import type { Config } from "../../core/config";
import {
  relayInstantOperations,
  type RelayInstantOperationsParameters,
  type RelayInstantOperationsReturnType,
} from "./relay-instant-operations";

/**
 * Build TanStack Mutation options for {@link relayInstantOperations}.
 *
 * @param config - The SDK config.
 * @returns Options to pass to `useMutation` / `queryClient.getMutationCache`.
 *
 * @example
 * ```ts
 * useMutation(relayInstantOperationsMutationOptions(config));
 * ```
 */
export function relayInstantOperationsMutationOptions(config: Config) {
  return {
    mutationKey: ["relayInstantOperations"] as const,
    mutationFn: (variables: RelayInstantOperationsParameters): Promise<RelayInstantOperationsReturnType> =>
      relayInstantOperations(config, variables),
  };
}
