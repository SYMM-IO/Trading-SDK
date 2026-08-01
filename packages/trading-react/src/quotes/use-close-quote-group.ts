"use client";

import {
  getInstantClosesQueryKey,
  instantCloseBulkAutoMutationOptions,
  NotificationType,
  planGroupClose,
  toGroupCloseCandidates,
  type ConfigParameter,
  type Notification,
  type PlanGroupCloseFailure,
  type QuoteGroup,
  type UnifiedQuote,
} from "@symmio/trading-core";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Address } from "viem";
import { formatUnits } from "viem";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { predicateMatch } from "../utils";
import { useNotifications } from "../websocket/use-notifications";

/** Decimal places of an 18-decimal-wei fixed-point value. */
const WEI_DECIMALS = 18;

/**
 * Solver `lastSeenAction` values that report a close **fill** — the moment a
 * close is actually done (mirrors the core notification classifier's fill set;
 * the request-stage actions are deliberately not here).
 */
const CLOSE_FILL_ACTIONS = new Set(["FillMarketOrderInstantClose", "FillLimitOrderClose"]);

/**
 * Lifecycle of one child close inside a group close:
 * `queued` → `closing` (submitted in the bulk request, awaiting its close-fill
 * notification) → `closed` (fill notification received), or `failed` (the bulk
 * submit or the close itself errored).
 */
export type CloseQuoteGroupStepStatus = "queued" | "closing" | "closed" | "failed";

/** Live state of one child close inside a group close run. */
export interface CloseQuoteGroupStep {
  /** Child identity (`UnifiedQuote.key`). */
  key: string;
  /** On-chain quote id of the child. */
  quoteId: bigint;
  /** Planned close amount, wei. */
  closeQuantity: bigint;
  /** `full` when the child closes entirely, `partial` otherwise. */
  kind: "full" | "partial";
  /** Current lifecycle stage of this child close. */
  status: CloseQuoteGroupStepStatus;
  /** Normalized error, when `status` is `failed`. */
  error?: SymmioRequestError;
}

/** Overall lifecycle of a group close run. */
export type CloseQuoteGroupStatus = "idle" | "closing" | "success" | "failed";

/** Inputs for one {@link UseCloseQuoteGroupReturnType.close} run. */
export interface CloseQuoteGroupParameters {
  /** The group whose children are being closed. */
  group: QuoteGroup;
  /** Exact total quantity to close across the group, wei. */
  targetQuantity: bigint;
  /**
   * The symbol's `minAcceptableQuoteValue` (wei) — the dust floor a partially
   * closed child must keep. Read it from the market info of the group's symbol.
   */
  minAcceptableQuoteValue: bigint;
  /** Slippage tolerance percent forwarded to every child close (e.g. `5`). */
  slippage: number;
  /** Pre-fetched mark price (decimal string) forwarded to every child close. */
  markPrice?: string;
  /** Delegated session key to submit the closes from, when delegation is active. */
  from?: Address;
  /**
   * Account whose live notification stream reports the close fills — pass the
   * **sub-account** when closing Virtual Account quotes (the VA frames arrive
   * on its owning sub-account's stream). Defaults to the first child's
   * `vaAddress ?? partyA`.
   */
  notificationsAccount?: Address;
  /** Chain override; defaults to the connected chain. */
  chainId?: number;
}

/**
 * Submission outcome of one {@link UseCloseQuoteGroupReturnType.close} run.
 * Resolves when the bulk request carrying every child close has been
 * **submitted** — settlement is confirmed asynchronously per child (its
 * close-fill notification), tracked via `status` / `steps` /
 * `progressPercent` on the hook.
 */
export interface CloseQuoteGroupSummary {
  /** `true` when every planned child close was submitted successfully. */
  ok: boolean;
  /** Σ quantity already confirmed closed at resolve time, wei. */
  closedQuantity: bigint;
  /** Per-child final states. Empty when planning already failed. */
  steps: CloseQuoteGroupStep[];
  /** Present when the plan itself was infeasible — nothing was closed. */
  planFailure?: PlanGroupCloseFailure;
  /** The error that stopped the run, when `ok` is `false` and a close failed. */
  error?: SymmioRequestError;
}

/** Return type of {@link useCloseQuoteGroup}. */
export interface UseCloseQuoteGroupReturnType {
  /** Plan and execute a group close. Resolves with the run's summary (never rejects). */
  close: (parameters: CloseQuoteGroupParameters) => Promise<CloseQuoteGroupSummary>;
  /** Clear the run state back to `idle`. No-op while a run is in flight. */
  reset: () => void;
  /** Overall run lifecycle. */
  status: CloseQuoteGroupStatus;
  /** `true` while a run is in flight. */
  isClosing: boolean;
  /** Quantity-weighted completion, `0`–`100` (2-decimal resolution). */
  progressPercent: number;
  /** Σ quantity closed so far in the current/last run, wei. */
  closedQuantity: bigint;
  /** The run's target, wei (`0` while idle). */
  targetQuantity: bigint;
  /** Per-child close states of the current/last run, in execution order. */
  steps: CloseQuoteGroupStep[];
  /** Planning failure of the last run, when the plan was infeasible. */
  planFailure?: PlanGroupCloseFailure;
  /** The error that stopped the last run, when a child close failed. */
  error?: SymmioRequestError;
}

