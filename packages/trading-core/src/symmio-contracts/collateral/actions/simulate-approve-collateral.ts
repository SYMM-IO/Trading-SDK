import { erc20Abi, type SimulateContractReturnType } from "viem";
import type { Config } from "../../../core/config";
import type { Compute, FromParameter } from "../../../shared/types/properties";
import type { ApproveCollateralParameters } from "./approve-collateral";

/**
 * Parameters for {@link simulateApproveCollateral}: the write's parameters plus
 * an optional `from` (the address the dry-run runs as).
 */
export type SimulateApproveCollateralParameters = Compute<ApproveCollateralParameters & FromParameter>;

/**
 * Return type of {@link simulateApproveCollateral}: viem's `{ request, result }`.
 *
 * Written as an explicit alias over `SimulateContractReturnType<typeof erc20Abi, …>`
 * so the emitted declaration references the ABI by name instead of inlining the whole
 * ABI (which would bloat the published `.d.ts` and degrade consumers' type-checking).
 */
export type SimulateApproveCollateralReturnType = SimulateContractReturnType<typeof erc20Abi, "approve">;

/**
 * Dry-run {@link approveCollateral} without sending a transaction. Runs
 * `simulateContract` (ERC20 `approve`) against the collateral token via the
 * public client; a would-be revert throws viem's call error.
 *
 * @param config - The SDK config.
 * @param parameters - Allowance amount, optional `from`, optional chain id.
 * @returns viem's `{ request, result }` (`result` is the `approve` boolean).
 * @throws {SymmError} when the chain is unsupported.
 * @throws Viem's call errors when the transaction would revert.
 */
export async function simulateApproveCollateral(
  config: Config,
  parameters: SimulateApproveCollateralParameters,
): Promise<SimulateApproveCollateralReturnType> {
  const { chainId, amount, from } = parameters;

  const { addresses } = config.getChainConfig(chainId);

  return config.getClient({ chainId }).simulateContract({
    address: addresses.collateralAddress,
    abi: erc20Abi,
    functionName: "approve",
    args: [addresses.symmioAddress, amount],
    account: from,
  });
}
