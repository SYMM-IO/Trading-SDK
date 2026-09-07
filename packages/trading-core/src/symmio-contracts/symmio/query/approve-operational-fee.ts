import type { Config } from "../../../core/config";
import { approveOperationalFee, type ApproveOperationalFeeParameters } from "../actions/approve-operational-fee";

/**
 * Build TanStack Mutation options for {@link approveOperationalFee}.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(approveOperationalFeeMutationOptions(config));
 * ```
 */
export function approveOperationalFeeMutationOptions(config: Config) {
  return {
    mutationKey: ["approveOperationalFee"] as const,
    mutationFn: (variables: ApproveOperationalFeeParameters) => approveOperationalFee(config, variables),
  };
}
