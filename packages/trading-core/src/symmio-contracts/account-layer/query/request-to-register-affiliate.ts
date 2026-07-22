import type { Config } from "../../../core/config";
import {
  requestToRegisterAffiliate,
  type RequestToRegisterAffiliateParameters,
} from "../actions/request-to-register-affiliate";

/**
 * Build TanStack Mutation options for {@link requestToRegisterAffiliate}.
 *
 * The returned `mutationFn` takes the action's parameters and forwards them to
 * `requestToRegisterAffiliate(config, …)`. Framework layers compose `onSuccess`
 * invalidation (e.g. of `getAffiliateState`) and error normalization on top.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(requestToRegisterAffiliateMutationOptions(config));
 * ```
 */
export function requestToRegisterAffiliateMutationOptions(config: Config) {
  return {
    mutationKey: ["requestToRegisterAffiliate"] as const,
    mutationFn: (variables: RequestToRegisterAffiliateParameters) => requestToRegisterAffiliate(config, variables),
  };
}
