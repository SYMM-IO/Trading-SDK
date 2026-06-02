import type { Config } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { getLowCapSolverAPI, type SymbolContractSymbol } from "../solver/enigma-solver";
import { MarketState, type Market } from "./types";

/**
 * Parameters for {@link getMarkets}.
 */
export type GetMarketsParameters = Compute<ChainIdParameter>;

/** Return type of {@link getMarkets}. */
export type GetMarketsReturnType = Market[];

/**
 * Fetch all tradable markets from the chain's solver `/contract-symbols`
 * endpoint. The solver base URL is resolved from `config` per call, so multiple
 * chains never clobber each other.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain id (defaults to the config's default chain).
 * @returns Normalized markets.
 * @throws {SymmError} when the chain is unsupported or the request fails.
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
 * Call the solver's `/contract-symbols` endpoint with a per-call base URL and
 * normalize the raw symbols into {@link Market}s.
 *
 * @internal
 */
async function fetchMarkets(baseURL: string): Promise<Market[]> {
  try {
    const response = await getLowCapSolverAPI().getContractSymbols({ baseURL });
    return response.symbols?.map(toMarket) ?? [];
  } catch (err) {
    if (err instanceof SymmError) throw err;
    throw new SymmError(`Failed to fetch markets from ${baseURL}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Transform a raw solver `SymbolContractSymbol` into the normalized
 * {@link Market} shape, filling defaults for missing fields.
 *
 * @internal
 */
function toMarket(raw: SymbolContractSymbol): Market {
  return {
    id: raw.symbol_id ?? 0,
    name: raw.name ?? "",
    symbol: raw.symbol ?? "",
    asset: raw.asset ?? "",
    state: raw.state ?? MarketState.FullyEnabled,
    pricePrecision: raw.price_precision ?? 0,
    quantityPrecision: raw.quantity_precision ?? 0,
    isValid: raw.is_valid ?? false,
    rfqAllowed: raw.rfq_allowed ?? false,
    tradingFee: Number(raw.trading_fee ?? 0),
    maxLeverage: Number(raw.max_leverage ?? 0),
    maxNotionalValue: raw.max_notional_value ?? 0,
    maxFundingRate: String(raw.max_funding_rate ?? "0"),
    minAcceptableQuoteValue: Number(raw.min_acceptable_quote_value ?? 0),
    minAcceptablePortionLF: Number(raw.min_acceptable_portion_lf ?? 0),
    hedgerFeeOpen: raw.hedger_fee_open ?? "0",
    hedgerFeeClose: raw.hedger_fee_close ?? "0",
    minNotionalValue: Number(raw.min_notional_value ?? 0),
    lotSize: raw.lot_size !== undefined ? Number(raw.lot_size) : undefined,
  };
}
