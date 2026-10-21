/** Numeric protocol input; amounts use 18 decimals and timestamps use seconds. */
type PoolQuoteNumeric = string | number | bigint | null | undefined;
/** Minimal portable quote fields used by pool calculations. */
export interface PoolQuoteCalculationInput {
  quantity?: PoolQuoteNumeric;
  openedPrice?: PoolQuoteNumeric;
  closedAmount?: PoolQuoteNumeric;
  initialOpenedPrice?: PoolQuoteNumeric;
  requestedOpenPrice?: PoolQuoteNumeric;
  leverage?: PoolQuoteNumeric;
  initialCva?: PoolQuoteNumeric;
  initialPartyAmm?: PoolQuoteNumeric;
  initialLf?: PoolQuoteNumeric;
  positionType?: string | number | null;
  timestamp?: PoolQuoteNumeric;
  timestampSendQuote?: PoolQuoteNumeric;
  timestampOpenPosition?: PoolQuoteNumeric;
  partyA?: string | null;
}
function fromWei(value: PoolQuoteNumeric): number {
  if (value == null || value === "") return 0;
  const parsed = typeof value === "string" ? parseFloat(value) : Number(value);
  return Number.isNaN(parsed) ? 0 : parsed / 1e18;
}
/** Virtual account balances, in unscaled collateral units. */
export type PoolOpenQuoteVaBalance = {
  allocatedBalance: number;
  lockedCVA: number;
  lockedLF: number;
  pendingLockedCVA: number;
  pendingLockedLF: number;
};

/** Same-market quotes and collateral snapshot for liquidation estimates. */
export type PoolOpenQuoteLiquidationContext = {
  markPrice?: number;
  quotes?: readonly PoolQuoteCalculationInput[];
  vaBalances?: Readonly<Record<string, PoolOpenQuoteVaBalance>>;
};

function positiveWei(value: PoolQuoteNumeric): number | undefined {
  const parsed = fromWei(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function isLongQuote(q: PoolQuoteCalculationInput): boolean {
  return String(q.positionType) === "0";
}

function getRemainingRatio(q: PoolQuoteCalculationInput): number {
  const totalQuantity = fromWei(q.quantity);
  const remainingQuantity = getPoolOpenQuoteQuantity(q);
  if (!(totalQuantity > 0 && remainingQuantity > 0)) return 0;
  return Math.min(1, remainingQuantity / totalQuantity);
}

function getVaAddress(q: PoolQuoteCalculationInput): string | undefined {
  return q.partyA?.toLowerCase();
}

function getPoolOpenQuoteMargin(q: PoolQuoteCalculationInput): number {
  return fromWei(q.initialCva) + fromWei(q.initialPartyAmm) + fromWei(q.initialLf);
}

/** Derive an unformatted pool quote metric from raw 18-decimal amounts. */
export function getPoolOpenQuoteEntryPrice(q: PoolQuoteCalculationInput): number {
  return positiveWei(q.openedPrice) ?? positiveWei(q.initialOpenedPrice) ?? positiveWei(q.requestedOpenPrice) ?? 0;
}

/** Derive an unformatted pool quote metric from raw 18-decimal amounts. */
export function getPoolOpenQuoteQuantity(q: PoolQuoteCalculationInput): number {
  const quantity = fromWei(q.quantity);
  const closedAmount = fromWei(q.closedAmount);
  const remaining = quantity - closedAmount;
  return Number.isFinite(remaining) && remaining > 0 ? remaining : 0;
}

/** Derive an unformatted pool quote metric from raw 18-decimal amounts. */
export function getPoolOpenQuoteLeverage(q: PoolQuoteCalculationInput): number {
  const direct = fromWei(q.leverage);
  if (direct > 0) return direct;
  if (getPoolOpenQuoteMargin(q) <= 0) return 0;
  const initialMargin = getPoolOpenQuoteMargin(q);
  const initialLf = fromWei(q.initialLf);
  if (Number.isFinite(initialLf) && initialLf > 0) return Math.max(1, Math.round((100 * initialLf) / initialMargin));
  const quantity = fromWei(q.quantity);
  const openedPrice = fromWei(q.openedPrice);
  const requested = fromWei(q.requestedOpenPrice);
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(openedPrice) || openedPrice <= 0) return 1;
  const opened = (quantity * openedPrice) / initialMargin;
  const candidate = Number.isFinite(requested) && requested > 0 ? (quantity * requested) / initialMargin : null;
  const inferred =
    candidate != null && Math.abs(candidate - Math.round(candidate)) < Math.abs(opened - Math.round(opened))
      ? candidate
      : opened;
  return Math.max(1, Math.round(inferred));
}

/** Derive an unformatted pool quote metric from raw 18-decimal amounts. */
export function getPoolOpenQuoteOpenedAt(
  q: Pick<PoolQuoteCalculationInput, "timestamp" | "timestampSendQuote" | "timestampOpenPosition">,
): number {
  for (const value of [q.timestampOpenPosition, q.timestampSendQuote, q.timestamp]) {
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds > 0) return seconds;
  }
  return 0;
}

