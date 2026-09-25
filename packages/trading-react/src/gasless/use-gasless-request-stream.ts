"use client";

import {
  getGaslessRequestQueryKey,
  getGaslessRequestTransactionsQueryKey,
  isGaslessRequestTerminal,
  supportsGaslessStatusStream,
  watchGaslessRequest,
  type Config,
  type GaslessRequest,
  type GaslessService,
  type GaslessStatusTransport,
  type GaslessStreamStatus,
  type GaslessStreamStatusDetail,
} from "@symmio/trading-core";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

/** What {@link useGaslessRequestStream} reports about the live transport. */
export interface GaslessStreamState {
  /** Stream health; anything but `"live"` means the caller should keep polling. */
  status: GaslessStreamStatus;
  /** Why, when the status alone does not say. */
  detail: GaslessStreamStatusDetail | null;
  /** Convenience for gating a poll: `status === "live"`. */
  live: boolean;
}

/**
 * Subscribe one workflow to the gateway's status stream and push its records
 * into the query cache.
 *
 * The hook owns no data of its own: every delivery is written to the same cache
 * entries the HTTP reads use, so components keep reading through
 * `useGaslessRequest` / `useGaslessRequestTransactions` and never learn which
 * transport produced a record. It returns only the stream's health, which the
 * caller uses to pause or resume its poll — the pattern `usePrices` uses for the
 * price feed.
 *
 * A deployment without a stream, or a disabled one, simply stays `"idle"`.
 *
 * @internal
 */
export function useGaslessRequestStream(parameters: {
  config: Config;
  chainId: number;
  requestId: string;
  service?: GaslessService;
  enabled: boolean;
  transport?: GaslessStatusTransport;
}): GaslessStreamState {
  const { config, chainId, requestId, service = "operations", enabled, transport = "auto" } = parameters;
  const queryClient = useQueryClient();
  const [state, setState] = useState<GaslessStreamState>({ status: "idle", detail: null, live: false });

  const active =
    enabled &&
    requestId.length > 0 &&
    transport !== "poll" &&
    supportsGaslessStatusStream(config, { chainId, service });

  useEffect(() => {
    if (!active) {
      setState({ status: "idle", detail: null, live: false });
      return;
    }

    /** The same keys the query factories build, `service` and `configKey` included. */
    const configKey = config.getChainConfigKey(chainId);
    const requestKey = getGaslessRequestQueryKey({ chainId, requestId, service, configKey });
    const transactionsKey = getGaslessRequestTransactionsQueryKey({ chainId, requestId, service, configKey });
    let unwatch: (() => void) | undefined;

    try {
      unwatch = watchGaslessRequest(config, {
        chainId,
        requestId,
        service,
        onUpdate: ({ request, transactions }) => {
          if (request) {
            /**
             * Cancel the poll in flight before seeding: a response that started
             * earlier must not land on top of this fresher record.
             */
            void queryClient.cancelQueries({ queryKey: requestKey, exact: true });
            queryClient.setQueryData(requestKey, (previous: GaslessRequest | undefined) =>
              previous && isNewer(previous, request) ? previous : request,
            );
          }
          if (transactions.length > 0) {
            void queryClient.cancelQueries({ queryKey: transactionsKey, exact: true });
            queryClient.setQueryData(transactionsKey, transactions);
          }
        },
        onStatusChange: (status, detail) => setState({ status, detail, live: status === "live" }),
        onError: () => {
          /** Stream trouble is reported through the status; the poll covers the data. */
        },
      });
    } catch {
      /** An unconfigured stream is not an error here: the caller keeps polling. */
      setState({ status: "idle", detail: null, live: false });
      return;
    }

    return () => {
      unwatch?.();
      setState({ status: "idle", detail: null, live: false });
    };
  }, [active, config, chainId, requestId, service, queryClient]);

  return state;
}

/**
 * Whether the record already in the cache is newer than an incoming one.
 *
 * A terminal status is sticky — nothing may regress it — and otherwise the
 * later `updatedAt` wins. Without this, a poll that started before a stream
 * snapshot could overwrite it with staler state.
 */
function isNewer(previous: GaslessRequest, next: GaslessRequest): boolean {
  if (isGaslessRequestTerminal(previous.status) && !isGaslessRequestTerminal(next.status)) return true;
  if (previous.updatedAt && next.updatedAt) return previous.updatedAt > next.updatedAt;
  return false;
}
