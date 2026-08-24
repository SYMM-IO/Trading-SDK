import { toFiniteNumber } from "@symmio/utils/number";
import type { ApiSymbolResponse } from "../types/generated/enigma-solver";
import type { SolverSymbol } from "./types";

/**
 * An `ApiSymbolResponse` row with the identity fields present. Enigma marks
 * every field optional in its OpenAPI spec, so we narrow to rows carrying a
 * usable identity (`symbol_id` / `name` / `symbol`) before mapping — a row
 * without identity cannot be traded or displayed.
 */
type IdentifiedSymbol = ApiSymbolResponse & {
  symbol_id: number;
  name: string;
  symbol: string;
};

/**
 * Type guard: does a raw `/symbols` row carry the identity fields the SDK
 * requires? Rows failing this are dropped by {@link toSolverSymbols}.
 */
function hasIdentity(symbol: ApiSymbolResponse): symbol is IdentifiedSymbol {
  return symbol.symbol_id !== undefined && symbol.name !== undefined && symbol.symbol !== undefined;
}

/**
 * Normalize raw Enigma `/symbols` rows to {@link SolverSymbol}. Rows missing an
 * identity field are skipped; every other solver-optional field is filled with a
 * neutral default so the normalized shape has no optional noise.
 *
 * @param symbols - Raw `ApiSymbolResponse` rows from the solver.
 */
export function toSolverSymbols(symbols: readonly ApiSymbolResponse[]): SolverSymbol[] {
  return symbols.filter(hasIdentity).map(toSolverSymbol);
}

function toSolverSymbol(symbol: IdentifiedSymbol): SolverSymbol {
  return {
    symbolId: symbol.symbol_id,
    name: symbol.name,
    symbol: symbol.symbol,
    asset: symbol.asset ?? "",
    isValid: symbol.is_valid ?? false,
    pricePrecision: symbol.price_precision ?? 0,
    quantityPrecision: symbol.quantity_precision ?? 0,
    maxLeverage: toFiniteNumber(symbol.max_leverage),
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
    tokenAddress: symbol.token_address ?? "",
    fundingRateEpochDuration: symbol.funding_rate_epoch_duration ?? "0",
    fundingRateWindowTime: symbol.funding_rate_window_time ?? "0",
    stateLong: symbol.state_long ?? 0,
    stateShort: symbol.state_short ?? 0,
  };
}
