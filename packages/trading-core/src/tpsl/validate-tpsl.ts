import { toDecimal } from "@symmio/utils/decimal";
import { PositionType } from "../symmio-contracts/symmio/types";
import type { TpSlConfig, TpSlValidation } from "./types";

/**
 * Inputs to {@link validateTpSl}. `openPrice` is the price the conditional
 * order's distance is measured against — the quote's open price for a closed
 * position, or the live mark price when validating against an open position
 * (set `isOpenPosition: true` so error text reads accordingly).
 */
export interface ValidateTpSlInputs {
  /** TP trigger price (decimal string). Omit when only setting an SL. */
  takeProfitPrice?: string;
  /** SL trigger price (decimal string). Omit when only setting a TP. */
  stopLossPrice?: string;
  /** Reference price for distance/spread rules (decimal string). */
  openPrice: string;
  positionType: PositionType;
  /** Market price precision — only used to render the "should be above/below X" hint. */
  pricePrecision: number;
  /** Live handler `/configs/` data. */
  config: TpSlConfig;
  /** When `true`, error text says "current price" instead of "open price". */
  isOpenPosition?: boolean;
}

/**
 * Validate a candidate TP/SL pair against the handler's published rules.
 * Mirrors vibe-ui's `validateTpSlValues`:
 *
 * 1. Sign rule (TP above/below open per side; SL the opposite).
 * 2. `minPriceDistancePercent` — |target − open| / open × 100 must clear the floor.
 * 3. `minProfitStopLossSpreadPercent` — when both sides set, the absolute spread
 *    as a percent of open must clear the floor.
 *
 * Returns `{ ok: true }` when every supplied side passes. Otherwise carries
 * per-side error strings so the UI can render them inline. The SDK does NOT
 * throw — the caller decides whether to surface, block, or proceed.
 */
export function validateTpSl(inputs: ValidateTpSlInputs): TpSlValidation {
  const { takeProfitPrice, stopLossPrice, openPrice, positionType, pricePrecision, config, isOpenPosition } = inputs;
  let tpError: string | undefined;
  let slError: string | undefined;

  const isShort = positionType === PositionType.SHORT;
  const open = toDecimal(openPrice);
  const sideLabel = isOpenPosition ? "current price" : "open price";

  if (takeProfitPrice && takeProfitPrice.length > 0) {
    const tp = toDecimal(takeProfitPrice);
    if (tp.lt(0)) {
      tpError = "Price must be greater than 0";
    } else if (isShort && tp.gt(open)) {
      tpError = `Price must be below ${sideLabel}`;
    } else if (!isShort && tp.lt(open)) {
      tpError = `Price must be above ${sideLabel}`;
    } else {
      const min = minPriceDistance(takeProfitPrice, openPrice, config, isShort);
      if (min.error) {
        tpError = isShort
          ? `Take Profit price should be below ${min.validPrice.toFixed(pricePrecision)}`
          : `Take Profit price should be above ${min.validPrice.toFixed(pricePrecision)}`;
      }
    }
  }

  if (stopLossPrice && stopLossPrice.length > 0) {
    const sl = toDecimal(stopLossPrice);
    if (sl.lt(0)) {
      slError = "Price must be greater than 0";
    } else if (isShort && sl.lt(open)) {
      slError = `Price must be above ${sideLabel}`;
    } else if (!isShort && sl.gt(open)) {
      slError = `Price must be below ${sideLabel}`;
    } else {
      const min = minPriceDistance(stopLossPrice, openPrice, config, !isShort);
      if (min.error) {
        slError = isShort
          ? `Stop Loss price should be above ${min.validPrice.toFixed(pricePrecision)}`
          : `Stop Loss price should be below ${min.validPrice.toFixed(pricePrecision)}`;
      }
    }
  }

  if (takeProfitPrice && stopLossPrice && !tpError && !slError) {
    const tp = toDecimal(takeProfitPrice);
    const sl = toDecimal(stopLossPrice);
    const spreadPercent = tp.minus(sl).abs().div(open).times(100).toNumber();
    if (spreadPercent < config.minProfitStopLossSpreadPercent) {
      tpError = "Take Profit and Stop Loss prices should be further apart";
      slError = "Take Profit and Stop Loss prices should be further apart";
    }
  }

  if (tpError || slError) return { ok: false, tpError, slError };
  return { ok: true };
}

/** `|target − open| / open × 100` vs `config.minPriceDistancePercent`. */
function minPriceDistance(
  targetPrice: string,
  openPrice: string,
  config: TpSlConfig,
  negative: boolean,
): { error: boolean; validPrice: ReturnType<typeof toDecimal> } {
  const target = toDecimal(targetPrice);
  const open = toDecimal(openPrice);
  const distancePercent = target.minus(open).div(open).times(100).abs().toNumber();
  if (distancePercent < config.minPriceDistancePercent) {
    const validPrice = negative
      ? open.minus(open.times(config.minPriceDistancePercent / 100))
      : open.plus(open.times(config.minPriceDistancePercent / 100));
    return { error: true, validPrice };
  }
  return { error: false, validPrice: target };
}
