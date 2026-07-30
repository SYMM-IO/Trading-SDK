import { getContractSymbolsContractSymbolsGet, type SymbolsContract } from "../../types/generated/rasa-solver";
import type { RasaMarket } from "../types";

/**
 * Normalize raw Rasa `/contract-symbols` rows to {@link RasaMarket}. Rasa marks
 * every field required, so this is a direct rename (with `maxLeverage` already a
 * number); no defaults or row skipping needed.
 */
export function toRasaMarkets(symbols: readonly SymbolsContract[]): RasaMarket[] {
  return symbols.map(toRasaMarket);
}

function toRasaMarket(symbol: SymbolsContract): RasaMarket {
  return {
    kind: "rasa",
    symbolId: symbol.symbol_id,
    name: symbol.name,
    symbol: symbol.symbol,
    asset: symbol.asset,
    isValid: symbol.is_valid,
    pricePrecision: symbol.price_precision,
    quantityPrecision: symbol.quantity_precision,
    maxLeverage: symbol.max_leverage,
    maxNotionalValue: symbol.max_notional_value,
    rfqAllowed: symbol.rfq_allowed,
    tradingFee: symbol.trading_fee,
    hedgerFeeOpen: symbol.hedger_fee_open,
    hedgerFeeClose: symbol.hedger_fee_close,
    maxFundingRate: symbol.max_funding_rate,
    minNotionalValue: symbol.min_notional_value,
    maxQuantity: symbol.max_quantity,
    lotSize: symbol.lot_size,
    minAcceptableQuoteValue: symbol.min_acceptable_quote_value,
    minAcceptablePortionLf: symbol.min_acceptable_portion_lf,
  };
}

/**
 * Fetch and normalize markets from a **Rasa**-kind solver. Owns Rasa's full
 * fetch story for `/contract-symbols`: the generated Rasa client call plus the
 * mapping to {@link RasaMarket}.
 *
 * @param baseURL - The solver's API base URL.
 * @internal
 */
export async function fetchRasaMarkets(baseURL: string): Promise<RasaMarket[]> {
  const response = await getContractSymbolsContractSymbolsGet({ baseURL });
  return toRasaMarkets(response.data.symbols);
}
