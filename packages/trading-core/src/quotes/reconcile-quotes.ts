import type { Address } from "viem";
import type { PendingInstantClose } from "../solvers/instant-close/get-instant-closes/to-pending-instant-close";
import type { PendingInstantOpen } from "../solvers/instant-open/get-instant-opens/types";
import { QuoteStatus, type Quote } from "../symmio-contracts/symmio/types";
import type { Notification } from "../websocket/notifications/types";
import { applyNotificationToQuotes } from "./apply-notification";
import { fingerprintQuote } from "./fingerprint";
import { toUnifiedQuoteFromInstantOpen, toUnifiedQuoteFromOnchain } from "./to-unified-quote";
import { QuoteLifecycle, type UnifiedQuote } from "./unified-quote";

/**
 * Inputs to {@link reconcileQuotes}: one snapshot of every quote source. The
 * result is "active quotes only" — a quote appears in the output iff it is
 * present in at least one of these sources this tick.
 */
export interface ReconcileQuotesInput {
  /** Sub-account (partyA) the snapshot belongs to. */
  partyA: Address;
  /** On-chain open positions (`getPartyAOpenPositions`). */
  onchainPositions: readonly Quote[];
  /** On-chain pending quotes hydrated via `getQuote`. */
  onchainPendingQuotes: readonly Quote[];
  /** Pending instant-open records from the hedger. */
  instantOpens: readonly PendingInstantOpen[];
  /** Pending instant-close records from the hedger. */
  instantCloses: readonly PendingInstantClose[];
  /**
   * Map from a pending instant-open's `tempQuoteId` to the Virtual Account (VA)
   * address its position will land in (from `resolveQuoteAccounts`). When a temp
   * id is present here, the optimistic row is stamped with its eventual VA so the
   * UI can show the VA before the trade anchors on-chain.
   */
  instantOpenVaByTempId?: Record<number, Address>;
  /** Notifications to apply after the merge, in arrival order. */
  notifications?: readonly Notification[];
  /**
   * Rows that anchored on-chain on a prior tick (a notification set their
   * `quoteId`) but whose on-chain struct has not been read yet — the
   * `pendingAnchors` returned by the previous {@link reconcileQuotes} call. The
   * consumer feeds them back so an anchored row survives the gap between "the
   * hedger drops the pending open" and "the on-chain read returns the quote"
   * instead of vanishing for a tick. Each is dropped automatically once the
   * matching on-chain read arrives (its `key` is already populated with the real
   * struct, so the retained copy is ignored).
   */
  retainedAnchors?: readonly UnifiedQuote[];
  /**
   * On-chain quote ids (decimal strings) whose close is **in flight** — filled
   * off-chain but not yet reflected by the on-chain read. The close-side mirror
   * of {@link retainedAnchors}: the poll rebuilds a filled-but-unsettled close as
   * `ONCHAIN` (`OPENED`) every tick, and a replayed close notification cannot
   * restore the stage on a poll-confirmed row (apply-notification's `inClosingFlow`
   * guard), so a row still read `OPENED` whose id is here is held at
   * {@link QuoteLifecycle.WRITE_ONCHAIN_CLOSE}. The caller bounds the set with its
   * close-confirm hold, so it clears at `CLOSE_PENDING` / removal / budget.
   */
  closingQuoteIds?: readonly string[];
}

/** Output of {@link reconcileQuotes}: the merged rows plus the temp ↔ on-chain links. */
export interface ReconcileQuotesResult {
  /** Merged, de-duplicated, lifecycle-tagged rows, newest first. */
  quotes: UnifiedQuote[];
  /**
   * Map from `tempQuoteId` to the on-chain row `key` it resolved to, recorded
   * **only once the row has anchored on-chain** (`quoteId` present). A
   * still-optimistic temp id is absent until then, so consumers can use this to
   * clear an optimistic seed exactly when its on-chain twin exists.
   */
  links: Record<number, string>;
  /**
   * Rows currently in {@link QuoteLifecycle.WRITE_ONCHAIN} — anchored per a
   * notification but not yet returned by the on-chain read. The consumer retains
   * these and feeds them back as {@link ReconcileQuotesInput.retainedAnchors} on
   * the next tick so they do not flicker out while the RPC catches up.
   */
  pendingAnchors: UnifiedQuote[];
}