/** Parameters for {@link useCloseQuoteGroup}. */
export type UseCloseQuoteGroupParameters = ConfigParameter;

interface RunState {
  status: CloseQuoteGroupStatus;
  steps: CloseQuoteGroupStep[];
  closedQuantity: bigint;
  targetQuantity: bigint;
  planFailure?: PlanGroupCloseFailure;
  error?: SymmioRequestError;
}

const IDLE: RunState = { status: "idle", steps: [], closedQuantity: 0n, targetQuantity: 0n };

/**
 * Close an exact quantity across a grouped position, child by child.
 *
 * The run first plans the allocation with `planGroupClose` (largest child
 * first; every partially closed child keeps at least the symbol's
 * `minAcceptableQuoteValue`; the plan sums to the target exactly or fails
 * without closing anything). It then submits **every allocation in one bulk
 * request** (`instantCloseBulkAuto` — n operations, one endpoint call). A
 * submitted child stays `closing` until its close settles: the hook watches
 * the account's live notifications and flips the child to `closed` — advancing
 * `closedQuantity` / `progressPercent` — when its **close fill** frame arrives
 * (`lastSeenAction: FillMarketOrderInstantClose` / `FillLimitOrderClose` with
 * `success`); `status` becomes `success` once every child confirms, and a
 * `failed` frame fails that step and the run. A rejected bulk submit fails the
 * whole run at once.
 *
 * @example
 * ```tsx
 * const { close, status, progressPercent, steps } = useCloseQuoteGroup();
 * const summary = await close({
 *   group, targetQuantity: parseUnits("2.8", 18),
 *   minAcceptableQuoteValue: market.minAcceptableQuoteValue, slippage: 5,
 * });
 * if (!summary.ok) showError(summary.planFailure ?? summary.error);
 * ```
 */
