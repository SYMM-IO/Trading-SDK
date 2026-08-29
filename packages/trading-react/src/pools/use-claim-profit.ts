"use client";

import {
  claimProfitMutationOptions,
  type ClaimProfitParameters,
  type ClaimProfitReturnType,
  type ConfigParameter,
} from "@symmio/trading-core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useClaimProfit}: just an optional `config`. */
export type UseClaimProfitParameters = ConfigParameter;

/**
 * Variables for the {@link useClaimProfit} mutation — the same shape as core's
 * {@link ClaimProfitParameters}.
 *
 * `accessToken`, `tokenContractAddress`, `depositChain`, `accountAddress`, and
 * `amount` are required; `chainId` defaults to the connected chain when omitted.
 */
export type ClaimProfitVariables = ClaimProfitParameters;

/**
 * Return type of {@link useClaimProfit}: resolves to a `PoolClaimResult` receipt
 * on success, or a normalized error.
 */
export type UseClaimProfitReturnType = UseMutationResult<
  ClaimProfitReturnType,
  SymmioRequestError,
  ClaimProfitVariables
>;

/**
 * Claim a pool's accrued LP rewards as USDC — POST the claim to the listing
 * backend in one call.
 *
 * The mutation POSTs the USDC `amount`, the pool's `tokenContractAddress`, the
 * `depositChain` (the pool's `chainId`), and the `accountAddress` sub-account to
 * credit, authed with the caller's Bearer `accessToken` (mint it with
 * {@link useAuthenticateListing}). The claim is synchronous: it resolves to a
 * `PoolClaimResult` receipt once the USDC has moved, so refetch
 * {@link useUserProfit} afterwards to see `claimableReward` fall and
 * `claimedReward` rise.
 *
 * Cap `amount` at the pool's `claimableReward` from {@link useUserProfit} — the
 * service rejects an over-claim. Pools is **chain-level** — `mutate` /
 * `mutateAsync` reject with a normalized {@link SymmioRequestError}
 * (`LISTING_NOT_CONFIGURED`) on a chain with no listing backend, and a bad or
 * expired token comes back as a `CLAIM_PROFIT_FAILED` `401`. Failures are
 * normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const claim = useClaimProfit();
 * const { data: profit } = useUserProfit({ accessToken, tokenContractAddress });
 *
 * claim.mutate({
 *   accessToken, // from useAuthenticateListing
 *   tokenContractAddress,
 *   depositChain: market.chainId,
 *   accountAddress: "0xSubAccount…",
 *   amount: profit?.claimableReward ?? 0n,
 * });
 * ```
 */
export function useClaimProfit(parameters: UseClaimProfitParameters = {}): UseClaimProfitReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = claimProfitMutationOptions(config);

  return useMutation({
    ...options,
    mutationFn: async (variables: ClaimProfitVariables): Promise<ClaimProfitReturnType> => {
      try {
        return await options.mutationFn({ ...variables, chainId: variables.chainId ?? chainId });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseClaimProfitReturnType;
}