/**
 * Merge every quote source for a sub-account into one stable, de-duplicated,
 * lifecycle-tagged list — **active quotes only**: a quote appears iff it is in at
 * least one source this tick, so a quote that has left every source is simply
 * absent (no lingering "removed" rows). **Pure** and stateless: given the same
 * `input` it always returns the same result, reading no clock and no randomness.
 *
 * Pipeline:
 *
 * 1. On-chain positions + pending quotes become anchored rows; `retainedAnchors`
 *    re-seed any anchored-but-not-yet-read row so it does not flicker out.
 * 2. Pending instant-closes overlay the matching on-chain row — `CLOSING` once the
 *    on-chain status shows the close pending, else `WRITE_ONCHAIN_CLOSE`.
 * 3. Pending instant-opens become `OPTIMISTIC` rows, **dropped** when an on-chain
 *    row already carries the same {@link fingerprintQuote} (the trade landed).
 * 4. Notifications are applied in order to link temp ↔ on-chain ids and advance
 *    lifecycles (an anchored-but-unread row sits at `WRITE_ONCHAIN`); `collapseByKey`
 *    then merges a rekeyed optimistic row into its on-chain twin, so the off-chain
 *    row drops once on-chain.
 * 5. Rows are sorted by `statusModifyTimestamp` descending (newest first), and the
 *    `WRITE_ONCHAIN` rows are returned as `pendingAnchors` for the next tick.
 *
 * @param input - One snapshot of all sources.
 * @returns The merged rows plus the temp ↔ on-chain `links`.
 *
 * @example
 * ```ts
 * const { quotes } = reconcileQuotes({
 *   partyA,
 *   onchainPositions,
 *   onchainPendingQuotes,
 *   instantOpens,
 *   instantCloses,
 *   notifications,
 * });
 * ```
 */
