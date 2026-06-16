"use client";

import {
  getPartyAOpenPositionsQueryOptions,
  getPartyAPendingQuotesQueryOptions,
  getPredictedNextVirtualAccountQueryOptions,
  getQuoteQueryOptions,
  isolationTypeForSide,
  reconcileQuotes,
  shouldAccelerateQuotePolling,
  type Notification,
  type Quote,
  type ReconcileQuotesResult,
  type SocketStatus,
  type UnifiedQuote,
} from "@symm-frontier/core";
import { useQueries } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAddress, type Address } from "viem";
import { useVirtualAccountsAddressesOfSubAccount } from "../account-layer/use-virtual-accounts-addresses-of-sub-account";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useInstantCloses } from "../instant-layer/use-instant-closes";
import { useInstantOpens } from "../instant-layer/use-instant-opens";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
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
 */
const NOTIFICATION_BUFFER_LIMIT = 100;

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
 * snapshots flow through the pure core `reconcileQuotes`, injecting `Date.now()`
 * as the clock, threading the previous result for the removal grace window, and
 * stamping each optimistic instant-open with its predicted VA via
 * `instantOpenVaByTempId`. Live notifications (via `useNotifications`, unless
 * `live` is `false`) are applied in the same merge. On-chain polling accelerates
 * automatically while any row is mid-transition (`shouldAccelerateQuotePolling`).
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
   * Previous reconciliation result (drives the removal grace window and the
   * temp ↔ on-chain links). Lives in a ref so it survives renders without
   * triggering one; the latest result is synced back after each merge.
   */
  const previousRef = useRef<ReconcileQuotesResult | undefined>(undefined);

  const optimisticEntries = useOptimisticQuotesStore((state) => state.entries);
  const clearSettled = useOptimisticQuotesStore((state) => state.clearSettled);

  const accelerated = previousRef.current ? shouldAccelerateQuotePolling(previousRef.current) : false;
  const refetchInterval = active ? (accelerated ? ACCELERATED_POLLING_INTERVAL : pollingInterval) : false;

  /** Off-chain hedger reads — always scoped to the sub-account, never the VAs. */
  const instantOpens = useInstantOpens({
    partyA: partyA as Address,
    chainId: resolvedChainId,
    query: { enabled: active && wantInstantOpens, refetchInterval },
  });

  const instantCloses = useInstantCloses({
    partyA: partyA as Address,
    chainId: resolvedChainId,
    query: { enabled: active && wantInstantCloses, refetchInterval },
  });

  /** The sub-account's existing on-chain VAs. Empty (harmless) when `partyA` is itself a VA. */
  const virtualAccounts = useVirtualAccountsAddressesOfSubAccount({
    subAccount: partyA,
    chainId: resolvedChainId,
    query: { enabled: active && includeVirtualAccounts, refetchInterval },
  });

  /**
   * TODO(quotes): brand-new-VA bridge gap — an optimistic row can briefly
   * disappear (then reappear as its `ONCHAIN` row) when a position opens in a
   * market the sub-account has never traded (a freshly created Virtual Account).
   *
   * Cause: predicted VAs below are derived from the CURRENT pending opens. The
   * instant the hedger drops an instant-open (because it landed on-chain), its
   * predicted VA leaves the `accounts` set — so we stop polling exactly the new VA
   * where the quote landed, right before we've read it. The VA is not in
   * `getVirtualAccountsAddressesOfSubAccount` yet, and the notification
   * `va_address` can lag, so for a tick the optimistic row has no on-chain twin
   * and (under "active quotes only") drops until its real `ONCHAIN` row appears.
   *
   * Fix: retain recently predicted/notified VAs in the account set for a short
   * window after their pending open disappears (a per-config VA "seen" cache, à la
   * Vibe-ui's VA store), so polling continues across the hand-off and the row
   * transitions without a flicker. See reference-va-address-resolution in agent
   * memory.
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
    }, []),
  });

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
    extraAccounts,
  ]);

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
      return { quotes: [], links: {} };
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
    });
    previousRef.current = next;
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

  /** Drop optimistic seeds once their `tempQuoteId` has anchored on-chain. */
  useEffect(() => {
    const settled = Object.keys(optimisticEntries)
      .map(Number)
      .filter((tempQuoteId) => result.links[tempQuoteId] !== undefined);
    if (settled.length > 0) clearSettled(settled);
  }, [result, optimisticEntries, clearSettled]);

  const byKey = useMemo<Record<string, UnifiedQuote>>(() => {
    const map: Record<string, UnifiedQuote> = {};
    for (const quote of result.quotes) map[quote.key] = quote;
    return map;
  }, [result.quotes]);

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
