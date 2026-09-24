"use client";

import {
  retryListingMutationOptions,
  type ConfigParameter,
  type RetryListingParameters,
  type RetryListingReturnType,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useRetryListing}: just an optional `config`. */
export type UseRetryListingParameters = ConfigParameter;

/**
 * Variables for the {@link useRetryListing} mutation — the same shape as core's
 * {@link RetryListingParameters}.
 *
 * `accessToken`, `tokenContractAddress`, and `depositChain` are required;
 * `chainId` defaults to the connected chain when omitted.
 */
export type RetryListingVariables = RetryListingParameters;

/**
 * Return type of {@link useRetryListing}: resolves to a `RetryListingResult` (the
 * retry allowance left) on success, or a normalized error.
 */
export type UseRetryListingReturnType = UseMutationResult<
  RetryListingReturnType,
  SymmioRequestError,
  RetryListingVariables
>;

/**
 * Retry a **rejected** market's listing — re-submit a market whose listing was
 * rejected, instead of refunding it.
 *
 * The mutation POSTs the rejected `tokenContractAddress` and its `depositChain`,
 * authed with the caller's Bearer `accessToken` (mint it with
 * {@link useAuthenticateListing}). Retries are capped and rate-limited: read
 * {@link useRetryListingInfo} first and only offer this when `remainingRetries > 0`
 * and the cooldown has elapsed.
 *
 * On success the hook invalidates the retry allowance (`getRetryListingInfo`) and
 * the user's pools view (`getUserListingMarkets`), so mounted views refetch and
 * reflect the retry.
 *
 * Pools is **chain-level** — `mutate` / `mutateAsync` reject with a normalized
 * {@link SymmioRequestError} (`LISTING_NOT_CONFIGURED`) on a chain with no listing
 * backend, and a bad or expired token comes back as a `RETRY_LISTING_FAILED`
 * `401`. No retries left or an un-elapsed cooldown is rejected by the service.
 * Failures are normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const retry = useRetryListing();
 * retry.mutate({ accessToken, tokenContractAddress, depositChain });
 * ```
 */
export function useRetryListing(parameters: UseRetryListingParameters = {}): UseRetryListingReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();
  const options = retryListingMutationOptions(config);

  return useMutation({
    ...options,
    mutationFn: async (variables: RetryListingVariables): Promise<RetryListingReturnType> => {
      try {
        return await options.mutationFn({ ...variables, chainId: variables.chainId ?? chainId });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
    onSuccess: () => {
      // A retry consumes an allowance and moves the market off REJECTED in the
      // user's pools view. Invalidate each by key tag so mounted views refetch.
      void queryClient.invalidateQueries({ queryKey: ["getRetryListingInfo"] });
      void queryClient.invalidateQueries({ queryKey: ["getUserListingMarkets"] });
    },
  }) as UseRetryListingReturnType;
}
