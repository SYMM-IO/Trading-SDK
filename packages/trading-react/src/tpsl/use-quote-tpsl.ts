"use client";

import {
  getQuoteTpSlQueryOptions,
  type ConfigParameter,
  type GetQuoteTpSlOptions,
  type QuoteTpSlRow,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useCallback } from "react";
import type { Address } from "viem";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { linkTpSlNotificationIds, matchTpSlNotification } from "./match-tpsl-notification";
import { useTpSlRecord, useTpSlStore, type TpSlRecord } from "./tpsl-store";
import { useWatchTpSlNotifications } from "./use-watch-tpsl-notifications";

/** Parameters for {@link useQuoteTpSl}. */
export type UseQuoteTpSlParameters = Omit<GetQuoteTpSlOptions, "quoteId"> &
  ConfigParameter & {
    /**
     * Quote id — accepts either the on-chain `quoteId` or the hedger
     * `tempQuoteId`. Whichever is passed, the hook resolves to the same
     * shared record via the store's id index.
     */
    quoteId: bigint;
    /**
     * SubAccount address — when provided, the hook also subscribes to the
     * TP/SL WebSocket and reconciles the record without manual polling.
     */
    account?: Address;
  };

/** Return type of {@link useQuoteTpSl}. */
export interface UseQuoteTpSlReturnType {
  /** The folded TP/SL snapshot from the shared store, or `undefined` before the first load. */
  data?: TpSlRecord;
  /** `true` while the first fetch for this quote is in flight. */
  isLoading: boolean;
  /** `true` while any fetch is in flight, including background refetches. */
  isFetching: boolean;
  /** Normalized fetch error, or `null`. */
  error: SymmioRequestError | null;
  /** Re-read the handler rows for this quote. */
  refetch: () => Promise<void>;
  /** The underlying handler-row query, for advanced use. */
  query: UseQueryResult<QuoteTpSlRow[], SymmioRequestError>;
}

/**
 * Read the folded TP/SL snapshot for one quote. Pass either the on-chain
 * `quoteId` or the hedger `tempQuoteId` — the store keeps a single record per
 * quote indexed under every id it has learned for that quote, so both callers
 * get the same object.
 *
 * The `confirming` overlay ("POST accepted, awaiting handler") is merged into
 * `tpState` / `slState` at read time — a side flagged as confirming reports
 * state `"confirming"` regardless of what the row set says.
 *
 * @param parameters - Quote id, optional sub-account for the live stream, query overrides.
 * @returns The snapshot plus the usual load/error/refetch surface.
 */
export function useQuoteTpSl(parameters: UseQuoteTpSlParameters): UseQuoteTpSlReturnType {
  const config = useSymmioConfig(parameters);
  const defaultChainId = useSymmioChainId();
  const chainId = parameters.chainId ?? defaultChainId;

  const record = useTpSlRecord(parameters.quoteId);
  const options = getQuoteTpSlQueryOptions(config, {
    ...parameters,
    chainId,
    quoteId: parameters.quoteId,
  });
  // Re-fetch is driven by TanStack Query cache: mutations invalidate `rowsKey`,
  // which triggers a refetch here so the store record picks up the newly
  // committed tp/sl values. (An earlier version gated on `record === undefined`
  // to avoid a duplicate fetch when the on-chain quoteId first appeared, but
  // that also swallowed post-mutation invalidations — leaving the box stuck on
  // the old values.)
  const query = useQuery({
    ...options,
    queryFn: async () => {
      try {
        const rows = await options.queryFn();
        useTpSlStore.getState().setRows(parameters.quoteId, rows);
        return rows;
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseQueryResult<QuoteTpSlRow[], SymmioRequestError>;

  useWatchTpSlNotifications({
    account: parameters.account,
    enabled: Boolean(parameters.account) && parameters.quoteId !== 0n,
    onNotification: (notification) => {
      linkTpSlNotificationIds(notification);
      const target = matchTpSlNotification(notification, [parameters.quoteId]);
      if (target === undefined) return;
      useTpSlStore.getState().applyNotification(target, notification);
    },
  });

  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    data: record,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error ?? null,
    refetch,
    query,
  };
}
