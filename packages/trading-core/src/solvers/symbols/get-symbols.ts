import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { Compute, ReadSolverParameter } from "../../shared/types/properties";
import { assertSolverKind } from "../assert-solver-kind";
import { getSymbols as requestSymbols } from "../types/generated/enigma-solver";
import { toSolverSymbols } from "./to-solver-symbol";
import type { SolverSymbol, SymbolStateFilter, SymbolValidityFilter } from "./types";

/**
 * Parameters for {@link getSymbols}.
 */
export type GetSymbolsParameters = Compute<
  ReadSolverParameter & {
    /** Max rows to return (solver max 500, default 100). */
    limit?: number;
    /** Row offset for pagination (default 0). */
    offset?: number;
    /** Restrict to a single symbol by its numeric id. */
    symbolId?: number;
    /** Case-insensitive substring match on the symbol name. */
    search?: string;
    /** Exact-match filter on the base asset. */
    asset?: string;
    /** Exact-match filter on the collateral token address. */
    tokenAddress?: string;
    /** Validity filter; the solver defaults to `"true"` (valid symbols only). */
    isValid?: SymbolValidityFilter;
    /** Long-side trading-state filter. */
    stateLong?: SymbolStateFilter;
    /** Short-side trading-state filter. */
    stateShort?: SymbolStateFilter;
  }
>;

/** Return type of {@link getSymbols}: one entry per symbol. */
export type GetSymbolsReturnType = SolverSymbol[];

/**
 * Fetch the tradable symbol catalogue from the chain's solver `/symbols`
 * endpoint. Returns a normalized {@link SolverSymbol} per row — id, name,
 * precisions, leverage, fees, and per-side trading state — filtered and paged by
 * the given `parameters`. The solver base URL is resolved from `config` per call,
 * so multiple chains never clobber each other.
 *
 * `/symbols` is an **Enigma-only** endpoint; the action asserts the resolved
 * solver is an `enigma` solver and throws before hitting the wire otherwise.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain id, solver id, and `/symbols` filters.
 * @returns Normalized symbols, one {@link SolverSymbol} per row.
 * @throws {SymmApiError} when the API request fails.
 * @throws {SymmError} `UNSUPPORTED_BY_SOLVER` when the resolved solver is not an `enigma` solver, or when the chain is unsupported.
 *
 * @example
 * ```ts
 * const symbols = await getSymbols(config, { search: "BTC" });
 * const btc = symbols.find((s) => s.name === "BTCUSDT");
 * console.log(btc?.maxLeverage);
 * ```
 */
export async function getSymbols(config: Config, parameters: GetSymbolsParameters = {}): Promise<GetSymbolsReturnType> {
  const solver = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId });
  assertSolverKind(solver, "enigma", "getSymbols");
  return fetchSymbols(solver.url, parameters);
}

/**
 * Call the solver's `/symbols` endpoint with a per-call base URL, mapping the
 * SDK's camelCase filters onto the generated snake_case query params, and
 * normalize the response rows into the SDK's stable array.
 *
 * @internal
 */
async function fetchSymbols(baseURL: string, parameters: GetSymbolsParameters): Promise<SolverSymbol[]> {
  try {
    const response = await requestSymbols(
      {
        limit: parameters.limit,
        offset: parameters.offset,
        symbol_id: parameters.symbolId,
        search: parameters.search,
        asset: parameters.asset,
        token_address: parameters.tokenAddress,
        is_valid: parameters.isValid,
        state_long: parameters.stateLong,
        state_short: parameters.stateShort,
      },
      { baseURL },
    );
    return toSolverSymbols(response.data.symbols ?? []);
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_SYMBOLS_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "FETCH_SYMBOLS_FAILED",
      `Failed to fetch symbols: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
