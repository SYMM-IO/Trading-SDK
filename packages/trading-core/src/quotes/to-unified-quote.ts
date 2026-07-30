import type { Address } from "viem";
import type { PendingInstantClose } from "../solvers/instant-close/get-instant-closes/to-pending-instant-close";
import type { PendingInstantOpen } from "../solvers/instant-open/get-instant-opens/types";
import { toWeiBigInt } from "../solvers/instant-open/shared/trade-math";
import { QuoteStatus, type LockedValues, type Quote } from "../symmio-contracts/symmio/types";
import { quoteOpenQuantity } from "./open-quantity";
import { QuoteLifecycle, type UnifiedQuote } from "./unified-quote";

/** All-zero locked values, used when an off-chain row has no per-leg margin yet. */
const EMPTY_LOCKED_VALUES: LockedValues = {
  cva: 0n,
  lf: 0n,
  partyAmm: 0n,
  partyBmm: 0n,
};

/**
 * Map an on-chain {@link QuoteStatus} to a {@link QuoteLifecycle}. Open and
 * pending statuses stay `ONCHAIN`; a pending close becomes `CLOSING`; a fully
 * closed/cancelled/expired quote becomes `CLOSED`.
 *
 * @param status - The on-chain quote status.
 * @returns The lifecycle stage to surface for an anchored row.
 */
export function lifecycleFromQuoteStatus(status: QuoteStatus): QuoteLifecycle {
  switch (status) {
    case QuoteStatus.CLOSE_PENDING:
    case QuoteStatus.CANCEL_CLOSE_PENDING:
      return QuoteLifecycle.CLOSING;
    case QuoteStatus.CLOSED:
    case QuoteStatus.CANCELED:
    case QuoteStatus.EXPIRED:
      return QuoteLifecycle.CLOSED;
    case QuoteStatus.LIQUIDATED:
      return QuoteLifecycle.FAILED;
    default:
      return QuoteLifecycle.ONCHAIN;
  }
}

/**
 * Build a {@link UnifiedQuote} from an on-chain {@link Quote}.
 *
 * The lifecycle is derived from the quote's {@link QuoteStatus} via
 * {@link lifecycleFromQuoteStatus}. Every amount is already 18-decimal wei on the
 * on-chain struct, so it carries through untouched.
 *
 * @param quote - The on-chain quote/position struct.
 * @returns The unified row, keyed `onchain:<id>`.
 *
 * @example
 * ```ts
 * const row = toUnifiedQuoteFromOnchain(quote);
 * ```
 */
export function toUnifiedQuoteFromOnchain(quote: Quote): UnifiedQuote {
  const lifecycle = lifecycleFromQuoteStatus(quote.quoteStatus);
  return {
    key: `onchain:${quote.id}`,
    origin: "onchain",
    lifecycle,
    quoteId: quote.id,
    partyA: quote.partyA,
    partyB: quote.partyB,
    symbolId: quote.symbolId,
    positionType: quote.positionType,
    orderType: quote.orderType,
    quoteStatus: quote.quoteStatus,
    requestedOpenPrice: quote.requestedOpenPrice,
    openedPrice: quote.openedPrice,
    initialOpenedPrice: quote.initialOpenedPrice,
    avgClosedPrice: quote.avgClosedPrice,
    requestedClosePrice: quote.requestedClosePrice,
    marketPrice: quote.marketPrice,
    quantity: quote.quantity,
    closedAmount: quote.closedAmount,
    openQuantity: quoteOpenQuantity({ quantity: quote.quantity, closedAmount: quote.closedAmount }),
    quantityToClose: quote.quantityToClose,
    lockedValues: quote.lockedValues,
    initialLockedValues: quote.initialLockedValues,
    maxFundingRate: quote.maxFundingRate,
    accumulatedPaidFunding: quote.accumulatedPaidFunding,
    lastFundingPaymentTimestamp: quote.lastFundingPaymentTimestamp,
    deadline: quote.deadline,
    tradingFee: quote.tradingFee,
    closeFee: quote.closeFee,
    affiliate: quote.affiliate,
    partyBsWhiteList: quote.partyBsWhiteList,
    parentId: quote.parentId,
    data: quote.data,
    createTimestamp: quote.createTimestamp,
    statusModifyTimestamp: quote.statusModifyTimestamp,
    raw: { onchain: quote },
  };
}

