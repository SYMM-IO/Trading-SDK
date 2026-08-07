"use client";

import {
  deleteQuoteTpSlMutationOptions,
  planGroupTpSlDelete,
  type ConfigParameter,
  type GroupTpSlChild,
  type GroupTpSlDeleteScope,
  type PlanGroupTpSlDeleteResult,
  type TpSlConditionalOrderType,
  type TpSlNotification,
} from "@symmio/trading-core";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Address } from "viem";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { invalidateTpSlReads } from "./invalidate-tpsl";
import { linkTpSlNotificationIds, matchTpSlNotification } from "./match-tpsl-notification";
import { runWithConcurrency } from "./run-with-concurrency";
import { isCancelSideSettled } from "./settled-side";
import { useTpSlRecords, useTpSlStore } from "./tpsl-store";
import { useWatchTpSlNotifications } from "./use-watch-tpsl-notifications";

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
  /** Account whose live stream confirms the cancels. Defaults to each child's Virtual Account owner. */
  notificationsAccount?: Address;
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

/** Outcome of one delete run. */
export interface DeleteQuoteGroupTpSlSummary {
  /** `true` when every planned cancel was accepted by the handler. */
  ok: boolean;
  /** Cancels the handler accepted. */
  deletedCount: number;
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
  /** Plan and execute a grouped cancel. Resolves with the run's summary (never rejects). */
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
  /** Step-weighted completion, `0`–`100` (2-decimal resolution). */
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
  const [watchAccount, setWatchAccount] = useState<Address>();
  const watchChainIdRef = useRef<number | undefined>(undefined);

  const commit = useCallback((next: RunState) => {
    runRef.current = next;
    setState(next);
  }, []);

  /** Confirming steps' quote ids, read live inside the socket handler. */
  const confirmingIds = useMemo(
    () => Array.from(new Set(state.steps.filter((step) => step.status === "confirming").map((step) => step.quoteId))),
    [state.steps],
  );
  const confirmingIdsRef = useRef(confirmingIds);
  confirmingIdsRef.current = confirmingIds;

  /**
   * This hook's own subscription feeds the shared store — it does **not**
   * resolve steps directly. Resolution is driven by the store (below), fed by
   * every TP/SL signal: this subscription, a co-mounted read hook's VA-channel
   * subscription, and the success refetch. So a cancel confirms no matter which
   * channel delivered the `gone` frame.
   */
  const onNotification = useCallback((notification: TpSlNotification) => {
    linkTpSlNotificationIds(notification);
    const target = matchTpSlNotification(notification, confirmingIdsRef.current);
    if (target !== undefined) useTpSlStore.getState().applyNotification(target, notification);
  }, []);

  useWatchTpSlNotifications({
    account: watchAccount,
    chainId: watchChainIdRef.current,
    config: parameters.config,
    enabled: Boolean(watchAccount) && confirmingIds.length > 0,
    onNotification,
  });

  // The single source of cancel resolution: reconcile confirming steps against
  // the shared store whenever it changes.
  const confirmingRecords = useTpSlRecords(confirmingIds);
  useEffect(() => {
    const run = runRef.current;
    if (!run.steps.some((step) => step.status === "confirming")) return;
    const store = useTpSlStore.getState();
    let changed = false;
    const steps = run.steps.map((step) => {
      if (step.status !== "confirming") return step;
      const record = store.get(step.quoteId);
      if (!record || !isCancelSideSettled(record, step.conditionalOrderType)) return step;
      changed = true;
      return { ...step, status: "done" as const };
    });
    if (changed) commit({ ...run, steps, status: resolveStatus(steps) });
  }, [confirmingRecords, commit]);

  const run = useCallback(
    async (runParameters: DeleteQuoteGroupTpSlParameters): Promise<DeleteQuoteGroupTpSlSummary> => {
      if (inFlight.current) {
        return {
          ok: false,
          deletedCount: 0,
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

      lastRunRef.current = runParameters;
      watchChainIdRef.current = chainId;
      setWatchAccount(runParameters.notificationsAccount ?? targets[0]?.virtualAccount);
      commit({ status: targets.length > 0 ? "deleting" : "success", steps, plan });
      if (targets.length === 0) {
        return { ok: true, deletedCount: 0, failedCount: 0, steps, plan };
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
          markConfirming(target.quoteId, target.conditionalOrderType === "take_profit" ? "tp" : "sl");
          patchStep(id, (step) => ({ ...step, status: "confirming" }));
        } catch (err) {
          const error = normalizeSymmError(err);
          patchStep(id, (step) => ({ ...step, status: "failed", error }));
        }
      };

      try {
        await runWithConcurrency(targets, runParameters.concurrency ?? 4, cancelOne);
      } finally {
        inFlight.current = false;
      }

      const finalSteps = runRef.current.steps;
      const failed = finalSteps.filter((step) => step.status === "failed");
      commit({ ...runRef.current, status: resolveStatus(finalSteps) });

      // Refetch the handler's rows for every cancelled leg so the box clears the
      // gone order even when the live WebSocket `cancel` frame never lands.
      void invalidateTpSlReads(
        queryClient,
        finalSteps.filter((step) => step.status === "confirming" || step.status === "done").map((step) => step.quoteId),
      );

      return {
        ok: failed.length === 0,
        deletedCount: finalSteps.filter((step) => step.status === "confirming" || step.status === "done").length,
        failedCount: failed.length,
        steps: [...finalSteps],
        plan,
        error: failed[0]?.error,
      };
    },
    [commit, config, connectedChainId, queryClient],
  );

  const retryFailed = useCallback(
    async (children?: readonly GroupTpSlChild[]): Promise<DeleteQuoteGroupTpSlSummary> => {
      const last = lastRunRef.current;
      const failedIds = runRef.current.steps.filter((step) => step.status === "failed").map((step) => step.id);
      if (!last || failedIds.length === 0) {
        return {
          ok: true,
          deletedCount: 0,
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
    setWatchAccount(undefined);
    lastRunRef.current = undefined;
    commit(IDLE);
  }, [commit]);

  const progressPercent = useMemo(() => {
    if (state.steps.length === 0) return 0;
    const settled = state.steps.filter(
      (step) => step.status === "confirming" || step.status === "done" || step.status === "failed",
    ).length;
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

/** Derive the run status from the current step list. */
function resolveStatus(steps: DeleteQuoteGroupTpSlStep[]): DeleteQuoteGroupTpSlStatus {
  if (steps.length === 0) return "success";
  if (steps.some((step) => step.status === "queued" || step.status === "deleting")) return "deleting";
  const failed = steps.filter((step) => step.status === "failed").length;
  if (failed === steps.length) return "failed";
  if (failed > 0) return "partial";
  if (steps.some((step) => step.status === "confirming")) return "confirming";
  return "success";
}
