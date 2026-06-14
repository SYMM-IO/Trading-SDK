import type { Hex } from "viem";

/**
 * Re-export the canonical trade-side enum so the instant-close slice has one
 * place to import it from. Numeric values match the on-chain enum:
 * `LONG = 0`, `SHORT = 1`.
 */
export { PositionType } from "../../../symmio-contracts/symmio/types";

/**
 * Re-export the canonical MARKET order-type constant from the open slice.
 * Single source of truth — both instant-open and instant-close encode the
 * same on-chain enum value.
 */
export { ORDER_TYPE_MARKET } from "../../instant-open/shared/types";

/**
 * Order-side trade values passed to `InstantCloseParameters`.
 *
 * All wei `bigint`s, final values. Caller (or the wizard) computes
 * `closePrice` from the mark price and slippage.
 */
export interface InstantCloseOrder {
  /** Quote id of the position being closed. */
  quoteId: bigint;
  /** Slippage-adjusted requested close price (wei, 1e18 fixed-point). */
  closePrice: bigint;
  /** Quantity to close (wei, 1e18 fixed-point). */
  quantityToClose: bigint;
}

/**
 * Market identification + precision metadata used by the close wizard.
 *
 * Only `id` is required. `name`, `pricePrecision`, and `quantityPrecision`
 * are pre-fetched overrides; when omitted, the wizard resolves them from the
 * solver `/contract-symbols` endpoint via `id`.
 */
export interface InstantCloseMarketData {
  /** Market `symbol_id` from solver markets. */
  id: number;
  /** Pre-fetched market name. */
  name?: string;
  /** Pre-fetched price precision. */
  pricePrecision?: number;
  /** Pre-fetched quantity precision. */
  quantityPrecision?: number;
}

/**
 * Wire-format response from the hedger's `/instant_trade/instant_close`
 * endpoint. The endpoint returns `void` on success (HTTP 2xx body is empty);
 * we surface a simple ack here.
 */
export interface InstantCloseReturnType {
  /** `true` when the hedger accepted the request. */
  success: boolean;
}

/**
 * Re-export the `Hex` type so callers don't need to import it from `viem` just
 * to construct a salt override.
 */
export type { Hex };
