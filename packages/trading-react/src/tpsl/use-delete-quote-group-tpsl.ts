"use client";

import {
  deleteQuoteTpSlMutationOptions,
  planGroupTpSlDelete,
  type ConfigParameter,
  type GroupTpSlChild,
  type GroupTpSlDeleteScope,
  type PlanGroupTpSlDeleteResult,
  type TpSlConditionalOrderType,
} from "@symmio/trading-core";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Address } from "viem";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import {
  awaitTpSlConfirmation,
  DEFAULT_TPSL_CONFIRMATION_TIMEOUT_MS,
  TPSL_CONFIRMATION_TIMEOUT_CODE,
  tpslConfirmationTimeoutError,
} from "./await-tpsl-confirmation";
import { invalidateTpSlReads } from "./invalidate-tpsl";
import { runWithConcurrency } from "./run-with-concurrency";
import { isCancelSideSettled } from "./settled-side";
import { startTpSlFallbackPoll, type TpSlPollWaitingSide } from "./tpsl-fallback-poll";
import { useTpSlRecords, useTpSlStore } from "./tpsl-store";
import { dedupeAddresses, useWatchTpSlAccounts } from "./use-watch-tpsl-accounts";

/**
 * Lifecycle of one cancel inside a grouped TP/SL delete run: `queued` →
 * `deleting` (request in flight) → `confirming` (handler returned 200) →
 * `done` (the WebSocket reported the order gone), or `failed`.
 */
export type DeleteQuoteGroupTpSlStepStatus = "queued" | "deleting" | "confirming" | "done" | "failed";

/** Live state of one cancel. */
export interface DeleteQuoteGroupTpSlStep {
  /** Stable step identity, `"<childKey>:<side>"`. */
  id: string;
  /** Child identity (`GroupTpSlChild.key`). */
  key: string;
  /** On-chain quote id. */
  quoteId: bigint;
  /** Side being cancelled. */
  conditionalOrderType: TpSlConditionalOrderType;
  /** Handler-issued conditional-order id being cancelled. */
  cohQuoteId: string;
  /** Current stage. */
  status: DeleteQuoteGroupTpSlStepStatus;
  /** Normalized error, when `status` is `"failed"`. */
  error?: SymmioRequestError;
}

/** Overall lifecycle of a grouped TP/SL delete run. */
export type DeleteQuoteGroupTpSlStatus =
  | "idle"
  /** At least one cancel is in flight. */
  | "deleting"
  /** Every request settled; at least one cancel still awaits its handler report. */
  | "confirming"
  /** Every cancel is confirmed gone. */
  | "success"
  /** Some cancels were accepted, some failed. */
  | "partial"
  /** Every cancel failed. */
  | "failed";

/** Inputs for one {@link UseDeleteQuoteGroupTpSlReturnType.deleteOrders} run. */
export interface DeleteQuoteGroupTpSlParameters {
  /** Children with their confirmed snapshots — from {@link useQuoteGroupTpSl}. */
  children: readonly GroupTpSlChild[];
  /** Which side(s) to cancel. Default `"all"`. */
  scope?: GroupTpSlDeleteScope;
  /**
   * Accounts whose live streams confirm the cancels. Defaults to the deduped
   * Virtual Account of every order the plan targets — the channel the handler
   * reports them gone on.
   */
  notificationsAccounts?: readonly Address[];
  /**
   * Single-account form of {@link DeleteQuoteGroupTpSlParameters.notificationsAccounts}.
   *
   * @deprecated Pass `notificationsAccounts`. A grouped position can span
   *   Virtual Accounts, so one address rarely covers the whole run.
   */
  notificationsAccount?: Address;
  /**
   * How long a cancel may wait for its report before the run refetches the
   * handler's rows and, failing that, gives up on it. Defaults to
   * {@link DEFAULT_TPSL_CONFIRMATION_TIMEOUT_MS}.
   */
  confirmationTimeoutMs?: number;
  /**
   * How long the WebSocket report gets on its own before the fallback sweep
   * starts, in milliseconds. Defaults to {@link TPSL_FALLBACK_POLL_DELAY_MS}.
   */
  fallbackPollDelayMs?: number;
  /**
   * Cadence of the fallback sweep once it has started, in milliseconds.
   * Defaults to {@link TPSL_FALLBACK_POLL_INTERVAL_MS}; `0` disables it.
   */
  fallbackPollIntervalMs?: number;
  /** Delegated session key to sign from, when delegation is active. */
  from?: Address;
  /**
   * How many cancels may be in flight at once. Default `4` — a cancel is a
   * short signed request with no price to confirm, so a bounded pool is a large
   * UX win over serializing. Set `1` when signing with a popup wallet.
   */
  concurrency?: number;
  /** Chain override; defaults to the connected chain. */
  chainId?: number;
  /** Restrict the run to these `"<childKey>:<side>"` step ids — the retry-failed-only path. */
  only?: readonly string[];
}

