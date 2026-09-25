import {
  getInstantCloses,
  getInstantOpens,
  getPartyAOpenPositions,
  getPartyAPendingQuotes,
  getQuote,
  QuoteLifecycle,
  QuoteStatus,
  reconcileQuotes,
  resolveQuoteAccounts,
  type Notification,
  type PendingInstantClose,
  type PendingInstantOpen,
  type Quote,
  type UnifiedQuote,
} from "@symmio/trading-core";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Address } from "viem";
import { useNotificationsFeed } from "./use-notifications.js";
import { useSdkScope } from "./use-sdk-scope.js";
import { useSubAccount } from "./use-sub-accounts.js";

const IN_FLIGHT_STAGES: readonly QuoteLifecycle[] = [
  QuoteLifecycle.OPTIMISTIC,
  QuoteLifecycle.PRICE_FILLED,
  QuoteLifecycle.WRITE_ONCHAIN,
  QuoteLifecycle.OPTIMISTIC_CLOSE,
  QuoteLifecycle.CLOSE_PRICE_FILLED,
  QuoteLifecycle.WRITE_ONCHAIN_CLOSE,
];

/** A quote in any transient (non-`ONCHAIN`, non-terminal) stage. */
export function isInFlight(quote: UnifiedQuote): boolean {
  return IN_FLIGHT_STAGES.includes(quote.lifecycle);
}

/** A quote is actionable (close / margin / TP-SL) only when fully `ONCHAIN`. */
export function isActionable(quote: UnifiedQuote): boolean {
  return quote.lifecycle === QuoteLifecycle.ONCHAIN && quote.quoteStatus === QuoteStatus.OPENED;
}

/** Whether an anchored quote has a cancel/force action available. */
export function hasOrderAction(quote: UnifiedQuote): boolean {
  return (
    quote.lifecycle === QuoteLifecycle.ONCHAIN &&
    (quote.quoteStatus === QuoteStatus.PENDING ||
      quote.quoteStatus === QuoteStatus.LOCKED ||
      quote.quoteStatus === QuoteStatus.CANCEL_PENDING ||
      quote.quoteStatus === QuoteStatus.CLOSE_PENDING ||
      quote.quoteStatus === QuoteStatus.CANCEL_CLOSE_PENDING)
  );
}

interface Snapshot {
  onchainPositions: Quote[];
  onchainPendingQuotes: Quote[];
  instantOpens: PendingInstantOpen[];
  instantCloses: PendingInstantClose[];
  instantOpenVaByTempId: Record<number, Address>;
}

interface ReconciledSnapshot {
  quotes: UnifiedQuote[];
  pendingAnchors: UnifiedQuote[];
}

interface ReconciliationAttempt {
  snapshot: ReconciledSnapshot | null;
  error: unknown;
}

interface ScopedSnapshot {
  scopeKey: string;
  snapshot: ReconciledSnapshot;
}

interface ScopedRetainedAnchors {
  scopeKey: string;
  anchors: UnifiedQuote[];
}

interface ScopedVirtualAccounts {
  scopeKey: string;
  addresses: string[];
}

const EMPTY_RECONCILED_SNAPSHOT: ReconciledSnapshot = {
  quotes: [],
  pendingAnchors: [],
};
const EMPTY_NOTIFICATIONS: Notification[] = [];

export interface ManagedPositions {
  /** Every reconciled row (including closed), newest first. */
  quotes: UnifiedQuote[];
  /** Rows that are not yet closed — the positions list. */
  positions: UnifiedQuote[];
  /** Whether at least one successfully reconciled snapshot is available. */
  hasSnapshot: boolean;
  /** The visible rows are last-known data and must not be used to start an action. */
  isStale: boolean;
  /** All required sources and reconciliation succeeded for the visible snapshot. */
  actionsEnabled: boolean;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => void;
}

/**
 * The terminal's `useManagedQuotes` analogue, driven directly off
 * `@symmio/trading-core`. Each tick it resolves the sub-account's full partyA
 * set (sub-account + existing VAs + VAs discovered from notifications), fans the
 * on-chain reads across all of them, folds in the hedger's pending instant-close
 * feed and the live notification stream through the pure `reconcileQuotes`
 * engine, and retains anchored-but-unread rows so positions never flicker out
 * during the optimistic→on-chain hand-off. Polling accelerates while any row is
 * in flight.
 */
