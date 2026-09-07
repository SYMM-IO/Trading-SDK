"use client";

import {
  confirmGaslessRequest,
  GaslessRequestStatus,
  getGaslessRequestQueryKey,
  type Config,
  type GaslessConfirmedRequest,
  type GaslessRequest,
  type GaslessService,
} from "@symmio/trading-core";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { IDLE_RELAY_PROGRESS, type GaslessRelayParameters, type GaslessRelayProgress } from "./gasless-relay-types";

/** What {@link useGaslessRelayConfirmation} hands back to a relay hook. */
export interface GaslessRelayConfirmationController {
  /** Current progress, to merge onto the mutation result as `relay`. */
  progress: GaslessRelayProgress;
  /** Reset progress and abort any in-flight wait. Call from the hook's `reset`. */
  reset: () => void;
  /**
   * Follow an accepted request to the configured depth.
   *
   * Returns the confirmation, or `undefined` for `confirmation: "none"`.
   * `invalidate` runs whenever a `succeeded` terminal was observed — including
   * when the wait was later aborted — because the point of waiting is the
   * invalidation, and the query client outlives the component.
   */
  confirm: (
    accepted: { requestId: string },
    options: { chainId: number; service?: GaslessService; invalidate: (queryClient: QueryClient) => void },
  ) => Promise<GaslessConfirmedRequest | undefined>;
}

/**
 * The confirmation half of every explicit relay hook.
 *
 * Owns the three things a relay mutation needs and a plain `useMutation` cannot
 * give it: an `AbortController` tied to the component's life, progress state
 * that survives a 120-second wait, and the guarantee that a `succeeded` relay
 * invalidates its reads even if nobody is left watching.
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

  const confirm = useCallback(
    async (
      accepted: { requestId: string },
      options: { chainId: number; service?: GaslessService; invalidate: (queryClient: QueryClient) => void },
    ) => {
      const { chainId, service, invalidate } = options;
      const { confirmation = "receipt" } = parameters;

      publish({ phase: "queued", requestId: accepted.requestId, status: GaslessRequestStatus.QUEUED });
      if (confirmation === "none") return undefined;

      /** A second submit supersedes the first: stop watching the old one. */
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      let sawSuccess = false;
      const configKey = config.getChainConfigKey(chainId);

      /** A superseded or aborted wait must not paint over the live one. */
      const isCurrent = () => abortRef.current === controller;

      const onUpdate = (request: GaslessRequest) => {
        if (request.status === GaslessRequestStatus.SUCCEEDED) sawSuccess = true;
        /**
         * Seed the record so a separately mounted `useGaslessRequest` on the
         * same id sees terminal immediately instead of running its own poll.
         */
        queryClient.setQueryData(
          getGaslessRequestQueryKey({ chainId, requestId: accepted.requestId, service, configKey }),
          request,
        );
        if (isCurrent()) {
          publish({
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
          onUpdate: (request) => {
            onUpdate(request);
            if (request.status === GaslessRequestStatus.SUCCEEDED && confirmation === "receipt" && isCurrent()) {
              publish({
                phase: "awaiting-receipt",
                requestId: request.requestId,
                status: request.status,
                txHash: request.txHash ?? undefined,
              });
            }
          },
        });
        if (isCurrent()) {
          publish({
            phase: "confirmed",
            requestId: confirmed.request.requestId,
            status: confirmed.request.status,
            txHash: confirmed.txHash,
          });
        }
        return confirmed;
      } catch (err) {
        if (isCurrent()) publish({ phase: "error", requestId: accepted.requestId, status: progressStatus(err) });
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

  return { progress, reset, confirm };
}

/** Best-effort status for the error phase; absent when the failure was transport-level. */
function progressStatus(err: unknown): GaslessRequestStatus | undefined {
  const data = (err as { responseData?: { status?: unknown } } | undefined)?.responseData;
  const status = data?.status;
  return typeof status === "string" && (Object.values(GaslessRequestStatus) as string[]).includes(status)
    ? (status as GaslessRequestStatus)
    : undefined;
}
