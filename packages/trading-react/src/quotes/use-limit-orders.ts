"use client";

import {
  getPendingQuotesQueryOptions,
  isOpenAnchorAction,
  NotificationType,
  OrderType,
  reconcileQuotes,
  type ConfigParameter,
  type GetPendingQuotesOptions,
  type Notification,
  type SocketStatus,
  type UnifiedQuote,
} from "@symmio/trading-core";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { zeroAddress } from "viem";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useInstantOpens } from "../instant-layer/use-instant-opens";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { SETTLE_REFETCH_DELAYS_MS } from "../websocket/is-settle-notification";
import { useNotifications } from "../websocket/use-notifications";

/** Cap the retained notification window fed into each reconcile pass. */
const NOTIFICATION_BUFFER_LIMIT = 200;

/**
 * Parameters for {@link useLimitOrders}: the core pending-quotes options (partyA,
 * chain id, batch size, TanStack `query` overrides) plus an optional `config`, a
 * `live` flag, and the `orderType` to return.
 */
export type UseLimitOrdersParameters = GetPendingQuotesOptions &
  ConfigParameter & {
    /**
     * Subscribe to notifications and burst-refetch the on-chain read when a quote
     * anchors (`SendQuoteTransaction`, the *second* send notification), so a
     * just-placed order flips from off-chain to on-chain without a manual refresh.
     * The shared WebSocket requires the provider tree. `@default true`
     */
    live?: boolean;
    /**
     * Which order type to return. Resting orders are `LIMIT`; that is the default.
     * `@default OrderType.LIMIT`
     */
    orderType?: OrderType;
  };

/** Result returned by {@link useLimitOrders}. */
export interface UseLimitOrdersReturnType {
  /**
   * The reconciled rows — off-chain (just-sent, from the hedger feed) and
   * on-chain (anchored) merged into one de-duplicated, lifecycle-tagged list,
   * newest first. Each row's `origin` is `"offchain"` until it anchors, then
   * `"onchain"`; `lifecycle` advances `OPTIMISTIC → WRITE_ONCHAIN → ONCHAIN`.
   */
  quotes: UnifiedQuote[];
  /** `true` while either source's first load is in flight. */
  isLoading: boolean;
  /** `true` when either source errored. */
  isError: boolean;
  /** The first source error, if any. */
  error: SymmioRequestError | null;
  /** Refetch both the on-chain and off-chain sources. */
  refetch: () => void;
  /** Live connection status of the notifications socket (`"closed"` when `live` is off). */
  socketStatus: SocketStatus;
}

/**
 * A partyA's resting orders (default `LIMIT`) as **one reconciled list across
 * on-chain and off-chain sources**: the hedger's pending instant-open feed shows
 * a just-sent order instantly as an `offchain` row, and the on-chain pending
 * read (`getPartyAPendingQuotes` + `getQuote`) carries it once it anchors. The
 * pure core `reconcileQuotes` merges both plus the live notification stream, so
 * one row transitions `OPTIMISTIC → WRITE_ONCHAIN → ONCHAIN` (its `origin`
 * flipping `offchain → onchain`) without flicker. Errors are normalized to
 * {@link SymmioRequestError}.
 *
 * This is the single-account, order-type-scoped convenience over the same
 * `reconcileQuotes` primitive `useManagedQuotes` uses across every account.
 *
 * @example
 * ```tsx
 * const { quotes, socketStatus } = useLimitOrders({ partyA });
 * // quotes: UnifiedQuote[] — offchain then onchain, tagged via `origin`/`lifecycle`.
 * ```
 */
export function useLimitOrders(parameters: UseLimitOrdersParameters = {}): UseLimitOrdersReturnType {
  const { live = true, orderType = OrderType.LIMIT, ...queryParameters } = parameters;
  const config = useSymmioConfig(queryParameters);
  const chainId = useSymmioChainId();
  const resolvedChainId = queryParameters.chainId ?? chainId;
  const partyA = queryParameters.partyA;
  const active = Boolean(partyA) && queryParameters.query?.enabled !== false;

  // On-chain source: pending quote ids hydrated via `getQuote`. Uses the shared
  // query key so cancel / force-cancel invalidations refetch this list too.
  const onchainOptions = getPendingQuotesQueryOptions(config, { ...queryParameters, chainId: resolvedChainId });
  const onchain = useQuery({
    ...onchainOptions,
    queryFn: async () => {
      try {
        return await onchainOptions.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  });

  // Off-chain source: the hedger's pending instant-open feed (carries LIMIT rows
  // the moment a send is accepted, before it anchors on-chain).
  const offchain = useInstantOpens({
    partyA: partyA ?? zeroAddress,
    chainId: resolvedChainId,
    config: queryParameters.config,
    query: { enabled: active },
  });

  // Limit orders are majors / rasa: cross-margin, so `partyA` IS the sub-account
  // and its notification frames arrive on it directly (no virtual account).
  //
  // Accumulate notifications and burst-refetch the on-chain read when a quote
  // anchors (the off-chain InstantRFQ price-fill has no on-chain id yet).
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { refetch: onchainRefetch } = onchain;
  const { status: socketStatus } = useNotifications({
    account: partyA,
    chainId: resolvedChainId,
    config: queryParameters.config,
    enabled: Boolean(live && partyA) && active,
    onNotification: useCallback(
      (notification: Notification) => {
        setNotifications((prev) => [...prev, notification].slice(-NOTIFICATION_BUFFER_LIMIT));
        if (notification.type !== NotificationType.SUCCESS || !isOpenAnchorAction(notification.lastSeenAction)) return;
        for (const ms of SETTLE_REFETCH_DELAYS_MS) setTimeout(() => void onchainRefetch(), ms);
      },
      [onchainRefetch],
    ),
  });

  // Rows anchored on a prior tick (a notification set their `quoteId`) but not yet
  // returned by the on-chain read — fed back so an anchored row keeps showing while
  // the RPC catches up, instead of vanishing at the hedger-drop → on-chain-read gap.
  const retainedAnchorsRef = useRef<UnifiedQuote[]>([]);

  const reconciled = useMemo(() => {
    if (!partyA) return { quotes: [] as UnifiedQuote[], pendingAnchors: [] as UnifiedQuote[] };
    const instantOpens = (offchain.data ?? []).filter((open) => open.orderType === orderType);
    const result = reconcileQuotes({
      partyA,
      onchainPositions: [],
      onchainPendingQuotes: onchain.data ?? [],
      instantOpens,
      instantCloses: [],
      notifications,
      retainedAnchors: retainedAnchorsRef.current,
    });
    return result;
    // retainedAnchorsRef is a ref (not a dep); the source data / notifications drive recompute.
  }, [partyA, onchain.data, offchain.data, notifications, orderType]);

  // Persist this tick's WRITE_ONCHAIN rows for the next reconcile pass.
  useEffect(() => {
    retainedAnchorsRef.current = reconciled.pendingAnchors;
  }, [reconciled]);

  const quotes = useMemo(
    () => reconciled.quotes.filter((quote) => quote.orderType === orderType),
    [reconciled, orderType],
  );

  const error = (onchain.error ?? offchain.error ?? null) as SymmioRequestError | null;

  return {
    quotes,
    isLoading: active && (onchain.isLoading || offchain.isLoading),
    isError: onchain.isError || offchain.isError,
    error,
    refetch: useCallback(() => {
      void onchain.refetch();
      void offchain.refetch();
    }, [onchain, offchain]),
    socketStatus,
  };
}
