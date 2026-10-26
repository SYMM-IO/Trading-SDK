import { encodeFunctionData, isAddressEqual, sliceHex, type Address, type Hash, type Hex } from "viem";
import type { Config } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import { symmioAbi } from "../../symmio-contracts/abi/v0.8.6/symmio";
import { getSubAccount } from "../../symmio-contracts/account-layer/actions/get-sub-account";
import { executeTimelockOp, type TimelockWriteParameters } from "../../symmio-contracts/account-layer/actions/timelock";
import {
  encodeInitiateWithdrawCall,
  type InitiateWithdrawParameters,
} from "../../symmio-contracts/symmio/actions/initiate-withdraw";
import {
  createHttpTimelockApprovalProvider,
  encodeTimelockedCoreCall,
  requestTimelockApproval,
  type TimelockApprovalProvider,
  type ValidatedTimelockApproval,
} from "../approval";
import { getTimelockPolicy, type GetTimelockPolicyParameters } from "../get-timelock-policy/get-timelock-policy";

/** Exact Core withdrawal variants. Amounts retain the deployed contract's raw units. */
export type EarlyWithdrawalCall =
  | { method: "withdraw"; amount: bigint }
  | { method: "withdrawTo"; recipient: Address; amount: bigint }
  | ({ method: "initiateWithdraw" } & Pick<InitiateWithdrawParameters, "parts" | "speedUp" | "providerData">);

/** Early-withdrawal inputs. Public approval signing and transaction execution have distinct wallet identities. */
export type EarlyWithdrawParameters = Omit<GetTimelockPolicyParameters, "selectors"> &
  TimelockWriteParameters & {
    withdrawal: EarlyWithdrawalCall;
    provider?: TimelockApprovalProvider;
    /** Optional delegated approval signer. `from` continues to select the execution wallet. */
    approvalSigner?: Address;
    /** Request expiry in Unix seconds, at most one hour ahead. */
    deadline: bigint;
    signal?: AbortSignal;
    /** Persist the one issued approval before execution. A persistence failure stops submission. */
    onApproval?: (approval: ValidatedTimelockApproval) => void | Promise<void>;
  };

/** Submitted transaction, not proof of withdrawal completion. Retain the approval for recovery. */
export interface EarlyWithdrawResult {
  hash: Hash;
  rootAccount: Address;
  callData: Hex;
  approval: ValidatedTimelockApproval;
}

/** Failure after issuance. Reuse/reconcile this approval; never automatically request another. */
export class EarlyWithdrawExecutionError extends Error {
  /** Present when submission returned a hash but receipt confirmation subsequently failed. */
  readonly hash?: Hash;
  readonly approval: ValidatedTimelockApproval;
  readonly callData: Hex;
  constructor(approval: ValidatedTimelockApproval, callData: Hex, cause: unknown, hash?: Hash) {
    super("Approval was issued but withdrawal submission did not complete. Reconcile before retrying.", { cause });
    this.approval = approval;
    this.callData = callData;
    this.hash = hash;
  }
}

function encodeWithdrawal(withdrawal: EarlyWithdrawalCall): Hex {
  switch (withdrawal.method) {
    case "withdraw":
      return encodeFunctionData({ abi: symmioAbi, functionName: "withdraw", args: [withdrawal.amount] });
    case "withdrawTo":
      return encodeFunctionData({
        abi: symmioAbi,
        functionName: "withdrawTo",
        args: [withdrawal.recipient, withdrawal.amount],
      });
    case "initiateWithdraw":
      return encodeInitiateWithdrawCall(withdrawal);
  }
}

/**
 * Request one approval and submit one Core withdrawal, retaining the original account inside `_call`.
 * @param config - Provider-neutral SDK config.
 * @param parameters - Raw-unit withdrawal, deployment/provider, signer and normal write controls.
 * @returns Transaction hash and issued approval. Confirm the receipt; Core cooldown/finalization still apply.
 * @remarks Omitted `gasless` inherits the SDK execution policy; explicit `false` selects wallet submission.
 * @example const submitted = await earlyWithdraw(config, { account, withdrawal: { method: "withdraw", amount }, deadline });
 */
export async function earlyWithdraw(config: Config, parameters: EarlyWithdrawParameters): Promise<EarlyWithdrawResult> {
  const callData = encodeWithdrawal(parameters.withdrawal);
  const policy = await getTimelockPolicy(config, { ...parameters, selectors: [sliceHex(callData, 0, 4)] });
  if (!policy.ready)
    throw new SymmError(
      "validation",
      "TIMELOCK_POLICY_REQUIRED",
      "Configure the withdrawal selector and wait for provider indexing before requesting approval.",
    );
  // Verify the wallet route before spending an approval slot. Relay authorization
  // remains in the existing shared dispatcher; no automatic delayed fallback.
  const owner = (await getSubAccount(config, { chainId: parameters.chainId, account: policy.rootAccount })).owner;
  const wallet = await config.getWalletClient({ chainId: parameters.chainId, from: parameters.from ?? owner });
  if (!isAddressEqual(wallet.account.address, owner))
    throw new SymmError("validation", "TIMELOCK_OWNER_REQUIRED", "The owner wallet must execute the early withdrawal.");
  if (wallet.chain?.id !== config.getChainConfig(parameters.chainId).chainId)
    throw new SymmError(
      "validation",
      "TIMELOCK_WALLET_CHAIN_MISMATCH",
      "Switch the execution wallet to the selected chain.",
    );
  const provider =
    parameters.provider ?? createHttpTimelockApprovalProvider({ baseUrl: config.getSolver(parameters).url });
  const approval = await requestTimelockApproval(config, {
    chainId: parameters.chainId,
    account: parameters.account,
    rootAccount: policy.rootAccount,
    capability: policy.capability,
    callData,
    deadline: parameters.deadline,
    from: parameters.approvalSigner ?? owner,
    provider,
    signal: parameters.signal,
  });
  try {
    await parameters.onApproval?.(approval);
    const hash = await executeTimelockOp(config, {
      ...parameters,
      from: owner,
      // Preserve the caller's option, including undefined, for the shared execution policy.
      gasless: parameters.gasless,
      account: policy.rootAccount,
      approvals: [approval.signedApproval],
      innerCallData: encodeTimelockedCoreCall(parameters.account, callData),
    });
    return { hash, rootAccount: policy.rootAccount, callData, approval };
  } catch (error) {
    throw new EarlyWithdrawExecutionError(approval, callData, error);
  }
}

/** One approval attempt only; even a global mutation retry default cannot repeat issuance. */
export function earlyWithdrawMutationOptions(config: Config) {
  return {
    mutationKey: ["earlyWithdraw"] as const,
    retry: false as const,
    mutationFn: (parameters: EarlyWithdrawParameters) => earlyWithdraw(config, parameters),
  };
}
