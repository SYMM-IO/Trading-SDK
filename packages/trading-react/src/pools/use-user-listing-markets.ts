"use client";

import {
  getUserListingMarketsQueryOptions,
  type ConfigParameter,
  type GetUserListingMarketsOptions,
  type GetUserListingMarketsReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useUserListingMarkets}: the core query options plus an optional `config`. */
export type UseUserListingMarketsParameters = GetUserListingMarketsOptions & ConfigParameter;

/** Return type of {@link useUserListingMarkets}: one page of the signed-in user's pool rows. */
export type UseUserListingMarketsReturnType = UseQueryResult<GetUserListingMarketsReturnType, SymmioRequestError>;

/**
 * Read a page of "Your Pools" — the listing markets that generated a deposit
 * address for the signed-in user, whether or not they have deposited yet.
 *
 * This is the authed twin of {@link useListingMarkets}: it takes a Bearer
 * `accessToken` from {@link useAuthenticateListing} and returns the same catalog
 * rows enriched with the user's `userDeposit`, `userSharePercentage`, and
 * `userRevenue`. Search, filtering, sorting, and pagination are all server-side,
 * exactly as on the public catalog.
 *
 * The token gates the query: until `accessToken` is a non-empty string the hook
 * stays idle (`enabled: false`) rather than firing an unauthenticated request, so
 * it can be mounted before sign-in. Every money field on a row is a `bigint` at
 * `LISTING_VALUE_DECIMALS` (18); `null` means the service reported no value, not
 * zero. Enigma-only; errors are normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const login = useAuthenticateListing();
 * const [token, setToken] = useState("");
 *
 * const { data, isPending } = useUserListingMarkets({
 *   accessToken: token,
 *   marketStatus: ListingMarketStatus.LISTED,
 *   limit: 25,
 * });
 *
 * // sign in first, then feed the token to the hook:
 * login.mutate({}, { onSuccess: (result) => setToken(result.accessToken) });
 * ```
 */
export function useUserListingMarkets(parameters: UseUserListingMarketsParameters): UseUserListingMarketsReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getUserListingMarketsQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
  });

  return useQuery({
    ...options,
    enabled: (parameters.query?.enabled ?? true) && parameters.accessToken.length > 0,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseUserListingMarketsReturnType;
}
