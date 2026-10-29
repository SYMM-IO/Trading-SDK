import type { Config } from "../../core/config";
import type { ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  authenticateListing,
  type AuthenticateListingParameters,
  type AuthenticateListingReturnType,
} from "./authenticate-listing";
import {
  getListingSignInMessage,
  type GetListingSignInMessageParameters,
  type GetListingSignInMessageReturnType,
} from "./get-sign-in-message";

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

/** Stable sign-in query identity, including deployment, wallet, origin and statement. */
export function getListingSignInMessageQueryKey(options: GetListingSignInMessageParameters & ConfigKeyParameter) {
  return ["getListingSignInMessage", filterQueryOptions({ ...options })] as const;
}
/** Sign-in query key. */
export type GetListingSignInMessageQueryKey = ReturnType<typeof getListingSignInMessageQueryKey>;
/** Required challenge identity plus optional query controls. */
export type GetListingSignInMessageOptions = GetListingSignInMessageParameters &
  QueryParameter<
    GetListingSignInMessageReturnType,
    Error,
    GetListingSignInMessageReturnType,
    GetListingSignInMessageQueryKey
  >;
/** Fetch a challenge without signing; React callers should normally use prefetchChallenge on useAuthenticateListing.
 * @param config - SDK configuration.
 * @param options - Wallet, origin, deployment and query controls.
 * @returns Options for a single-use sign-in challenge.
 */
export function getListingSignInMessageQueryOptions(
  config: Config,
  options: GetListingSignInMessageOptions,
): SymmioQueryOptions<
  GetListingSignInMessageReturnType,
  Error,
  GetListingSignInMessageReturnType,
  GetListingSignInMessageQueryKey
> {
  return {
    ...options.query,
    queryKey: getListingSignInMessageQueryKey({ ...options, configKey: challengeConfigKey(config, options) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getListingSignInMessage(config, options),
  };
}

function challengeConfigKey(config: Config, options: GetListingSignInMessageOptions): string | undefined {
  try {
    return config.getChainConfigKey(options.chainId);
  } catch (error) {
    if (options.query?.enabled === false) return undefined;
    throw error;
  }
}
