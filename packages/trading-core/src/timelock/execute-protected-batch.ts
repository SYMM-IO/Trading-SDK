import {
  encodeFunctionData,
  isAddressEqual,
  keccak256,
  sliceHex,
  zeroAddress,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import type { Config } from "../core/config";
import { SymmError } from "../shared/errors/symm-error";
import type { GaslessWriteParameter, WriteContractParameter } from "../shared/types/properties";
import { accountLayerAbi } from "../symmio-contracts/abi/v0.8.6/account-layer";
import { getSubAccount } from "../symmio-contracts/account-layer/actions/get-sub-account";
import {
  executeTimelockOp,
  getSelectorTimelock,
  resolveTimelockRootAccount,
} from "../symmio-contracts/account-layer/actions/timelock";
import type { SignedTimelockApproval } from "../symmio-contracts/account-layer/types";
import { requestTimelockApproval } from "./approval";
import {
  assertProtectedGaslessDelegation,
  assertTimelockAuthorizationUnused,
  failTimelockAuthorization,
  reserveTimelockAuthorization,
  submitTimelockAuthorization,
  type TimelockAuthorization,
} from "./execute-protected-call";

/** Exact per-call authorizations for an atomic batch. Use a fresh object for each attempt. */
export interface TimelockBatchAuthorization {
  calls: readonly (TimelockAuthorization | undefined)[];
}

/** A partially authorized or submitted batch, retained for reconciliation. */
export class TimelockBatchExecutionError extends Error {
  constructor(
    readonly approvals: readonly SignedTimelockApproval[],
    readonly callDatas: readonly Hex[],
    cause: unknown,
    readonly hash?: Hash,
  ) {
    super("The protected batch did not complete; reconcile its approvals and transaction before retrying.", { cause });
  }
}

type BatchAttempt =
  | { status: "pending" }
  | { status: "failed"; error: unknown }
  | { status: "submitted"; approvals: readonly SignedTimelockApproval[]; callDatas: readonly Hex[]; hash: Hash };
const batchAttempts = new WeakMap<TimelockBatchAuthorization, BatchAttempt>();

/** Reject re-entry before fetching any short-lived inputs. @internal */
export function assertTimelockBatchUnused(timelock: TimelockBatchAuthorization): void {
  const previous = batchAttempts.get(timelock);
  if (previous?.status === "failed") throw previous.error;
  if (previous?.status === "submitted")
    throw new TimelockBatchExecutionError(
      previous.approvals,
      previous.callDatas,
      new Error("Transaction already submitted; reconcile its receipt."),
      previous.hash,
    );
  if (previous)
    throw new SymmError(
      "validation",
      "TIMELOCK_REQUEST_IN_PROGRESS",
      "This batch authorization is already being processed.",
    );
}

/** Return a submitted batch's approvals, calldata and transaction hash for receipt recovery. */
export function getTimelockBatchRecovery(
  authorization: TimelockBatchAuthorization,
): { approvals: readonly SignedTimelockApproval[]; callDatas: readonly Hex[]; hash: Hash } | undefined {
  const attempt = batchAttempts.get(authorization);
  return attempt?.status === "submitted"
    ? { approvals: attempt.approvals, callDatas: attempt.callDatas, hash: attempt.hash }
    : undefined;
}

/** @internal Authorize each protected Core call and submit one atomic AccountLayer batch. */
export async function executeProtectedCoreBatch(
  config: Config,
  parameters: WriteContractParameter &
    GaslessWriteParameter & {
      account: Address;
      callDatas: readonly Hex[];
      timelock: TimelockBatchAuthorization;
    },
): Promise<Hash> {
  const { account, chainId, timelock } = parameters;
  const callDatas = [...parameters.callDatas];
  const authorizations = [...timelock.calls];
  assertTimelockBatchUnused(timelock);
  if (callDatas.length !== authorizations.length || callDatas.length === 0)
    throw new SymmError(
      "validation",
      "TIMELOCK_BATCH_MISMATCH",
      "Provide one authorization entry for each batch call.",
    );
  const root = await resolveTimelockRootAccount(config, { account, chainId });
  const owner = (await getSubAccount(config, { account: root, chainId })).owner;
  const wallet = await config.getWalletClient({ chainId, from: parameters.from ?? owner });
  const delegated = !isAddressEqual(wallet.account.address, owner);
  if (delegated) {
    const gasless = typeof parameters.gasless === "boolean" ? { enabled: parameters.gasless } : parameters.gasless;
    if (gasless?.enabled !== true || gasless.fallback === "wallet")
      throw new SymmError(
        "validation",
        "TIMELOCK_OWNER_REQUIRED",
        "A delegated signer requires explicit gasless execution without wallet fallback.",
      );
  }
  if (wallet.chain?.id !== config.getChainConfig(chainId).chainId)
    throw new SymmError(
      "validation",
      "TIMELOCK_WALLET_CHAIN_MISMATCH",
      "Switch the execution wallet to the selected chain.",
    );
  const policies = await Promise.all(
    callDatas.map((data) => getSelectorTimelock(config, { account: root, chainId, selector: sliceHex(data, 0, 4) })),
  );
  const innerCallData = encodeFunctionData({ abi: accountLayerAbi, functionName: "_call", args: [account, callDatas] });
  if (delegated)
    await assertProtectedGaslessDelegation(config, {
      chainId,
      root,
      signer: wallet.account.address,
      selector: sliceHex(innerCallData, 0, 4),
      gasless: parameters.gasless,
    });
  const outerPolicy = await getSelectorTimelock(config, {
    account: root,
    chainId,
    selector: sliceHex(innerCallData, 0, 4),
  });
  if (!isAddressEqual(outerPolicy.unlocker, zeroAddress))
    throw new SymmError(
      "validation",
      "TIMELOCK_BATCH_OUTER_UNSUPPORTED",
      "The outer _call selector is timelocked; authorize it separately before requesting batch approvals.",
    );
  for (let i = 0; i < callDatas.length; i++) {
    const policy = policies[i]!;
    const authorization = authorizations[i];
    if (isAddressEqual(policy.unlocker, zeroAddress)) {
      if (authorization)
        throw new SymmError(
          "validation",
          "TIMELOCK_BATCH_MISMATCH",
          "Do not provide an approval for an unlocked call.",
        );
      continue;
    }
    if (!authorization)
      throw new SymmError(
        "validation",
        "TIMELOCK_APPROVAL_REQUIRED",
        "Every locked batch call requires its own authorization.",
      );
    if ("approval" in authorization) {
      const approval = authorization.approval.approval;
      if (
        !isAddressEqual(approval.account, root) ||
        !isAddressEqual(approval.unlocker, policy.unlocker) ||
        approval.callDataHash.toLowerCase() !== keccak256(callDatas[i]!).toLowerCase()
      )
        throw new SymmError("validation", "TIMELOCK_APPROVAL_MISMATCH", "The approval does not match its batch call.");
    } else if (!isAddressEqual(authorization.capability.unlocker, policy.unlocker)) {
      throw new SymmError(
        "validation",
        "TIMELOCK_UNLOCKER_MISMATCH",
        "The configured selector unlocker does not match the approval provider.",
      );
    }
  }
  if (batchAttempts.has(timelock))
    throw new SymmError(
      "validation",
      "TIMELOCK_REQUEST_IN_PROGRESS",
      "This batch authorization is already being processed.",
    );
  const present = authorizations.filter((item): item is TimelockAuthorization => item !== undefined);
  if (new Set(present).size !== present.length)
    throw new SymmError(
      "validation",
      "TIMELOCK_BATCH_MISMATCH",
      "Use a distinct authorization object for each batch call.",
    );
  for (const authorization of present) assertTimelockAuthorizationUnused(authorization);
  for (const authorization of present) reserveTimelockAuthorization(authorization);
  batchAttempts.set(timelock, { status: "pending" });
  const approvals: SignedTimelockApproval[] = [];
  try {
    for (let i = 0; i < callDatas.length; i++) {
      const authorization = authorizations[i];
      if (!authorization) continue;
      if ("approval" in authorization) {
        approvals.push(authorization.approval);
      } else {
        const issued = await requestTimelockApproval(config, {
          chainId,
          account,
          rootAccount: root,
          callData: callDatas[i]!,
          capability: authorization.capability,
          provider: authorization.provider,
          deadline: authorization.deadline,
          from: authorization.approvalSigner ?? owner,
          signal: authorization.signal,
        });
        approvals.push(issued.signedApproval);
        await authorization.onApproval?.(issued);
      }
    }
    const hash = await executeTimelockOp(config, {
      account: root,
      chainId,
      from: parameters.from ?? owner,
      gasless: delegated
        ? { ...(typeof parameters.gasless === "object" ? parameters.gasless : {}), enabled: true, fallback: "error" }
        : parameters.gasless,
      simulateBeforeWrite: parameters.simulateBeforeWrite,
      approvals,
      innerCallData,
    });
    batchAttempts.set(timelock, { status: "submitted", approvals, callDatas, hash });
    let approvalIndex = 0;
    for (let i = 0; i < authorizations.length; i++) {
      const authorization = authorizations[i];
      if (authorization) submitTimelockAuthorization(authorization, approvals[approvalIndex++]!, callDatas[i]!, hash);
    }
    return hash;
  } catch (error) {
    const failure = approvals.length ? new TimelockBatchExecutionError(approvals, callDatas, error) : error;
    batchAttempts.set(timelock, { status: "failed", error: failure });
    for (const authorization of present) failTimelockAuthorization(authorization, failure);
    throw failure;
  }
}
