import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { Compute, ReadSolverParameter } from "../../shared/types/properties";
import { assertSolverKind } from "../assert-solver-kind";
import {
  getSymbolPriceRangePriceRangeSymbolGet,
  type SymbolPriceRangeInputSchema,
} from "../types/generated/rasa-solver";

/** Parameters for {@link getSolverPriceRange}. */
export type GetSolverPriceRangeParameters = Compute<
  ReadSolverParameter & {
    /** Market symbol name, e.g. `"BTCUSDT"` (the `name` field of a market). */
    symbol: string;
  }
>;

/** Return type of {@link getSolverPriceRange} — min/max acceptable prices as decimal strings. */
export type GetSolverPriceRangeReturnType = SymbolPriceRangeInputSchema;

/**
 * Fetch a symbol's acceptable price range from the Rasa-only
 * `/price-range/{symbol}` endpoint.
 *
 * @param config - The SDK config.
 * @param parameters - Symbol name plus optional chain/solver.
 * @returns `min_price` / `max_price` as decimal strings.
 * @throws {SymmError} `UNSUPPORTED_BY_SOLVER` when the resolved solver is not a `rasa` solver.
 * @throws {SymmApiError} when the API request fails.
 */
export async function getSolverPriceRange(
  config: Config,
  parameters: GetSolverPriceRangeParameters,
): Promise<GetSolverPriceRangeReturnType> {
  const solver = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId });
  assertSolverKind(solver, "rasa", "getSolverPriceRange");
  try {
    const response = await getSymbolPriceRangePriceRangeSymbolGet(parameters.symbol, { baseURL: solver.url });
    return response.data;
  } catch (err) {
    if (err instanceof SymmError) throw err;
    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_SOLVER_PRICE_RANGE_FAILED", baseURL: solver.url });
    }
    throw new SymmError(
      "api",
      "FETCH_SOLVER_PRICE_RANGE_FAILED",
      `Failed to fetch solver price range: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
