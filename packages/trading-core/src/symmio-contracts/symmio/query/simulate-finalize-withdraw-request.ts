import type { Config } from "../../../core/config";
import {
  simulateFinalizeWithdrawRequest,
  type SimulateFinalizeWithdrawRequestParameters,
} from "../actions/simulate-finalize-withdraw-request";

/**
 * Build TanStack Mutation options for {@link simulateFinalizeWithdrawRequest} — an on-demand dry-run
 * (`simulateContract`) of finalizeWithdrawRequest.
 *
 * @param config - The SDK config.
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(simulateFinalizeWithdrawRequestMutationOptions(config));
 * ```
 */
export function simulateFinalizeWithdrawRequestMutationOptions(config: Config) {
  return {
    mutationKey: ["simulateFinalizeWithdrawRequest"] as const,
    mutationFn: (variables: SimulateFinalizeWithdrawRequestParameters) =>
      simulateFinalizeWithdrawRequest(config, variables),
  };
}
