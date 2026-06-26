"use client";

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import {
  addMarginMutationOptions,
  getAccountBalanceInfoQueryKey,
  getAccountBalanceOfQueryKey,
  type AddMarginParameters,
} from "@theoldvarorg/core";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { resolveWriteResult, type WriteParameters, type WriteResult } from "../transactions";
import { predicateMatch } from "../utils";

/**
 * Parameters for {@link useAddMargin}.
 */
export type UseAddMarginParameters = WriteParameters;

/** Result returned by the {@link useAddMargin} mutation. */
export type AddMarginResult = WriteResult;

/** Return type of {@link useAddMargin}. */
export type UseAddMarginReturnType = UseMutationResult<AddMarginResult, SymmioRequestError, AddMarginParameters>;

/**
 * Add margin to a virtual account (VA) — move collateral from the parent
 * subaccount's available balance into the VA via `AccountLayer.addMargin`. The
 * connected wallet must own the VA. No signature is required. On success, the
 * VA's balance reads are invalidated so mounted views refetch.
 *
 * @example
 * ```tsx
 * const { mutate } = useAddMargin();
 * mutate({ virtualAccount: "0xva…", amount: 50_000000000000000000n });
 * ```
 */
export function useAddMargin(parameters: UseAddMarginParameters = {}): UseAddMarginReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();

  const base = addMarginMutationOptions(config);

  return useMutation<AddMarginResult, SymmioRequestError, AddMarginParameters>({
    mutationKey: base.mutationKey,
    mutationFn: async (variables) => {
      try {
        const resolvedChainId = variables.chainId ?? chainId;
        const hash = await base.mutationFn({
          virtualAccount: variables.virtualAccount,
          amount: variables.amount,
          simulateBeforeWrite: variables.simulateBeforeWrite,
          chainId: resolvedChainId,
        });
        return resolveWriteResult(config, hash, {
          chainId: resolvedChainId,
          waitForReceipt: parameters.waitForReceipt,
          confirmations: parameters.confirmations,
        });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
    onSuccess: (_result, variables) => {
      const partial = { account: variables.virtualAccount };
      void queryClient.invalidateQueries({ predicate: predicateMatch(getAccountBalanceInfoQueryKey, partial) });
      void queryClient.invalidateQueries({ predicate: predicateMatch(getAccountBalanceOfQueryKey, partial) });
    },
  });
}
