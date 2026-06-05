import { erc20Abi, type Address } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";

/**
 * Parameters for {@link getCollateralAllowance}.
 */
export type GetCollateralAllowanceParameters = Compute<
  ChainIdParameter & {
    /** Token owner whose allowance to the SYMMIO core is read (usually the connected EOA). */
    owner: Address;
  }
>;

/**
 * Return type of {@link getCollateralAllowance}: the approved amount in the
 * collateral token's smallest unit.
 */
export type GetCollateralAllowanceReturnType = bigint;

/**
 * Read how much collateral `owner` has approved the **SYMMIO core**
 * (`symmioAddress`) to spend.
 *
 * Use this before a deposit to decide whether an `approveCollateral` call is
 * needed: the deposit succeeds only when the allowance covers the deposit amount.
 *
 * @param config - The SDK config.
 * @param parameters - Token owner, optional chain id.
 * @returns The current allowance, in collateral units.
 * @throws {SymmError} when the chain is not supported.
 * @throws Viem's `ContractFunctionExecutionError` and friends for on-chain failures.
 *
 * @example
 * ```ts
 * const allowance = await getCollateralAllowance(config, { owner: "0xabc…" });
 * const needsApproval = allowance < depositAmount;
 * ```
 */
export async function getCollateralAllowance(
  config: Config,
  parameters: GetCollateralAllowanceParameters,
): Promise<GetCollateralAllowanceReturnType> {
  const { chainId, owner } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  return client.readContract({
    address: addresses.collateralAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, addresses.symmioAddress],
  });
}
