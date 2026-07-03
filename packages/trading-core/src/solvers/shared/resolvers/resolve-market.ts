import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import { getMarkets } from "../../markets/get-markets";
import type { ResolvedMarket } from "./types";

/**
 * Parameters for {@link resolveMarket}.
 */
export interface ResolveMarketParameters {
  chainId?: number;
  marketId: number;
  marketName?: string;
  pricePrecision?: number;
  quantityPrecision?: number;
}

/**
 * Resolve market metadata (`name`, `pricePrecision`, `quantityPrecision`) for
 * `marketId`. Returns caller-supplied values when all three are pre-filled;
 * otherwise fetches `/contract-symbols` and extracts the matching record.
 *
 * Shared by the instant-open and instant-close wizards.
 *
 * @throws {SymmError} `RESOLVE_MARKET_NOT_FOUND` when no record matches.
 * @throws {SymmError} `RESOLVE_MARKET_METADATA_INCOMPLETE` when the solver
 *   record is missing required fields.
 */
export async function resolveMarket(config: Config, parameters: ResolveMarketParameters): Promise<ResolvedMarket> {
  const { marketName, pricePrecision, quantityPrecision } = parameters;
  if (marketName !== undefined && pricePrecision !== undefined && quantityPrecision !== undefined) {
    return { name: marketName, pricePrecision, quantityPrecision };
  }

  const markets = await getMarkets(config, { chainId: parameters.chainId });
  const match = markets.find((m) => m.symbol_id === parameters.marketId);
  if (!match) {
    throw new SymmError(
      "api",
      "RESOLVE_MARKET_NOT_FOUND",
      `Market id ${parameters.marketId} not returned by solver /contract-symbols.`,
    );
  }

  const name = marketName ?? match.name;
  const resolvedPricePrecision = pricePrecision ?? match.price_precision;
  const resolvedQuantityPrecision = quantityPrecision ?? match.quantity_precision;
  if (name === undefined || resolvedPricePrecision === undefined || resolvedQuantityPrecision === undefined) {
    throw new SymmError(
      "api",
      "RESOLVE_MARKET_METADATA_INCOMPLETE",
      `Solver returned incomplete metadata for market id ${parameters.marketId} (name/price_precision/quantity_precision missing).`,
    );
  }
  return { name, pricePrecision: resolvedPricePrecision, quantityPrecision: resolvedQuantityPrecision };
}
