import { WEI_DECIMALS } from "@/lib/format";
import type { UnifiedQuote } from "@symmio/trading-core";
import { formatTokenAmount } from "@symmio/utils";

/** Em-dash placeholder for a field a source has not populated. */
export const EMPTY = "—";

/** Shorten an address to `0x1234…abcd` for dense display; keep the full value in a `title`. */
export function truncateAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

/** Format an 18-decimal-wei amount with the given decimal precision. */
export function formatFixedPoint(raw: bigint, precision: number): string {
  return formatTokenAmount(raw, WEI_DECIMALS, { maxFractionDigits: precision });
}

/** Format an optional wei amount, falling back to {@link EMPTY} when absent. */
export function formatOptionalFixedPoint(raw: bigint | undefined, precision: number): string {
  return raw === undefined ? EMPTY : formatFixedPoint(raw, precision);
}

/**
 * The identifier a row answers to: the on-chain quote id once anchored, else the
 * hedger's temp id, else the reconciliation key.
 */
export function quoteIdLabel(quote: UnifiedQuote): string {
  if (quote.quoteId !== undefined) return `#${quote.quoteId.toString()}`;
  if (quote.tempQuoteId !== undefined) return `temp #${quote.tempQuoteId}`;
  return quote.key;
}

/** Sort key for an id column — on-chain ids above temp ids, both numerically ascending. */
export function quoteIdSort(quote: UnifiedQuote): number {
  if (quote.quoteId !== undefined) return Number(quote.quoteId);
  if (quote.tempQuoteId !== undefined) return Number(quote.tempQuoteId);
  return 0;
}

/** Best-known creation timestamp (seconds) for sorting and displaying a row's age. */
export function quoteCreatedSeconds(quote: UnifiedQuote): bigint | undefined {
  return quote.createTimestamp ?? quote.statusModifyTimestamp;
}

/**
 * A leverage figure as `12.48×`, or {@link EMPTY} when the locked-margin sum is
 * zero — no partyA collateral on record, which the SDK returns as `"0"`.
 */
export function formatLeverageLabel(raw: string): string {
  const leverage = Number(raw);
  if (!Number.isFinite(leverage) || leverage === 0) return EMPTY;
  return `${parseFloat(leverage.toFixed(2))}×`;
}

/**
 * Signed decimal string as a display figure with an explicit `+` on gains, e.g.
 * `+61.0800`. {@link EMPTY} when the value is zero or unparseable, so a row with
 * no price tick yet shows a dash rather than a confident `0`.
 */
export function formatSigned(value: string, precision = 4): string {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount === 0) return EMPTY;
  return `${amount > 0 ? "+" : ""}${amount.toFixed(precision)}`;
}

/** Tailwind text colour for a signed figure: mint for a gain, red for a loss, muted at zero. */
export function signedToneClassName(value: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount === 0) return "text-muted-foreground";
  return amount > 0 ? "text-positive" : "text-negative";
}