/**
 * Outcome of one delete run, reported once the handler has confirmed every
 * cancel gone — or the run has given up waiting for it.
 */
export interface DeleteQuoteGroupTpSlSummary {
  /** `true` when every planned cancel was accepted **and** confirmed gone. */
  ok: boolean;
  /** Cancels the handler accepted. */
  deletedCount: number;
  /** Cancels the handler's report confirmed gone. */
  confirmedCount: number;
  /** Cancels that failed. */
  failedCount: number;
  /** Per-step final states at resolve time. */
  steps: DeleteQuoteGroupTpSlStep[];
  /** The plan the run executed — inspect `skipped` for in-flight or local-only sides. */
  plan: PlanGroupTpSlDeleteResult;
  /** First error, when any cancel failed. */
  error?: SymmioRequestError;
}

/** Return type of {@link useDeleteQuoteGroupTpSl}. */
export interface UseDeleteQuoteGroupTpSlReturnType {
  /**
   * Plan and execute a grouped cancel. Resolves once the handler has reported
   * every order gone or the run gave up waiting (never rejects).
   */
  deleteOrders: (parameters: DeleteQuoteGroupTpSlParameters) => Promise<DeleteQuoteGroupTpSlSummary>;
  /** Re-run only the cancels that failed, against fresh children when supplied. Never rejects. */
  retryFailed: (children?: readonly GroupTpSlChild[]) => Promise<DeleteQuoteGroupTpSlSummary>;
  /** Clear the run state back to `idle`. No-op while a run is in flight. */
  reset: () => void;
  /** Overall run lifecycle. */
  status: DeleteQuoteGroupTpSlStatus;
  /** `true` while a cancel request is in flight. */
  isDeleting: boolean;
  /** `true` while every request has settled but some cancel still awaits its handler report. */
  isConfirming: boolean;
  /**
   * Step-weighted completion, `0`–`100` (2-decimal resolution). A cancel the
   * handler accepted but has not reported gone yet does **not** count.
   */
  progressPercent: number;
  /** Per-step states of the current/last run, in execution order. */
  steps: DeleteQuoteGroupTpSlStep[];
  /** The last run's plan. */
  plan?: PlanGroupTpSlDeleteResult;
  /** First error of the last run, when a cancel failed. */
  error?: SymmioRequestError;
}

/** Parameters for {@link useDeleteQuoteGroupTpSl}. */
export type UseDeleteQuoteGroupTpSlParameters = ConfigParameter;

interface RunState {
  status: DeleteQuoteGroupTpSlStatus;
  steps: DeleteQuoteGroupTpSlStep[];
  plan?: PlanGroupTpSlDeleteResult;
  error?: SymmioRequestError;
}

const IDLE: RunState = { status: "idle", steps: [] };

/** A plan that found nothing — returned when a run never got off the ground. */
const EMPTY_PLAN: PlanGroupTpSlDeleteResult = { targets: [], skipped: [], isNoop: true };

/**
 * Cancel take-profit / stop-loss orders across a grouped position.
 *
 * `planGroupTpSlDelete` enumerates the cancellable orders first, reading each
 * `cohQuoteId` off the child's **confirmed** snapshot — never off an edit
 * buffer — and excluding sides that are still mid-flight. The cancels then run
 * through a bounded worker pool (4 at a time by default) with no
 * short-circuit: one rejection fails only its own step.
 *
 * A cancel goes `confirming` on a 200 and `done` when the WebSocket reports the
 * order gone.
 *
 * @param parameters - Optional config override.
 * @returns The run controls and its live per-step state.
 *
 * @example
 * ```tsx
 * const { deleteOrders, steps } = useDeleteQuoteGroupTpSl();
 * const summary = await deleteOrders({ children, scope: "all" });
 * ```
 */