export function useCloseQuoteGroup(parameters: UseCloseQuoteGroupParameters = {}): UseCloseQuoteGroupReturnType {
  const config = useSymmioConfig(parameters);
  const connectedChainId = useSymmioChainId();
  const queryClient = useQueryClient();
  const [state, setState] = useState<RunState>(IDLE);
  /** Mirror of `state` for the notification callback and the submit loop (single source). */
  const runRef = useRef<RunState>(IDLE);
  const inFlight = useRef(false);
  /** Account whose notification stream confirms the run's closes. */
  const [watchAccount, setWatchAccount] = useState<Address>();
  const watchChainIdRef = useRef<number | undefined>(undefined);

  const commit = useCallback((next: RunState) => {
    runRef.current = next;
    setState(next);
  }, []);

  /**
   * Settlement tracking: a submitted child is finished when its close **fill**
   * notification arrives — `lastSeenAction` of `FillMarketOrderInstantClose`
   * (or `FillLimitOrderClose`) with a `success` status. That flips the step to
   * `closed` and advances progress; the run finishes (`success`) once every
   * step is closed. A `failed` frame for the quote marks the step (and run)
   * failed instead. Request-stage frames (`InstantRequestToClosePosition`, …)
   * are ignored.
   */
  const onNotification = useCallback(
    (notification: Notification) => {
      const run = runRef.current;
      const index = run.steps.findIndex(
        (step) => step.status === "closing" && String(step.quoteId) === notification.quoteId,
      );
      if (index < 0) return;

      const isCloseFill =
        notification.type === NotificationType.SUCCESS &&
        notification.lastSeenAction !== null &&
        CLOSE_FILL_ACTIONS.has(notification.lastSeenAction);
      const isFailure = notification.type === NotificationType.FAILED;
      if (!isCloseFill && !isFailure) return;

      const steps = [...run.steps];
      let closedQuantity = run.closedQuantity;
      if (isCloseFill) {
        const step = { ...steps[index]!, status: "closed" as const };
        closedQuantity += step.closeQuantity;
        steps[index] = step;
        const allClosed = steps.every((entry) => entry.status === "closed");
        const status = run.status === "closing" && allClosed ? "success" : run.status;
        commit({ ...run, steps, closedQuantity, status });
        return;
      }
      const error = normalizeSymmError(new Error(notification.failureMessage ?? "Close failed on the solver."));
      steps[index] = { ...steps[index]!, status: "failed", error };
      commit({ ...run, steps, status: "failed", error });
    },
    [commit],
  );

  useNotifications({
    account: watchAccount,
    chainId: watchChainIdRef.current,
    config: parameters.config,
    // Listen while any submitted child still awaits its settle notifications —
    // even after a later submit failed, the earlier closes keep confirming.
    enabled: Boolean(watchAccount) && state.steps.some((step) => step.status === "closing"),
    onNotification,
  });

  const close = useCallback(
    async (runParameters: CloseQuoteGroupParameters): Promise<CloseQuoteGroupSummary> => {
      if (inFlight.current || runRef.current.steps.some((step) => step.status === "closing")) {
        return {
          ok: false,
          closedQuantity: 0n,
          steps: [],
          error: normalizeSymmError(new Error("A group close is already in flight.")),
        };
      }

      const { group, targetQuantity, minAcceptableQuoteValue, slippage, markPrice, from, notificationsAccount } =
        runParameters;
      const chainId = runParameters.chainId ?? connectedChainId;

      const candidates = toGroupCloseCandidates(group.quotes, minAcceptableQuoteValue);
      const plan = planGroupClose(candidates, targetQuantity);
      if (!plan.feasible) {
        commit({ status: "failed", steps: [], closedQuantity: 0n, targetQuantity, planFailure: plan });
        return { ok: false, closedQuantity: 0n, steps: [], planFailure: plan };
      }

      const childByKey = new Map<string, UnifiedQuote>(group.quotes.map((quote) => [quote.key, quote]));
      const steps: CloseQuoteGroupStep[] = plan.allocations.map((allocation) => ({
        key: allocation.key,
        // The planner only emits candidates built from anchored children, so the id is present.
        quoteId: childByKey.get(allocation.key)!.quoteId!,
        closeQuantity: allocation.closeQuantity,
        kind: allocation.kind,
        status: "queued",
      }));

      inFlight.current = true;
      const firstChild = childByKey.get(steps[0]!.key)!;
      watchChainIdRef.current = chainId;
      setWatchAccount(notificationsAccount ?? firstChild.vaAddress ?? firstChild.partyA);

      // Every allocation submits in ONE bulk round-trip, so all steps go `closing` together.
      commit({
        status: "closing",
        steps: steps.map((step) => ({ ...step, status: "closing" as const })),
        closedQuantity: 0n,
        targetQuantity,
      });

      const base = instantCloseBulkAutoMutationOptions(config);
      try {
        await base.mutationFn({
          orders: steps.map((step) => {
            const child = childByKey.get(step.key)!;
            return {
              partyA: child.vaAddress ?? child.partyA,
              market: { id: Number(child.symbolId) },
              positionType: child.positionType,
              quoteId: step.quoteId,
              quantityToClose: formatUnits(step.closeQuantity, WEI_DECIMALS),
              slippage,
              markPrice,
            };
          }),
          from,
          chainId,
        });
      } catch (err) {
        const error = normalizeSymmError(err);
        const run = runRef.current;
        commit({
          ...run,
          status: "failed",
          steps: run.steps.map((step) =>
            step.status === "closing" ? { ...step, status: "failed" as const, error } : step,
          ),
          error,
        });
        return { ok: false, closedQuantity: runRef.current.closedQuantity, steps: [...runRef.current.steps], error };
      } finally {
        inFlight.current = false;
      }

      // Surface the fresh closing rows immediately, exactly like the single-close hook.
      const configKey = config.getChainConfigKey(chainId);
      void queryClient.invalidateQueries({ predicate: predicateMatch(getInstantClosesQueryKey, { configKey }) });

      // Submitted. Completion is notification-driven; fast fills may already have
      // finished the run while the request was in flight.
      const run = runRef.current;
      if (run.status === "closing" && run.steps.every((step) => step.status === "closed")) {
        commit({ ...run, status: "success" });
      }
      return { ok: true, closedQuantity: runRef.current.closedQuantity, steps: [...runRef.current.steps] };
    },
    [commit, config, connectedChainId, queryClient],
  );

  const reset = useCallback(() => {
    if (inFlight.current) return;
    watchChainIdRef.current = undefined;
    setWatchAccount(undefined);
    commit(IDLE);
  }, [commit]);

  const progressPercent = useMemo(() => {
    if (state.targetQuantity <= 0n) return 0;
    return Number((state.closedQuantity * 10_000n) / state.targetQuantity) / 100;
  }, [state.closedQuantity, state.targetQuantity]);

  return {
    close,
    reset,
    status: state.status,
    isClosing: state.status === "closing",
    progressPercent,
    closedQuantity: state.closedQuantity,
    targetQuantity: state.targetQuantity,
    steps: state.steps,
    planFailure: state.planFailure,
    error: state.error,
  };
}
