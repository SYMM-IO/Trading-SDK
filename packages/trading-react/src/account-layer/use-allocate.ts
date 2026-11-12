"use client";

import {
  allocateMutationOptions,
  getAccountBalanceInfoQueryKey,
  getAccountBalanceOfQueryKey,
  type AllocateParameters,
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
 * Parameters for {@link useAllocate}.
 */
export type UseAllocateParameters = AutomaticTimelockWriteParameters;

/** Result returned by the {@link useAllocate} mutation. */
export type AllocateResult = WriteResult;

/** Return type of {@link useAllocate}. */
export type UseAllocateReturnType = UseMutationResult<AllocateResult, SymmioRequestError, AllocateParameters>;

/**
 * Allocate a subaccount's available balance into its allocated (tradeable)
 * balance (routed through the AccountLayer `_call` proxy). On success, the
 * subaccount's balance-info and balance-of reads are invalidated.
 *
 * @example
 * ```tsx
 * const { mutate } = useAllocate();
 * mutate({ account: "0xsub…", amount: 1_000000000000000000n });
 * ```
 */
export function useAllocate(parameters: UseAllocateParameters = {}): UseAllocateReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();
  const automaticTimelock = useAutomaticTimelock(config, parameters.automaticTimelock);

  const base = allocateMutationOptions(config);

  return useMutation<AllocateResult, SymmioRequestError, AllocateParameters>({
    mutationKey: base.mutationKey,
    mutationFn: async (variables) => {
      let authorization = variables.timelock;
      try {
        const resolvedChainId = variables.chainId ?? chainId;
        authorization = await automaticTimelock(variables, {
          account: variables.account,
          chainId: resolvedChainId,
          functionName: "allocate",
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
      const partial = { account: variables.account };
      void queryClient.invalidateQueries({ predicate: predicateMatch(getAccountBalanceInfoQueryKey, partial) });
      void queryClient.invalidateQueries({ predicate: predicateMatch(getAccountBalanceOfQueryKey, partial) });
    },
  });
}
