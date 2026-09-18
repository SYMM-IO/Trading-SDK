"use client";

import {
  confirmGaslessRequest,
  GaslessRequestStatus,
  getGaslessRequestQueryKey,
  isNewerGaslessRequest,
  type Config,
  type GaslessAcceptedRequest,
  type GaslessConfirmedRequest,
  type GaslessRequest,
  type GaslessService,
} from "@symmio/trading-core";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import { IDLE_RELAY_PROGRESS, type GaslessRelayParameters, type GaslessRelayProgress } from "./gasless-relay-types";

/**
 * The acceptance fields a confirmation needs. Every gasless submit receipt
 * satisfies it: an operations receipt carries `walletIds`, a deposit settlement
 * carries the single `walletId` it settled.
 *
 * @internal
 */
export interface GaslessRelayAcceptance {
  requestId: string;
  idempotencyKey: string;
  protocolInstance: string | null;
  owner: Address;
  walletIds?: readonly bigint[];
  walletId?: bigint;
}

/** What the relay hook tells the confirmation about the request it just submitted. @internal */
export interface GaslessRelayConfirmOptions {
  /** The chain the relay was accepted on. */
  chainId: number;
  /** Which sub-service stores the request. Defaults to `"operations"`. */
  service?: GaslessService;
  /** The workflow label the submit carried, for the persisted row. */
  operationType?: string;
  /** Invalidate the reads a `succeeded` relay changed. */
  invalidate: (queryClient: QueryClient) => void;
}

/** What {@link useGaslessRelayConfirmation} hands back to a relay hook. */
export interface GaslessRelayConfirmationController {
  /** Current progress, to merge onto the mutation result as `relay`. */
  progress: GaslessRelayProgress;
  /** Reset progress and abort any in-flight wait. Call from the hook's `reset`. */
  reset: () => void;
  /**
   * Run the submit half of a relay through the progress state.
   *
   * Publishes `submitting` for the window between the user's click and the
   * service's `202` — signing and the POST — which is the one stretch
   * {@link confirm} cannot see, and publishes `error` if that window fails.
   * Nothing is accepted yet, so neither phase carries a request id.
   */
  submit: <result>(send: () => Promise<result>) => Promise<result>;
  /**
   * Follow an accepted request to the configured depth.
   *
   * Returns the confirmation, or `undefined` for `confirmation: "none"`.
   * `invalidate` runs whenever a `succeeded` terminal was observed — including
   * when the wait was later aborted — because the point of waiting is the
   * invalidation, and the query client outlives the component.
   */
  confirm: (
    accepted: GaslessRelayAcceptance,
    options: GaslessRelayConfirmOptions,
  ) => Promise<GaslessConfirmedRequest | undefined>;
}

/** The wait budget ran out: the outcome is unknown, not failed. */
const TIMEOUT_CODES: ReadonlySet<string> = new Set(["GASLESS_TERMINAL_TIMEOUT", "GASLESS_BROADCAST_TIMEOUT"]);

/** The ids a relay selected, whichever shape its acceptance reports them in. */
function acceptedWalletIds(accepted: GaslessRelayAcceptance): readonly bigint[] {
  if (accepted.walletIds) return accepted.walletIds;
  return accepted.walletId === undefined ? [] : [accepted.walletId];
}

/**
 * The confirmation half of every explicit relay hook.
 *
 * Owns the four things a relay mutation needs and a plain `useMutation` cannot
 * give it: an `AbortController` tied to the component's life, progress state
 * that survives a 120-second wait, the `onAccepted` hand-off that lets a
 * consumer persist the request id before anything can go wrong, and the
 * guarantee that a `succeeded` relay invalidates its reads even if nobody is
 * left watching.
 *
 * @param parameters - The hook's confirmation options.
 * @param config - The SDK config, for the confirm call and the cache seed.
 *
 * @internal
 */
