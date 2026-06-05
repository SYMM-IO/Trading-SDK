import type { Config } from "../../../core/config";
import { approveCollateral, type ApproveCollateralParameters } from "../actions/approve-collateral";

/**
 * Build TanStack Mutation options for {@link approveCollateral}.
 *
 * The returned `mutationFn` takes the action's parameters and forwards them to
 * `approveCollateral(config, …)`. Framework layers compose `onSuccess`
 * invalidation (e.g. of `getCollateralAllowance`) and error normalization on top.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(approveCollateralMutationOptions(config));
 * ```
 */
export function approveCollateralMutationOptions(config: Config) {
  return {
    mutationKey: ["approveCollateral"] as const,
    mutationFn: (variables: ApproveCollateralParameters) => approveCollateral(config, variables),
  };
}
