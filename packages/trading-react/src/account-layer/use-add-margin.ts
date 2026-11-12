"use client";

import {
  addMarginMutationOptions,
  getAccountBalanceInfoQueryKey,
  getAccountBalanceOfQueryKey,
  type AddMarginParameters,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeProtectedWriteError } from "../errors/normalize-protected-write-error";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { resolveWriteResult, type AutomaticTimelockWriteParameters, type WriteResult } from "../transactions";
import { predicateMatch } from "../utils";
import { useAutomaticTimelock } from "./use-automatic-timelock";

/**
 * Parameters for {@link useAddMargin}.
 */
export type UseAddMarginParameters = AutomaticTimelockWriteParameters;

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
  const automaticTimelock = useAutomaticTimelock(config, parameters.automaticTimelock);

  const base = addMarginMutationOptions(config);

  return useMutation<AddMarginResult, SymmioRequestError, AddMarginParameters>({
    mutationKey: base.mutationKey,
    mutationFn: async (variables) => {
      let authorization = variables.timelock;
      try {
        const resolvedChainId = variables.chainId ?? chainId;
        authorization = await automaticTimelock(variables, {
          account: variables.virtualAccount,
          chainId: resolvedChainId,
          functionName: "addMargin",
          explicit: authorization,
        });
        const hash = await base.mutationFn({
          ...variables,
          chainId: resolvedChainId,
          ...(authorization ? { timelock: authorization } : {}),
        });
        const result = resolveWriteResult(config, hash, {
          chainId: resolvedChainId,
          waitForReceipt: parameters.waitForReceipt,
          confirmations: parameters.confirmations,
        });
        const settled = await result;
        automaticTimelock.finish(variables, settled);
        return settled;
      } catch (err) {
        automaticTimelock.fail(variables, err);
        throw authorization ? normalizeProtectedWriteError(err, authorization) : normalizeSymmError(err);
      }
    },
    onSuccess: (_result, variables) => {
      const partial = { account: variables.virtualAccount };
      void queryClient.invalidateQueries({ predicate: predicateMatch(getAccountBalanceInfoQueryKey, partial) });
      void queryClient.invalidateQueries({ predicate: predicateMatch(getAccountBalanceOfQueryKey, partial) });
    },
  });
}