export function useManagedPositions(enabled = true): ManagedPositions {
  const { config, chainId, solverId } = useSdkScope();
  const { subAccount } = useSubAccount();
  const { notifications } = useNotificationsFeed();

  const scopeKey = `${chainId}:${solverId}:${subAccount ?? ""}`;
  const [discoveredVaState, setDiscoveredVaState] = useState<ScopedVirtualAccounts>({
    scopeKey,
    addresses: [],
  });
  const [inFlight, setInFlight] = useState(false);
  const retainedAnchors = useRef<ScopedRetainedAnchors | null>(null);
  const lastGoodSnapshot = useRef<ScopedSnapshot | null>(null);
  const notificationScope = useRef(scopeKey);

  const scopedNotifications = notificationScope.current === scopeKey ? notifications : EMPTY_NOTIFICATIONS;

  useEffect(() => {
    notificationScope.current = scopeKey;
    setInFlight(false);
  }, [scopeKey]);

  const notifVas = useMemo(
    () => Array.from(new Set(scopedNotifications.map((n) => n.vaAddress).filter((v): v is string => Boolean(v)))),
    [scopedNotifications],
  );
  const extraAccounts = useMemo(() => {
    const discoveredVas = discoveredVaState.scopeKey === scopeKey ? discoveredVaState.addresses : [];
    return Array.from(new Set([...discoveredVas, ...notifVas]));
  }, [discoveredVaState, notifVas, scopeKey]);

  const query = useQuery({
    queryKey: ["managed-positions", chainId, solverId, subAccount, extraAccounts.join(",")],
    enabled: enabled && Boolean(subAccount),
    refetchInterval: inFlight ? 1500 : 4000,
    queryFn: async (): Promise<Snapshot> => {
      const account = subAccount as Address;
      const instantOpens = await getInstantOpens(config, { chainId, solverId, partyA: account });
      const { accounts, instantOpenVaByTempId } = await resolveQuoteAccounts(config, {
        chainId,
        subAccount: account,
        instantOpens,
        includeVirtualAccounts: true,
        extraAccounts: extraAccounts as Address[],
      });

      const perAccount = await Promise.all(
        accounts.map(async (partyA) => {
          const [positions, pendingIds] = await Promise.all([
            getPartyAOpenPositions(config, { chainId, partyA }),
            getPartyAPendingQuotes(config, { chainId, partyA }),
          ]);
          const pending = (
            await Promise.all(pendingIds.map((quoteId) => getQuote(config, { chainId, quoteId })))
          ).filter((quote): quote is Quote => quote != null);
          return { positions: [...positions], pending };
        }),
      );

      const instantCloses = await getInstantCloses(config, { chainId, solverId, partyA: account });

      return {
        onchainPositions: perAccount.flatMap((entry) => entry.positions),
        onchainPendingQuotes: perAccount.flatMap((entry) => entry.pending),
        instantOpens: [...instantOpens],
        instantCloses: [...instantCloses],
        instantOpenVaByTempId,
      };
    },
  });

  const reconciliation = useMemo<ReconciliationAttempt>(() => {
    if (!subAccount || !query.data) {
      return { snapshot: null, error: null };
    }
    try {
      const result = reconcileQuotes({
        partyA: subAccount as Address,
        onchainPositions: query.data.onchainPositions,
        onchainPendingQuotes: query.data.onchainPendingQuotes,
        instantOpens: query.data.instantOpens,
        instantCloses: query.data.instantCloses,
        instantOpenVaByTempId: query.data.instantOpenVaByTempId,
        /** Already in arrival order — the order `reconcileQuotes` requires. */
        notifications: scopedNotifications,
        retainedAnchors: retainedAnchors.current?.scopeKey === scopeKey ? retainedAnchors.current.anchors : [],
      });
      return {
        snapshot: { quotes: result.quotes, pendingAnchors: result.pendingAnchors },
        error: null,
      };
    } catch (error) {
      return { snapshot: null, error };
    }
  }, [subAccount, query.data, scopedNotifications, scopeKey]);

  const previousSnapshot = lastGoodSnapshot.current?.scopeKey === scopeKey ? lastGoodSnapshot.current.snapshot : null;
  const reconciled = reconciliation.snapshot ?? previousSnapshot ?? EMPTY_RECONCILED_SNAPSHOT;
  const hasSnapshot = reconciliation.snapshot != null || previousSnapshot != null;
  const error = query.error ?? reconciliation.error;
  const isStale =
    enabled &&
    Boolean(subAccount) &&
    (reconciliation.snapshot == null || query.error != null || reconciliation.error != null);
  const actionsEnabled = enabled && Boolean(subAccount) && reconciliation.snapshot != null && error == null;

  useEffect(() => {
    if (!reconciliation.snapshot) return;

    lastGoodSnapshot.current = { scopeKey, snapshot: reconciliation.snapshot };
    retainedAnchors.current = { scopeKey, anchors: reconciliation.snapshot.pendingAnchors };

    const nextInFlight = reconciliation.snapshot.quotes.some(isInFlight);
    setInFlight((prev) => (prev === nextInFlight ? prev : nextInFlight));

    const found = reconciliation.snapshot.quotes
      .map((q) => q.vaAddress)
      .filter((v): v is Address => Boolean(v))
      .map((v) => v.toString());
    setDiscoveredVaState((previous) => {
      const current = previous.scopeKey === scopeKey ? previous.addresses : [];
      const seen = new Set(current.map((v) => v.toLowerCase()));
      const next = [...current];
      let changed = false;
      for (const va of found) {
        if (!seen.has(va.toLowerCase())) {
          seen.add(va.toLowerCase());
          next.push(va);
          changed = true;
        }
      }
      if (!changed && previous.scopeKey === scopeKey) return previous;
      return { scopeKey, addresses: next };
    });
  }, [reconciliation.snapshot, scopeKey]);

  /**
   * A failed quote never became a position, so it is never rendered as one — a
   * `FAILED` row is dropped alongside the terminal `CLOSED` rows.
   */
  const positions = useMemo(
    () =>
      reconciled.quotes.filter(
        (quote) => quote.lifecycle !== QuoteLifecycle.CLOSED && quote.lifecycle !== QuoteLifecycle.FAILED,
      ),
    [reconciled.quotes],
  );

  return {
    quotes: reconciled.quotes,
    positions,
    hasSnapshot,
    isStale,
    actionsEnabled,
    isLoading: query.isLoading && !hasSnapshot,
    isFetching: query.isFetching,
    error,
    refetch: () => void query.refetch(),
  };
}
