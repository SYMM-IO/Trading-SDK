import type { Config } from "../../core/config";
import {
  relayGaslessBatch,
  type RelayGaslessBatchParameters,
  type RelayGaslessBatchReturnType,
} from "./relay-gasless-batch";

/**
 * Build TanStack Mutation options for {@link relayGaslessBatch}.
 *
 * @param config - The SDK config.
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(relayGaslessBatchMutationOptions(config));
 * ```
 */
export function relayGaslessBatchMutationOptions(config: Config) {
  return {
    mutationKey: ["relayGaslessBatch"] as const,
    mutationFn: (variables: RelayGaslessBatchParameters): Promise<RelayGaslessBatchReturnType> =>
      relayGaslessBatch(config, variables),
  };
}
