import { SymmError } from "../errors";
import { getLowCapSolverAPI, type SymbolContractSymbol } from "../solver/enigma-solver";
import { setSolverBaseUrl } from "../solver/axios-client";
import type { Market } from "./types";
import { MarketState } from "./types";

/**
 * Transform raw solver response to normalized Market shape.
 */
function transformContractSymbol(raw: SymbolContractSymbol): Market {
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
  setSolverBaseUrl(solverUrl);

  const api = getLowCapSolverAPI();

  try {
    const response = await api.getContractSymbols();

    if (!response.symbols || !Array.isArray(response.symbols)) {
      throw new SymmError(`Unexpected response shape from ${solverUrl}: missing symbols array`);
    }

    return response.symbols.map(transformContractSymbol);
  } catch (err) {
    if (err instanceof SymmError) throw err;
    throw new SymmError(`Failed to fetch markets from ${solverUrl}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
