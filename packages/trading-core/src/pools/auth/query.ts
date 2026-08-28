import type { Config } from "../../core/config";
import {
  authenticateListing,
  type AuthenticateListingParameters,
  type AuthenticateListingReturnType,
} from "./authenticate-listing";

/**
 * Build TanStack Mutation options for {@link authenticateListing}. Modeled as a
 * mutation (not a query): it signs a message with the wallet and exchanges it
 * for a bearer token.
 *
 * @param config - The SDK config.
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * const { mutateAsync } = useMutation(authenticateListingMutationOptions(config));
 * const token = await mutateAsync({ domain: "app.example.com", uri: "https://app.example.com" });
 * ```
 */
export function authenticateListingMutationOptions(config: Config) {
  return {
    mutationKey: ["authenticateListing"] as const,
    mutationFn: (variables: AuthenticateListingParameters): Promise<AuthenticateListingReturnType> =>
      authenticateListing(config, variables),
  };
}