export function useDeleteQuoteGroupTpSl(
  parameters: UseDeleteQuoteGroupTpSlParameters = {},
): UseDeleteQuoteGroupTpSlReturnType {
  const config = useSymmioConfig(parameters);
  const connectedChainId = useSymmioChainId();
  const queryClient = useQueryClient();
  const [state, setState] = useState<RunState>(IDLE);
  const runRef = useRef<RunState>(IDLE);
  const inFlight = useRef(false);
  const lastRunRef = useRef<DeleteQuoteGroupTpSlParameters | undefined>(undefined);
  const [watchAccounts, setWatchAccounts] = useState<Address[]>([]);
  const watchChainIdRef = useRef<number | undefined>(undefined);

  const commit = useCallback((next: RunState) => {
    runRef.current = next;
    setState(next);
  }, []);

  /** Confirming steps' quote ids — the frames this run is listening for. */
  const confirmingIds = useMemo(
    () => Array.from(new Set(state.steps.filter((step) => step.status === "confirming").map((step) => step.quoteId))),
    [state.steps],
  );

  /**
   * Watch every Virtual Account the run touches. Frames land in the shared
   * store and resolution reads that store, so a cancel confirms no matter which
   * subscription delivered the `gone` frame.
   */
  useWatchTpSlAccounts({
    accounts: watchAccounts,
    ids: confirmingIds,
    chainId: watchChainIdRef.current,
    config: parameters.config,
    enabled: watchAccounts.length > 0 && confirmingIds.length > 0,
  });

  /** Reconcile confirming cancels against the store. Safe to call at any time. */
  const settle = useCallback(() => {
    const run = runRef.current;
    if (!run.steps.some((step) => step.status === "confirming")) return;
    const next = settleSteps(run.steps);
    if (next) commit({ ...run, steps: next, status: resolveStatus(next) });
  }, [commit]);

  // Keep the rendered state in step with the store while this hook is mounted.
  // The run's own waiter drives the same reconcile off its store subscription,
  // so a run still resolves after the component unmounts.
  const confirmingRecords = useTpSlRecords(confirmingIds);
  useEffect(() => {
    settle();
  }, [confirmingRecords, settle]);

  const run = useCallback(
    async (runParameters: DeleteQuoteGroupTpSlParameters): Promise<DeleteQuoteGroupTpSlSummary> => {
      if (inFlight.current) {
        return {
          ok: false,
          deletedCount: 0,
          confirmedCount: 0,
          failedCount: 0,
          steps: [],
          plan: EMPTY_PLAN,
          error: normalizeSymmError(new Error("A grouped TP/SL cancel is already in flight.")),
        };
      }

      const chainId = runParameters.chainId ?? connectedChainId;
      const plan = planGroupTpSlDelete(runParameters.children, runParameters.scope);
      const allowed = runParameters.only === undefined ? undefined : new Set(runParameters.only);
      const targets = plan.targets.filter((target) => allowed === undefined || allowed.has(stepIdOf(target)));

      const steps: DeleteQuoteGroupTpSlStep[] = targets.map((target) => ({
        id: stepIdOf(target),
        key: target.key,
        quoteId: target.quoteId,
        conditionalOrderType: target.conditionalOrderType,
        cohQuoteId: target.cohQuoteId,
        status: "queued",
      }));
      /** Which Virtual Account each targeted order lives under. */
      const virtualAccountByQuoteId = new Map<bigint, Address>();
      for (const target of targets) virtualAccountByQuoteId.set(target.quoteId, target.virtualAccount);

      lastRunRef.current = runParameters;
      watchChainIdRef.current = chainId;
      setWatchAccounts(watchAccountsOf(runParameters, targets));
      commit({ status: targets.length > 0 ? "deleting" : "success", steps, plan });
      if (targets.length === 0) {
        return { ok: true, deletedCount: 0, confirmedCount: 0, failedCount: 0, steps, plan };
      }

      inFlight.current = true;
      const base = deleteQuoteTpSlMutationOptions(config);
      const markConfirming = useTpSlStore.getState().markConfirming;

      function patchStep(id: string, mutate: (step: DeleteQuoteGroupTpSlStep) => DeleteQuoteGroupTpSlStep): void {
        const current = runRef.current;
        const index = current.steps.findIndex((step) => step.id === id);
        if (index < 0) return;
        const next = [...current.steps];
        next[index] = mutate(next[index]!);
        commit({ ...current, steps: next, status: resolveStatus(next) });
      }

      const cancelOne = async (target: PlanGroupTpSlDeleteResult["targets"][number]) => {
        const id = stepIdOf(target);
        patchStep(id, (step) => ({ ...step, status: "deleting" }));
        try {
          await base.mutationFn({
            quoteId: target.quoteId,
            virtualAccount: target.virtualAccount,
            cohQuoteId: target.cohQuoteId,
            conditionalOrderType: target.conditionalOrderType,
            from: runParameters.from,
            chainId,
          });
          markConfirming(target.quoteId, target.conditionalOrderType === "take_profit" ? "tp" : "sl", {
            intent: "cancel",
          });
          patchStep(id, (step) => ({ ...step, status: "confirming" }));
        } catch (err) {
          const error = normalizeSymmError(err);
          patchStep(id, (step) => ({ ...step, status: "failed", error }));
        }
      };

      /**
       * Stop waiting on the cancels the handler never reported. Their
       * store-side guard is dropped first, so the refetch that follows writes
       * the handler's real rows through.
       */
      function expirePending(): void {
        const store = useTpSlStore.getState();
        const expired: bigint[] = [];
        for (const step of runRef.current.steps) {
          if (step.status !== "confirming") continue;
          store.clearConfirming(step.quoteId, step.conditionalOrderType === "take_profit" ? "tp" : "sl");
          expired.push(step.quoteId);
        }
        if (expired.length === 0) return;
        const error = tpslConfirmationTimeoutError();
        const current = runRef.current;
        const next = current.steps.map((step) =>
          step.status === "confirming" ? { ...step, status: "failed" as const, error } : step,
        );
        commit({ ...current, steps: next, status: resolveStatus(next), error: current.error ?? error });
        void invalidateTpSlReads(queryClient, expired);
      }

      try {
        await runWithConcurrency(targets, runParameters.concurrency ?? 4, cancelOne);

        // Every request has been answered; now wait for the handler to report
        // each accepted cancel gone. Refetching is the fallback, not the
        // signal, so it fires only once a report is overdue.
        await awaitTpSlConfirmation({
          settle,
          hasPending: () => runRef.current.steps.some((step) => step.status === "confirming"),
          onTimeout: () =>
            void invalidateTpSlReads(
              queryClient,
              runRef.current.steps.filter((step) => step.status === "confirming").map((step) => step.quoteId),
            ),
          onExpire: expirePending,
          onWait: () =>
            startTpSlFallbackPoll(config, {
              chainId,
              delayMs: runParameters.fallbackPollDelayMs,
              intervalMs: runParameters.fallbackPollIntervalMs,
              getWaiting: () => waitingSidesOf(runRef.current.steps, virtualAccountByQuoteId),
            }).stop,
          timeoutMs: runParameters.confirmationTimeoutMs ?? DEFAULT_TPSL_CONFIRMATION_TIMEOUT_MS,
        });
      } finally {
        inFlight.current = false;
      }

      const finalSteps = runRef.current.steps;
      const failed = finalSteps.filter((step) => step.status === "failed");
      const confirmed = finalSteps.filter((step) => step.status === "done");
      /** Accepted but never reported gone — the handler took it, the confirmation never came. */
      const unconfirmed = failed.filter((step) => step.error?.code === TPSL_CONFIRMATION_TIMEOUT_CODE);
      commit({ ...runRef.current, status: resolveStatus(finalSteps), error: failed[0]?.error });

      // Reconcile against the handler's rows now that the run is over.
      void invalidateTpSlReads(
        queryClient,
        confirmed.map((step) => step.quoteId),
      );

      return {
        ok: failed.length === 0,
        deletedCount: confirmed.length + unconfirmed.length,
        confirmedCount: confirmed.length,
        failedCount: failed.length,
        steps: [...finalSteps],
        plan,
        error: failed[0]?.error,
      };
    },
    [commit, config, connectedChainId, queryClient, settle],
  );

  const retryFailed = useCallback(
    async (children?: readonly GroupTpSlChild[]): Promise<DeleteQuoteGroupTpSlSummary> => {
      const last = lastRunRef.current;
      const failedIds = runRef.current.steps.filter((step) => step.status === "failed").map((step) => step.id);
      if (!last || failedIds.length === 0) {
        return {
          ok: true,
          deletedCount: 0,
          confirmedCount: 0,
          failedCount: 0,
          steps: [...runRef.current.steps],
          plan: runRef.current.plan ?? EMPTY_PLAN,
        };
      }
      return run({ ...last, children: children ?? last.children, only: failedIds });
    },
    [run],
  );

  const reset = useCallback(() => {
    if (inFlight.current) return;
    watchChainIdRef.current = undefined;
    setWatchAccounts([]);
    lastRunRef.current = undefined;
    commit(IDLE);
  }, [commit]);

  const progressPercent = useMemo(() => {
    if (state.steps.length === 0) return 0;
    /** A cancel the handler accepted but has not reported gone is not progress yet. */
    const settled = state.steps.filter((step) => step.status === "done" || step.status === "failed").length;
    return Math.round((settled / state.steps.length) * 10_000) / 100;
  }, [state.steps]);

  return {
    deleteOrders: run,
    retryFailed,
    reset,
    status: state.status,
    isDeleting: state.status === "deleting",
    isConfirming: state.status === "confirming",
    progressPercent,
    steps: state.steps,
    plan: state.plan,
    error: state.error,
  };
}

