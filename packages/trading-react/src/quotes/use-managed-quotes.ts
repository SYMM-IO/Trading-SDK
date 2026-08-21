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
  isCancelAction,
  isCloseFillAction,
  isolationTypeForSide,
  isOpenAnchorAction,
  NotificationType,
  QuoteLifecycle,
  reconcileQuotes,
  shouldAccelerateOnchainReads,
  type Notification,
  type Quote,
  type ReconcileQuotesResult,
  type SocketStatus,
  type UnifiedQuote,
} from "@symmio/trading-core";
import { useQueries, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAddress, type Address } from "viem";
import { useVirtualAccountsAddressesOfSubAccount } from "../account-layer/use-virtual-accounts-addresses-of-sub-account";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useInstantCloses } from "../instant-layer/use-instant-closes";
import { useInstantOpens } from "../instant-layer/use-instant-opens";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { useTpSlStore } from "../tpsl/tpsl-store";
import { invalidateAccountBalances, predicateMatch } from "../utils";
import { useNotifications } from "../websocket/use-notifications";
import { nextConfirmDelay, pruneCancelConfirmHold, pruneCloseConfirmHold, pruneOpenConfirmHold } from "./confirm-hold";
import { useOptimisticQuotesStore } from "./optimistic-quotes-store";

/**
 * Baseline poll interval (ms) used **only as a fallback** when the live event channel
 * is unavailable (`live` is off, or the notifications socket is not `open`). With the
 * socket up the feature is events-first: there is no idle on-chain poll unless the
 * consumer opts into one via `pollingInterval`.
 */
const FALLBACK_POLLING_INTERVAL = 5_000;

/** Accelerated quote-polling interval (ms) while a row is mid-transition. */
const ACCELERATED_POLLING_INTERVAL = 1_500;

/**
 * Confirm-hold backoff (see `openConfirmRef` / `closeConfirmRef` / `pumpConfirm`).
 * A notification reports a state change the on-chain read lags behind, so the reads
 * are refetched immediately and then again on a backoff that starts at
 * {@link CONFIRM_FIRST_DELAY}, doubles each round, and caps at
 * {@link CONFIRM_MAX_INTERVAL} — until the chain reflects the change or the total
 * {@link CONFIRM_MAX_MS} budget passes. It covers both directions:
 *
 * - an **open** anchor (`SendQuoteTransaction` & friends), which the solver emits when
 *   it *broadcasts* the transaction: the single invalidation that frame triggers races
 *   the block and usually loses, and it is the last frame of an instant open, so
 *   without the chase the position stays invisible until something else refetches;
 * - a **close** fill, the rasa case where the quote lingers OPENED after
 *   `FillMarketOrderInstantClose` and the settle lags;
 * - a **cancel** request, where the confirming transaction is the solver's
 *   `acceptCancelRequest` and is never announced at all (see
 *   {@link CANCEL_CONFIRM_MAX_MS}).
 */
const CONFIRM_FIRST_DELAY = 500;
/** Ceiling for the doubling confirm-hold backoff interval (ms). */
const CONFIRM_MAX_INTERVAL = 60_000;
/** Total budget (ms) to chase a reported change before giving up (a stuck / failed action). */
const CONFIRM_MAX_MS = 120_000;
/**
 * Budget (ms) for the **cancel** confirm hold, longer than {@link CONFIRM_MAX_MS}
 * because a cancel can legitimately sit unanswered far longer than an open or a
 * close: `requestToCancelQuote` on a `LOCKED` quote only asks, and partyA cannot
 * force the issue until the market-agent force-cancel cooldown elapses (150 s on
 * Base at the time of writing, read from `coolDownsOfMA()[1]`). Giving up at two
 * minutes would go blind right as that window closes. The backoff is capped at
 * {@link CONFIRM_MAX_INTERVAL}, so a long wait costs about one read per minute, and
 * the hold releases itself the moment the chain drops the quote.
 */
const CANCEL_CONFIRM_MAX_MS = 600_000;

/**
 * Cap on the live-notification buffer fed back into the merge. Reconciliation is
 * idempotent over already-applied notifications, so only a recent window is kept
 * to bound memory and reprocessing.
 *
 * TODO: check this and packages/trading-react/src/quotes/use-managed-quotes.ts#L188-L206
 */
const NOTIFICATION_BUFFER_LIMIT = 100;

/** Stable empty array so the `accounts` memo doesn't churn while no VAs are retained. */
const NO_RETAINED_VAS: readonly Address[] = [];

