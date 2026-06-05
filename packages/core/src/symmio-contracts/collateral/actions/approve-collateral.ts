import { erc20Abi, type Hash } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";

/**
 * Parameters for {@link approveCollateral}.
 */
export type ApproveCollateralParameters = Compute<
  ChainIdParameter & {
    /**
     * Allowance to grant, in the collateral token's smallest unit (e.g.
     * `1_000000n` for 1 USDC at 6 decimals). Pass `maxUint256` to approve once and
     * skip future approvals.
     */
    amount: bigint;
  }
>;

/** Return type of {@link approveCollateral}: the submitted transaction hash. */
export type ApproveCollateralReturnType = Hash;

/**
 * Approve the chain's collateral token (e.g. USDC) for spending by the **SYMMIO
 * core** (`symmioAddress`).
 *
 * The core is the contract that pulls collateral from the user during
 * `depositForAccount` / `depositAndAllocateForAccount`, so the deposit reverts
 * unless the user has approved at least the deposit amount here first. Check the
 * current allowance with `getCollateralAllowance`.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - Allowance amount (collateral units), optional chain id.
 * @returns The submitted transaction hash. The caller waits on the receipt.
 * @throws {SymmError} when the chain is unsupported or no wallet is available.
 * @throws Viem's write errors (`ContractFunctionExecutionError`, ...).
 *
 * @example
 * ```ts
 * import { maxUint256 } from "viem";
 * const hash = await approveCollateral(config, { amount: maxUint256 });
 * ```
 */
export async function approveCollateral(
  config: Config,
  parameters: ApproveCollateralParameters,
): Promise<ApproveCollateralReturnType> {
  const { chainId, amount } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const walletClient = await config.getWalletClient({ chainId });

  return walletClient.writeContract({
    address: addresses.collateralAddress,
    abi: erc20Abi,
    functionName: "approve",
    args: [addresses.symmioAddress, amount],
    account: walletClient.account,
    chain: walletClient.chain,
  });
}
