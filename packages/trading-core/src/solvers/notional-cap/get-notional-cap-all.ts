import { toFiniteNumber } from "@symmio/utils/number";
import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { Compute, ReadSolverParameter } from "../../shared/types/properties";
import { getNotionalCap } from "../types/generated/enigma-solver";
import { toMarketNotionalCap } from "./to-market-notional-cap";
import type { MarketNotionalCap } from "./types";

/**
 * Parameters for {@link getNotionalCapAll}.
 */
export type GetNotionalCapAllParameters = Compute<ReadSolverParameter>;

/** Return type of {@link getNotionalCapAll}: aggregate totals + per-symbol rows. */
export interface GetNotionalCapAllReturnType {
  /** Number of symbols the solver returned. */
  count: number;
  /** Σ `openInterest` across every market (dollars). */
  totalOpenInterest: number;
  /** Σ `used` across every market (dollars). */
  totalUsed: number;
  /** Per-symbol rows, decoded with the same mapper as {@link getNotionalCapBySymbolId}. */
  symbols: MarketNotionalCap[];
}

/**
 * Fetch every market's notional cap in one call (`/notional_cap`). Surfaces the
 * aggregate `totalOpenInterest` / `totalUsed` and the per-symbol rows decoded
 * via {@link toMarketNotionalCap} — the same mapper the single-symbol read uses.
 *
 * Dollar amounts are returned as plain `number` values exactly as the solver
 * reports them; no decimal scaling. HTTP / transport failures throw
 * {@link SymmApiError}.
 *
 * @example
 * ```ts
 * const all = await getNotionalCapAll(config, {});
 * console.log(all.totalOpenInterest, all.symbols.length);
 * ```
 */
export async function getNotionalCapAll(
  config: Config,
  parameters: GetNotionalCapAllParameters = {},
): Promise<GetNotionalCapAllReturnType> {
  const solver = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId });
  try {
    const response = await getNotionalCap(undefined, { baseURL: solver.url });
    const r = response.data as Record<string, unknown>;
    const rawSymbols = Array.isArray(r.symbols) ? (r.symbols as Parameters<typeof toMarketNotionalCap>[0][]) : [];
    return {
      count: toFiniteNumber(r.count as number | string | undefined),
      totalOpenInterest: toFiniteNumber(r.total_open_interest as number | string | undefined),
      totalUsed: toFiniteNumber(r.total_used as number | string | undefined),
      symbols: rawSymbols.map(toMarketNotionalCap),
    };
  } catch (err) {
    if (err instanceof SymmError) throw err;
    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_NOTIONAL_CAP_ALL_FAILED", baseURL: solver.url });
    }
    throw new SymmError(
      "api",
      "FETCH_NOTIONAL_CAP_ALL_FAILED",
      `Failed to fetch notional caps: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
