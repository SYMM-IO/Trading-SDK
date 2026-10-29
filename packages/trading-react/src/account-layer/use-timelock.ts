"use client";

import {
  cancelTimelockOpMutationOptions,
  clearTimelocksMutationOptions,
  createHttpTimelockApprovalProvider,
  encodeTimelockedCoreCall,
  executeProtectedCallMutationOptions,
  executeTimelockOpMutationOptions,
  getSelectorTimelockQueryKey,
  getSelectorTimelockQueryOptions,
  getTimelockPolicyQueryKey,
  getTimelockScheduleStateQueryKey,
  getTimelockScheduleStateQueryOptions,
  INSTANT_OPEN_TIMELOCK_ACCOUNT_LAYER_FUNCTIONS,
  INSTANT_OPEN_TIMELOCK_CORE_FUNCTIONS,
  INSTANT_OPEN_TIMELOCK_SELECTORS,
  matchesScheduledCall,
  requestTimelockApprovalMutationOptions,
  scheduleTimelockOpMutationOptions,
  setupTimelocksMutationOptions,
  type CancelTimelockOpParameters,
  type ClearTimelocksParameters,
  type Config,
  type ConfigParameter,
  type ExecuteProtectedCallParameters,
  type ExecuteTimelockOpParameters,
  type GetSelectorTimelockOptions,
  type GetTimelockScheduleStateOptions,
  type RequestTimelockApprovalParameters,
  type ScheduleTimelockOpParameters,
  type SelectorTimelock,
  type SetupTimelocksParameters,
  type SolverId,
  type TimelockScheduleState,
  type ValidatedTimelockApproval,
} from "@symmio/trading-core";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useMemo } from "react";
import type { Address, Hex } from "viem";
import { normalizeProtectedWriteError } from "../errors/normalize-protected-write-error";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { invalidateTimelockExecutionReads } from "../gasless/invalidate-relay-reads";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { resolveWriteResult, type WriteParameters, type WriteResult } from "../transactions";
import { predicateMatch } from "../utils/predicate-match";

type TimelockMutationFactory<T> = (config: Config) => {
  mutationKey: readonly string[];
  mutationFn: (variables: T) => Promise<`0x${string}`>;
};

/** Select a supported policy selector by its ABI function name. */
export function useTimelockSelector(name: string): Hex | undefined {
  const names: readonly string[] = [
    ...INSTANT_OPEN_TIMELOCK_CORE_FUNCTIONS,
    ...INSTANT_OPEN_TIMELOCK_ACCOUNT_LAYER_FUNCTIONS,
  ];
  const index = names.indexOf(name);
  return index < 0 ? undefined : INSTANT_OPEN_TIMELOCK_SELECTORS[index];
}

/** Check whether an execution payload matches a single scheduled raw call. */
export function useScheduledCallMatch(account: Address, rawCallData: Hex, innerCallData: Hex): boolean {
  return matchesScheduledCall(account, rawCallData, innerCallData);
}

/** Create the standard approval transport for the selected solver. */
export function useTimelockApprovalProvider(
  parameters: ConfigParameter & { chainId?: number; solverId?: SolverId } = {},
) {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const solver = config.getSolver({ chainId: parameters.chainId ?? chainId, solverId: parameters.solverId });
  return useMemo(() => createHttpTimelockApprovalProvider({ baseUrl: solver.url }), [solver.url]);
}

