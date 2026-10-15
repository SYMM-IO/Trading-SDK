import type { TokenPrice } from "../types";
import type { SymbolPriceResponse } from "../types/generated/listing-backend";

/**
 * Map the raw `/v2/market/token-price` response into the SDK's
 * {@link TokenPrice}.
 *
 * The wire shape is a single `price` float (USD per token); it is carried
 * through unchanged.
 *
 * @param raw - The endpoint's `/v2/market/token-price` response body.
 * @returns The normalized token price estimate.
 */
export function toTokenPrice(raw: SymbolPriceResponse): TokenPrice {
  return {
    price: raw.price,
  };
}