export function reconcileQuotes(input: ReconcileQuotesInput): ReconcileQuotesResult {
  const byKey = new Map<string, UnifiedQuote>();

  for (const quote of input.onchainPositions) {
    const row = withVaAddress(toUnifiedQuoteFromOnchain(quote), input.partyA);
    byKey.set(row.key, row);
  }
  for (const quote of input.onchainPendingQuotes) {
    const row = withVaAddress(toUnifiedQuoteFromOnchain(quote), input.partyA);
    if (!byKey.has(row.key)) byKey.set(row.key, row);
  }
  /**
   * Re-seed rows that anchored on a prior tick but have no on-chain struct yet, so
   * they survive the hedger-drop → on-chain-read gap. Skipped the moment the real
   * on-chain read populates the same `key` (inserted above), so retention ends
   * itself once the RPC confirms.
   */
  for (const anchor of input.retainedAnchors ?? []) {
    if (!byKey.has(anchor.key)) byKey.set(anchor.key, anchor);
  }
  for (const close of input.instantCloses) {
    const key = `onchain:${close.quoteId}`;
    const existing = byKey.get(key);
    /**
     * An instant-close always references a quote that already exists on-chain, so
     * we only overlay the close onto its matching row. If the on-chain row has not
     * loaded yet we skip it rather than synthesize a placeholder with no market or
     * side; the overlay applies on the next tick once the position read catches up.
     */
    if (!existing) continue;
    byKey.set(key, {
      ...existing,
      lifecycle: overlayCloseLifecycle(existing),
      quantityToClose: close.quantityToClose,
      raw: { ...existing.raw, instantClose: close },
    });
  }

  const onchainFingerprints = new Set<string>();

  for (const row of byKey.values()) {
    if (row.origin === "onchain") onchainFingerprints.add(fingerprintQuote(row));
  }
  for (const open of input.instantOpens) {
    const row = toUnifiedQuoteFromInstantOpen(open);
    if (onchainFingerprints.has(fingerprintQuote(row))) continue;
    const vaAddress = input.instantOpenVaByTempId?.[open.tempQuoteId];
    if (vaAddress) row.vaAddress = vaAddress;
    if (!byKey.has(row.key)) byKey.set(row.key, row);
  }
  let merged = [...byKey.values()];
  for (const notification of input.notifications ?? []) {
    merged = applyNotificationToQuotes(merged, notification);
  }
  merged = collapseByKey(merged);
  /**
   * Close-side retention (mirror of `retainedAnchors`). A close that filled
   * off-chain sits at `WRITE_ONCHAIN_CLOSE`, but the poll keeps reading the quote
   * `OPENED` until the settle mines and rebuilds the row as `ONCHAIN` — and the
   * replayed close notification cannot restore the stage on that poll-confirmed
   * row (`applyNotificationToQuotes`' `inClosingFlow` guard). So a still-`OPENED`
   * row whose close the caller is chasing is held at `WRITE_ONCHAIN_CLOSE` until
   * the chain reflects the close (`CLOSE_PENDING` / removed) or the caller drops it.
   */
  if (input.closingQuoteIds?.length) {
    const closing = new Set(input.closingQuoteIds);
    merged = merged.map((row) =>
      row.quoteId !== undefined &&
      closing.has(`${row.quoteId}`) &&
      row.lifecycle === QuoteLifecycle.ONCHAIN &&
      row.quoteStatus === QuoteStatus.OPENED
        ? { ...row, lifecycle: QuoteLifecycle.WRITE_ONCHAIN_CLOSE }
        : row,
    );
  }
  // Drop terminal quotes: a `CLOSED` lifecycle only comes from an on-chain
  // terminal status (`CANCELED` / `CLOSED` / `EXPIRED`) — a done quote a lagging
  // read still lists (e.g. a just force-cancelled limit order). It is not active,
  // so it must not linger in the list. (Off-chain rows never reach `CLOSED`.)
  merged = merged.filter((row) => row.lifecycle !== QuoteLifecycle.CLOSED);
  merged.sort((a, b) => {
    const aTs = a.statusModifyTimestamp ?? 0n;
    const bTs = b.statusModifyTimestamp ?? 0n;
    if (aTs !== bTs) return aTs > bTs ? -1 : 1;
    const aId = stableSortKey(a);
    const bId = stableSortKey(b);
    if (aId !== bId) return aId > bId ? -1 : 1;
    return 0;
  });
  const links: Record<number, string> = {};
  for (const row of merged) {
    /**
     * Only record a temp ↔ on-chain link once the row has actually anchored
     * (`quoteId` set). A still-optimistic row carries only its own `temp:` key —
     * recording that as a "link" would let the consumer clear its optimistic seed
     * before the on-chain twin exists, dropping the row for a tick (the
     * appear→disappear→reappear flicker).
     */
    if (row.tempQuoteId !== undefined && row.quoteId !== undefined) links[row.tempQuoteId] = row.key;
  }
  const pendingAnchors = merged.filter((row) => row.lifecycle === QuoteLifecycle.WRITE_ONCHAIN);
  return { quotes: merged, links, pendingAnchors };
}

