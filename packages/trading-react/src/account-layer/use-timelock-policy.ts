"use client";

import {
  EarlyWithdrawExecutionError,
  earlyWithdrawMutationOptions,
  getLastWithdrawRequestIdQueryKey,
  getPendingWithdrawRequestsBatchQueryKey,
  getPendingWithdrawRequestsQueryKey,
  getSelectorTimelockQueryKey,
  getTimelockPolicyQueryKey,
  getTimelockPolicyQueryOptions,
  getTimelockScheduleStateQueryKey,
  getWithdrawableTimeQueryKey,
  getWithdrawRequestsQueryKey,
  setupTimelockPolicyMutationOptions,
  type ConfigParameter,
  type EarlyWithdrawParameters,
  type EarlyWithdrawResult,
  type GetTimelockPolicyOptions,
  type SetupTimelockPolicyParameters,
  type TimelockPolicyReport,
  type TimelockSetupResult,
} from "@symmio/trading-core";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { resolveWriteResult, TransactionRevertedError, type WriteParameters, type WriteResult } from "../transactions";
import { invalidateAccountBalances } from "../utils/invalidate-account-balances";
import { predicateMatch } from "../utils/predicate-match";

/** Complete policy query including standard React config overrides. */
export type UseTimelockPolicyParameters = GetTimelockPolicyOptions & ConfigParameter;

/** Read all selector corrections for any root/virtual account. No writes or approval probes occur. */
export function useTimelockPolicy(
  parameters: UseTimelockPolicyParameters,
): UseQueryResult<TimelockPolicyReport, SymmioRequestError> {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getTimelockPolicyQueryOptions(config, { ...parameters, chainId: parameters.chainId ?? chainId });
  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (error) {
        throw normalizeSymmError(error);
      }
    },
  }) as UseQueryResult<TimelockPolicyReport, SymmioRequestError>;
}

function invalidatePolicy(queryClient: QueryClient, configKey: string) {
  for (const key of [getTimelockPolicyQueryKey, getSelectorTimelockQueryKey, getTimelockScheduleStateQueryKey]) {
    void queryClient.invalidateQueries({ predicate: predicateMatch(key, { configKey }) });
  }
}

/** Configure root policy with defaults, returning confirmed receipt and separate indexing status. Retries are disabled. */
export function useSetupTimelockPolicy(
  parameters: ConfigParameter = {},
): UseMutationResult<TimelockSetupResult, SymmioRequestError, SetupTimelockPolicyParameters> {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();
  const base = setupTimelockPolicyMutationOptions(config);
  return useMutation({
    ...base,
    mutationFn: async (variables) => {
      try {
        return await base.mutationFn({ ...variables, chainId: variables.chainId ?? chainId });
      } catch (error) {
        throw normalizeSymmError(error);
      }
    },
    onSuccess: (_result, variables) => {
      invalidatePolicy(queryClient, config.getChainConfigKey(variables.chainId ?? chainId));
    },
  });
}

/** Submitted approval/withdrawal plus optional receipt and relay handle. A hash alone is not confirmation. */
export type EarlyWithdrawWriteResult = EarlyWithdrawResult & WriteResult;

/**
 * Obtain one approval and execute a withdrawal. Defaults to receipt confirmation; never automatically retries.
 * Failures keep their normalized classification and issued-approval recovery context in `cause`.
 * @param parameters - Config and standard receipt controls.
 * @returns Mutation with the approval, hash and confirmed receipt (unless explicitly disabled).
 * @example const withdrawal = useEarlyWithdraw();
 */
export function useEarlyWithdraw(
  parameters: WriteParameters = {},
): UseMutationResult<EarlyWithdrawWriteResult, SymmioRequestError, EarlyWithdrawParameters> {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();
  const base = earlyWithdrawMutationOptions(config);
  return useMutation({
    ...base,
    mutationFn: async (variables) => {
      try {
        const resolvedChainId = variables.chainId ?? chainId;
        const submitted = await base.mutationFn({ ...variables, chainId: resolvedChainId });
        try {
          return {
            ...submitted,
            ...(await resolveWriteResult(config, submitted.hash, { ...parameters, chainId: resolvedChainId })),
          };
        } catch (error) {
          throw new EarlyWithdrawExecutionError(submitted.approval, submitted.callData, error, submitted.hash);
        }
      } catch (error) {
        throw normalizeEarlyWithdrawError(error);
      }
    },
    onSuccess: (result, variables) => {
      if (!result.receipt) return;
      const scope = { configKey: config.getChainConfigKey(variables.chainId ?? chainId) };
      invalidatePolicy(queryClient, scope.configKey);
      invalidateAccountBalances(queryClient, scope);
      for (const key of [
        getPendingWithdrawRequestsQueryKey,
        getPendingWithdrawRequestsBatchQueryKey,
        getWithdrawRequestsQueryKey,
        getLastWithdrawRequestIdQueryKey,
        getWithdrawableTimeQueryKey,
      ]) {
        void queryClient.invalidateQueries({ predicate: predicateMatch(key, scope) });
      }
    },
  });
}

function normalizeEarlyWithdrawError(error: unknown): SymmioRequestError {
  if (!(error instanceof EarlyWithdrawExecutionError)) return normalizeSymmError(error);
  const underlying = normalizeSymmError(error.cause);
  if (underlying instanceof TransactionRevertedError) {
    // Preserve the SDK's mined-revert subclass without mutating the original
    // cause or creating a cycle through the recovery wrapper.
    const reverted = new TransactionRevertedError({ hash: underlying.hash, receipt: underlying.receipt });
    reverted.cause = error;
    return reverted;
  }
  return new SymmioRequestError({ ...underlying, message: underlying.message, cause: error });
}
