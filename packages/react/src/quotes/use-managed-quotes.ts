"use client";

import {
  classifyQuoteNotificationAction,
  getInstantClosesQueryKey,
  getInstantOpensQueryKey,
  getPartyAOpenPositionsQueryKey,
  getPartyAOpenPositionsQueryOptions,
  getPartyAPendingQuotesQueryKey,
  getPartyAPendingQuotesQueryOptions,
  getPredictedNextVirtualAccountQueryOptions,
  getQuoteQueryKey,
  getQuoteQueryOptions,
  isolationTypeForSide,
  QuoteLifecycle,
  reconcileQuotes,
  shouldAccelerateQuotePolling,
  type Notification,
  type Quote,
  type ReconcileQuotesResult,
  type SocketStatus,
  type UnifiedQuote,
} from "@symm-frontier/core";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAddress, type Address } from "viem";
import { useVirtualAccountsAddressesOfSubAccount } from "../account-layer/use-virtual-accounts-addresses-of-sub-account";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useInstantCloses } from "../instant-layer/use-instant-closes";
import { useInstantOpens } from "../instant-layer/use-instant-opens";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { predicateMatch } from "../utils";
import { useNotifications } from "../websocket/use-notifications";
import { useOptimisticQuotesStore } from "./optimistic-quotes-store";

/** Idle quote-polling interval (ms) when nothing is mid-transition. */
const DEFAULT_POLLING_INTERVAL = 5_000;

/** Accelerated quote-polling interval (ms) while a row is mid-transition. */
const ACCELERATED_POLLING_INTERVAL = 1_500;

/**
 * Cap on the live-notification buffer fed back into the merge. Reconciliation is
 * idempotent over already-applied notifications, so only a recent window is kept
 * to bound memory and reprocessing.
 *
 * TODO: check this and packages/react/src/quotes/use-managed-quotes.ts#L188-L206
 */
const NOTIFICATION_BUFFER_LIMIT = 100;

/** Stable empty array so the `accounts` memo doesn't churn while no VAs are retained. */
const NO_RETAINED_VAS: readonly Address[] = [];

/** Debounce (ms) for coalescing a burst of notifications into one set of read invalidations. */
const NOTIFICATION_INVALIDATE_DEBOUNCE = 250;

/**
 * Lifecycle stages that mean an open is in flight, so the hedger instant-opens
 * feed is worth polling. Outside these stages the feed has nothing new (a
 * settled position is tracked by the on-chain reads), so polling it is wasted.
 */
const OPEN_INTENT_LIFECYCLES = new Set<QuoteLifecycle>([
  QuoteLifecycle.OPTIMISTIC,
  QuoteLifecycle.PRICE_FILLED,
  QuoteLifecycle.WRITE_ONCHAIN,
]);

/**
 * Lifecycle stages that mean a close is in flight, so the hedger instant-closes
 * feed is worth polling. Outside these stages there is no pending close, so
 * polling the feed (merely holding open positions) is wasted.
 */
const CLOSE_INTENT_LIFECYCLES = new Set<QuoteLifecycle>([QuoteLifecycle.WRITE_ONCHAIN_CLOSE, QuoteLifecycle.CLOSING]);

/**
 * Which underlying quote sources {@link useManagedQuotes} should read. Every
 * source defaults to `true`; set one to `false` to skip its query/subscription
 * entirely (e.g. a screen that never opens instant trades).
 */
export interface ManagedQuotesSources {
  /** Read on-chain open positions via `usePartyAOpenPositions`. Default `true`. */
  openPositions?: boolean;
  /** Read on-chain pending quote ids (hydrated per-id) via `usePartyAPendingQuotes`. Default `true`. */
  pendingQuotes?: boolean;
  /** Read pending instant-opens from the hedger via `useInstantOpens`. Default `true`. */
  instantOpens?: boolean;
  /** Read pending instant-closes from the hedger via `useInstantCloses`. Default `true`. */
  instantCloses?: boolean;
}

/**
 * Parameters for {@link useManagedQuotes}.
 */
