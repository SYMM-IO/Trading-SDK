"use client";

import {
  getRetryListingInfoQueryOptions,
  type ConfigParameter,
  type GetRetryListingInfoOptions,
  type GetRetryListingInfoReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useRetryListingInfo}: the core query options plus an optional `config`. */
export type UseRetryListingInfoParameters = GetRetryListingInfoOptions & ConfigParameter;

/** Return type of {@link useRetryListingInfo}: the user's retry allowance for one market. */
export type UseRetryListingInfoReturnType = UseQueryResult<GetRetryListingInfoReturnType, SymmioRequestError>;

/**
 * Read the signed-in user's **retry allowance** for a rejected market — how many
 * listing retries remain and the cooldown before the next.
 *
 * Authed: pass the Bearer `accessToken` from {@link useAuthenticateListing}. Read
 * this before offering {@link useRetryListing}: gate the retry button on
 * `remainingRetries > 0` and on `remainingCooldownSeconds` being `null` or `0`.
 * Errors are normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data } = useRetryListingInfo({ accessToken, tokenContractAddress, depositChain });
 * ```
 */
export function useRetryListingInfo(parameters: UseRetryListingInfoParameters): UseRetryListingInfoReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getRetryListingInfoQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
  });

  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseRetryListingInfoReturnType;
}
