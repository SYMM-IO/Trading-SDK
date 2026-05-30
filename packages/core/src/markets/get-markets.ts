import { SymmError } from "../errors";
import type { ContractSymbol, ContractSymbolsResponse, Market } from "./types";
import { MarketState } from "./types";

/**
 * Transform raw solver response to normalized Market shape.
 */
function transformContractSymbol(raw: ContractSymbol): Market {
  return {
    id: raw.symbol_id,
    name: raw.name,
    symbol: raw.symbol,
    asset: raw.asset,
    state: raw.state ?? MarketState.FullyEnabled,
    pricePrecision: raw.price_precision,
    quantityPrecision: raw.quantity_precision,
    isValid: raw.is_valid,
    rfqAllowed: raw.rfq_allowed ?? false,
    tradingFee: raw.trading_fee,
    maxLeverage: raw.max_leverage,
    maxNotionalValue: raw.max_notional_value,
    maxFundingRate: String(raw.max_funding_rate),
    minAcceptableQuoteValue: raw.min_acceptable_quote_value,
    minAcceptablePortionLF: raw.min_acceptable_portion_lf,
    hedgerFeeOpen: raw.hedger_fee_open,
    hedgerFeeClose: raw.hedger_fee_close,
    minNotionalValue: Number(raw.min_notional_value),
    lotSize: raw.lot_size !== undefined ? Number(raw.lot_size) : undefined,
  };
}

/**
 * Fetch tradable markets from a solver's `/contract-symbols` endpoint.
 *
 * @param solverUrl - Base URL of the solver (e.g. "https://solver.example.com/api")
 * @returns Array of normalized Market objects
 * @throws {SymmError} on network or parsing errors
 *
 * @example
 * ```ts
 * const markets = await getMarkets("https://solver.enigma.bz/api");
 * console.log(markets[0].name); // "BTCUSDT"
 * ```
 */
export async function getMarkets(solverUrl: string): Promise<Market[]> {
  const endpoint = solverUrl.endsWith("/")
    ? `${solverUrl}contract-symbols`
    : `${solverUrl}/contract-symbols`;

  let response: Response;
  try {
    response = await fetch(endpoint);
  } catch (err) {
    throw new SymmError(`Failed to fetch markets from ${endpoint}: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!response.ok) {
    throw new SymmError(`Solver returned ${response.status} from ${endpoint}`);
  }

  let data: ContractSymbolsResponse;
  try {
    data = (await response.json()) as ContractSymbolsResponse;
  } catch {
    throw new SymmError(`Invalid JSON response from ${endpoint}`);
  }

  if (!Array.isArray(data.symbols)) {
    throw new SymmError(`Unexpected response shape from ${endpoint}: missing symbols array`);
  }

  return data.symbols.map(transformContractSymbol);
}
