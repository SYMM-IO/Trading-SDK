import type { Config } from "../../core/config";
import {
  resubmitGaslessRequest,
  type ResubmitGaslessRequestParameters,
  type ResubmitGaslessRequestReturnType,
} from "./resubmit-gasless-request";

/**
 * Build TanStack Mutation options for {@link resubmitGaslessRequest}.
 *
 * @param config - The SDK config.
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * const resubmit = useMutation(resubmitGaslessRequestMutationOptions(config));
 * resubmit.mutate(pendingSubmit);
 * ```
 */
export function resubmitGaslessRequestMutationOptions(config: Config) {
  return {
    mutationKey: ["resubmitGaslessRequest"] as const,
    mutationFn: (variables: ResubmitGaslessRequestParameters): Promise<ResubmitGaslessRequestReturnType> =>
      resubmitGaslessRequest(config, variables),
  };
}