/** Execute one exact protected call and refresh affected reads after confirmation. */
export function useProtectedCall(
  parameters: WriteParameters = {},
): UseMutationResult<WriteResult, SymmioRequestError, ExecuteProtectedCallParameters> {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();
  const base = executeProtectedCallMutationOptions(config);
  return useMutation({
    mutationKey: base.mutationKey,
    retry: false,
    mutationFn: async (variables) => {
      try {
        const resolvedChainId = variables.chainId ?? chainId;
        const hash = await base.mutationFn({ ...variables, chainId: resolvedChainId });
        return await resolveWriteResult(config, hash, {
          chainId: resolvedChainId,
          waitForReceipt: parameters.waitForReceipt,
          confirmations: parameters.confirmations,
        });
      } catch (error) {
        throw normalizeProtectedWriteError(error, variables.timelock);
      }
    },
    onSuccess: (result, variables) => {
      if (!result.receipt) return;
      const inner =
        variables.target === "core"
          ? encodeTimelockedCoreCall(variables.account, variables.callData)
          : variables.callData;
      invalidateTimelockExecutionReads(
        queryClient,
        { configKey: config.getChainConfigKey(variables.chainId ?? chainId) },
        inner,
      );
    },
  });
}

function useTimelockMutation<T extends { chainId?: number; innerCallData?: Hex }>(
  factory: TimelockMutationFactory<T>,
  parameters: WriteParameters,
  invalidate: "policy" | "schedule" | "execution",
): UseMutationResult<WriteResult, SymmioRequestError, T> {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();
  const base = factory(config);
  return useMutation({
    mutationKey: base.mutationKey,
    retry: false,
    mutationFn: async (variables: T) => {
      try {
        const resolvedChainId = variables.chainId ?? chainId;
        const hash = await base.mutationFn({ ...variables, chainId: resolvedChainId });
        return await resolveWriteResult(config, hash, {
          chainId: resolvedChainId,
          waitForReceipt: parameters.waitForReceipt,
          confirmations: parameters.confirmations,
        });
      } catch (error) {
        throw normalizeSymmError(error);
      }
    },
    onSuccess: (result, variables) => {
      if (!result.receipt) return;
      const scope = { configKey: config.getChainConfigKey(variables.chainId ?? chainId) };
      const account = "account" in variables ? (variables.account as `0x${string}`) : undefined;
      if (invalidate === "policy") {
        // A policy is shared by the root and all virtual accounts.
        void queryClient.invalidateQueries({ predicate: predicateMatch(getTimelockPolicyQueryKey, scope) });
        void queryClient.invalidateQueries({
          predicate: predicateMatch(getSelectorTimelockQueryKey, { ...scope, account }),
        });
        void queryClient.invalidateQueries({
          predicate: predicateMatch(getTimelockScheduleStateQueryKey, { ...scope, account }),
        });
        return;
      }
      void queryClient.invalidateQueries({
        predicate: predicateMatch(getTimelockScheduleStateQueryKey, { ...scope, account }),
      });
      if (invalidate !== "execution") return;

      if (variables.innerCallData) {
        invalidateTimelockExecutionReads(queryClient, scope, variables.innerCallData);
      }
    },
  });
}

/**
 * Configure root-account timelock policy and refresh policy-derived reads after confirmation.
 *
 * @param parameters - Receipt waiting and optional config controls.
 * @returns A mutation whose variables match `setupTimelocks`.
 *
 * @example
 * ```tsx
 * const setup = useSetupTimelocks();
 * setup.mutate({ account: root, unlocker, delay: 600n, selectors, gasless: true });
 * ```
 */
export function useSetupTimelocks(
  parameters: WriteParameters = {},
): UseMutationResult<WriteResult, SymmioRequestError, SetupTimelocksParameters> {
  return useTimelockMutation(setupTimelocksMutationOptions, parameters, "policy");
}

/**
 * Remove selector policies from a root account.
 *
 * @param parameters - Receipt waiting and optional config controls.
 * @returns A mutation whose variables match `clearTimelocks`.
 */
export function useClearTimelocks(
  parameters: WriteParameters = {},
): UseMutationResult<WriteResult, SymmioRequestError, ClearTimelocksParameters> {
  return useTimelockMutation(clearTimelocksMutationOptions, parameters, "policy");
}

/**
 * Schedule raw operation calldata for delayed fallback execution.
 *
 * @param parameters - Receipt waiting and optional config controls.
 * @returns A mutation whose variables include the root account and exact raw calldata.
 */
