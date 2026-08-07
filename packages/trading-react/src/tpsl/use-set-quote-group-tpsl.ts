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
  type TpSlNotification,
  type TpSlValidation,
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
import { isCancelSideSettled, isWriteSideSettled } from "./settled-side";
import { useTpSlRecords, useTpSlStore } from "./tpsl-store";
import { useWatchTpSlNotifications } from "./use-watch-tpsl-notifications";

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
  /** Account whose live stream confirms the run. Defaults to `subAccount`. */
  notificationsAccount?: Address;
  /** Chain override; defaults to the connected chain. */
  chainId?: number;
  /** Restrict the run to these leg keys — the retry-failed-only path. */
  only?: readonly string[];
}

/**
 * Outcome of one run. Resolves once every planned request has settled;
 * *confirmation* continues asynchronously per step via the WebSocket report,
 * tracked on `status` / `steps` / `progressPercent`.
 */
export interface SetQuoteGroupTpSlSummary {
  /** `true` when every planned step was accepted by the handler. */
  ok: boolean;
  /** Steps the handler accepted (writes and cancels). */
  submittedCount: number;
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
  /** Plan and apply. Resolves with the run's summary (never rejects). */
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
  /** Share of steps that have settled either way, `0`–`100` (2-decimal resolution). */
  progressPercent: number;
  /** Steps the handler accepted so far — **excludes** failures. */
  acceptedCount: number;
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
 * for a cancel. `set()` resolves at the `confirming` boundary; a failed step
 * fails only itself and the run ends as `"partial"`, except when the wallet
 * rejects a signature, which stops the run rather than prompting again.
 *
 * @param parameters - Optional config override.
 * @returns The run controls and its live per-step state.
 *
 * @example
 * ```tsx
 * const { set, steps, progressPercent } = useSetQuoteGroupTpSl();
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
   * resolve steps directly. Step resolution is driven entirely by the store
   * (below), which is fed by every TP/SL signal: this subscription, a
   * co-mounted read hook's VA-channel subscription, and the success refetch. So
   * a step advances no matter which channel delivered the update — the
   * "stuck on waiting for the handler" case, where the frame arrived on the read
   * hook's subscription and this hook's own matcher never saw it.
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

  // The single source of step resolution: reconcile confirming steps against
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
      if (!record) return step;
      const remaining = step.sides.filter((side) =>
        step.kind === "cancel" ? !isCancelSideSettled(record, side) : !isWriteSideSettled(record, side),
      );
      if (remaining.length === step.sides.length) return step;
      changed = true;
      return remaining.length > 0 ? { ...step, sides: remaining } : { ...step, sides: [], status: "done" as const };
    });
    if (changed) commit({ ...run, steps, status: resolveStatus(steps) });
    // `confirmingRecords` is the store subscription that drives this; `runRef`
    // and the store are read live.
  }, [confirmingRecords, commit]);

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
      const steps: SetQuoteGroupTpSlStep[] = [
        ...carryOver,
        ...plan.actions.map<SetQuoteGroupTpSlStep>((action) => toStep(action)),
      ];

      lastRunRef.current = runParameters;
      watchChainIdRef.current = chainId;
      setWatchAccount(runParameters.notificationsAccount ?? runParameters.subAccount);
      commit({ status: work.length > 0 ? "submitting" : resolveStatus(steps), steps, plan });
      if (work.length === 0) {
        return {
          ok: true,
          submittedCount: 0,
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
            markConfirming(action.quoteId, action.conditionalOrderType === "take_profit" ? "tp" : "sl");
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
      } finally {
        inFlight.current = false;
      }

      /** Anything the abort left `queued` never reached the handler — say so. */
      if (stoppedByUser) {
        const current = runRef.current;
        const cancelled = normalizeSymmError(new Error("Signature rejected — the remaining legs were not submitted."));
        const next = current.steps.map((step) =>
          step.status === "queued" ? { ...step, status: "failed" as const, error: cancelled } : step,
        );
        commit({ ...current, steps: next, status: resolveStatus(next) });
      }

      const finalSteps = runRef.current.steps;
      const failed = finalSteps.filter((step) => step.status === "failed");
      commit({ ...runRef.current, status: resolveStatus(finalSteps), error: failed[0]?.error });

      // Pull the handler's authoritative rows for every leg the run touched, so
      // the box resolves out of `confirming` (and a cancelled side clears) even
      // when the live WebSocket frame never lands.
      void invalidateTpSlReads(
        queryClient,
        finalSteps.filter((step) => step.status === "confirming" || step.status === "done").map((step) => step.quoteId),
      );

      return {
        ok: failed.length === 0,
        submittedCount: finalSteps.filter((step) => step.status === "confirming" || step.status === "done").length,
        failedCount: failed.length,
        skippedCount: plan.skips.length,
        steps: [...finalSteps],
        plan,
        stoppedByUser,
        error: failed[0]?.error,
      };
    },
    [commit, config, connectedChainId, queryClient],
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
    setWatchAccount(undefined);
    lastRunRef.current = undefined;
    commit(IDLE);
  }, [commit]);

  const counts = useMemo(() => {
    const executed = state.steps.filter((step) => step.status !== "skipped");
    const accepted = executed.filter((step) => step.status === "confirming" || step.status === "done").length;
    const failed = executed.filter((step) => step.status === "failed").length;
    const settled = accepted + failed;
    return {
      acceptedCount: accepted,
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
