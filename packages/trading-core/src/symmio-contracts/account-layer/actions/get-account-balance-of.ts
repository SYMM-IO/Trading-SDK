import type { Address } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.6/symmio";

/**
 * Parameters for {@link getAccountBalanceOf}.
 */
export type GetAccountBalanceOfParameters = Compute<
  ChainIdParameter & {
    /** Account address passed to `balanceOf`. */
    account: Address;
  }
>;

/** Return type of {@link getAccountBalanceOf}: raw collateral token units. */
export type GetAccountBalanceOfReturnType = bigint;

/**
 * Read a SYMMIO account's raw deposited balance from `balanceOf`.
 *
 * Resolves the viem client and default SYMMIO core/diamond address from
 * `config`.
 *
 * @param config - The SDK config.
 * @param parameters - Account address and optional chain id.
 * @returns The raw `balanceOf(account)` value in collateral token units.
 * @throws {SymmError} when the chain is not supported.
 * @throws Viem's `ContractFunctionExecutionError` and friends for on-chain failures.
 *
 * @example
 * ```ts
 * const balance = await getAccountBalanceOf(config, { account });
 * ```
 */
export async function getAccountBalanceOf(
  config: Config,
  parameters: GetAccountBalanceOfParameters,
): Promise<GetAccountBalanceOfReturnType> {
  const { chainId, account } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  return client.readContract({
    address: addresses.symmioAddress,
    abi: symmioAbi,
    functionName: "balanceOf",
    args: [account],
  });
}