/**
 * Build an optimistic {@link UnifiedQuote} from a pending instant-open record.
 *
 * The hedger reports human-scaled decimal strings; this normalizes price,
 * quantity, and the locked legs to 18-decimal wei via {@link toWeiBigInt}. The
 * row is `OPTIMISTIC` (no fill, no on-chain id yet) and keyed `temp:<tempId>`.
 *
 * @param pending - A normalized pending instant-open record.
 * @returns The unified row.
 *
 * @example
 * ```ts
 * const row = toUnifiedQuoteFromInstantOpen(pending);
 * ```
 */
export function toUnifiedQuoteFromInstantOpen(pending: PendingInstantOpen): UnifiedQuote {
  const quantity = toWeiBigInt(pending.quantity);
  return {
    key: `temp:${pending.tempQuoteId}`,
    origin: "offchain",
    lifecycle: QuoteLifecycle.OPTIMISTIC,
    tempQuoteId: pending.tempQuoteId,
    partyA: pending.partyA,
    symbolId: BigInt(pending.marketId),
    positionType: pending.positionType,
    orderType: pending.orderType,
    requestedOpenPrice: toWeiBigInt(pending.requestedOpenPrice),
    quantity,
    openQuantity: quantity,
    lockedValues: {
      cva: toWeiBigInt(pending.cva),
      lf: toWeiBigInt(pending.lf),
      partyAmm: toWeiBigInt(pending.partyAmm),
      partyBmm: toWeiBigInt(pending.partyBmm),
    },
    raw: { instantOpen: pending },
  };
}

/**
 * Inputs identifying the position a pending instant-close targets. A close
 * record only carries the quote id and close amounts, so the market/side fields
 * come from the already-known on-chain row (or sensible zero defaults).
 */
export interface ToUnifiedQuoteFromInstantCloseContext {
  /** Sub-account (partyA) that owns the position being closed. */
  partyA: Address;
  /** Market identifier of the position being closed. */
  symbolId: UnifiedQuote["symbolId"];
  /** Side of the position being closed. */
  positionType: UnifiedQuote["positionType"];
  /** Order type of the position being closed. */
  orderType: UnifiedQuote["orderType"];
}

/**
 * Build a `CLOSING` {@link UnifiedQuote} from a pending instant-close record.
 *
 * A close record carries only the quote id and close amounts (already wei), so
 * market/side metadata is supplied via `context` (typically copied from the
 * matching on-chain row). Reconciliation overlays closes onto the existing
 * on-chain row directly; this helper is exposed for consumers that want to render
 * a standalone close-only row when the on-chain row is not available.
 *
 * @param pending - A normalized pending instant-close record.
 * @param context - Market/side metadata for the targeted position.
 * @returns The unified row, keyed `onchain:<quoteId>`.
 */
export function toUnifiedQuoteFromInstantClose(
  pending: PendingInstantClose,
  context: ToUnifiedQuoteFromInstantCloseContext,
): UnifiedQuote {
  return {
    key: `onchain:${pending.quoteId}`,
    origin: "onchain",
    lifecycle: QuoteLifecycle.CLOSING,
    quoteId: pending.quoteId,
    partyA: context.partyA,
    symbolId: context.symbolId,
    positionType: context.positionType,
    orderType: context.orderType,
    requestedOpenPrice: 0n,
    quantity: 0n,
    openQuantity: 0n,
    quantityToClose: pending.quantityToClose,
    lockedValues: EMPTY_LOCKED_VALUES,
    raw: { instantClose: pending },
  };
}
