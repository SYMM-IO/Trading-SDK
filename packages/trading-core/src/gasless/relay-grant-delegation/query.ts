import type { Config } from "../../core/config";
import {
  relayGrantDelegation,
  type RelayGrantDelegationParameters,
  type RelayGrantDelegationReturnType,
} from "./relay-grant-delegation";

/**
 * Build TanStack Mutation options for {@link relayGrantDelegation}.
 *
 * @param config - The SDK config.
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(relayGrantDelegationMutationOptions(config));
 * ```
 */
export function relayGrantDelegationMutationOptions(config: Config) {
  return {
    mutationKey: ["relayGrantDelegation"] as const,
    mutationFn: (variables: RelayGrantDelegationParameters): Promise<RelayGrantDelegationReturnType> =>
      relayGrantDelegation(config, variables),
  };
}