export interface UseManagedQuotesParameters {
  /** Sub-account (partyA) to manage quotes for. The hook is idle until this is set. */
  partyA?: Address;
  /** Target chain id. Defaults to the connected chain. */
  chainId?: number;
  /** Idle on-chain polling interval (ms). Default 5000; accelerates automatically while rows transition. */
  pollingInterval?: number;
  /** Subscribe to the live notifications stream. Default `true`; set `false` for poll-only. */
  live?: boolean;
  /** Master switch. When `false` every source is idle regardless of `sources`. Default `true`. */
  enabled?: boolean;
  /**
   * Union the sub-account's existing on-chain Virtual Accounts (VAs) — plus the
   * predicted VAs of its pending instant-opens and any VAs seen on the
   * notifications stream — into the on-chain reads. In lowcap each isolated
   * position lives under a VA, so this is required to see the full picture.
   * Default `true`.
   */
  includeVirtualAccounts?: boolean;
  /** Extra accounts to read quotes across (e.g. VAs already known to the consumer). */
  extraAccounts?: readonly Address[];
  /** Per-source toggles; omit to read every source. */
  sources?: ManagedQuotesSources;
}

/**
 * Value returned by {@link useManagedQuotes}.
 */
export interface UseManagedQuotesResult {
  /** Merged, de-duplicated, lifecycle-tagged rows, newest first. */
  quotes: UnifiedQuote[];
  /** The same rows indexed by their stable {@link UnifiedQuote.key}. */
  byKey: Record<string, UnifiedQuote>;
  /** The on-chain `partyA` accounts the quotes were read across (sub-account + VAs + predicted + extras). */
  accounts: Address[];
  /** `true` while any enabled source has not produced its first result. */
  isLoading: boolean;
  /** `true` while any enabled source is fetching (background refetch included). */
  isFetching: boolean;
  /** Live connection status of the notifications socket (`"closed"` when `live` is off). */
  socketStatus: SocketStatus;
  /** The first error surfaced by any source, normalized, or `null`. */
  error: SymmioRequestError | null;
  /** Force every enabled source to refetch immediately. */
  refetch: () => void;
}

/**
 * Orchestrate every quote source for one sub-account — fanned out across every
 * account that holds its positions — into a single, stable, lifecycle-tagged
 * table.
 *
 * In lowcap, isolated positions live under Virtual Accounts (VAs), so a
 * sub-account's quotes are spread across its VAs rather than the sub-account
 * itself. This resolves the full account set — the sub-account, its existing
 * VAs (`useVirtualAccountsAddressesOfSubAccount`), the predicted VAs of its
 * pending instant-opens (`getPredictedNextVirtualAccount`), VAs seen on the
 * notifications stream, and any `extraAccounts` — then reads
 * `getPartyAOpenPositions` and `getPartyAPendingQuotes` (+ per-id `getQuote`
 * hydration) across that set via `useQueries`. Off-chain hedger reads
 * (`useInstantOpens` / `useInstantCloses`) stay scoped to the sub-account.
 *
 * Every source is gated by `sources`, `enabled`, and a set `partyA`, then their
 * snapshots flow through the pure core `reconcileQuotes` ("active quotes only" —
 * a quote shows iff it is in a source this tick), stamping each optimistic
 * instant-open with its predicted VA via `instantOpenVaByTempId`. Live
 * notifications (via `useNotifications`, unless `live` is `false`) are applied in
 * the same merge. On-chain polling accelerates automatically while any row is
 * mid-transition (`shouldAccelerateQuotePolling`).
 *
 * Optimistic instant-opens seeded into {@link useOptimisticQuotesStore} are
 * merged in as extra `instantOpens` so a just-submitted trade shows instantly,
 * then cleared once the same `tempQuoteId` lands on-chain.
 *
 * @example
 * ```tsx
 * const { quotes, accounts, socketStatus, isLoading } = useManagedQuotes({ partyA });
 * ```
 */
