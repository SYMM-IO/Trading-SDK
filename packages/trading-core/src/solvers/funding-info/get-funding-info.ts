import { isAxiosError } from "axios";
import type { SymmioSolverKind } from "../../core/chains/types";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { fetchEnigmaFundingInfo } from "./adapters/enigma-funding-info";
import { fetchRasaFundingInfo } from "./adapters/rasa-funding-info";
import type { MarketFundingInfo, NormalizedFundingInfoByKind } from "./types";

/**
 * Parameters for {@link getFundingInfo}.
 * @example const parameters: GetFundingInfoParameters = { chainId: 42161, symbolIds: [117, 185] };
 */
export type GetFundingInfoParameters<K extends SymmioSolverKind = SymmioSolverKind> = Compute<
  ChainIdParameter & {
    /** Select a solver; a literal narrows the returned rows. */
    solverId?: K;
    /** Enigma only: restrict the result to these symbol IDs. Omit to fetch every market (the endpoint default). */
    symbolIds?: readonly number[];
    /** Rasa ticker filter. Only valid for a Rasa solver. */
    symbols?: readonly string[];
  }
>;

/**
 * Funding observations keyed by Enigma symbol ID or Rasa ticker, with per-epoch fractional rates.
 * @example const rows: GetFundingInfoReturnType = await getFundingInfo(config, { symbolIds: [117] });
 */
export type GetFundingInfoReturnType<K extends SymmioSolverKind = SymmioSolverKind> = NormalizedFundingInfoByKind[K][];

/**
 * Fetch per-market funding rates from Enigma `/funding-info` or Rasa `/get_funding_info`
 * endpoint. Returns the next-epoch long/short funding rate, next funding time,
 * and epoch length for every market (or only the requested Enigma `symbolIds` or Rasa `symbols`). The
 * solver base URL is resolved from `config` per call, so multiple chains never
 * clobber each other.
 *
 * Rates are surfaced as plain per-epoch decimal fractions exactly as the solver
 * reports them (multiply by `100` for a percentage); no scaling is applied.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain, solver and solver-specific filter.
 * @returns Normalized funding info, one {@link MarketFundingInfo} per market.
 * @throws {SymmApiError} when the API request fails.
 * @throws {SymmError} when the chain is unsupported or a filter targets the wrong solver (INVALID_FUNDING_FILTER).
 *
 * @example
 * ```ts
 * const funding = await getFundingInfo(config, { solverId: "enigma" });
 * const btc = funding.find((f) => f.symbolId === 1);
 * console.log(btc?.nextFundingRateLong); // 0.0001 → 0.01%
 * ```
 */
export async function getFundingInfo<K extends SymmioSolverKind = SymmioSolverKind>(
  config: Config,
  parameters: GetFundingInfoParameters<K> = {},
): Promise<GetFundingInfoReturnType<K>> {
  const solver = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId });
  try {
    let rows: MarketFundingInfo[];
    switch (solver.id) {
      case "enigma":
        if (parameters.symbols !== undefined)
          throw new SymmError(
            "validation",
            "INVALID_FUNDING_FILTER",
            "Enigma funding accepts symbolIds, not ticker symbols.",
          );
        rows = await fetchEnigmaFundingInfo(solver.url, parameters.symbolIds);
        break;
      case "rasa":
        if (parameters.symbolIds !== undefined)
          throw new SymmError(
            "validation",
            "INVALID_FUNDING_FILTER",
            "Rasa funding accepts ticker symbols, not symbolIds.",
          );
        rows = await fetchRasaFundingInfo(solver.url, parameters.symbols);
        break;
      default: {
        const unreachable: never = solver.id;
        throw new SymmError(
          "api",
          "UNSUPPORTED_BY_SOLVER",
          `Funding info is not supported by solver kind "${unreachable}".`,
        );
      }
    }
    return rows as GetFundingInfoReturnType<K>;
  } catch (err) {
    if (err instanceof SymmError) throw err;
    if (isAxiosError(err))
      throw SymmApiError.fromAxios(err, { code: "FETCH_FUNDING_INFO_FAILED", baseURL: solver.url });
    throw new SymmError(
      "api",
      "FETCH_FUNDING_INFO_FAILED",
      `Failed to fetch funding info: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
