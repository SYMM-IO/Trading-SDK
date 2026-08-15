import {
  getPricesApiV1PriceGet,
  getSymbolPricesBatchApiV1PricesNamesGet,
  type PriceData,
} from "../enigma/types/generated/enigma-price-service";
import type { EnigmaMarkPriceTick } from "../types";

/**
 * Map one Enigma price record onto the normalized tick.
 *
 * **`name` comes from the response's record KEY, never from `value.name`.**
 * The existing `resolveMarkPrice` looks its result up by key, and `PriceData`
 * carries its own `name` field that can differ — `"::"`-suffixed lowcap names
 * are exactly where the two diverge. Mapping from `value.name` would silently
 * break every lowcap instant-open, so the key is authoritative here.
 *
 * `markPrice` arrives as a JSON number and is stringified without reformatting,
 * preserving the exact value the previous implementation produced.
 *
 * @internal
 */
export function toEnigmaMarkPriceTick(key: string, value: PriceData): EnigmaMarkPriceTick {
  return {
    provider: "enigma",
    name: key,
    markPrice: String(value.markPrice),
    ...(value.time !== undefined ? { time: value.time } : {}),
  };
}

/**
 * Map an Enigma `name → PriceData` response onto normalized ticks.
 *
 * @internal
 */
export function toEnigmaMarkPrices(record: Record<string, PriceData>): EnigmaMarkPriceTick[] {
  return Object.entries(record).map(([key, value]) => toEnigmaMarkPriceTick(key, value));
}

/**
 * Fetch and normalize Enigma mark prices — the provider's whole fetch story for
 * this endpoint.
 *
 * With `names`, hits the batch-by-names route with the identical wire call the
 * shipped `getEnigmaPriceServicePricesByNames` makes, so the Enigma path is
 * behaviourally unchanged. Without, reads every price the service serves.
 *
 * When `names` is supplied, each matched tick carries the caller's exact
 * spelling so `ticks.find(t => t.name === yourName)` always hits.
 *
 * Both routes the SDK needs here are marked `@deprecated` by the vendor, and
 * both are used deliberately: the non-deprecated `/api/v1/prices` is keyed by
 * token **address** and rejects a call without one (verified live: `422`
 * `addresses Field required`), so it cannot serve a name-based lookup at all.
 * Revisit only if Enigma ships a name-keyed replacement.
 *
 * @internal
 */
export async function fetchEnigmaMarkPrices(
  baseURL: string,
  names?: readonly string[],
): Promise<EnigmaMarkPriceTick[]> {
  if (!names) {
    const response = await getPricesApiV1PriceGet({ baseURL });
    // This route returns an array, not a keyed record — there is no key to be
    // authoritative, so `name` necessarily comes off each row.
    return response.data.map((value) => toEnigmaMarkPriceTick(value.name, value));
  }

  const requested = names.filter((name) => name.trim().length > 0);
  if (requested.length === 0) return [];

  const response = await getSymbolPricesBatchApiV1PricesNamesGet(requested.join(","), { baseURL });
  const record = response.data;

  const ticks: EnigmaMarkPriceTick[] = [];
  for (const name of requested) {
    const value = record[name];
    if (value) ticks.push(toEnigmaMarkPriceTick(name, value));
  }
  return ticks;
}