/**
 * Invalidate the authoritative on-chain quote reads for one chain scope — the open
 * positions and the pending-quote ids, fanned out across every account. Scoped by
 * `configKey`, so another chain's cache is untouched; React Query dedups concurrent
 * refetches of the same query.
 */
function invalidateOnchainQuoteReads(client: QueryClient, scope: { configKey: string }): void {
  void client.invalidateQueries({ predicate: predicateMatch(getPartyAOpenPositionsQueryKey, scope) });
  void client.invalidateQueries({ predicate: predicateMatch(getPartyAPendingQuotesQueryKey, scope) });
}

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
 * feed is worth polling. Outside these stages there is no in-flight close (the
 * close has either not started or already landed on-chain, where the feed drops
 * it and the close-confirm hold takes over), so polling the feed is wasted.
 */
const CLOSE_INTENT_LIFECYCLES = new Set<QuoteLifecycle>([QuoteLifecycle.WRITE_ONCHAIN_CLOSE]);

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
  /**
   * Opt-in idle polling cadence (ms). **Default off** — with `live` notifications the
   * feature is events-first: it does not poll at idle, only (a) accelerates on-chain
   * reads briefly while a row awaits on-chain confirmation (the RPC-lag retry), and
   * (b) falls back to a baseline poll when the event channel is down. Set this to make
   * it poll on a fixed cadence regardless (e.g. a live-inspector panel).
   */
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
 * the same merge. With `live` notifications the feature is **events-first**: it does
 * not poll at idle, only accelerating the on-chain reads briefly while a row awaits
 * on-chain confirmation (`shouldAccelerateOnchainReads`, the RPC-lag retry), and
 * falling back to a baseline poll only when the event channel is down.
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
  const { partyA, chainId, pollingInterval, live = true, enabled = true } = parameters;
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
   * {@link shouldAccelerateOnchainReads} (and the feed-intent gates) the previous
   * tick's result, since the source queries set their `refetchInterval` before this
   * render's result exists. ("Active quotes only" dropped the grace window, and
   * `links` are recomputed fresh on each merge.)
   */
  const previousRef = useRef<ReconcileQuotesResult | undefined>(undefined);

  /**
   * Open-confirm hold: on-chain quoteId → deadline (ms). An open-anchor notification
   * (`onNotification`) records the quote here and kicks off `pumpConfirm`, which
   * refetches the on-chain reads on a doubling backoff until the read returns the
   * quote. The solver emits that frame when it *broadcasts* the transaction, so the
   * one invalidation it triggers races the block — and it is the **last** frame of an
   * instant open, so nothing else would ever re-read: with the event channel live
   * there is no idle poll, and the accelerated retry needs a `WRITE_ONCHAIN` row,
   * which only exists if a pre-chain row from the hedger feed was still there to
   * anchor. Entries are pruned once the polled struct lands or the
   * {@link CONFIRM_MAX_MS} budget passes.
   */
  const openConfirmRef = useRef<Map<string, number>>(new Map());
  /**
   * Close-confirm hold: on-chain quoteId → deadline (ms). A close notification
   * (`onNotification`) records the quote here and kicks off `pumpConfirm`, which
   * refetches the on-chain reads on a doubling backoff until the chain reflects the
   * close — the rasa case, where the quote lingers OPENED after
   * `FillMarketOrderInstantClose` and the stateless reconcile reverts the row to
   * `ONCHAIN`. Entries are pruned once the chain confirms the close (row dropped /
   * closed) or the {@link CONFIRM_MAX_MS} budget passes; when every map empties the
   * backoff stops.
   */
  const closeConfirmRef = useRef<Map<string, number>>(new Map());
  /**
   * Cancel-confirm hold: on-chain quoteId → deadline (ms). A cancel notification
   * (`onNotification`) records the quote here and kicks off `pumpConfirm`, which
   * refetches the on-chain reads on a doubling backoff until the chain settles the
   * cancel. Cancelling a `LOCKED` order takes two transactions and only the first is
   * announced: `requestToCancelQuote` moves the quote to `CANCEL_PENDING` and leaves
   * it in `partyAPendingQuotes`, then the solver's `acceptCancelRequest` sets
   * `CANCELED` and removes it — with **no** notification frame. A `CANCEL_PENDING`
   * row is lifecycle `ONCHAIN`, so it accelerates nothing either; without this chase
   * the cancelled order stays on screen indefinitely. Entries are pruned once the
   * chain drops the quote or the {@link CANCEL_CONFIRM_MAX_MS} budget passes.
   */
  const cancelConfirmRef = useRef<Map<string, number>>(new Map());
  /** Pending confirm-hold backoff timer (the next scheduled refetch), if any. */
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Current confirm-hold backoff interval (ms); doubles each round up to the cap. */
  const confirmDelayRef = useRef(CONFIRM_FIRST_DELAY);
  /** Latest `pumpConfirm`, called from the backoff timer (assigned below each render). */
  const pumpConfirmRef = useRef<() => void>(() => {});

  /**
   * (Re)start the confirm-hold backoff from its first delay — called whenever a
   * notification registers a new hold, so a fresh event always gets a prompt retry
   * even if a long-running chase had already backed off to the cap. Stable (refs
   * only), so it never re-creates `onNotification` and never resubscribes the socket.
   */
  const restartConfirmChase = useCallback(() => {
    confirmDelayRef.current = CONFIRM_FIRST_DELAY;
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = setTimeout(() => pumpConfirmRef.current(), CONFIRM_FIRST_DELAY);
  }, []);

  /**
   * Rows anchored on a prior tick (a notification set their `quoteId`) but not yet
   * returned by the on-chain read — the previous merge's `pendingAnchors`. Fed back
   * into {@link reconcileQuotes} so an anchored row keeps showing while the RPC
   * catches up, instead of vanishing once the hedger drops its pending open. Held in
   * a ref so it survives renders without triggering one; the source query that
   * dropped the row drives the recompute that reads it.
   */
  const retainedAnchorsRef = useRef<UnifiedQuote[]>([]);

  /**
   * Last tick's socket status, read one render behind (like `previousRef`) to decide
   * whether the live event channel is up. Updated right after `useNotifications` below.
   * When the channel is live the feature is events-first (no idle poll); when it is
   * down we fall back to polling so state still advances without notifications.
   */
  const socketStatusRef = useRef<SocketStatus>("closed");

  const optimisticEntries = useOptimisticQuotesStore((state) => state.entries);
  const clearSettled = useOptimisticQuotesStore((state) => state.clearSettled);

  /** Live event channel = subscribed (`live`) and the socket was `open` last render. */
  const eventChannelLive = live && socketStatusRef.current === "open";
  /** Consumer's opt-in idle cadence (off by default). */
  const idleInterval = pollingInterval && pollingInterval > 0 ? pollingInterval : false;

  /**
   * On-chain reads accelerate to {@link ACCELERATED_POLLING_INTERVAL} **only** while a
   * row awaits on-chain confirmation (`WRITE_ONCHAIN` / `WRITE_ONCHAIN_CLOSE` /
   * `CLOSING`) — the RPC-lag retry. (An anchor or a close the read has not caught up
   * with is chased separately by `pumpConfirm`'s backoff, which needs no row at all,
   * not by this steady interval.) Otherwise:
   * no idle poll when the event channel is live (events drive updates) unless the
   * consumer opted into `idleInterval`; a baseline fallback when the channel is down so
   * state still progresses. Read from the previous result because the queries set their
   * interval before this render's result exists (an on-chain poll / notification
   * re-render advances it a tick later).
   */
  const accelerateOnchain = previousRef.current ? shouldAccelerateOnchainReads(previousRef.current) : false;
  const onchainIdleInterval = eventChannelLive ? idleInterval : idleInterval || FALLBACK_POLLING_INTERVAL;
  const refetchInterval = active ? (accelerateOnchain ? ACCELERATED_POLLING_INTERVAL : onchainIdleInterval) : false;

  /**
   * Hedger feeds are event-driven while the channel is live: the open/close mutation
   * invalidates the matching feed once and the notifications advance the stage, so they
   * do not poll (unless the consumer opted into `idleInterval`). When the channel is
   * down they poll while the matching flow is in flight, to track it without
   * notifications. `hasOpenIntent` / `hasCloseIntent` come from the previous tick.
   */
  const previousQuotes = previousRef.current?.quotes;
  const hasOpenIntent = previousQuotes?.some((quote) => OPEN_INTENT_LIFECYCLES.has(quote.lifecycle)) ?? false;
  const hasCloseIntent = previousQuotes?.some((quote) => CLOSE_INTENT_LIFECYCLES.has(quote.lifecycle)) ?? false;
  const feedInterval = (hasIntent: boolean) =>
    !eventChannelLive && hasIntent ? ACCELERATED_POLLING_INTERVAL : idleInterval;
  const instantOpensInterval = active && wantInstantOpens ? feedInterval(hasOpenIntent) : false;
  const instantClosesInterval = active && wantInstantCloses ? feedInterval(hasCloseIntent) : false;

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
    onNotification: useCallback(
      (notification: Notification) => {
        setNotifications((prev) => [...prev, notification].slice(-NOTIFICATION_BUFFER_LIMIT));
        // Solver notification carries both `tempQuoteId` and the on-chain
        // `quoteId` on the frame that anchors a pre-chain quote. Link the two
        // in the TP/SL store so a record that was written under the temp id
        // (via `useSetQuoteTpSl` post-instant-open) is instantly reachable via
        // the on-chain id once the anchor lands — no re-fetch needed.
        const tempId = notification.tempQuoteId;
        const onchainStr = notification.quoteId;
        if (tempId && onchainStr && onchainStr !== `${tempId}`) {
          useTpSlStore.getState().link(BigInt(tempId), BigInt(onchainStr));
        }
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
        /**
         * The quote **anchored on-chain**: the solver reports this when it broadcasts
         * the transaction, so the read is typically still a block behind and the
         * debounced invalidation below lands on the pre-anchor state. Register the hold
         * and chase it (`pumpConfirm`) until the read returns the quote — this is the
         * last frame of an instant open, so without the chase a confirmed position can
         * stay out of the table indefinitely. Only for a `SUCCESS` frame carrying a real
         * on-chain id (still-off-chain frames repeat the negative temp id), so a
         * reverted anchor is not chased for the full budget.
         */
        if (
          notification.type === NotificationType.SUCCESS &&
          isOpenAnchorAction(notification.lastSeenAction) &&
          onchainStr &&
          onchainStr !== "0" &&
          onchainStr !== `${tempId}`
        ) {
          openConfirmRef.current.set(onchainStr, Date.now() + CONFIRM_MAX_MS);
          invalidateOnchainQuoteReads(queryClientRef.current, { configKey: configKeyRef.current });
          restartConfirmChase();
        }
        // Close *filled* (not merely requested): refetch the on-chain reads immediately,
        // then chase the settle on a doubling backoff (`pumpConfirm`) until the chain
        // drops the quote or the budget passes. Covers rasa, where the quote lingers OPENED
        // after `FillMarketOrderInstantClose` and the row would otherwise revert to ONCHAIN
        // and stop polling before the settle lands.
        if (isCloseFillAction(notification.lastSeenAction) && onchainStr && onchainStr !== "0") {
          closeConfirmRef.current.set(onchainStr, Date.now() + CONFIRM_MAX_MS);
          invalidateOnchainQuoteReads(queryClientRef.current, { configKey: configKeyRef.current });
          restartConfirmChase();
        }
        /**
         * A cancel was **requested**. The frame arrives around the time the request
         * transaction is broadcast, so the debounced invalidation below still reads
         * `LOCKED` or at best `CANCEL_PENDING` — and the transaction that actually ends
         * the order, the solver's `acceptCancelRequest`, is never announced. Register
         * the hold and chase the read until the chain drops the quote. Unlike the open
         * anchor this deliberately does **not** require `type === SUCCESS`: a failed
         * cancel frame still means the chain may have moved, and the hold costs one read
         * that releases itself immediately if nothing changed.
         */
        if (isCancelAction(notification.lastSeenAction) && onchainStr && onchainStr !== "0") {
          cancelConfirmRef.current.set(onchainStr, Date.now() + CANCEL_CONFIRM_MAX_MS);
          invalidateOnchainQuoteReads(queryClientRef.current, { configKey: configKeyRef.current });
          invalidateAccountBalances(queryClientRef.current, { configKey: configKeyRef.current });
          restartConfirmChase();
        }
        if (invalidateTimerRef.current) clearTimeout(invalidateTimerRef.current);
        invalidateTimerRef.current = setTimeout(() => {
          const client = queryClientRef.current;
          const scope = { configKey: configKeyRef.current };
          const { opens, closes } = pendingInvalidationRef.current;
          pendingInvalidationRef.current = { opens: false, closes: false };
          invalidateOnchainQuoteReads(client, scope);
          void client.invalidateQueries({ predicate: predicateMatch(getQuoteQueryKey, scope) });
          if (opens) void client.invalidateQueries({ predicate: predicateMatch(getInstantOpensQueryKey, scope) });
          if (closes) void client.invalidateQueries({ predicate: predicateMatch(getInstantClosesQueryKey, scope) });
        }, NOTIFICATION_INVALIDATE_DEBOUNCE);
      },
      [restartConfirmChase],
    ),
  });

  /** Mirror the live socket status into the ref the interval gating reads next render. */
  socketStatusRef.current = socketStatus;

  /**
   * One-shot re-sync when the notifications socket **reconnects**. The stream does not
   * replay messages missed while it was down, so on a re-`open` we invalidate the reads
   * once to catch up — this replaces a continuous fallback poll. The first connect is
   * skipped (the queries already fetched on mount).
   */
  const hasBeenOpenRef = useRef(false);
  useEffect(() => {
    if (!live || socketStatus !== "open") return;
    if (hasBeenOpenRef.current) {
      const client = queryClientRef.current;
      const scope = { configKey: configKeyRef.current };
      invalidateOnchainQuoteReads(client, scope);
      void client.invalidateQueries({ predicate: predicateMatch(getQuoteQueryKey, scope) });
      void client.invalidateQueries({ predicate: predicateMatch(getInstantOpensQueryKey, scope) });
      void client.invalidateQueries({ predicate: predicateMatch(getInstantClosesQueryKey, scope) });
    }
    hasBeenOpenRef.current = true;
  }, [socketStatus, live]);

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

  /**
   * One backoff round for every confirm hold. Prunes the entries the on-chain read has
   * caught up with — an anchored open the read now returns ({@link pruneOpenConfirmHold}),
   * a close the chain reflects ({@link pruneCloseConfirmHold}), or a cancel the chain
   * settled ({@link pruneCancelConfirmHold}), all against the latest reconcile — plus
   * any whose budget passed; if any map still holds something, refetches the on-chain
   * reads and reschedules itself with a doubled interval (capped). When they are all
   * empty it stops, so the chase self-terminates the moment the chain catches up. Reads
   * only refs, so it always sees the latest quotes / config; reassigned each render and
   * invoked through {@link pumpConfirmRef} from the timer.
   */
  pumpConfirmRef.current = () => {
    const quotes = previousRef.current?.quotes ?? [];
    const now = Date.now();
    const expiredOpens = pruneOpenConfirmHold(openConfirmRef.current, quotes, now);
    const expiredCloses = pruneCloseConfirmHold(closeConfirmRef.current, quotes, now);
    const expiredCancels = pruneCancelConfirmHold(cancelConfirmRef.current, quotes, now);
    if (process.env.NODE_ENV !== "production") {
      if (expiredOpens.length > 0) {
        console.debug("[useManagedQuotes] open-confirm hold expired without on-chain confirmation", expiredOpens);
      }
      if (expiredCloses.length > 0) {
        console.debug("[useManagedQuotes] close-confirm hold expired without on-chain confirmation", expiredCloses);
      }
      if (expiredCancels.length > 0) {
        console.debug("[useManagedQuotes] cancel-confirm hold expired without on-chain confirmation", expiredCancels);
      }
    }
    if (
      openConfirmRef.current.size === 0 &&
      closeConfirmRef.current.size === 0 &&
      cancelConfirmRef.current.size === 0
    ) {
      confirmTimerRef.current = undefined;
      return;
    }
    invalidateOnchainQuoteReads(queryClientRef.current, { configKey: configKeyRef.current });
    /**
     * A cancel still in flight also owes the account a refund: `acceptCancelRequest`
     * (and `forceCancelQuote`) return the open trading fee and release the reserved
     * margin. That transaction is not the consumer's own — no mutation `onSuccess`
     * covers it — and no frame announces it, so the balance reads only come back
     * with this chase. The open and close holds are not included: their balance
     * moves land in the consumer's own instant-layer mutation, which already
     * invalidates on success.
     */
    if (cancelConfirmRef.current.size > 0) {
      invalidateAccountBalances(queryClientRef.current, { configKey: configKeyRef.current });
    }
    confirmDelayRef.current = nextConfirmDelay(confirmDelayRef.current, CONFIRM_MAX_INTERVAL);
    confirmTimerRef.current = setTimeout(() => pumpConfirmRef.current(), confirmDelayRef.current);
  };

  /** Stop the confirm-hold backoff on unmount so a pending timer cannot fire after teardown. */
  useEffect(
    () => () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    },
    [],
  );

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