/** Stable per-side step identity. */
function stepIdOf(target: { key: string; conditionalOrderType: TpSlConditionalOrderType }): string {
  return `${target.key}:${target.conditionalOrderType}`;
}

/**
 * Reconcile confirming cancels against the shared store: a cancel is `done`
 * once the store shows that side gone.
 *
 * @param steps - The run's current steps.
 * @returns The updated list, or `undefined` when nothing moved.
 */
function settleSteps(steps: DeleteQuoteGroupTpSlStep[]): DeleteQuoteGroupTpSlStep[] | undefined {
  const store = useTpSlStore.getState();
  let changed = false;
  const next = steps.map((step) => {
    if (step.status !== "confirming") return step;
    const record = store.get(step.quoteId);
    if (!record || !isCancelSideSettled(record, step.conditionalOrderType)) return step;
    changed = true;
    return { ...step, status: "done" as const };
  });
  return changed ? next : undefined;
}

/**
 * The cancels this run is still waiting on, in the shape the fallback sweep
 * needs. Each carries the `cohQuoteId` that must disappear — the sweep confirms
 * a cancel by that specific order going away, not by an empty result.
 */
function waitingSidesOf(
  steps: readonly DeleteQuoteGroupTpSlStep[],
  accounts: ReadonlyMap<bigint, Address>,
): TpSlPollWaitingSide[] {
  const waiting: TpSlPollWaitingSide[] = [];
  for (const step of steps) {
    if (step.status !== "confirming") continue;
    const account = accounts.get(step.quoteId);
    if (!account) continue;
    waiting.push({
      quoteId: step.quoteId,
      side: step.conditionalOrderType,
      intent: "cancel",
      cohQuoteId: step.cohQuoteId,
      account,
    });
  }
  return waiting;
}

/**
 * The accounts whose streams report on this run — every Virtual Account the
 * targeted orders live under, deduped.
 */
function watchAccountsOf(
  parameters: DeleteQuoteGroupTpSlParameters,
  targets: PlanGroupTpSlDeleteResult["targets"],
): Address[] {
  if (parameters.notificationsAccounts) return dedupeAddresses(parameters.notificationsAccounts);
  if (parameters.notificationsAccount) return [parameters.notificationsAccount];
  return dedupeAddresses(targets.map((target) => target.virtualAccount));
}

/**
 * Derive the run status from the current step list. `confirming` outranks
 * `partial` so a failure elsewhere cannot make the status terminal while
 * another cancel still awaits its report.
 */
function resolveStatus(steps: DeleteQuoteGroupTpSlStep[]): DeleteQuoteGroupTpSlStatus {
  if (steps.length === 0) return "success";
  if (steps.some((step) => step.status === "queued" || step.status === "deleting")) return "deleting";
  if (steps.some((step) => step.status === "confirming")) return "confirming";
  const failed = steps.filter((step) => step.status === "failed").length;
  if (failed === steps.length) return "failed";
  if (failed > 0) return "partial";
  return "success";
}
