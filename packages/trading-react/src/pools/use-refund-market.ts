"use client";

import {
  refundMarketMutationOptions,
  type ConfigParameter,
  type RefundMarketParameters,
  type RefundMarketReturnType,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useRefundMarket}: just an optional `config`. */
export type UseRefundMarketParameters = ConfigParameter;

/**
 * Variables for the {@link useRefundMarket} mutation — the same shape as core's
 * {@link RefundMarketParameters}.
 *
 * `accessToken`, `marketAddress`, `depositChain`, and `recipientAddress` are
 * required; `chainId` defaults to the connected chain when omitted.
 */
export type RefundMarketVariables = RefundMarketParameters;

/**
 * Return type of {@link useRefundMarket}: resolves to a `PoolRefundResult` receipt
 * on success, or a normalized error.
 */
export type UseRefundMarketReturnType = UseMutationResult<
  RefundMarketReturnType,
  SymmioRequestError,
  RefundMarketVariables
>;

/**
 * Refund a deposit on a **rejected** market — reclaim the funds a user deposited
 * into a market whose listing was rejected.
 *
 * The mutation POSTs the rejected `marketAddress`, its `depositChain`, and the
 * `recipientAddress` to send the deposit to, authed with the caller's Bearer
 * `accessToken` (mint it with {@link useAuthenticateListing}). Use it only for a
 * market whose `marketStatus` is `REJECTED`; it resolves to a `PoolRefundResult`
 * carrying the transfer's transaction hash.
 *
 * On success the hook invalidates the user's transaction lists
 * (`getUserTransactions`, `getPoolTransactions`) and their pools view
 * (`getUserListingMarkets`), so mounted views refetch and reflect the refund.
 *
 * Pools is **chain-level** — `mutate` / `mutateAsync` reject with a normalized
 * {@link SymmioRequestError} (`LISTING_NOT_CONFIGURED`) on a chain with no listing
 * backend, and a bad or expired token comes back as a `REFUND_MARKET_FAILED`
 * `401`. A market that is not refundable is rejected by the service. Failures are
 * normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const refund = useRefundMarket();
 * refund.mutate({
 *   accessToken, // from useAuthenticateListing
 *   marketAddress: rejectedMarket.contractAddress,
 *   depositChain: rejectedMarket.chainId,
 *   recipientAddress: account.address,
 * });
 * ```
 */
export function useRefundMarket(parameters: UseRefundMarketParameters = {}): UseRefundMarketReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();
  const options = refundMarketMutationOptions(config);

  return useMutation({
    ...options,
    mutationFn: async (variables: RefundMarketVariables): Promise<RefundMarketReturnType> => {
      try {
        return await options.mutationFn({ ...variables, chainId: variables.chainId ?? chainId });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
    onSuccess: () => {
      // A refund turns the deposit into a refunded row and updates the rejected
      // market in the user's pools view. Invalidate each by key tag so mounted
      // views refetch — the caller does not refetch these by hand.
      void queryClient.invalidateQueries({ queryKey: ["getUserTransactions"] });
      void queryClient.invalidateQueries({ queryKey: ["getPoolTransactions"] });
      void queryClient.invalidateQueries({ queryKey: ["getUserListingMarkets"] });
    },
  }) as UseRefundMarketReturnType;
}
