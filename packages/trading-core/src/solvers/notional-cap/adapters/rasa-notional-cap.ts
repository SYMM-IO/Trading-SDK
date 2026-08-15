import { toFiniteNumber } from "@symmio/utils/number";
import {
  getNotionalCapNotionalCapSymbolIdGet,
  type OpenInterestResponseSchema,
} from "../../types/generated/rasa-solver";
import type { RasaNotionalCap } from "../types";

/**
 * Map a raw Rasa `/notional_cap/{symbolId}` response to {@link RasaNotionalCap}.
 * Rasa returns only `total_cap` and `used` (as decimal strings) — there are no
 * per-side, open-interest, price, or balance fields to normalize.
 */
export function toRasaNotionalCap(raw: OpenInterestResponseSchema): RasaNotionalCap {
  return {
    kind: "rasa",
    totalCap: toFiniteNumber(raw.total_cap),
    used: toFiniteNumber(raw.used),
  };
}

/**
 * Fetch and normalize one market's notional cap from a **Rasa** solver — the
 * generated Rasa client call plus mapping to {@link RasaNotionalCap}.
 *
 * @internal
 */
export async function fetchRasaNotionalCap(baseURL: string, symbolId: number): Promise<RasaNotionalCap> {
  const response = await getNotionalCapNotionalCapSymbolIdGet(symbolId, { baseURL });
  return toRasaNotionalCap(response.data);
}
