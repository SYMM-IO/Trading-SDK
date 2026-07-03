import type { TpSlConditionalOrderLeg, TpSlPriceType } from "../types";

/** `order_type` field — `1` = market. */
export const TPSL_LEG_ORDER_TYPE_MARKET = 1;

/**
 * Build one conditional-order leg (TP or SL). Mirrors vibe-ui's
 * `buildConditionalOrderLeg` exactly so the signed payload matches what the
 * handler expects.
 */
export function buildConditionalOrderLeg(parameters: {
  /** Quote quantity (decimal string). */
  quantity: string;
  /** Slippage-shifted "opened" price (decimal string, rounded to market precision). */
  price: string;
  /** Trigger price (decimal string, rounded to market precision). */
  conditionalPrice: string;
  priceType: TpSlPriceType;
  /** Defaults to `TPSL_LEG_ORDER_TYPE_MARKET`. */
  orderType?: number;
}): TpSlConditionalOrderLeg {
  return {
    quantity: parameters.quantity,
    price: parameters.price,
    orderType: parameters.orderType ?? TPSL_LEG_ORDER_TYPE_MARKET,
    conditionalPrice: parameters.conditionalPrice,
    conditionalPriceType: parameters.priceType === "lastPrice" ? "last_close" : "market",
  };
}
