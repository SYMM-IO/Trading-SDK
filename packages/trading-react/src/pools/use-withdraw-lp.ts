"use client";

import {
  withdrawLpMutationOptions,
  type ConfigParameter,
  type WithdrawLpParameters,
  type WithdrawLpReturnType,
} from "@symmio/trading-core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useWithdrawLp}: just an optional `config`. */
export type UseWithdrawLpParameters = ConfigParameter;

/**
 * Variables for the {@link useWithdrawLp} mutation — the same shape as core's
 * {@link WithdrawLpParameters}.
 *
 * `accessToken`, `marketAddress`, `withdrawAddress`, and `amount` are required;
 * `description` is optional. `chainId` defaults to the connected chain when
 * omitted.
 */
export type WithdrawLpVariables = WithdrawLpParameters;

/**
 * Return type of {@link useWithdrawLp}: resolves to `void` on success (the
 * listing backend acknowledges with an empty body) or a normalized error.
 */
export type UseWithdrawLpReturnType = UseMutationResult<WithdrawLpReturnType, SymmioRequestError, WithdrawLpVariables>;

/**
 * Withdraw LP shares from a pool — queue a withdrawal with the listing backend in
 * one call.
 *
 * The mutation POSTs the LP `amount`, the pool's `marketAddress`, and the
 * `withdrawAddress` to send the liquidity to, authed with the caller's Bearer
 * `accessToken` (mint it with {@link useAuthenticateListing}). It resolves to
 * `void`; the withdrawn shares move into the pool's pending-withdrawal queue, so
 * refetch {@link useUserProfit} afterwards to see `pendingWithdrawLpAmount` rise
 * and `availableLpAmount` fall.
 *
 * Cap `amount` at the pool's `availableLpAmount` from {@link useUserProfit} — the
 * service rejects an over-withdrawal. Pools is **chain-level** — `mutate` /
 * `mutateAsync` reject with a normalized {@link SymmioRequestError}
 * (`LISTING_NOT_CONFIGURED`) on a chain with no listing backend, and a bad or
 * expired token comes back as a `WITHDRAW_LP_FAILED` `401`. Failures are
 * normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const withdraw = useWithdrawLp();
 * const { data: profit } = useUserProfit({ accessToken, tokenContractAddress });
 *
 * withdraw.mutate({
 *   accessToken, // from useAuthenticateListing
 *   marketAddress: tokenContractAddress,
 *   withdrawAddress: "0xRecipient…",
 *   amount: profit?.availableLpAmount ?? 0n,
 * });
 * ```
 */
export function useWithdrawLp(parameters: UseWithdrawLpParameters = {}): UseWithdrawLpReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = withdrawLpMutationOptions(config);

  return useMutation({
    ...options,
    mutationFn: async (variables: WithdrawLpVariables): Promise<WithdrawLpReturnType> => {
      try {
        return await options.mutationFn({ ...variables, chainId: variables.chainId ?? chainId });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseWithdrawLpReturnType;
}
