import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { getNotionalCapBySymbolId } from "./get-notional-cap-by-symbol-id";

/**
 * Parameters for {@link getOpenInterestBySymbolId}.
 */
export type GetOpenInterestBySymbolIdParameters = Compute<
  ChainIdParameter & {
    /** Solver market id (`symbol_id`). */
    symbolId: number;
  }
>;

/** Return type of {@link getOpenInterestBySymbolId}. */
export interface GetOpenInterestBySymbolIdReturnType {
  /** Solver market id. */
  symbolId: number;
  /** Market ticker. */
  symbol: string;
  /** Net open interest on the market (dollars). */
  openInterest: number;
  /**
   * Effective total cap for the market (dollars) — `availableToLong +
   * availableToShort + openInterest`. This is the value the UI shows as the
   * market's full capacity, rather than the raw `total_cap` the solver
   * publishes (which is often `0` for lowcaps).
   */
  totalCap: number;
  /** Solver-reported error string for this market, or `null` when none. */
  error: string | null;
}

/**
 * Read just the `openInterest` and effective `totalCap` for one market. Thin
 * selector over {@link getNotionalCapBySymbolId} so the React hook can use a
 * smaller return shape without re-hitting the solver.
 *
 * `totalCap` is derived as `availableToLong + availableToShort + openInterest`
 * — that's the figure the UI treats as the market's full capacity, since the
 * solver's raw `total_cap` field is often `0` for lowcap markets.
 *
 * Same error semantics as the full call: surfaces the solver `error` string on
 * the response and throws {@link SymmApiError} for HTTP failures.
 *
 * @example
 * ```ts
 * const { openInterest, totalCap } = await getOpenInterestBySymbolId(config, { symbolId: 132 });
 * ```
 */
export async function getOpenInterestBySymbolId(
  config: Config,
  parameters: GetOpenInterestBySymbolIdParameters,
): Promise<GetOpenInterestBySymbolIdReturnType> {
  const cap = await getNotionalCapBySymbolId(config, parameters);
  return {
    symbolId: cap.symbolId,
    symbol: cap.symbol,
    openInterest: cap.openInterest,
    totalCap: cap.availableToLong + cap.availableToShort + cap.openInterest,
    error: cap.error,
  };
}
