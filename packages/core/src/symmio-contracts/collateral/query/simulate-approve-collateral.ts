import type { Config } from "../../../core/config";
import {
  simulateApproveCollateral,
  type SimulateApproveCollateralParameters,
} from "../actions/simulate-approve-collateral";

/**
 * Build TanStack Mutation options for {@link simulateApproveCollateral} — an on-demand dry-run
 * (`simulateContract`) of approveCollateral.
 *
 * @param config - The SDK config.
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(simulateApproveCollateralMutationOptions(config));
 * ```
 */
export function simulateApproveCollateralMutationOptions(config: Config) {
  return {
    mutationKey: ["simulateApproveCollateral"] as const,
    mutationFn: (variables: SimulateApproveCollateralParameters) => simulateApproveCollateral(config, variables),
  };
}
