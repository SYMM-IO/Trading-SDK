"use client";

import {
  deleteQuoteTpSlMutationOptions,
  planGroupTpSl,
  setQuoteTpSlMutationOptions,
  type ConfigParameter,
  type GroupTpSlAction,
  type GroupTpSlChild,
  type GroupTpSlDesiredMap,
  type GroupTpSlSkipReason,
  type PlanGroupTpSlResult,
  type TpSlConditionalOrderType,
  type TpSlConfig,
  type TpSlValidation,
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
import { isCancelSideSettled, isWriteSideSettled } from "./settled-side";
import { startTpSlFallbackPoll, type TpSlPollWaitingSide } from "./tpsl-fallback-poll";
import { useTpSlRecords, useTpSlStore } from "./tpsl-store";
import { dedupeAddresses, useWatchTpSlAccounts } from "./use-watch-tpsl-accounts";

/**
 * Lifecycle of one step inside a grouped TP/SL run:
 * `queued` → `submitting` (request in flight) → `confirming` (handler returned
 * 200) → `done` (the WebSocket reported the order live, or gone for a cancel),
 * or `failed`, or `skipped` (the plan decided the leg needs no write).
 */
export type SetQuoteGroupTpSlStepStatus = "queued" | "submitting" | "confirming" | "done" | "failed" | "skipped";

/** What a step does. A leg can produce a `cancel` **and** a `write` in one run. */
export type SetQuoteGroupTpSlStepKind = "write" | "cancel" | "skip";

/** Live state of one step. */
export interface SetQuoteGroupTpSlStep {
  /**
   * Stable step identity, unique within a run. A leg may yield several steps
   * (cancel one side, write the other), so this — not `key` — is what a
   * consumer should use as a list key.
   */
  id: string;
  /** Leg identity (`GroupTpSlChild.key`). Several steps can share it. */
  key: string;
  /** What this step does. */
  kind: SetQuoteGroupTpSlStepKind;
  /** On-chain quote id. `0n` for a leg the plan skipped before it anchored. */
  quoteId: bigint;
  /**
   * Sides this step still awaits confirmation for. A write starts with the
   * sides it wrote and empties as reports land; a cancel carries exactly one.
   */
  sides: TpSlConditionalOrderType[];
  /** Current stage. */
  status: SetQuoteGroupTpSlStepStatus;
  /** Why the leg was skipped, when `status` is `"skipped"`. */
  skipReason?: GroupTpSlSkipReason;
  /** Per-side validation errors, when `skipReason` is `"invalid"`. */
  validation?: TpSlValidation;
  /** Handler-issued conditional-order id — reported by a write, targeted by a cancel. */
  cohQuoteId?: string;
  /** Normalized error, when `status` is `"failed"`. */
  error?: SymmioRequestError;
}

/** Overall lifecycle of a grouped TP/SL run. */
export type SetQuoteGroupTpSlStatus =
  | "idle"
  /** At least one request is in flight. */
  | "submitting"
  /** Every request settled; at least one step still awaits its handler report. */
  | "confirming"
  /** Every written and cancelled step is confirmed. */
  | "success"
  /** Some steps were accepted, some failed. */
  | "partial"
  /** Every step failed. */
  | "failed";

/** Inputs for one {@link UseSetQuoteGroupTpSlReturnType.set} run. */
export interface SetQuoteGroupTpSlParameters {
  /** Legs with their confirmed snapshots — from {@link useQuoteGroupTpSl}. */
  children: readonly GroupTpSlChild[];
  /** Desired per-leg state, keyed by `GroupTpSlChild.key`. */
  desired: GroupTpSlDesiredMap;
  /** SubAccount that owns every leg's Virtual Account — required in the signed message. */
  subAccount: Address;
  /** Market price precision. One value per run — a grouped position is one market. */
  pricePrecision: number;
  /** Live handler `/configs/` rules; with `referencePrice`, invalid legs are skipped, not submitted. */
  config?: TpSlConfig;
  /** Reference price for validation (decimal string) — pass the live mark price. */
  referencePrice?: string;
  /** Slippage percent forwarded to every write. Defaults to the SDK's TP/SL default. */
  slippage?: number;
  /** Affiliate override forwarded to every write. */
  affiliate?: Address;
  /** Delegated session key to sign from, when delegation is active. */
  from?: Address;
  /**
   * How many requests may be in flight at once. Default `1` — every leg needs
   * its own EIP-712 signature from the same wallet client, and serializing
   * avoids signature races and simultaneous wallet prompts. Raise it only when
   * signing with a session key.
   */
  concurrency?: number;
  /**
   * Stop the run when the wallet rejects a signature, instead of prompting for
   * every remaining leg. Default `true` — a trader who dismisses one prompt did
   * not consent to five more.
   */
  stopOnUserRejection?: boolean;
  /**
   * Accounts whose live streams confirm the run. Defaults to the deduped
   * Virtual Account of every leg the plan touches — the channel the handler
   * reports these orders on, and the reason a group spanning several VAs is
   * fully covered.
   */
  notificationsAccounts?: readonly Address[];
  /**
   * Single-account form of {@link SetQuoteGroupTpSlParameters.notificationsAccounts}.
   *
   * @deprecated Pass `notificationsAccounts`. A grouped position can span
   *   Virtual Accounts, so one address rarely covers the whole run.
   */
  notificationsAccount?: Address;
  /**
   * How long a step may wait for its report before the run refetches the
   * handler's rows and, failing that, gives up on it. Defaults to
   * {@link DEFAULT_TPSL_CONFIRMATION_TIMEOUT_MS}.
   */
  confirmationTimeoutMs?: number;
  /**
   * How long the WebSocket report gets on its own before the fallback sweep
   * starts, in milliseconds. Defaults to {@link TPSL_FALLBACK_POLL_DELAY_MS}.
   *
   * The sweep exists for reports that never come; while one can still
   * plausibly arrive, reading the handler adds load and answers nothing.
   */
  fallbackPollDelayMs?: number;
  /**
   * Cadence of the fallback sweep once it has started, in milliseconds.
   * Defaults to {@link TPSL_FALLBACK_POLL_INTERVAL_MS}; `0` disables the sweep
   * and leaves the WebSocket report as the only confirmation signal.
   */
  fallbackPollIntervalMs?: number;
  /** Chain override; defaults to the connected chain. */
  chainId?: number;
  /** Restrict the run to these leg keys — the retry-failed-only path. */
  only?: readonly string[];
}

/**
 * Outcome of one run, reported once every step has been confirmed by the
 * handler's report — or given up on. Nothing about the run is still in flight
 * when this resolves.
 */
export interface SetQuoteGroupTpSlSummary {
  /** `true` when every planned step was accepted **and** confirmed. */
  ok: boolean;
  /** Steps the handler accepted (writes and cancels). */
  submittedCount: number;
  /** Steps the handler's report confirmed. */
  confirmedCount: number;
  /** Steps that failed. */
  failedCount: number;
  /** Legs the plan skipped. */
  skippedCount: number;
  /** Per-step final states at resolve time. */
  steps: SetQuoteGroupTpSlStep[];
  /** The plan the run executed — inspect `skips` for why a leg was left out. */
  plan: PlanGroupTpSlResult;
  /** `true` when the run stopped early because the wallet rejected a signature. */
  stoppedByUser: boolean;
  /** First error, when any step failed. */
  error?: SymmioRequestError;
}

/** Return type of {@link useSetQuoteGroupTpSl}. */
export interface UseSetQuoteGroupTpSlReturnType {
  /**
   * Plan and apply. Resolves once every step has been confirmed by the
   * handler's report or given up on (never rejects).
   */
  set: (parameters: SetQuoteGroupTpSlParameters) => Promise<SetQuoteGroupTpSlSummary>;
  /**
   * Re-run only the steps that failed, against fresh children when supplied
   * (so a leg that confirmed via a race is diffed away). Steps that already
   * succeeded are preserved, not reset. Never rejects.
   */
  retryFailed: (children?: readonly GroupTpSlChild[]) => Promise<SetQuoteGroupTpSlSummary>;
  /** Clear the run state back to `idle`. No-op while a run is in flight. */
  reset: () => void;
  /** Overall run lifecycle. */
  status: SetQuoteGroupTpSlStatus;
  /** `true` while a request is in flight. */
  isSubmitting: boolean;
  /** `true` while every request has settled but some step still awaits its handler report. */
  isConfirming: boolean;
  /**
   * Share of steps that reached a terminal state — confirmed or failed — as
   * `0`–`100` (2-decimal resolution). A step the handler accepted but has not
   * reported on yet does **not** count.
   */
  progressPercent: number;
  /** Steps the handler accepted so far — **excludes** failures. */
  acceptedCount: number;
  /** Steps the handler's report has confirmed so far. */
  confirmedCount: number;
  /** Steps that failed so far. */
  failedCount: number;
  /** Steps the current/last run intends to execute (writes + cancels). */
  totalCount: number;
  /** Per-step states of the current/last run, in execution order. */
  steps: SetQuoteGroupTpSlStep[];
  /** The last run's plan, for UI gating. */
  plan?: PlanGroupTpSlResult;
  /** First error of the last run, when a step failed. */
  error?: SymmioRequestError;
}

/** Parameters for {@link useSetQuoteGroupTpSl}. */
export type UseSetQuoteGroupTpSlParameters = ConfigParameter;

interface RunState {
  status: SetQuoteGroupTpSlStatus;
  steps: SetQuoteGroupTpSlStep[];
  plan?: PlanGroupTpSlResult;
  error?: SymmioRequestError;
}

const IDLE: RunState = { status: "idle", steps: [] };

/** A plan that decided nothing — returned when a run never got off the ground. */
const EMPTY_PLAN: PlanGroupTpSlResult = {
  actions: [],
  sets: [],
  deletes: [],
  skips: [],
  hasInvalid: false,
  isNoop: true,
};

/**
 * Apply a desired take-profit / stop-loss state across a grouped position.
 *
 * The run first diffs the desired state with `planGroupTpSl`, so a leg whose
 * trigger price and price type already match the handler is never re-submitted
 * and a side that did not change is dropped from its request. It then executes
 * the plan — **one signed request per leg, sequentially by default**, because
 * the conditional-order handler has no bulk endpoint and every request needs
 * its own EIP-712 signature.
 *
 * Both halves of the plan run: a side the caller cleared becomes a cancel
 * (`deleteQuoteTpSl`), a side with a new value becomes a write
 * (`setQuoteTpSl`). One leg can do both in the same run.
 *
 * A step goes `confirming` as soon as the handler returns 200 (the shared TP/SL
 * store is marked so the UI can show the target price straight away) and `done`
 * once the WebSocket reports the matching transition — live for a write, gone
 * for a cancel. **`set()` waits for those reports**: it resolves only when every
 * step is confirmed, so a caller that awaits it can trust the exits are real.
 * A step whose report never arrives falls back to the handler's REST rows after
 * `confirmationTimeoutMs` and fails if those do not show it either.
 *
 * A failed step fails only itself and the run ends as `"partial"`, except when
 * the wallet rejects a signature, which stops the run rather than prompting
 * again.
 *
 * @param parameters - Optional config override.
 * @returns The run controls and its live per-step state.
 *
 * @example
 * ```tsx
 * const { set, steps, isConfirming } = useSetQuoteGroupTpSl();
 * // Resolves once the handler has reported every leg live.
 * const summary = await set({ children, desired: editor.desired, subAccount, pricePrecision });
 * if (!summary.ok) showError(summary.error);
 * ```
 */
export function useSetQuoteGroupTpSl(parameters: UseSetQuoteGroupTpSlParameters = {}): UseSetQuoteGroupTpSlReturnType {
  const config = useSymmioConfig(parameters);
  const connectedChainId = useSymmioChainId();
  const queryClient = useQueryClient();
  const [state, setState] = useState<RunState>(IDLE);
  /** Mirror of `state` for the notification callback and the submit loop. */
  const runRef = useRef<RunState>(IDLE);
  const inFlight = useRef(false);
  /** Inputs of the last run, so `retryFailed` can replay them. */
  const lastRunRef = useRef<SetQuoteGroupTpSlParameters | undefined>(undefined);
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
   * Watch every Virtual Account the run touches. The frames land in the shared
   * store rather than here, and step resolution reads that store — so a step
   * advances no matter which subscription delivered the update, including a
   * co-mounted read hook's.
   */
  useWatchTpSlAccounts({
    accounts: watchAccounts,
    ids: confirmingIds,
    chainId: watchChainIdRef.current,
    config: parameters.config,
    enabled: watchAccounts.length > 0 && confirmingIds.length > 0,
  });

  /** Reconcile confirming steps against the store. Safe to call at any time. */
  const settle = useCallback(() => {
    const run = runRef.current;
    if (!run.steps.some((step) => step.status === "confirming")) return;
    const next = settleSteps(run.steps);
    if (next) commit({ ...run, steps: next, status: resolveStatus(next) });
  }, [commit]);

  // Keep the rendered state in step with the store for as long as this hook is
  // mounted. The run's own waiter drives the same reconcile off its store
  // subscription, so a run still resolves after the component unmounts.
  const confirmingRecords = useTpSlRecords(confirmingIds);
  useEffect(() => {
    settle();
    // `confirmingRecords` is the store subscription that drives this; `runRef`
    // and the store are read live.
  }, [confirmingRecords, settle]);

  const run = useCallback(
    async (
      runParameters: SetQuoteGroupTpSlParameters,
      /** Steps from an earlier run to preserve (the retry path). */
      carryOver: SetQuoteGroupTpSlStep[] = [],
    ): Promise<SetQuoteGroupTpSlSummary> => {
      if (inFlight.current) {
        return {
          ok: false,
          submittedCount: 0,
          confirmedCount: 0,
          failedCount: 0,
          skippedCount: 0,
          steps: [],
          plan: EMPTY_PLAN,
          stoppedByUser: false,
          error: normalizeSymmError(new Error("A grouped TP/SL run is already in flight.")),
        };
      }

      const chainId = runParameters.chainId ?? connectedChainId;
      const plan = planGroupTpSl({
        children: runParameters.children,
        desired: runParameters.desired,
        pricePrecision: runParameters.pricePrecision,
        referencePrice: runParameters.referencePrice,
        config: runParameters.config,
        only: runParameters.only,
      });

      /** Walk `plan.actions` so a leg's cancel keeps its planned place before its write. */
      const work = plan.actions.filter((action) => action.action !== "skip");
      /** Which Virtual Account each leg lives under — the account its orders are filed under. */
      const virtualAccountByQuoteId = new Map<bigint, Address>();
      for (const action of plan.actions) {
        if (action.action !== "skip") virtualAccountByQuoteId.set(action.quoteId, action.virtualAccount);
      }
      const steps: SetQuoteGroupTpSlStep[] = [
        ...carryOver,
        ...plan.actions.map<SetQuoteGroupTpSlStep>((action) => toStep(action)),
      ];

      lastRunRef.current = runParameters;
      watchChainIdRef.current = chainId;
      setWatchAccounts(watchAccountsOf(runParameters, plan));
      commit({ status: work.length > 0 ? "submitting" : resolveStatus(steps), steps, plan });
      if (work.length === 0) {
        return {
          ok: true,
          submittedCount: 0,
          confirmedCount: 0,
          failedCount: 0,
          skippedCount: plan.skips.length,
          steps,
          plan,
          stoppedByUser: false,
        };
      }

      inFlight.current = true;
      const setBase = setQuoteTpSlMutationOptions(config);
      const deleteBase = deleteQuoteTpSlMutationOptions(config);
      const markConfirming = useTpSlStore.getState().markConfirming;
      let stoppedByUser = false;

      /** Update one step by id and recompute the run status from the whole list. */
      function patchStep(id: string, mutate: (step: SetQuoteGroupTpSlStep) => SetQuoteGroupTpSlStep): void {
        const current = runRef.current;
        const index = current.steps.findIndex((step) => step.id === id);
        if (index < 0) return;
        const next = [...current.steps];
        next[index] = mutate(next[index]!);
        commit({ ...current, steps: next, status: resolveStatus(next) });
      }

      function fail(id: string, err: unknown): void {
        const error = normalizeSymmError(err);
        if (error.kind === "user-rejected") stoppedByUser = true;
        patchStep(id, (step) => ({ ...step, status: "failed", error }));
      }

      /**
       * Stop waiting on the steps the handler never reported. Their store-side
       * guard is dropped first, so the refetch that follows writes the
       * handler's real rows through instead of being held off by a
       * confirmation that is not coming.
       */
      function expirePending(): void {
        const store = useTpSlStore.getState();
        const expired: bigint[] = [];
        for (const step of runRef.current.steps) {
          if (step.status !== "confirming") continue;
          for (const side of step.sides) store.clearConfirming(step.quoteId, side === "take_profit" ? "tp" : "sl");
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

      const execute = async (action: GroupTpSlAction) => {
        const id = stepIdOf(action);
        patchStep(id, (step) => ({ ...step, status: "submitting" }));

        if (action.action === "delete") {
          try {
            await deleteBase.mutationFn({
              quoteId: action.quoteId,
              virtualAccount: action.virtualAccount,
              cohQuoteId: action.cohQuoteId,
              conditionalOrderType: action.conditionalOrderType,
              from: runParameters.from,
              chainId,
            });
            // `intent: "cancel"` — this side is waiting to disappear, so an
            // empty refetch confirms it rather than being held as a write.
            markConfirming(action.quoteId, action.conditionalOrderType === "take_profit" ? "tp" : "sl", {
              intent: "cancel",
            });
            patchStep(id, (step) => ({ ...step, status: "confirming" }));
          } catch (err) {
            fail(id, err);
          }
          return;
        }
        if (action.action !== "set") return;

        try {
          const result = await setBase.mutationFn({
            quoteId: action.quoteId,
            virtualAccount: action.virtualAccount,
            subAccount: runParameters.subAccount,
            symbolId: action.symbolId,
            positionType: action.positionType,
            quantity: action.quantity,
            pricePrecision: runParameters.pricePrecision,
            affiliate: runParameters.affiliate,
            slippage: runParameters.slippage,
            tp: action.tp,
            sl: action.sl,
            from: runParameters.from,
            chainId,
          });
          if (action.tp) {
            markConfirming(action.quoteId, "tp", {
              price: action.tp.triggerPrice,
              priceType: action.tp.priceType,
              cohQuoteId: result.cohQuoteId,
            });
          }
          if (action.sl) {
            markConfirming(action.quoteId, "sl", {
              price: action.sl.triggerPrice,
              priceType: action.sl.priceType,
              cohQuoteId: result.cohQuoteId,
            });
          }
          patchStep(id, (step) => ({ ...step, status: "confirming", cohQuoteId: result.cohQuoteId }));
        } catch (err) {
          fail(id, err);
        }
      };

      const stopOnUserRejection = runParameters.stopOnUserRejection ?? true;
      try {
        await runWithConcurrency(work, runParameters.concurrency ?? 1, execute, () =>
          stopOnUserRejection ? stoppedByUser : false,
        );

        /** Anything the abort left `queued` never reached the handler — say so. */
        if (stoppedByUser) {
          const current = runRef.current;
          const cancelled = normalizeSymmError(
            new Error("Signature rejected — the remaining legs were not submitted."),
          );
          const next = current.steps.map((step) =>
            step.status === "queued" ? { ...step, status: "failed" as const, error: cancelled } : step,
          );
          commit({ ...current, steps: next, status: resolveStatus(next) });
        }

        /** Surface the first failure while the rest of the run is still confirming. */
        const submitted = runRef.current;
        commit({ ...submitted, error: submitted.steps.find((step) => step.status === "failed")?.error });

        // Every request has been answered; now wait for the handler to report
        // each accepted step — live for a write, gone for a cancel. Refetching
        // is the fallback, not the signal, so it fires only once a report is
        // overdue.
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
      /** Accepted but never reported — the handler took it, the confirmation never came. */
      const unconfirmed = failed.filter((step) => step.error?.code === TPSL_CONFIRMATION_TIMEOUT_CODE);
      commit({ ...runRef.current, status: resolveStatus(finalSteps), error: failed[0]?.error });

      // Reconcile against the handler's rows now that the run is over: the
      // reports carried the state, this makes sure the resting snapshot agrees.
      void invalidateTpSlReads(
        queryClient,
        confirmed.map((step) => step.quoteId),
      );

      return {
        ok: failed.length === 0,
        submittedCount: confirmed.length + unconfirmed.length,
        confirmedCount: confirmed.length,
        failedCount: failed.length,
        skippedCount: plan.skips.length,
        steps: [...finalSteps],
        plan,
        stoppedByUser,
        error: failed[0]?.error,
      };
    },
    [commit, config, connectedChainId, queryClient, settle],
  );

  const set = useCallback((runParameters: SetQuoteGroupTpSlParameters) => run(runParameters), [run]);

  const retryFailed = useCallback(
    async (children?: readonly GroupTpSlChild[]): Promise<SetQuoteGroupTpSlSummary> => {
      const last = lastRunRef.current;
      const previous = runRef.current.steps;
      const failedKeys = [...new Set(previous.filter((step) => step.status === "failed").map((step) => step.key))];
      if (!last || failedKeys.length === 0) {
        return {
          ok: true,
          submittedCount: 0,
          confirmedCount: 0,
          failedCount: 0,
          skippedCount: 0,
          steps: [...previous],
          plan: runRef.current.plan ?? EMPTY_PLAN,
          stoppedByUser: false,
        };
      }
      // Keep every step that already succeeded or is still confirming, so a
      // retry never regresses progress or tears down a live subscription.
      const carryOver = previous.filter((step) => !failedKeys.includes(step.key));
      return run({ ...last, children: children ?? last.children, only: failedKeys }, carryOver);
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

  const counts = useMemo(() => {
    const executed = state.steps.filter((step) => step.status !== "skipped");
    const accepted = executed.filter((step) => step.status === "confirming" || step.status === "done").length;
    const confirmed = executed.filter((step) => step.status === "done").length;
    const failed = executed.filter((step) => step.status === "failed").length;
    /** A step the handler accepted but has not reported on is not progress yet. */
    const settled = confirmed + failed;
    return {
      acceptedCount: accepted,
      confirmedCount: confirmed,
      failedCount: failed,
      totalCount: executed.length,
      progressPercent: executed.length === 0 ? 0 : Math.round((settled / executed.length) * 10_000) / 100,
    };
  }, [state.steps]);

  return {
    set,
    retryFailed,
    reset,
    status: state.status,
    isSubmitting: state.status === "submitting",
    isConfirming: state.status === "confirming",
    ...counts,
    steps: state.steps,
    plan: state.plan,
    error: state.error,
  };
}

/**
 * Reconcile confirming steps against the shared store: drop each side the
 * handler has reported on and mark the step `done` once none are left.
 *
 * @param steps - The run's current steps.
 * @returns The updated list, or `undefined` when nothing moved.
 */
function settleSteps(steps: SetQuoteGroupTpSlStep[]): SetQuoteGroupTpSlStep[] | undefined {
  const store = useTpSlStore.getState();
  let changed = false;
  const next = steps.map((step) => {
    if (step.status !== "confirming") return step;
    const record = store.get(step.quoteId);
    if (!record) return step;
    const remaining = step.sides.filter((side) =>
      step.kind === "cancel" ? !isCancelSideSettled(record, side) : !isWriteSideSettled(record, side),
    );
    if (remaining.length === step.sides.length) return step;
    changed = true;
    return remaining.length > 0 ? { ...step, sides: remaining } : { ...step, sides: [], status: "done" as const };
  });
  return changed ? next : undefined;
}

/**
 * The sides this run is still waiting on, in the shape the fallback sweep
 * needs: one entry per `(quote, side)` still `confirming`, tagged with the
 * account whose orders it will be found among and with what it is waiting for.
 *
 * Read live on every tick, so a side settled by a WebSocket frame between two
 * ticks drops out on its own.
 */
function waitingSidesOf(
  steps: readonly SetQuoteGroupTpSlStep[],
  accounts: ReadonlyMap<bigint, Address>,
): TpSlPollWaitingSide[] {
  const waiting: TpSlPollWaitingSide[] = [];
  for (const step of steps) {
    if (step.status !== "confirming") continue;
    const account = accounts.get(step.quoteId);
    if (!account) continue;
    for (const side of step.sides) {
      waiting.push({
        quoteId: step.quoteId,
        side,
        intent: step.kind === "cancel" ? "cancel" : "write",
        cohQuoteId: step.cohQuoteId,
        account,
      });
    }
  }
  return waiting;
}

/**
 * The accounts whose streams report on this run.
 *
 * The SubAccount comes first because that is where the handler actually
 * publishes: a report's `address` is the subscribing account, not the Virtual
 * Account that owns the order — two quotes under different VAs arrive on the
 * same channel. The VAs are watched as well, since they are what the orders are
 * filed under and a deployment that reports there costs us one pooled
 * subscription to cover.
 */
function watchAccountsOf(parameters: SetQuoteGroupTpSlParameters, plan: PlanGroupTpSlResult): Address[] {
  if (parameters.notificationsAccounts) return dedupeAddresses(parameters.notificationsAccounts);
  return dedupeAddresses([
    parameters.notificationsAccount ?? parameters.subAccount,
    ...plan.actions.map((action) => (action.action === "skip" ? undefined : action.virtualAccount)),
  ]);
}

/** Stable, unique step identity. A cancel is per-side; a write covers both sides of one leg. */
function stepIdOf(action: GroupTpSlAction): string {
  if (action.action === "delete") return `${action.key}:cancel:${action.conditionalOrderType}`;
  if (action.action === "set") return `${action.key}:write`;
  return `${action.key}:skip`;
}

/** Map one planner decision onto its initial step. */
function toStep(action: GroupTpSlAction): SetQuoteGroupTpSlStep {
  if (action.action === "delete") {
    return {
      id: stepIdOf(action),
      key: action.key,
      kind: "cancel",
      quoteId: action.quoteId,
      sides: [action.conditionalOrderType],
      status: "queued",
      cohQuoteId: action.cohQuoteId,
    };
  }
  if (action.action === "set") {
    return {
      id: stepIdOf(action),
      key: action.key,
      kind: "write",
      quoteId: action.quoteId,
      sides: [...(action.tp ? (["take_profit"] as const) : []), ...(action.sl ? (["stop_loss"] as const) : [])],
      status: "queued",
    };
  }
  return {
    id: stepIdOf(action),
    key: action.key,
    kind: "skip",
    quoteId: 0n,
    sides: [],
    status: "skipped",
    skipReason: action.reason,
    validation: action.validation,
  };
}

/**
 * Derive the run status from the current step list. Skipped legs never
 * influence it — a run whose plan skipped everything is a success. `confirming`
 * outranks `partial` so a failure elsewhere cannot make the status terminal
 * while other steps still await their reports.
 */
function resolveStatus(steps: SetQuoteGroupTpSlStep[]): SetQuoteGroupTpSlStatus {
  const executed = steps.filter((step) => step.status !== "skipped");
  if (executed.length === 0) return "success";
  if (executed.some((step) => step.status === "queued" || step.status === "submitting")) return "submitting";
  if (executed.some((step) => step.status === "confirming")) return "confirming";
  const failed = executed.filter((step) => step.status === "failed").length;
  if (failed === executed.length) return "failed";
  if (failed > 0) return "partial";
  return "success";
}
