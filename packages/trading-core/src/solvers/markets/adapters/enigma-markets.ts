import { getContractSymbols, type ApiContractSymbol } from "../../types/generated/enigma-solver";
import type { EnigmaMarket } from "../types";

/**
 * An Enigma contract symbol with its identity fields present. Enigma marks every
 * field optional in its OpenAPI spec, so we narrow to the rows that carry a
 * usable identity (`symbol_id` / `name` / `symbol`) before mapping — a market
 * without identity cannot be traded or displayed.
 */
type IdentifiedEnigmaSymbol = ApiContractSymbol & {
  symbol_id: number;
  name: string;
  symbol: string;
};

/**
 * Type guard: does an Enigma contract symbol carry the identity fields the SDK
 * requires? Rows failing this are dropped by {@link toEnigmaMarkets}.
 */
function hasIdentity(symbol: ApiContractSymbol): symbol is IdentifiedEnigmaSymbol {
  return symbol.symbol_id !== undefined && symbol.name !== undefined && symbol.symbol !== undefined;
}

/**
 * Normalize raw Enigma `/contract-symbols` rows to {@link EnigmaMarket}. Rows
 * missing an identity field are skipped; every other Enigma-optional field is
 * filled with a neutral default so the normalized shape has no optional noise.
 */
export function toEnigmaMarkets(symbols: readonly ApiContractSymbol[]): EnigmaMarket[] {
  return symbols.filter(hasIdentity).map(toEnigmaMarket);
}

function toEnigmaMarket(symbol: IdentifiedEnigmaSymbol): EnigmaMarket {
  return {
    kind: "enigma",
    symbolId: symbol.symbol_id,
    name: symbol.name,
    symbol: symbol.symbol,
    asset: symbol.asset ?? "",
    isValid: symbol.is_valid ?? false,
    pricePrecision: symbol.price_precision ?? 0,
    quantityPrecision: symbol.quantity_precision ?? 0,
    maxLeverage: symbol.max_leverage != null ? Number(symbol.max_leverage) : 0,
    maxNotionalValue: symbol.max_notional_value ?? 0,
    rfqAllowed: symbol.rfq_allowed ?? false,
    tradingFee: symbol.trading_fee ?? "0",
    hedgerFeeOpen: symbol.hedger_fee_open ?? "0",
    hedgerFeeClose: symbol.hedger_fee_close ?? "0",
    maxFundingRate: symbol.max_funding_rate ?? "0",
    minNotionalValue: symbol.min_notional_value ?? "0",
    maxQuantity: symbol.max_quantity ?? "0",
    lotSize: symbol.lot_size ?? "0",
    minAcceptableQuoteValue: symbol.min_acceptable_quote_value ?? "0",
    minAcceptablePortionLf: symbol.min_acceptable_portion_lf ?? "0",
    side: symbol.side ?? "",
    state: symbol.state ?? 0,
    tokenAddress: symbol.token_address ?? "",
    fundingRateEpochDuration: symbol.funding_rate_epoch_duration ?? "0",
    fundingRateWindowTime: symbol.funding_rate_window_time ?? "0",
    minOpenSolverFeeCap: symbol.min_open_solver_fee_cap ?? "0",
    minCloseSolverFeeCap: symbol.min_close_solver_fee_cap ?? "0",
  };
}

/**
 * Fetch and normalize markets from an **Enigma**-kind solver. Owns Enigma's full
 * fetch story for `/contract-symbols`: the generated Enigma client call plus the
 * mapping to {@link EnigmaMarket}.
 *
 * @param baseURL - The solver's API base URL.
 * @internal
 */
export async function fetchEnigmaMarkets(baseURL: string): Promise<EnigmaMarket[]> {
  const response = await getContractSymbols({ baseURL });
  return toEnigmaMarkets(response.data.symbols ?? []);
}
