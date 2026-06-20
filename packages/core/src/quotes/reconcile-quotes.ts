import type { Address } from "viem";
import type { PendingInstantClose } from "../solvers/instant-close/get-instant-closes/to-pending-instant-close";
import type { PendingInstantOpen } from "../solvers/instant-open/get-instant-opens/to-pending-instant-open";
import type { Quote } from "../symmio-contracts/symmio/types";
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
 * 1. On-chain positions + pending quotes become anchored rows.
 * 2. Pending instant-closes overlay the matching on-chain row as `CLOSING`.
 * 3. Pending instant-opens become `OPTIMISTIC` rows, **dropped** when an on-chain
 *    row already carries the same {@link fingerprintQuote} (the trade landed).
 * 4. Notifications are applied in order to link temp ↔ on-chain ids and advance
 *    lifecycles; `collapseByKey` then merges a rekeyed optimistic row into its
 *    on-chain twin, so the off-chain row drops once on-chain.
 * 5. Rows are sorted by `statusModifyTimestamp` descending (newest first).
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
      lifecycle: existing.lifecycle === QuoteLifecycle.CLOSED ? QuoteLifecycle.CLOSED : QuoteLifecycle.CLOSING,
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
  return { quotes: merged, links };
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
    closedPrice: primary.closedPrice ?? secondary.closedPrice,
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
