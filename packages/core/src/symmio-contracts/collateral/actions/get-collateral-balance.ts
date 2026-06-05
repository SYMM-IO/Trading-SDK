import { erc20Abi, type Address } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";

/**
 * Parameters for {@link getCollateralBalance}.
 */
export type GetCollateralBalanceParameters = Compute<
  ChainIdParameter & {
    /** Address whose collateral-token balance to read (usually the connected EOA). */
    owner: Address;
  }
>;

/**
 * Return type of {@link getCollateralBalance}: the wallet balance in the
 * collateral token's smallest unit.
 */
export type GetCollateralBalanceReturnType = bigint;

/**
 * Read `owner`'s wallet balance of the chain's collateral token (e.g. USDC).
 *
 * This is the on-chain ERC20 balance held by the EOA — the funds available to
 * deposit — not a SYMMIO subaccount balance.
 *
 * @param config - The SDK config.
 * @param parameters - Token owner, optional chain id.
 * @returns The wallet balance, in collateral units.
 * @throws {SymmError} when the chain is not supported.
 * @throws Viem's `ContractFunctionExecutionError` and friends for on-chain failures.
 *
 * @example
 * ```ts
 * const balance = await getCollateralBalance(config, { owner: "0xabc…" });
 * ```
 */
export async function getCollateralBalance(
  config: Config,
  parameters: GetCollateralBalanceParameters,
): Promise<GetCollateralBalanceReturnType> {
  const { chainId, owner } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  return client.readContract({
    address: addresses.collateralAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [owner],
  });
}