export function useGaslessRelayConfirmation(
  parameters: GaslessRelayParameters,
  config: Config,
): GaslessRelayConfirmationController {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<GaslessRelayProgress>(IDLE_RELAY_PROGRESS);

  const abortRef = useRef<AbortController>(undefined);
  const mountedRef = useRef(true);

  /**
   * Held in a ref, and the effect has no dependencies, so the cleanup runs on
   * unmount only. Depending on the value would re-run the cleanup whenever a
   * caller flipped the flag — aborting a live confirmation, and doing so on
   * exactly the `true -> false` transition that asks for the opposite.
   */
  const abortOnUnmountRef = useRef(parameters.abortOnUnmount ?? true);
  abortOnUnmountRef.current = parameters.abortOnUnmount ?? true;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (abortOnUnmountRef.current) abortRef.current?.abort();
    };
  }, []);

  /** Progress is cosmetic — never let a late setState warn after unmount. */
  const publish = useCallback((next: GaslessRelayProgress) => {
    if (mountedRef.current) setProgress(next);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = undefined;
    publish(IDLE_RELAY_PROGRESS);
  }, [publish]);

  const submit = useCallback(
    async <result>(send: () => Promise<result>): Promise<result> => {
      publish({ phase: "submitting", degraded: false });
      try {
        return await send();
      } catch (err) {
        /**
         * The service never accepted anything, so there is no id to report and
         * no workflow to keep watching: unlike a failed confirmation, this one
         * is safe to retry from the wallet.
         */
        publish({ phase: "error", degraded: false });
        throw err;
      }
    },
    [publish],
  );

  const confirm = useCallback(
    async (accepted: GaslessRelayAcceptance, options: GaslessRelayConfirmOptions) => {
      const { chainId, service, invalidate } = options;
      const { confirmation = "receipt" } = parameters;

      /**
       * Before anything can fail: the request exists server-side from this
       * point on, and its id is the only handle on it.
       */
      try {
        parameters.onAccepted?.({
          requestId: accepted.requestId,
          service: service ?? "operations",
          chainId,
          protocolInstance: accepted.protocolInstance,
          idempotencyKey: accepted.idempotencyKey,
          operationType: options.operationType ?? null,
          owner: accepted.owner,
          walletIds: acceptedWalletIds(accepted),
        } satisfies GaslessAcceptedRequest);
      } catch {
        /** An observer must never fail a relay the service has already accepted. */
      }

      /** Reported on every publish, so a transient blind spot never reads as a failure. */
      let degraded = false;
      let issue: GaslessRelayProgress["issue"];

      const publishPhase = (next: Omit<GaslessRelayProgress, "degraded" | "issue" | "idempotencyKey">) => {
        publish({ ...next, idempotencyKey: accepted.idempotencyKey, degraded, issue });
      };

      publishPhase({
        phase: "queued",
        requestId: accepted.requestId,
        status: GaslessRequestStatus.QUEUED,
      });
      if (confirmation === "none") return undefined;

      /** A second submit supersedes the first: stop watching the old one. */
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      let sawSuccess = false;
      let lastStatus: GaslessRequestStatus | undefined;
      let lastTxHash: GaslessRequest["txHash"] = null;
      const configKey = config.getChainConfigKey(chainId);

      /** A superseded or aborted wait must not paint over the live one. */
      const isCurrent = () => abortRef.current === controller;

      const onUpdate = (request: GaslessRequest) => {
        if (request.status === GaslessRequestStatus.SUCCEEDED) sawSuccess = true;
        lastStatus = request.status;
        lastTxHash = request.txHash;
        /** A read landed: whatever was unreadable a moment ago is readable again. */
        degraded = false;
        issue = undefined;
        /**
         * Seed the record so a separately mounted `useGaslessRequest` on the
         * same id sees terminal immediately instead of running its own poll —
         * but only when it is genuinely newer, or a slow `queued` response
         * would repaint a finished workflow as pending.
         */
        queryClient.setQueryData<GaslessRequest>(
          getGaslessRequestQueryKey({ chainId, requestId: accepted.requestId, service, configKey }),
          (previous) => (isNewerGaslessRequest(previous, request) ? request : previous),
        );
        if (isCurrent()) {
          publishPhase({
            phase: request.status === GaslessRequestStatus.SUBMITTED ? "submitted" : "queued",
            requestId: request.requestId,
            status: request.status,
            txHash: request.txHash ?? undefined,
          });
        }
        parameters.onProgress?.(request);
      };

      try {
        const confirmed = await confirmGaslessRequest(config, {
          chainId,
          requestId: accepted.requestId,
          service: service ?? "operations",
          until: confirmation,
          receiptConfirmations: parameters.receiptConfirmations,
          timeoutMs: parameters.timeoutMs,
          receiptTimeoutMs: parameters.receiptTimeoutMs,
          signal: controller.signal,
          onTransportIssue: (error) => {
            degraded = true;
            issue = normalizeSymmError(error);
            if (isCurrent()) {
              publishPhase({
                phase: lastStatus === GaslessRequestStatus.SUBMITTED ? "submitted" : "queued",
                requestId: accepted.requestId,
                status: lastStatus,
                txHash: lastTxHash ?? undefined,
              });
            }
          },
          onUpdate: (request) => {
            onUpdate(request);
            if (request.status === GaslessRequestStatus.SUCCEEDED && confirmation === "receipt" && isCurrent()) {
              publishPhase({
                phase: "awaiting-receipt",
                requestId: request.requestId,
                status: request.status,
                txHash: request.txHash ?? undefined,
              });
            }
          },
        });
        if (isCurrent()) {
          publishPhase({
            phase: "confirmed",
            requestId: confirmed.request.requestId,
            status: confirmed.request.status,
            txHash: confirmed.txHash,
          });
        }
        return confirmed;
      } catch (err) {
        if (isCurrent()) {
          /**
           * A budget that ran out is not a verdict: the relay is still running
           * and its id is still good. The mutation rejects either way — it has
           * no result to report — but the phase must not tell the user their
           * action failed, which is what makes them submit it a second time.
           */
          const phase = TIMEOUT_CODES.has(readErrorCode(err)) ? "unconfirmed" : "error";
          publishPhase({
            phase,
            requestId: accepted.requestId,
            status: progressStatus(err) ?? (phase === "unconfirmed" ? lastStatus : undefined),
            txHash: lastTxHash ?? undefined,
          });
        }
        throw err;
      } finally {
        /**
         * Gated on the observed terminal, not on how the wait ended: an abort
         * after `succeeded` still leaves the cache stale for everyone else.
         */
        if (sawSuccess) invalidate(queryClient);
        if (abortRef.current === controller) abortRef.current = undefined;
      }
    },
    [config, parameters, publish, queryClient],
  );

  return { progress, reset, submit, confirm };
}

/** The SDK error code an error carries, read structurally across the error layers. */
function readErrorCode(err: unknown): string {
  const code = (err as { code?: unknown } | undefined)?.code;
  return typeof code === "string" ? code : "";
}

/** Best-effort status for the error phase; absent when the failure was transport-level. */
function progressStatus(err: unknown): GaslessRequestStatus | undefined {
  const data = (err as { responseData?: { status?: unknown } } | undefined)?.responseData;
  const status = data?.status;
  return typeof status === "string" && (Object.values(GaslessRequestStatus) as string[]).includes(status)
    ? (status as GaslessRequestStatus)
    : undefined;
}
