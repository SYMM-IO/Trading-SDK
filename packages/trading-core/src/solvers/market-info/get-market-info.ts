import { isAxiosError } from "axios";
import type { SymmioResolvedSolver, SymmioSolverKind } from "../../core/chains/types";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { fetchEnigmaMarketInfo, fetchRasaMarketInfo } from "./adapters";
import type { MarketInfo, NormalizedMarketInfoByKind } from "./types";

/**
 * Parameters for {@link getMarketInfo}, generic over the solver kind `K`. A
 * **literal** `solverId` narrows the return to that solver's market-info type; a
 * variable or omitted `solverId` yields the {@link MarketInfo} union.
 */
export type GetMarketInfoParameters<K extends SymmioSolverKind = SymmioSolverKind> = Compute<
  ChainIdParameter & {
    /** Which solver kind to read. A literal narrows the return; omit for the chain's default. */
    solverId?: K;
  }
>;

/** Return type of {@link getMarketInfo}: the market-info type for kind `K` (the {@link MarketInfo} union when unspecified). */
export type GetMarketInfoReturnType<K extends SymmioSolverKind = SymmioSolverKind> = NormalizedMarketInfoByKind[K];

/**
 * Fetch per-market info from the chain's solver `/get_market_info` endpoint,
 * normalized to the {@link MarketInfo} union. The response diverges by solver
 * kind — **Enigma** returns per-market 24h volume + lifetime value plus aggregate
 * totals; **Rasa** returns per-market price / 24h change / volume / notional cap.
 * So **narrow on `kind`** before reading either side's rows.
 *
 * Pass a **literal** `solverId` to narrow the return to that solver's type; omit
 * it (default solver) to get the union.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain id and solver kind.
 * @returns Normalized market info for the resolved solver.
 * @throws {SymmApiError} when the API request fails.
 * @throws {SymmError} when the chain or solver is unsupported.
 *
 * @example
 * ```ts
 * const info = await getMarketInfo(config, {});
 * if (info.kind === "enigma") console.log(info.totalValue24h);
 * else console.log(info.markets[0]?.price); // Rasa
 * ```
 */
export async function getMarketInfo<K extends SymmioSolverKind = SymmioSolverKind>(
  config: Config,
  parameters: GetMarketInfoParameters<K> = {},
): Promise<GetMarketInfoReturnType<K>> {
  const solver = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId });
  try {
    const info = await fetchMarketInfoBySolverKind(solver);
    return info as GetMarketInfoReturnType<K>;
  } catch (err) {
    throw toMarketInfoError(err, solver.url);
  }
}

/**
 * Dispatch to the resolved solver's per-kind market-info adapter (each owns its
 * client call + normalization). Exhaustive over the solver kinds — a new kind
 * fails to compile at the `never` guard until its adapter is wired in.
 *
 * @internal
 */
async function fetchMarketInfoBySolverKind(solver: SymmioResolvedSolver): Promise<MarketInfo> {
  switch (solver.id) {
    case "enigma":
      return fetchEnigmaMarketInfo(solver.url);
    case "rasa":
      return fetchRasaMarketInfo(solver.url);
    default: {
      const unreachable: never = solver.id;
      throw new SymmError(
        "api",
        "UNSUPPORTED_BY_SOLVER",
        `Market info is not supported by solver kind "${unreachable}".`,
      );
    }
  }
}

/**
 * Map a fetch failure to a typed {@link SymmError}.
 *
 * @internal
 */
function toMarketInfoError(err: unknown, baseURL: string): SymmError {
  if (err instanceof SymmError) return err;
  if (isAxiosError(err)) {
    return SymmApiError.fromAxios(err, { code: "FETCH_MARKET_INFO_FAILED", baseURL });
  }
  return new SymmError(
    "api",
    "FETCH_MARKET_INFO_FAILED",
    `Failed to fetch market info: ${err instanceof Error ? err.message : String(err)}`,
    { cause: err instanceof Error ? err : undefined },
  );
}
