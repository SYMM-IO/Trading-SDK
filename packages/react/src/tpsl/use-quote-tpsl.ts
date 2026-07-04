"use client";

import {
  getQuoteTpSlQueryOptions,
  type ConfigParameter,
  type GetQuoteTpSlOptions,
  type TpSlNotification,
} from "@symm-frontier/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { Address } from "viem";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
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
export type UseQuoteTpSlReturnType = UseQueryResult<TpSlRecord, SymmioRequestError>;

/**
 * Read the folded TP/SL snapshot for one quote. Pass either the on-chain
 * `quoteId` or the hedger `tempQuoteId` — the store keeps a single record per
 * quote indexed under every id it has learned for that quote, so both callers
 * get the same object.
 *
 * The `confirming` overlay ("POST accepted, awaiting handler") is merged into
 * `tpState` / `slState` at read time — a side flagged as confirming reports
 * state `"confirming"` regardless of what the row set says.
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
  const queryResult = useQuery({
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
  });

  useWatchTpSlNotifications({
    account: parameters.account,
    enabled: Boolean(parameters.account) && parameters.quoteId !== 0n,
    onNotification: (notification) => {
      if (notification.primaryIdentifier !== 0 && notification.secondaryIdentifier !== 0) {
        useTpSlStore.getState().link(BigInt(notification.primaryIdentifier), BigInt(notification.secondaryIdentifier));
      }
      if (!matchesQuote(notification, parameters.quoteId)) return;
      useTpSlStore.getState().applyNotification(parameters.quoteId, notification);
    },
  });

  return {
    query: queryResult,
    data: record,
  } as unknown as UseQuoteTpSlReturnType;
}

/**
 * True when the notification and the caller address the same store record.
 * Uses the store's id index — every id linked to the same record maps to
 * the same object, so reference equality decides the match.
 */
function matchesQuote(notification: TpSlNotification, quoteId: bigint): boolean {
  const store = useTpSlStore.getState();
  const target = store.get(quoteId);
  if (!target) {
    // No record yet for the target — fall back to raw-id compare so the
    // first "seed" frame still matches.
    return (
      notification.primaryIdentifier === Number(quoteId) ||
      notification.secondaryIdentifier === Number(quoteId) ||
      notification.quoteId === Number(quoteId)
    );
  }
  if (notification.primaryIdentifier !== 0 && store.get(BigInt(notification.primaryIdentifier)) === target) return true;
  if (notification.secondaryIdentifier !== 0 && store.get(BigInt(notification.secondaryIdentifier)) === target)
    return true;
  return false;
}
