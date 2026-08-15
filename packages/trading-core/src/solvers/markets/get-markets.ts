import { isAxiosError } from "axios";
import type { SymmioResolvedSolver, SymmioSolverKind } from "../../core/chains/types";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { fetchEnigmaMarkets, fetchRasaMarkets } from "./adapters";
import type { Market, NormalizedMarketByKind } from "./types";

/**
 * Parameters for {@link getMarkets}, generic over the solver kind `K`.
 *
 * `solverId` is a {@link SymmioSolverKind} (`"enigma" | "rasa"`). Pass a
 * **literal** — `"rasa"` — and it binds `K`, narrowing the return to that
 * solver's market type. Pass a variable (or omit it) and `K` stays the full
 * kind union, so the return is the {@link Market} union and you narrow on `kind`.
 */
export type GetMarketsParameters<K extends SymmioSolverKind = SymmioSolverKind> = Compute<
  ChainIdParameter & {
    /**
     * Which solver kind to read. A literal narrows the return type; a variable
     * widens it to the {@link Market} union. Omit to use the chain's default.
     */
    solverId?: K;
  }
>;

/**
 * Return type of {@link getMarkets}: an array of the normalized market type for
 * kind `K`. With `K` unspecified this is the {@link Market} union.
 */
export type GetMarketsReturnType<K extends SymmioSolverKind = SymmioSolverKind> = NormalizedMarketByKind[K][];

/**
 * Fetch all tradable markets from the chain's solver `/contract-symbols`
 * endpoint, normalized to the SDK {@link Market} shape (camelCase fields,
 * `maxLeverage` as a number, no vendor optionality). The solver base URL and
 * kind are resolved from `config` per call, so multiple chains and solvers never
 * clobber each other.
 *
 * Pass a **literal** `solverId` to narrow the return to that solver's market
 * type; omit it (default solver) to get the {@link Market} union and narrow on
 * `kind` at the use site.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain id and solver kind.
 * @returns Normalized markets for the resolved solver.
 * @throws {SymmApiError} when the API request fails.
 * @throws {SymmError} when the chain or solver is unsupported.
 *
 * @example
 * ```ts
 * const rasa = await getMarkets(config, { solverId: "rasa" }); // RasaMarket[]
 * const any = await getMarkets(config, {}); // Market[] — narrow on `kind`
 * ```
 */
export async function getMarkets<K extends SymmioSolverKind = SymmioSolverKind>(
  config: Config,
  parameters: GetMarketsParameters<K> = {},
): Promise<GetMarketsReturnType<K>> {
  const solver = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId });
  try {
    const markets = await fetchMarketsBySolverKind(solver);
    return markets as GetMarketsReturnType<K>;
  } catch (err) {
    throw toMarketsError(err, solver.url);
  }
}

/**
 * Dispatch to the resolved solver's per-kind market adapter (each owns its
 * client call + normalization). The `switch` is exhaustive over the solver kinds
 * — a new kind fails to compile at the `never` guard until its adapter is wired
 * in here.
 *
 * @internal
 */
async function fetchMarketsBySolverKind(solver: SymmioResolvedSolver): Promise<Market[]> {
  switch (solver.id) {
    case "enigma":
      return fetchEnigmaMarkets(solver.url);
    case "rasa":
      return fetchRasaMarkets(solver.url);
    default: {
      const unreachable: never = solver.id;
      throw new SymmError("api", "UNSUPPORTED_BY_SOLVER", `Markets are not supported by solver kind "${unreachable}".`);
    }
  }
}

/**
 * Map a fetch failure to a typed {@link SymmError}, preserving an already-typed
 * error and decoding axios failures.
 *
 * @internal
 */
function toMarketsError(err: unknown, baseURL: string): SymmError {
  if (err instanceof SymmError) return err;
  if (isAxiosError(err)) {
    return SymmApiError.fromAxios(err, { code: "FETCH_MARKETS_FAILED", baseURL });
  }
  return new SymmError(
    "api",
    "FETCH_MARKETS_FAILED",
    `Failed to fetch markets: ${err instanceof Error ? err.message : String(err)}`,
    { cause: err instanceof Error ? err : undefined },
  );
}
