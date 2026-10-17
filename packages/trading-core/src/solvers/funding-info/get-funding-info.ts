import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { Compute, ReadSolverParameter } from "../../shared/types/properties";
import { assertSolverKind } from "../assert-solver-kind";
import { getFundingInfo as requestFundingInfo } from "../types/generated/enigma-solver";
import { toMarketFundingInfo } from "./to-funding-info";
import type { MarketFundingInfo } from "./types";

/**
 * Parameters for {@link getFundingInfo}.
 * @example const parameters: GetFundingInfoParameters = { chainId: 42161, symbolIds: [117, 185] };
 */
export type GetFundingInfoParameters = Compute<
  ReadSolverParameter & {
    /** Restrict the result to these symbol IDs. Omit to fetch every market (the endpoint default). */
    symbolIds?: readonly number[];
  }
>;

/**
 * Funding observations keyed by stable symbol ID, with per-epoch fractional rates.
 * @example const rows: GetFundingInfoReturnType = await getFundingInfo(config, { symbolIds: [117] });
 */
export type GetFundingInfoReturnType = MarketFundingInfo[];

/**
 * Fetch per-market funding rates from the chain's solver `/funding-info`
 * endpoint. Returns the next-epoch long/short funding rate, next funding time,
 * and epoch length for every market (or only the requested `symbolIds`). The
 * solver base URL is resolved from `config` per call, so multiple chains never
 * clobber each other.
 *
 * Rates are surfaced as plain per-epoch decimal fractions exactly as the solver
 * reports them (multiply by `100` for a percentage); no scaling is applied.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain id and `symbolIds` filter.
 * @returns Normalized funding info, one {@link MarketFundingInfo} per market.
 * @throws {SymmApiError} when the API request fails.
 * @throws {SymmError} when the chain is unsupported.
 *
 * @example
 * ```ts
 * const funding = await getFundingInfo(config);
 * const btc = funding.find((f) => f.symbolId === 1);
 * console.log(btc?.nextFundingRateLong); // 0.0001 → 0.01%
 * ```
 */
export async function getFundingInfo(
  config: Config,
  parameters: GetFundingInfoParameters = {},
): Promise<GetFundingInfoReturnType> {
  const solver = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId });
  assertSolverKind(solver, "enigma", "getFundingInfo");
  return fetchFundingInfo(solver.url, parameters.symbolIds);
}

/**
 * Call the solver's `/funding-info` endpoint with a per-call base URL and
 * map the market-keyed response into the SDK's normalized array.
 *
 * @internal
 */
async function fetchFundingInfo(baseURL: string, symbolIds?: readonly number[]): Promise<MarketFundingInfo[]> {
  try {
    const response = await requestFundingInfo(symbolIds ? { symbol_ids: [...symbolIds] } : undefined, { baseURL });
    return Object.entries(response.data).flatMap(([key, raw]) => {
      const symbolId = Number(key);
      if (!Number.isSafeInteger(symbolId) || symbolId <= 0 || !raw || typeof raw !== "object") return [];
      return [toMarketFundingInfo(symbolId, raw)];
    });
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_FUNDING_INFO_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "FETCH_FUNDING_INFO_FAILED",
      `Failed to fetch funding info: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
