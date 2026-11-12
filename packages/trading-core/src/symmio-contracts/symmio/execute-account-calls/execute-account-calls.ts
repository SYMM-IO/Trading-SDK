import { encodeFunctionData, type Abi, type Address, type Hash } from "viem";
import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, GaslessWriteParameter, WriteContractParameter } from "../../../shared/types/properties";
import { executeProtectedCoreBatch, type TimelockBatchAuthorization } from "../../../timelock/execute-protected-batch";
import { symmioAbi } from "../../abi/v0.8.6/symmio";
import { callAsSubAccount } from "../internal/call-as-sub-account";

/** A named SYMMIO core write, encoded and executed as a subaccount. */
export interface AccountContractCall {
  /** Name of a payable or nonpayable function in the SDK's SYMMIO ABI. */
  functionName: string;
  /** Contract arguments in order; amounts retain the named function's units. */
  args?: readonly unknown[];
}

/** Parameters for {@link executeAccountCalls}. */
export type ExecuteAccountCallsParameters = Compute<
  WriteContractParameter &
    GaslessWriteParameter & {
      /** Subaccount whose owner or delegated gasless signer authorizes the calls. */
      account: Address;
      /** Nonempty ordered list of core writes. Each call executes as the same subaccount. */
      calls: readonly AccountContractCall[];
      /** Optional per-call authorizations for an atomic protected Core batch. */
      timelock?: TimelockBatchAuthorization;
    }
>;

/** Transaction hash returned by {@link executeAccountCalls}; wait for its receipt before refreshing reads. */
export type ExecuteAccountCallsReturnType = Hash;

/**
 * Execute named SYMMIO core writes atomically as one subaccount.
 *
 * Wallet execution uses one AccountLayer `_call(account, callDatas)` transaction,
 * simulated by default. Gasless execution uses the existing dispatcher and its
 * relayable-selector restrictions. This action never invents a wallet fallback.
 * Arguments are encoded before any wallet resolution; the SDK does not infer
 * request IDs or feed a call's return value into a later call.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - Subaccount, ordered calls, optional chain id, signer and execution overrides.
 * @returns The submitted transaction hash. The caller waits on the receipt.
 * @throws {SymmError} for empty calls, unknown or read-only functions, an unsupported chain, no available wallet, or unsupported execution.
 * @throws Viem's encoding and write errors (`ContractFunctionExecutionError`, ...).
 *
 * @example
 * ```ts
 * const hash = await executeAccountCalls(config, {
 *   account,
 *   calls: [{ functionName: "allocate", args: [amount18] }],
 *   gasless: false,
 * });
 * ```
 */
export async function executeAccountCalls(
  config: Config,
  parameters: ExecuteAccountCallsParameters,
): Promise<ExecuteAccountCallsReturnType> {
  const { calls, ...execution } = parameters;

  if (calls.length === 0) {
    throw new SymmError("validation", "EMPTY_ACCOUNT_CALLS", "executeAccountCalls requires at least one core write.");
  }

  const data = calls.map((call) => {
    if (!isCoreWrite(call.functionName)) {
      throw new SymmError("validation", "INVALID_ACCOUNT_CALL", `Unknown SYMMIO core write: ${call.functionName}.`);
    }
    return encodeFunctionData({ abi: symmioAbi as Abi, functionName: call.functionName, args: call.args });
  });

  if (execution.timelock)
    return executeProtectedCoreBatch(config, { ...execution, callDatas: data, timelock: execution.timelock });

  return callAsSubAccount(config, { ...execution, data });
}

/** Whether `functionName` is a payable or nonpayable function in the SYMMIO core ABI. */
function isCoreWrite(functionName: string) {
  return symmioAbi.some(
    (item) =>
      item.type === "function" &&
      item.name === functionName &&
      ["nonpayable", "payable"].includes(item.stateMutability),
  );
}
