"use client";

import {
  getUserProfitQueryOptions,
  type ConfigParameter,
  type GetUserProfitOptions,
  type GetUserProfitReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useUserProfit}: the core query options plus an optional `config`. */
export type UseUserProfitParameters = GetUserProfitOptions & ConfigParameter;

/** Return type of {@link useUserProfit}: the signed-in user's LP position in one pool. */
export type UseUserProfitReturnType = UseQueryResult<GetUserProfitReturnType, SymmioRequestError>;

/**
 * Read the signed-in user's LP position in a single pool — their LP shares, LP
 * balance valued in tokens and USDC, claimable and claimed rewards, deposited
 * token amount, and the LP shares queued for withdrawal.
 *
 * This is an authed, per-pool read: it takes a Bearer `accessToken` from
 * {@link useAuthenticateListing} and a `tokenContractAddress` (the token that
 * addresses one market in the listing API). Both gate the query — until the
 * token **and** the address are non-empty strings the hook stays idle
 * (`enabled: false`) rather than firing an incomplete or unauthenticated
 * request, so it can be mounted before sign-in or before an address is entered.
 *
 * Every field on the returned {@link UserPoolProfit} is a `bigint` at
 * `LISTING_VALUE_DECIMALS` (18); an absent figure is normalized to `0n`, not
 * `null`. Enigma-only; errors are normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const login = useAuthenticateListing();
 * const [token, setToken] = useState("");
 *
 * const { data, isPending } = useUserProfit({
 *   accessToken: token,
 *   tokenContractAddress: "0x1234…",
 * });
 *
 * // sign in first, then feed the token to the hook:
 * login.mutate({}, { onSuccess: (result) => setToken(result.accessToken) });
 * ```
 */
export function useUserProfit(parameters: UseUserProfitParameters): UseUserProfitReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getUserProfitQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
  });

  return useQuery({
    ...options,
    enabled:
      (parameters.query?.enabled ?? true) &&
      parameters.accessToken.length > 0 &&
      parameters.tokenContractAddress.length > 0,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseUserProfitReturnType;
}
