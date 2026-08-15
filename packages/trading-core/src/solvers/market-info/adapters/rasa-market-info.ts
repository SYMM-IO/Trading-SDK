import { toFiniteNumber } from "@symmio/utils/number";
import {
  getMarketInfoGetMarketInfoGet,
  type GetMarketInfoGetMarketInfoGet200,
} from "../../types/generated/rasa-solver";
import type { RasaMarketInfo, RasaMarketInfoRow } from "../types";

/**
 * Map Rasa's `/get_market_info` map (`symbol → { price, price_change_percent,
 * trade_volume, notional_cap }`) into {@link RasaMarketInfo}, keying the symbol
 * out onto each row.
 */
export function toRasaMarketInfo(raw: GetMarketInfoGetMarketInfoGet200): RasaMarketInfo {
  const markets: RasaMarketInfoRow[] = Object.entries(raw).map(([symbol, value]) => ({
    symbol,
    price: toFiniteNumber(value.price),
    priceChangePercent: toFiniteNumber(value.price_change_percent),
    tradeVolume: toFiniteNumber(value.trade_volume),
    notionalCap: toFiniteNumber(value.notional_cap),
  }));
  return { kind: "rasa", markets };
}

/**
 * Fetch and normalize market info from a **Rasa** solver — the generated client
 * call plus mapping to {@link RasaMarketInfo}.
 *
 * @internal
 */
export async function fetchRasaMarketInfo(baseURL: string): Promise<RasaMarketInfo> {
  const response = await getMarketInfoGetMarketInfoGet({ baseURL });
  return toRasaMarketInfo(response.data);
}
