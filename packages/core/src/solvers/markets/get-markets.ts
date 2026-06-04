import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { getContractSymbols, type SymbolContractSymbol } from "../types/generated/enigma-solver";

/**
 * Parameters for {@link getMarkets}.
 */
export type GetMarketsParameters = Compute<ChainIdParameter>;

/** Return type of {@link getMarkets}. */
export type GetMarketsReturnType = SymbolContractSymbol[];

/**
 * Fetch all tradable markets from the chain's solver `/contract-symbols`
 * endpoint. The solver base URL is resolved from `config` per call, so multiple
 * chains never clobber each other.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain id (defaults to the config's default chain).
 * @returns Raw contract symbols from solver.
 * @throws {SymmApiError} when the API request fails.
 * @throws {SymmError} when the chain is unsupported.
 *
 * @example
 * ```ts
 * const markets = await getMarkets(config, {});
 * console.log(markets[0]?.name); // "BTCUSDT"
 * ```
 */
export async function getMarkets(config: Config, parameters: GetMarketsParameters = {}): Promise<GetMarketsReturnType> {
  const { solver } = config.getChainConfig(parameters.chainId);
  return fetchMarkets(solver.url);
}

/**
 * Call the solver's `/contract-symbols` endpoint with a per-call base URL.
 *
 * @internal
 */
async function fetchMarkets(baseURL: string): Promise<SymbolContractSymbol[]> {
  try {
    const response = await getContractSymbols({ baseURL });
    return response.data.symbols ?? [];
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw new SymmApiError({
        code: "FETCH_MARKETS_FAILED",
        message: err.message,
        status: err.response?.status ?? 0,
        statusText: err.response?.statusText ?? "Unknown",
        responseData: err.response?.data,
        url: err.config?.url ? `${baseURL}${err.config.url}` : baseURL,
        method: err.config?.method?.toUpperCase() ?? "GET",
        cause: err,
      });
    }

    throw new SymmError(
      "api",
      "FETCH_MARKETS_FAILED",
      `Failed to fetch markets: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
