import type { Config } from "../../../core/config";
import {
  approveOperationalFeeAllowance,
  type ApproveOperationalFeeAllowanceParameters,
} from "../actions/approve-operational-fee-allowance";

/**
 * Build TanStack Mutation options for {@link approveOperationalFeeAllowance}.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(approveOperationalFeeAllowanceMutationOptions(config));
 * ```
 */
export function approveOperationalFeeAllowanceMutationOptions(config: Config) {
  return {
    mutationKey: ["approveOperationalFeeAllowance"] as const,
    mutationFn: (variables: ApproveOperationalFeeAllowanceParameters) =>
      approveOperationalFeeAllowance(config, variables),
  };
}
