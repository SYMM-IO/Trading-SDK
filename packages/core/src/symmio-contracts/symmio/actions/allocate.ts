import { encodeFunctionData, type Address, type Hash } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute, SimulateBeforeWriteParameter } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.5/symmio";
import { callAsSubAccount } from "../internal/call-as-sub-account";

/**
 * Parameters for {@link allocate}.
 */
export type AllocateParameters = Compute<
  ChainIdParameter &
    SimulateBeforeWriteParameter & {
      /**
       * The subaccount to allocate into. The call is routed through the
       * AccountLayer `_call` proxy; the connected wallet must be its on-chain `owner`.
       */
      account: Address;
      /**
       * Amount to move from the available balance into the allocated balance, in
       * **18 decimals** (not the collateral token's decimals). Capped by the
       * per-user balance limit.
       */
      amount: bigint;
    }
>;

/** Return type of {@link allocate}: the submitted transaction hash. */
export type AllocateReturnType = Hash;

/**
 * Move collateral from a subaccount's **available balance** into its **allocated
 * (tradeable) balance** on the SYMMIO core.
 *
 * Allocated balance is what Party A actually trades against. The subaccount's
 * available balance is debited and its allocated balance credited, in 18-decimal
 * units, capped by the per-user balance limit. The subaccount must not be
 * suspended or currently in liquidation as Party A.
 *
 * Encodes the SYMMIO core `allocate(amount)` call and routes it through
 * `AccountLayer._call(account, …)` so the core attributes it to the subaccount.
 *
 * Dry-runs the call with {@link simulateAllocate} first unless `simulateBeforeWrite`
 * is `false` (per-call, falling back to the config default).
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - Subaccount, amount (18 decimals), optional chain id.
 * @returns The submitted transaction hash. The caller waits on the receipt.
 * @throws {SymmError} when the chain is unsupported or no wallet is available.
 * @throws Viem's write errors (`ContractFunctionExecutionError`, ...).
 *
 * @example
 * ```ts
 * const hash = await allocate(config, { account: "0xsub…", amount: 1_000000000000000000n });
 * ```
 */
export async function allocate(config: Config, parameters: AllocateParameters): Promise<AllocateReturnType> {
  const { chainId, account, amount } = parameters;

  const data = encodeFunctionData({
    abi: symmioAbi,
    functionName: "allocate",
    args: [amount],
  });

  return callAsSubAccount(config, {
    account,
    data,
    chainId,
    simulateBeforeWrite: parameters.simulateBeforeWrite,
  });
}
