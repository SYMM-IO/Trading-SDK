import { isAddressEqual, keccak256, sliceHex, zeroAddress, type Address, type Hash, type Hex } from "viem";
import type { Config } from "../core/config";
import { SymmError } from "../shared/errors/symm-error";
import type { GaslessWriteParameter, WriteContractParameter } from "../shared/types/properties";
import { getSubAccount } from "../symmio-contracts/account-layer/actions/get-sub-account";
import {
  executeTimelockOp,
  getSelectorTimelock,
  resolveTimelockRootAccount,
} from "../symmio-contracts/account-layer/actions/timelock";
import type { SignedTimelockApproval } from "../symmio-contracts/account-layer/types";
import { getIsDelegationActive } from "../symmio-contracts/instant-layer/actions/get-is-delegation-active";
import {
  encodeTimelockedCoreCall,
  requestTimelockApproval,
  type TimelockApprovalCapability,
  type TimelockApprovalProvider,
  type ValidatedTimelockApproval,
} from "./approval";

/** Optional one-attempt authorization for a protected operation. Create a new object for a deliberate new attempt. */
export type TimelockAuthorization =
  | { approval: SignedTimelockApproval }
  | {
      capability: TimelockApprovalCapability;
      provider: TimelockApprovalProvider;
      deadline: bigint;
      approvalSigner?: Address;
      signal?: AbortSignal;
      /** Persist the approval before submission. Throwing prevents submission. */
      onApproval?: (approval: ValidatedTimelockApproval) => void | Promise<void>;
    };

/** An issued approval is retained when its transaction could not be submitted. */
export class TimelockExecutionError extends Error {
  readonly approval: SignedTimelockApproval;
  readonly callData: Hex;
  readonly hash?: Hash;
  constructor(approval: SignedTimelockApproval, callData: Hex, cause: unknown, hash?: Hash) {
    super("A timelock approval was issued but execution did not complete. Reconcile it before retrying.", { cause });
    this.approval = approval;
    this.callData = callData;
    this.hash = hash;
  }
}

// A mutation retry receives the same variables object. Reusing this one-shot
// authorization must never issue a second approval or resubmit an unknown write.
type Attempt =
  | { status: "pending" }
  | { status: "failed"; error: unknown }
  | { status: "submitted"; approval: SignedTimelockApproval; callData: Hex; hash: Hash };
const attempts = new WeakMap<TimelockAuthorization, Attempt>();

/** Return the approval and submitted transaction for a one-attempt authorization, when available. */
export function getTimelockExecutionRecovery(
  authorization: TimelockAuthorization,
): { approval: SignedTimelockApproval; callData: Hex; hash: Hash } | undefined {
  const attempt = attempts.get(authorization);
  return attempt?.status === "submitted"
    ? { approval: attempt.approval, callData: attempt.callData, hash: attempt.hash }
    : undefined;
}

/** @internal Check that a caller-owned authorization has not been attempted. */
export function assertTimelockAuthorizationUnused(authorization: TimelockAuthorization): void {
  const attempt = attempts.get(authorization);
  if (!attempt) return;
  if (attempt.status === "failed") throw attempt.error;
  if (attempt.status === "submitted")
    throw new TimelockExecutionError(
      attempt.approval,
      attempt.callData,
      new Error("A transaction has already been submitted; reconcile its receipt."),
      attempt.hash,
    );
  throw new SymmError("validation", "TIMELOCK_REQUEST_IN_PROGRESS", "This authorization is already being processed.");
}

/** @internal Reserve synchronously after checking all authorizations. */
export function reserveTimelockAuthorization(authorization: TimelockAuthorization): void {
  assertTimelockAuthorizationUnused(authorization);
  attempts.set(authorization, { status: "pending" });
}

/** @internal Preserve a failed attempt across automatic retries. */
export function failTimelockAuthorization(authorization: TimelockAuthorization, error: unknown): void {
  attempts.set(authorization, { status: "failed", error });
}

/** @internal Record a submitted transaction for receipt reconciliation. */
export function submitTimelockAuthorization(
  authorization: TimelockAuthorization,
  approval: SignedTimelockApproval,
  callData: Hex,
  hash: Hash,
): void {
  attempts.set(authorization, { status: "submitted", approval, callData, hash });
}

/** @internal Verify delegated gasless execution before consuming an approval slot. */
export async function assertProtectedGaslessDelegation(
  config: Config,
  parameters: {
    chainId?: number;
    root: Address;
    signer: Address;
    selector: Hex;
    gasless: GaslessWriteParameter["gasless"];
  },
): Promise<void> {
  const chainId = config.getChainConfig(parameters.chainId).chainId;
  const signerAccount =
    typeof parameters.gasless === "object" ? (parameters.gasless.account ?? parameters.root) : parameters.root;
  if (!isAddressEqual(signerAccount, parameters.root))
    throw new SymmError(
      "validation",
      "TIMELOCK_GASLESS_ACCOUNT_MISMATCH",
      "A delegated protected operation must execute under its root account.",
    );
  const active = await getIsDelegationActive(config, {
    chainId,
    account: signerAccount,
    delegate: parameters.signer,
    selector: parameters.selector,
  });
  if (!active)
    throw new SymmError(
      "validation",
      "GASLESS_SIGNER_NOT_DELEGATED",
      `The signer lacks delegation for ${parameters.selector}.`,
    );
}