export function useManagedQuotes(parameters: UseManagedQuotesParameters): UseManagedQuotesResult {
  const { partyA, chainId, pollingInterval = DEFAULT_POLLING_INTERVAL, live = true, enabled = true } = parameters;
  const config = useSymmioConfig();
  const defaultChainId = useSymmioChainId();
  const resolvedChainId = chainId ?? defaultChainId;
  const includeVirtualAccounts = parameters.includeVirtualAccounts ?? true;
  const extraAccounts = parameters.extraAccounts;
  const sources = parameters.sources;
  const wantOpenPositions = sources?.openPositions ?? true;
  const wantPendingQuotes = sources?.pendingQuotes ?? true;
  const wantInstantOpens = sources?.instantOpens ?? true;
  const wantInstantCloses = sources?.instantCloses ?? true;
  const active = enabled && Boolean(partyA);

  /**
   * Identity of the current account set's owner. VA retention (below) is scoped
   * to this `(chainId, partyA)` so switching sub-accounts never carries another
   * account's VAs into the read set.
   */
  const retentionOwner = active && partyA ? `${resolvedChainId}:${partyA.toLowerCase()}` : undefined;

  /**
   * VAs retained across the optimistic→on-chain hand-off. A predicted VA leaves
   * `predictedVas` the instant its instant-open lands on-chain (the hedger drops
   * the pending open), while `getVirtualAccountsAddressesOfSubAccount` and the
   * notification `va_address` can lag a poll behind — so without retention we'd
   * stop polling the exact VA the position just landed in, and the row would
   * vanish for a tick before reappearing as its `ONCHAIN` twin. VAs are
   * append-only on-chain, so once discovered we keep reading them while the owner
   * is unchanged. See reference-va-address-resolution in agent memory.
   */
  const [retained, setRetained] = useState<{ owner?: string; vas: Address[] }>({ vas: [] });
  const retainedVas = retained.owner === retentionOwner ? retained.vas : NO_RETAINED_VAS;

  /**
   * Notification-driven invalidation. Reads are kept in sync off the live
   * notifications stream — not polling — so the feature works with polling off.
   * `queryClient` and the cache scope (`configKey`) are mirrored into refs so the
   * `onNotification` callback below can stay referentially stable (a new callback
   * identity would resubscribe the socket). The debounce timer coalesces a burst
   * of notifications into one invalidation pass.
   */
  const queryClient = useQueryClient();
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;
  const configKey = config.getChainConfigKey(resolvedChainId);
  const configKeyRef = useRef(configKey);
  configKeyRef.current = configKey;
  const invalidateTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /**
   * Which hedger feeds a debounced notification burst should invalidate. A burst
   * can mix open and close events, so the kinds are accumulated here across the
   * debounce window and read (then reset) when the timer fires — scoping the
   * invalidation to the feeds the events can actually affect.
   */
  const pendingInvalidationRef = useRef<{ opens: boolean; closes: boolean }>({ opens: false, closes: false });

  /**
   * Last reconciliation result, kept in a ref so it survives renders without
   * triggering one. Its only remaining job is to feed
   * {@link shouldAccelerateQuotePolling} the previous tick's result, since the
   * source queries set their `refetchInterval` before this render's result
   * exists. ("Active quotes only" dropped the grace window, and `links` are
   * recomputed fresh on each merge.)
   */
  const previousRef = useRef<ReconcileQuotesResult | undefined>(undefined);

  /**
   * Rows anchored on a prior tick (a notification set their `quoteId`) but not yet
   * returned by the on-chain read — the previous merge's `pendingAnchors`. Fed back
   * into {@link reconcileQuotes} so an anchored row keeps showing while the RPC
   * catches up, instead of vanishing once the hedger drops its pending open. Held in
   * a ref so it survives renders without triggering one; the source query that
   * dropped the row drives the recompute that reads it.
   */
  const retainedAnchorsRef = useRef<UnifiedQuote[]>([]);

  const optimisticEntries = useOptimisticQuotesStore((state) => state.entries);
  const clearSettled = useOptimisticQuotesStore((state) => state.clearSettled);

  const accelerated = previousRef.current ? shouldAccelerateQuotePolling(previousRef.current) : false;
  const pollInterval = accelerated ? ACCELERATED_POLLING_INTERVAL : pollingInterval;
  const refetchInterval = active ? pollInterval : false;

  /**
   * Gate the hedger feeds on the previous tick's lifecycles: poll instant-opens
   * only while an open is in flight, instant-closes only while a close is in flight.
   * Idle (just holding positions) polls neither — the on-chain reads + notifications
   * cover steady state, and the open/close mutations invalidate the matching feed to
   * bootstrap the first fetch. (Computed from the previous result for the same reason
   * `accelerated` is — the queries set their interval before this render's result
   * exists; an on-chain poll or notification re-render flips the gate on a tick later.)
   */
  const previousQuotes = previousRef.current?.quotes;
  const hasOpenIntent = previousQuotes?.some((quote) => OPEN_INTENT_LIFECYCLES.has(quote.lifecycle)) ?? false;
  const hasCloseIntent = previousQuotes?.some((quote) => CLOSE_INTENT_LIFECYCLES.has(quote.lifecycle)) ?? false;
  const instantOpensInterval = active && wantInstantOpens && hasOpenIntent ? pollInterval : false;
  const instantClosesInterval = active && wantInstantCloses && hasCloseIntent ? pollInterval : false;

  /**
   * Off-chain hedger reads — always scoped to the sub-account, never the VAs. Kept
   * `enabled` so a mutation's `onSuccess` invalidation can fetch them on demand, but
   * polled only while the matching flow is in flight (see the interval gates above).
   */
  const instantOpens = useInstantOpens({
    partyA: partyA as Address,
    chainId: resolvedChainId,
    query: { enabled: active && wantInstantOpens, refetchInterval: instantOpensInterval },
  });

  const instantCloses = useInstantCloses({
    partyA: partyA as Address,
    chainId: resolvedChainId,
    query: { enabled: active && wantInstantCloses, refetchInterval: instantClosesInterval },
  });

  /** The sub-account's existing on-chain VAs. Empty (harmless) when `partyA` is itself a VA. */
  const virtualAccounts = useVirtualAccountsAddressesOfSubAccount({
    subAccount: partyA,
    chainId: resolvedChainId,
    query: { enabled: active && includeVirtualAccounts, refetchInterval },
  });

  /**
   * Brand-new-VA bridge: a position can open in a market the sub-account has
   * never traded, landing in a freshly created VA that is not yet in
   * `getVirtualAccountsAddressesOfSubAccount`. The predicted VA below covers it
   * while the instant-open is pending; once it lands on-chain the hedger drops the
   * open and the prediction with it, so VA retention (`retained`, above) keeps the
   * VA in the poll set across the hand-off — the row transitions to `ONCHAIN` in
   * place instead of flickering out and back.
   */

  /**
   * Predict the VA each pending instant-open will land in. The set of opens is
   * dynamic, but `useQueries` over a dynamic array is allowed — the hook count
   * stays one regardless of length.
   */
  const pendingOpens = wantInstantOpens ? (instantOpens.data ?? []) : [];
  const predictedVas = useQueries({
    queries: pendingOpens.map((open) => ({
      ...getPredictedNextVirtualAccountQueryOptions(config, {
        subAccount: partyA,
        chainId: resolvedChainId,
        isolationType: isolationTypeForSide(open.positionType),
        symbolId: BigInt(open.marketId),
        query: { enabled: active && includeVirtualAccounts, refetchInterval },
      }),
    })),
    combine: (results) => ({
      byTempId: pendingOpens.reduce<Record<number, Address>>((map, open, index) => {
        const predicted = results[index]?.data;
        if (predicted) map[open.tempQuoteId] = getAddress(predicted);
        return map;
      }, {}),
      addresses: results.map((result) => result.data).filter((address): address is Address => Boolean(address)),
      isLoading: results.some((result) => result.isLoading),
      isFetching: results.some((result) => result.isFetching),
    }),
  });

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { status: socketStatus } = useNotifications({
    account: partyA,
    chainId: resolvedChainId,
    enabled: active && live,
    onNotification: useCallback((notification: Notification) => {
      setNotifications((prev) => [...prev, notification].slice(-NOTIFICATION_BUFFER_LIMIT));
      /**
       * Refetch the authoritative reads off the live event so both tables stay in
       * sync without polling. The on-chain reads always refresh (any lifecycle event
       * can change them); the hedger feeds refresh only for the matching flow, so an
       * open event never re-fetches the closes feed and vice versa. Kinds are
       * accumulated across the debounce window because a burst can mix open and close
       * events. Scoped to this chain (`configKey`); React Query dedups concurrent
       * refetches of the same query.
       */
      const kind = classifyQuoteNotificationAction(notification.lastSeenAction);
      const pending = pendingInvalidationRef.current;
      if (kind === "open") pending.opens = true;
      else if (kind === "close") pending.closes = true;
      else {
        pending.opens = true;
        pending.closes = true;
      }
      if (invalidateTimerRef.current) clearTimeout(invalidateTimerRef.current);
      invalidateTimerRef.current = setTimeout(() => {
        const client = queryClientRef.current;
        const scope = { configKey: configKeyRef.current };
        const { opens, closes } = pendingInvalidationRef.current;
        pendingInvalidationRef.current = { opens: false, closes: false };
        void client.invalidateQueries({ predicate: predicateMatch(getPartyAOpenPositionsQueryKey, scope) });
        void client.invalidateQueries({ predicate: predicateMatch(getPartyAPendingQuotesQueryKey, scope) });
        void client.invalidateQueries({ predicate: predicateMatch(getQuoteQueryKey, scope) });
        if (opens) void client.invalidateQueries({ predicate: predicateMatch(getInstantOpensQueryKey, scope) });
        if (closes) void client.invalidateQueries({ predicate: predicateMatch(getInstantClosesQueryKey, scope) });
      }, NOTIFICATION_INVALIDATE_DEBOUNCE);
    }, []),
  });

  /** Clear the pending invalidation timer on unmount. */
  useEffect(() => {
    return () => {
      if (invalidateTimerRef.current) clearTimeout(invalidateTimerRef.current);
    };
  }, []);

  /** Distinct VA addresses seen on the notifications stream. */
  const notificationVas = useMemo<Address[]>(() => {
    const seen = new Set<string>();
    const result: Address[] = [];
    for (const notification of notifications) {
      if (!notification.vaAddress) continue;
      const checksummed = getAddress(notification.vaAddress);
      const lower = checksummed.toLowerCase();
      if (seen.has(lower)) continue;
      seen.add(lower);
      result.push(checksummed);
    }
    return result;
  }, [notifications]);

  /**
   * The deduplicated (case-insensitive), checksummed set of on-chain accounts to
   * read quotes across — the sub-account, its VAs, the predicted VAs, the
   * notification VAs, and any extras. Order: sub-account first, then the rest.
   */
  const accounts = useMemo<Address[]>(() => {
    if (!active || !partyA) return [];
    const seen = new Set<string>();
    const result: Address[] = [];
    const add = (address: Address) => {
      const checksummed = getAddress(address);
      const lower = checksummed.toLowerCase();
      if (seen.has(lower)) return;
      seen.add(lower);
      result.push(checksummed);
    };
    add(partyA);
    if (includeVirtualAccounts) {
      for (const virtualAccount of virtualAccounts.data ?? []) add(virtualAccount);
      for (const predicted of predictedVas.addresses) add(predicted);
      for (const notificationVa of notificationVas) add(notificationVa);
      for (const retainedVa of retainedVas) add(retainedVa);
    }
    for (const extra of extraAccounts ?? []) add(extra);
    return result;
  }, [
    active,
    partyA,
    includeVirtualAccounts,
    virtualAccounts.data,
    predictedVas.addresses,
    notificationVas,
    retainedVas,
    extraAccounts,
  ]);

  /**
   * Accumulate every VA we discover (list + predicted + notification) into the
   * retained set so none ever leaves the poll set mid-hand-off. Monotonic per
   * owner; resets when the owner `(chainId, partyA)` changes. Setting state only
   * when something new appears keeps this from looping.
   */
  useEffect(() => {
    if (!retentionOwner) return;
    const discovered = [...(virtualAccounts.data ?? []), ...predictedVas.addresses, ...notificationVas];
    setRetained((prev) => {
      const carryOver = prev.owner === retentionOwner ? prev.vas : [];
      const seen = new Set(carryOver.map((address) => address.toLowerCase()));
      const next = [...carryOver];
      let changed = prev.owner !== retentionOwner;
      for (const va of discovered) {
        const checksummed = getAddress(va);
        const lower = checksummed.toLowerCase();
        if (seen.has(lower)) continue;
        seen.add(lower);
        next.push(checksummed);
        changed = true;
      }
      return changed ? { owner: retentionOwner, vas: next } : prev;
    });
  }, [retentionOwner, virtualAccounts.data, predictedVas.addresses, notificationVas]);

  /** On-chain open positions, fanned out across every account, flattened to one `Quote[]`. */
  const openPositions = useQueries({
    queries: accounts.map((account) => {
      const options = getPartyAOpenPositionsQueryOptions(config, {
        partyA: account,
        chainId: resolvedChainId,
        query: { enabled: active && wantOpenPositions, refetchInterval },
      });
      return {
        ...options,
        queryFn: async () => {
          try {
            return await options.queryFn();
          } catch (err) {
            throw normalizeSymmError(err);
          }
        },
      };
    }),
    combine: (results) => ({
      quotes: results.flatMap((result) => result.data ?? []),
      isLoading: results.some((result) => result.isLoading),
      isFetching: results.some((result) => result.isFetching),
      error: (results.find((result) => result.error)?.error as SymmioRequestError | undefined) ?? null,
      refetch: () => results.forEach((result) => result.refetch()),
    }),
  });
  /** Pending quote ids, fanned out across every account, then hydrated per id. */
  const pendingQuoteIds = useQueries({
    queries: accounts.map((account) => {
      const options = getPartyAPendingQuotesQueryOptions(config, {
        partyA: account,
        chainId: resolvedChainId,
        query: { enabled: active && wantPendingQuotes, refetchInterval },
      });
      return {
        ...options,
        queryFn: async () => {
          try {
            return await options.queryFn();
          } catch (err) {
            throw normalizeSymmError(err);
          }
        },
      };
    }),
    combine: (results) => ({
      ids: results.flatMap((result) => result.data ?? []),
      isLoading: results.some((result) => result.isLoading),
      isFetching: results.some((result) => result.isFetching),
      error: (results.find((result) => result.error)?.error as SymmioRequestError | undefined) ?? null,
      refetch: () => results.forEach((result) => result.refetch()),
    }),
  });

  const hydratedPending = useQueries({
    queries: pendingQuoteIds.ids.map((quoteId) => {
      const options = getQuoteQueryOptions(config, {
        quoteId,
        chainId: resolvedChainId,
        query: { enabled: active && wantPendingQuotes, refetchInterval },
      });
      return {
        ...options,
        queryFn: async () => {
          try {
            return await options.queryFn();
          } catch (err) {
            throw normalizeSymmError(err);
          }
        },
      };
    }),
    combine: (results) => ({
      quotes: results.map((result) => result.data).filter((quote): quote is Quote => Boolean(quote)),
      isLoading: results.some((result) => result.isLoading),
      isFetching: results.some((result) => result.isFetching),
      error: (results.find((result) => result.error)?.error as SymmioRequestError | undefined) ?? null,
    }),
  });

  const result = useMemo<ReconcileQuotesResult>(() => {
    if (!active || !partyA) {
      previousRef.current = undefined;
      retainedAnchorsRef.current = [];
      return { quotes: [], links: {}, pendingAnchors: [] };
    }
    const seededInstantOpens = [...(instantOpens.data ?? []), ...Object.values(optimisticEntries)];
    const next = reconcileQuotes({
      partyA,
      onchainPositions: wantOpenPositions ? openPositions.quotes : [],
      onchainPendingQuotes: wantPendingQuotes ? hydratedPending.quotes : [],
      instantOpens: wantInstantOpens ? seededInstantOpens : [],
      instantCloses: wantInstantCloses ? (instantCloses.data ?? []) : [],
      instantOpenVaByTempId: predictedVas.byTempId,
      notifications,
      retainedAnchors: retainedAnchorsRef.current,
    });
    previousRef.current = next;
    retainedAnchorsRef.current = next.pendingAnchors;
    return next;
  }, [
    active,
    partyA,
    openPositions.quotes,
    hydratedPending.quotes,
    instantOpens.data,
    instantCloses.data,
    predictedVas.byTempId,
    optimisticEntries,
    notifications,
    wantOpenPositions,
    wantPendingQuotes,
    wantInstantOpens,
    wantInstantCloses,
  ]);

  const byKey = useMemo<Record<string, UnifiedQuote>>(() => {
    const map: Record<string, UnifiedQuote> = {};
    for (const quote of result.quotes) map[quote.key] = quote;
    return map;
  }, [result.quotes]);

  /**
   * Drop optimistic seeds once their `tempQuoteId` has been **confirmed by the
   * on-chain read** — the linked row carries the polled struct (`raw.onchain`).
   * Clearing on the notification link alone would drop the seed while the row is
   * still `WRITE_ONCHAIN`, before any source but the notification holds it, so the
   * row would flicker out until the RPC catches up.
   */
  useEffect(() => {
    const settled = Object.keys(optimisticEntries)
      .map(Number)
      .filter((tempQuoteId) => {
        const key = result.links[tempQuoteId];
        return key !== undefined && byKey[key]?.raw.onchain !== undefined;
      });
    if (settled.length > 0) clearSettled(settled);
  }, [result, byKey, optimisticEntries, clearSettled]);

  const isLoading =
    (active && includeVirtualAccounts && virtualAccounts.isLoading) ||
    (active && includeVirtualAccounts && predictedVas.isLoading) ||
    (active && wantOpenPositions && openPositions.isLoading) ||
    (active && wantPendingQuotes && (pendingQuoteIds.isLoading || hydratedPending.isLoading)) ||
    (active && wantInstantOpens && instantOpens.isLoading) ||
    (active && wantInstantCloses && instantCloses.isLoading);

  const isFetching =
    (includeVirtualAccounts && (virtualAccounts.isFetching || predictedVas.isFetching)) ||
    (wantOpenPositions && openPositions.isFetching) ||
    (wantPendingQuotes && (pendingQuoteIds.isFetching || hydratedPending.isFetching)) ||
    (wantInstantOpens && instantOpens.isFetching) ||
    (wantInstantCloses && instantCloses.isFetching);

  const error =
    openPositions.error ??
    pendingQuoteIds.error ??
    hydratedPending.error ??
    virtualAccounts.error ??
    instantOpens.error ??
    instantCloses.error ??
    null;

  /**
   * `openPositions` / `pendingQuoteIds` are `useQueries` fan-outs (no single
   * query handle), so their combined results expose a `refetch` that fires every
   * per-account query. Refetching the ids re-drives the per-id hydration.
   */
  const refetchOpenPositions = openPositions.refetch;
  const refetchPendingQuoteIds = pendingQuoteIds.refetch;
  const refetch = useCallback(() => {
    if (includeVirtualAccounts) virtualAccounts.refetch();
    if (wantOpenPositions) refetchOpenPositions();
    if (wantPendingQuotes) refetchPendingQuoteIds();
    if (wantInstantOpens) instantOpens.refetch();
    if (wantInstantCloses) instantCloses.refetch();
  }, [
    includeVirtualAccounts,
    wantOpenPositions,
    wantPendingQuotes,
    wantInstantOpens,
    wantInstantCloses,
    virtualAccounts,
    refetchOpenPositions,
    refetchPendingQuoteIds,
    instantOpens,
    instantCloses,
  ]);

  return {
    quotes: result.quotes,
    byKey,
    accounts,
    isLoading: Boolean(isLoading),
    isFetching: Boolean(isFetching),
    socketStatus: live ? socketStatus : "closed",
    error,
    refetch,
  };
}