export function useScheduleTimelockOp(
  parameters: WriteParameters = {},
): UseMutationResult<WriteResult, SymmioRequestError, ScheduleTimelockOpParameters> {
  return useTimelockMutation(scheduleTimelockOpMutationOptions, parameters, "schedule");
}

/**
 * Cancel a pending fallback schedule before execution.
 *
 * @param parameters - Receipt waiting and optional config controls.
 * @returns A mutation that accepts the same root account and raw calldata used to schedule.
 */
export function useCancelTimelockOp(
  parameters: WriteParameters = {},
): UseMutationResult<WriteResult, SymmioRequestError, CancelTimelockOpParameters> {
  return useTimelockMutation(cancelTimelockOpMutationOptions, parameters, "schedule");
}

/**
 * Execute a timelocked AccountLayer call with an approval or mature schedule.
 * After confirmation, refresh the inner operation's affected reads, including
 * account lists and details for `deleteSubAccount`. No approval is requested automatically.
 *
 * @param parameters - Receipt waiting and optional config controls.
 * @returns A mutation whose variables carry inner AccountLayer calldata and optional approvals.
 */
export function useExecuteTimelockOp(
  parameters: WriteParameters = {},
): UseMutationResult<WriteResult, SymmioRequestError, ExecuteTimelockOpParameters> {
  return useTimelockMutation(executeTimelockOpMutationOptions, parameters, "execution");
}

/**
 * Request one public approval. Automatic mutation retries are always disabled.
 *
 * @param parameters - Optional SDK config override.
 * @returns A mutation returning a validated signed approval and the prepared request.
 *
 * @example
 * ```tsx
 * const approval = useRequestTimelockApproval();
 * approval.mutate({ provider, capability, account, rootAccount, callData, deadline });
 * ```
 */
export function useRequestTimelockApproval(
  parameters: ConfigParameter = {},
): UseMutationResult<ValidatedTimelockApproval, SymmioRequestError, RequestTimelockApprovalParameters> {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const base = requestTimelockApprovalMutationOptions(config);
  return useMutation({
    mutationKey: base.mutationKey,
    retry: false,
    mutationFn: async (variables) => {
      try {
        return await base.mutationFn({ ...variables, chainId: variables.chainId ?? chainId });
      } catch (error) {
        throw normalizeSymmError(error);
      }
    },
  });
}

/** Required selector-policy query inputs plus React config overrides. */
export type UseSelectorTimelockParameters = GetSelectorTimelockOptions & ConfigParameter;

/**
 * Read the unlocker and delay configured for one root-account selector.
 *
 * @param parameters - Root account, selector, optional chain, and TanStack query controls.
 * @returns A TanStack query result containing the selector policy.
 */
export function useSelectorTimelock(
  parameters: UseSelectorTimelockParameters,
): UseQueryResult<SelectorTimelock, SymmioRequestError> {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getSelectorTimelockQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
  });
  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (error) {
        throw normalizeSymmError(error);
      }
    },
  }) as UseQueryResult<SelectorTimelock, SymmioRequestError>;
}

/** Required schedule-state query inputs plus React config overrides. */
export type UseTimelockScheduleStateParameters = GetTimelockScheduleStateOptions & ConfigParameter;

/**
 * Read a fallback schedule and its derived ready/expiry timestamps.
 *
 * @param parameters - Root account, exact raw calldata, optional selector calldata, and query controls.
 * @returns A TanStack query result containing schedule state and policy timing.
 *
 * @example
 * ```tsx
 * const schedule = useTimelockScheduleState({ account: root, callData: rawWithdrawCall });
 * ```
 */
export function useTimelockScheduleState(
  parameters: UseTimelockScheduleStateParameters,
): UseQueryResult<TimelockScheduleState, SymmioRequestError> {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getTimelockScheduleStateQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
  });
  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (error) {
        throw normalizeSymmError(error);
      }
    },
  }) as UseQueryResult<TimelockScheduleState, SymmioRequestError>;
}
