import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { getGetFundingInfo } from "../types/generated/enigma-solver";
import { toMarketFundingInfo } from "./to-funding-info";
import type { MarketFundingInfo } from "./types";

/**
 * Parameters for {@link getFundingInfo}.
 */
export type GetFundingInfoParameters = Compute<
  ChainIdParameter & {
    /** Restrict the result to these market names. Omit to fetch every market (the endpoint default). */
    symbols?: readonly string[];
  }
>;

/** Return type of {@link getFundingInfo}: one entry per market. */
export type GetFundingInfoReturnType = MarketFundingInfo[];

/**
 * Fetch per-market funding rates from the chain's solver `/get_funding_info`
 * endpoint. Returns the next-epoch long/short funding rate, next funding time,
 * and epoch length for every market (or only the requested `symbols`). The
 * solver base URL is resolved from `config` per call, so multiple chains never
 * clobber each other.
 *
 * Rates are surfaced as plain per-epoch decimal fractions exactly as the solver
 * reports them (multiply by `100` for a percentage); no scaling is applied.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain id and `symbols` filter.
 * @returns Normalized funding info, one {@link MarketFundingInfo} per market.
 * @throws {SymmApiError} when the API request fails.
 * @throws {SymmError} when the chain is unsupported.
 *
 * @example
 * ```ts
 * const funding = await getFundingInfo(config);
 * const btc = funding.find((f) => f.symbol === "BTCUSDT");
 * console.log(btc?.nextFundingRateLong); // 0.0001 → 0.01%
 * ```
 */
export async function getFundingInfo(
  config: Config,
  parameters: GetFundingInfoParameters = {},
): Promise<GetFundingInfoReturnType> {
  const { solver } = config.getChainConfig(parameters.chainId);
  return fetchFundingInfo(solver.url, parameters.symbols);
}

/**
 * Call the solver's `/get_funding_info` endpoint with a per-call base URL and
 * map the market-keyed response into the SDK's normalized array.
 *
 * @internal
 */
async function fetchFundingInfo(baseURL: string, symbols?: readonly string[]): Promise<MarketFundingInfo[]> {
  try {
    const response = await getGetFundingInfo(symbols ? { symbols: [...symbols] } : undefined, { baseURL });
    return Object.entries(response.data).map(([symbol, raw]) => toMarketFundingInfo(symbol, raw));
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