/** Derive an unformatted pool quote metric from raw 18-decimal amounts. */
export function getPoolOpenQuotePositionValue(q: PoolQuoteCalculationInput, markPrice?: number): number {
  const price = markPrice ?? getPoolOpenQuoteEntryPrice(q);
  return getPoolOpenQuoteQuantity(q) * price;
}

/** Derive an unformatted pool quote metric from raw 18-decimal amounts. */
export function getPoolOpenQuoteUpnl(q: PoolQuoteCalculationInput, markPrice?: number): number | undefined {
  if (markPrice == null || !Number.isFinite(markPrice)) return undefined;

  const entryPrice = getPoolOpenQuoteEntryPrice(q);
  const quantity = getPoolOpenQuoteQuantity(q);
  if (!(entryPrice > 0 && quantity > 0)) return undefined;

  const priceDelta = isLongQuote(q) ? markPrice - entryPrice : entryPrice - markPrice;
  return priceDelta * quantity;
}

/** Derive an unformatted pool quote metric from raw 18-decimal amounts. */
export function getPoolOpenQuoteRoePercent(
  q: PoolQuoteCalculationInput,
  markPrice?: number,
  leverage = getPoolOpenQuoteLeverage(q),
): number | undefined {
  if (markPrice == null || !Number.isFinite(markPrice)) return undefined;

  const entryPrice = getPoolOpenQuoteEntryPrice(q);
  if (!(entryPrice > 0 && leverage > 0)) return undefined;

  const priceDelta = isLongQuote(q) ? markPrice - entryPrice : entryPrice - markPrice;
  return (priceDelta / entryPrice) * 100;
}

/** Derive an unformatted pool quote metric from raw 18-decimal amounts. */
export function getPoolOpenQuoteLiquidationPrice(
  q: PoolQuoteCalculationInput,
  leverage = getPoolOpenQuoteLeverage(q),
  context: PoolOpenQuoteLiquidationContext = {},
): number | undefined {
  const markPrice = context.markPrice;
  const vaAddress = getVaAddress(q);
  const vaBalance = vaAddress ? context.vaBalances?.[vaAddress] : undefined;
  const vaQuotes = context.quotes ?? [q];

  if (vaAddress && vaBalance && markPrice != null && Number.isFinite(markPrice) && markPrice > 0) {
    let totalSize = 0;
    let totalPnl = 0;

    for (const quote of vaQuotes) {
      if (getVaAddress(quote) !== vaAddress) continue;

      const quantity = getPoolOpenQuoteQuantity(quote);
      const upnl = getPoolOpenQuoteUpnl(quote, markPrice);
      if (!(quantity > 0) || upnl == null) continue;

      totalSize += quantity;
      totalPnl += upnl;
    }

    if (totalSize > 0) {
      const marginToLiq =
        vaBalance.allocatedBalance -
        vaBalance.lockedCVA -
        vaBalance.lockedLF -
        vaBalance.pendingLockedCVA -
        vaBalance.pendingLockedLF +
        totalPnl;
      const liquidationPrice = isLongQuote(q)
        ? markPrice - marginToLiq / totalSize
        : markPrice + marginToLiq / totalSize;
      return Number.isFinite(liquidationPrice) ? Math.max(0, liquidationPrice) : undefined;
    }
  }

  const entryPrice = getPoolOpenQuoteEntryPrice(q);
  const quantity = getPoolOpenQuoteQuantity(q);
  const partyAMargin = fromWei(q.initialPartyAmm) * getRemainingRatio(q);

  if (entryPrice > 0 && quantity > 0 && partyAMargin > 0) {
    const liquidationPrice = isLongQuote(q)
      ? entryPrice - partyAMargin / quantity
      : entryPrice + partyAMargin / quantity;
    return Number.isFinite(liquidationPrice) ? Math.max(0, liquidationPrice) : undefined;
  }

  if (!(entryPrice > 0 && leverage > 0)) return undefined;

  return isLongQuote(q) ? entryPrice * (1 - 1 / leverage) : entryPrice * (1 + 1 / leverage);
}