/**
 * Lifecycle for an on-chain row that a pending instant-close overlays. Keep a
 * terminal `CLOSED` as-is; keep the row's on-chain lifecycle (`ONCHAIN`) when the
 * on-chain status **already** reflects the close (`CLOSE_PENDING` /
 * `CANCEL_CLOSE_PENDING`) — the close landed, don't drag it backwards; otherwise
 * the read still shows the position open while the close is in-flight, so surface
 * {@link QuoteLifecycle.OPTIMISTIC_CLOSE} as the base close stage. Close
 * notifications (applied after this overlay) then advance it to
 * `CLOSE_PRICE_FILLED` → `WRITE_ONCHAIN_CLOSE`, and once the on-chain read reflects
 * the pending close it resolves to `ONCHAIN` (with `quoteStatus: CLOSE_PENDING`).
 */
function overlayCloseLifecycle(existing: UnifiedQuote): QuoteLifecycle {
  if (existing.lifecycle === QuoteLifecycle.CLOSED) return QuoteLifecycle.CLOSED;
  if (existing.quoteStatus === QuoteStatus.CLOSE_PENDING || existing.quoteStatus === QuoteStatus.CANCEL_CLOSE_PENDING) {
    return existing.lifecycle;
  }
  return QuoteLifecycle.OPTIMISTIC_CLOSE;
}

/**
 * Collapse rows that ended up sharing a `key` after a notification rekeyed an
 * optimistic row (`temp:<id>` → `onchain:<id>`) onto an on-chain twin the poll
 * already returned. Without this the same quote can appear twice — once from the
 * poll and once from the rekeyed optimistic row — yielding duplicate React keys.
 * The genuine on-chain row (the one carrying `raw.onchain`) wins; the optimistic
 * row's `tempQuoteId` / `raw.instantOpen` are grafted on so the temp ↔ on-chain
 * link survives and the optimistic entry can be cleared.
 */
function collapseByKey(rows: UnifiedQuote[]): UnifiedQuote[] {
  const byKey = new Map<string, UnifiedQuote>();
  for (const row of rows) {
    const existing = byKey.get(row.key);
    byKey.set(row.key, existing ? mergeDuplicateRows(existing, row) : row);
  }
  return [...byKey.values()];
}

/**
 * Merge two rows that resolved to the same `key`, preferring the one that carries
 * the polled on-chain struct and grafting the off-chain identifiers from the other.
 */
function mergeDuplicateRows(a: UnifiedQuote, b: UnifiedQuote): UnifiedQuote {
  const primary = a.raw.onchain ? a : b;
  const secondary = primary === a ? b : a;
  return {
    ...primary,
    tempQuoteId: primary.tempQuoteId ?? secondary.tempQuoteId,
    vaAddress: primary.vaAddress ?? secondary.vaAddress,
    openedPrice: primary.openedPrice ?? secondary.openedPrice,
    avgClosedPrice: primary.avgClosedPrice ?? secondary.avgClosedPrice,
    quantityToClose: primary.quantityToClose ?? secondary.quantityToClose,
    raw: { ...secondary.raw, ...primary.raw },
  };
}

/**
 * Stamp the row's Virtual Account on `vaAddress` when it was read from a VA — in
 * lowcap a VA-scoped position's `partyA` IS its VA, so when the row's `partyA`
 * differs from the sub-account being reconciled we surface it on the dedicated
 * `vaAddress` field for the consumer.
 */
function withVaAddress(row: UnifiedQuote, subAccount: Address): UnifiedQuote {
  if (row.partyA.toLowerCase() === subAccount.toLowerCase()) return row;
  return { ...row, vaAddress: row.partyA };
}

/**
 * Deterministic tiebreak key for rows that share a `statusModifyTimestamp`: the
 * on-chain quote id when anchored, else the (negative) temp id. Keeps the sort
 * order reproducible regardless of the unstable on-chain read order — the
 * contract stores positions with swap-and-pop, so the raw read order reshuffles
 * on every open/close.
 */
function stableSortKey(quote: UnifiedQuote): bigint {
  if (quote.quoteId !== undefined) return quote.quoteId;
  if (quote.tempQuoteId !== undefined) return BigInt(quote.tempQuoteId);
  return 0n;
}
