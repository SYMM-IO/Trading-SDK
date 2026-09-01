import type { SimulateContractReturnType } from "viem";
import type { Config } from "../../../core/config";
import type { Compute, FromParameter } from "../../../shared/types/properties";
import { accountLayerAbi } from "../../abi/v0.8.6/account-layer";
import type { CreateSubAccountsParameters } from "./create-sub-accounts";

/**
 * Parameters for {@link simulateCreateSubAccounts}: the write's parameters plus
 * an optional `from` (the address the dry-run runs as).
 */
export type SimulateCreateSubAccountsParameters = Compute<CreateSubAccountsParameters & FromParameter>;

/**
 * Return type of {@link simulateCreateSubAccounts}: viem's `{ request, result }`.
 *
 * Written as an explicit alias over `SimulateContractReturnType<typeof accountLayerAbi, …>`
 * so the emitted declaration references the ABI by name instead of inlining the whole
 * ABI (which would bloat the published `.d.ts` and degrade consumers' type-checking).
 */
export type SimulateCreateSubAccountsReturnType = SimulateContractReturnType<
  typeof accountLayerAbi,
  "createSubAccounts"
>;

/**
 * Dry-run {@link createSubAccounts} without sending a transaction.
 *
 * Runs `simulateContract` against the AccountLayer using the **public client**,
 * so it never signs or broadcasts. A successful call returns the would-be created
 * subaccount addresses in `result`; a call that would revert throws viem's
 * `ContractFunctionExecutionError` (decode it with the React layer's
 * `normalizeSymmError`).
 *
 * @param config - The SDK config.
 * @param parameters - Affiliate, per-subaccount data, optional `from`, optional chain id.
 * @returns viem's `{ request, result }`; `result` is the predicted subaccount addresses.
 * @throws {SymmError} when the chain is unsupported.
 * @throws Viem's call errors when the transaction would revert.
 *
 * @example
 * ```ts
 * const { result } = await simulateCreateSubAccounts(config, {
 *   affiliate,
 *   accountsData: [{ name: "Main", metadata: "0x", symmioCore, isolationType, singleVAMode }],
 *   from: owner,
 * });
 * ```
 */
export async function simulateCreateSubAccounts(
  config: Config,
  parameters: SimulateCreateSubAccountsParameters,
): Promise<SimulateCreateSubAccountsReturnType> {
  const { chainId, affiliate, accountsData, from } = parameters;

  const { addresses } = config.getChainConfig(chainId);

  return config.getClient({ chainId }).simulateContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "createSubAccounts",
    args: [affiliate, accountsData],
    account: from,
  });
}
