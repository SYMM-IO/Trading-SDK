import { toDecimal } from "@symmio/utils";
import { parseUnits } from "viem";
import { calculateClosePlatformFee } from "../../quotes/fees/calculate-close-platform-fee";
import { calculateOpenPlatformFee } from "../../quotes/fees/calculate-open-platform-fee";
import { calculateQuotePnl } from "../../quotes/upnl/calculate-quote-pnl";
import { PositionType } from "../../symmio-contracts/symmio/types";
import { toListingValue } from "../markets/to-listing-market";
import { getPoolBalanceBreakdown } from "./balance";
import type { PoolQuoteCalculationInput } from "./quotes";

const ONE = 10n ** 18n;

/** Balance amounts are raw 18-decimal integers; tokenPriceUsd is an unscaled USD price. */
export interface PoolWithdrawalPreviewInput {
  balance: Parameters<typeof getPoolBalanceBreakdown>[0];
  /** Integer percentage from 0 through 100. */
  percent: number;
  tokenPriceUsd?: number | null;
}

/** Size an LP withdrawal exactly. Returned LP, token, USDC and USD amounts all have 18 decimals. */
export function getPoolWithdrawalPreview({ balance, percent, tokenPriceUsd }: PoolWithdrawalPreviewInput) {
  if (!Number.isInteger(percent) || percent < 0 || percent > 100)
    throw new RangeError("Withdrawal percent must be an integer from 0 to 100");
  const { availableLpRaw, totalLpRaw } = getPoolBalanceBreakdown(balance);
  const lpAmount = (availableLpRaw * BigInt(percent)) / 100n;
  // Estimate the selected share before LP rounding, preserving the existing displayed percentage.
  const denominator = totalLpRaw > 0n ? totalLpRaw * 100n : 1n;
  const tokenAmount = ((balance?.userBalanceInTokens ?? 0n) * availableLpRaw * BigInt(percent)) / denominator;
  const usdcAmount = ((balance?.userBalanceInUsdc ?? 0n) * availableLpRaw * BigInt(percent)) / denominator;
  const price =
    tokenPriceUsd != null && Number.isFinite(tokenPriceUsd) ? parseUnits(toDecimal(tokenPriceUsd).toFixed(), 18) : 0n;
  return { lpAmount, tokenAmount, usdcAmount, valueUsd: usdcAmount + (tokenAmount * price) / ONE };
}

/** Minimum/price use plain USD; deposit balances and addedTokens use 18-decimal token amounts. */
export interface PoolDepositPreviewInput {
  minimumUsd?: number | null;
  tokenPriceUsd?: number | null;
  baselineTokens?: bigint | null;
  currentTokens?: bigint | null;
}

/** Estimate the minimum token deposit and observed increase. Missing price/baseline remains unavailable. */
export function getPoolDepositPreview({
  minimumUsd,
  tokenPriceUsd,
  baselineTokens,
  currentTokens,
}: PoolDepositPreviewInput) {
  const minimumTokens =
    minimumUsd != null &&
    Number.isFinite(minimumUsd) &&
    tokenPriceUsd != null &&
    Number.isFinite(tokenPriceUsd) &&
    tokenPriceUsd > 0
      ? minimumUsd / tokenPriceUsd
      : undefined;
  const addedTokens =
    baselineTokens == null || currentTokens == null
      ? undefined
      : currentTokens > baselineTokens
        ? currentTokens - baselineTokens
        : 0n;
  return { minimumTokens, addedTokens };
}

/** Normalize raw quote amounts once; empty/malformed fields contribute zero. */
function quoteAmount(value: PoolQuoteCalculationInput["quantity"]): bigint {
  return value == null ? 0n : (toListingValue(String(value)) ?? 0n);
}

/** Choose the first present quote field, retaining an explicitly supplied zero. */
function firstAmount(...values: PoolQuoteCalculationInput["quantity"][]): bigint {
  return quoteAmount(values.find((value) => value != null && value !== ""));
}

/** Pending quantity, selected requested/opened price and notional, all as 18-decimal integers. */
export function getPoolPendingQuoteMetrics(quote: PoolQuoteCalculationInput) {
  const quantity = quoteAmount(quote.quantity);
  const price = firstAmount(quote.requestedOpenPrice, quote.openedPrice);
  return { quantity, price, notional: (quantity * price) / ONE };
}

/** Immutable event snapshot plus the position's full opening quantity/fee basis. Monetary fields use 18 decimals. */
export interface PoolTradeHistoryCalculationInput extends PoolQuoteCalculationInput {
  averageClosedPrice?: PoolQuoteCalculationInput["quantity"];
  closedPrice?: PoolQuoteCalculationInput["quantity"];
  tradingFee?: PoolQuoteCalculationInput["quantity"];
  closeFee?: PoolQuoteCalculationInput["quantity"];
}

/** Event-specific history values, in 18-decimal token/price/collateral units. The opening fee uses the full position. */
export function getPoolTradeHistoryMetrics(quote: PoolTradeHistoryCalculationInput) {
  const quantity = firstAmount(quote.closedAmount, quote.quantity);
  const closePrice = firstAmount(quote.averageClosedPrice, quote.closedPrice);
  const openedPrice = quoteAmount(quote.openedPrice);
  const initialOpenedPrice = quoteAmount(quote.initialOpenedPrice);
  const platformFee =
    calculateOpenPlatformFee({
      quantity: quoteAmount(quote.quantity),
      openedPrice: initialOpenedPrice > 0n ? initialOpenedPrice : openedPrice,
      openFeeRate: quoteAmount(quote.tradingFee),
    }) + calculateClosePlatformFee({ quantity, closePrice, closeFeeRate: quoteAmount(quote.closeFee) });
  const { pnl } = calculateQuotePnl({
    positionType: String(quote.positionType) === "0" ? PositionType.LONG : PositionType.SHORT,
    closedAmount: quantity,
    closedPrice: closePrice,
    openedPrice,
    leverage: "1",
  });
  return {
    quantity,
    closePrice,
    tradeValue: (quantity * closePrice) / ONE,
    platformFee,
    realizedPnl: parseUnits(pnl, 18),
  };
}

/** Sum already-selected, ordered amounts without altering order or range. Units are preserved (normally 18 decimals). */
export function getPoolHistoryAmounts(amounts: readonly bigint[]): { total: bigint; cumulative: bigint[] } {
  let total = 0n;
  const cumulative = amounts.map((amount) => (total += amount));
  return { total, cumulative };
}