/** Inputs for a single explicitly authorized Core or AccountLayer operation. */
export type ExecuteProtectedCallParameters = WriteContractParameter &
  GaslessWriteParameter & {
    account: Address;
    callData: Hex;
    target: "core" | "account-layer";
    timelock: TimelockAuthorization;
  };

/**
 * Execute one exact protected call. The caller chooses its provider and raw calldata.
 * Core calls retain the original account inside the AccountLayer wrapper.
 * @param config - SDK configuration and injected clients.
 * @param parameters - Account, raw calldata, target and one-attempt authorization.
 * @returns Submitted transaction hash; wait for the receipt to confirm execution.
 */
export async function executeProtectedCall(config: Config, parameters: ExecuteProtectedCallParameters): Promise<Hash> {
  const { account, chainId, callData, timelock } = parameters;
  assertTimelockAuthorizationUnused(timelock);
  const root = await resolveTimelockRootAccount(config, { account, chainId });
  const policy = await getSelectorTimelock(config, { account: root, chainId, selector: sliceHex(callData, 0, 4) });
  if (parameters.target === "core") {
    const wrapper = encodeTimelockedCoreCall(account, callData);
    const outer = await getSelectorTimelock(config, { account: root, chainId, selector: sliceHex(wrapper, 0, 4) });
    if (!isAddressEqual(outer.unlocker, zeroAddress))
      throw new SymmError(
        "validation",
        "TIMELOCK_OUTER_CALL_UNSUPPORTED",
        "The outer _call selector is timelocked; it requires separate authorization.",
      );
  }
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
  if (delegated)
    await assertProtectedGaslessDelegation(config, {
      chainId,
      root,
      signer: wallet.account.address,
      selector: sliceHex(parameters.target === "core" ? encodeTimelockedCoreCall(account, callData) : callData, 0, 4),
      gasless: parameters.gasless,
    });

  // Check again after the asynchronous reads to exclude concurrent attempts.
  reserveTimelockAuthorization(timelock);

  try {
    let approval: SignedTimelockApproval;
    let issued: ValidatedTimelockApproval | undefined;
    if ("approval" in timelock) {
      approval = timelock.approval;
      if (
        !isAddressEqual(approval.approval.account, root) ||
        !isAddressEqual(approval.approval.unlocker, policy.unlocker) ||
        approval.approval.callDataHash.toLowerCase() !== keccak256(callData).toLowerCase()
      )
        throw new SymmError(
          "validation",
          "TIMELOCK_APPROVAL_MISMATCH",
          "The approval does not match this account, unlocker, or operation.",
        );
    } else {
      if (!isAddressEqual(policy.unlocker, timelock.capability.unlocker))
        throw new SymmError(
          "validation",
          "TIMELOCK_UNLOCKER_MISMATCH",
          "The configured selector unlocker does not match the approval provider.",
        );
      issued = await requestTimelockApproval(config, {
        chainId,
        account,
        rootAccount: root,
        callData,
        capability: timelock.capability,
        provider: timelock.provider,
        deadline: timelock.deadline,
        from: timelock.approvalSigner ?? owner,
        signal: timelock.signal,
      });
      approval = issued.signedApproval;
    }
    try {
      if (issued && "onApproval" in timelock) await timelock.onApproval?.(issued);
      const hash = await executeTimelockOp(config, {
        account: root,
        chainId,
        from: parameters.from ?? owner,
        gasless: delegated
          ? { ...(typeof parameters.gasless === "object" ? parameters.gasless : {}), enabled: true, fallback: "error" }
          : parameters.gasless,
        simulateBeforeWrite: parameters.simulateBeforeWrite,
        approvals: [approval],
        innerCallData: parameters.target === "core" ? encodeTimelockedCoreCall(account, callData) : callData,
      });
      submitTimelockAuthorization(timelock, approval, callData, hash);
      return hash;
    } catch (error) {
      throw new TimelockExecutionError(approval, callData, error);
    }
  } catch (error) {
    failTimelockAuthorization(timelock, error);
    throw error;
  }
}

/** TanStack mutation options with automatic retries disabled. */
export function executeProtectedCallMutationOptions(config: Config) {
  return {
    mutationKey: ["executeProtectedCall"] as const,
    retry: false as const,
    mutationFn: (parameters: ExecuteProtectedCallParameters) => executeProtectedCall(config, parameters),
  };
}
