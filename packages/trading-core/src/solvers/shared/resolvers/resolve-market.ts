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
 * otherwise fetches `/contract-symbols` and extracts the matching record. The
 * normalized {@link Market} shape guarantees these fields, so only "not found"
 * can fail here.
 *
 * Shared by the instant-open and instant-close wizards.
 *
 * @throws {SymmError} `RESOLVE_MARKET_NOT_FOUND` when no record matches.
 */
export async function resolveMarket(config: Config, parameters: ResolveMarketParameters): Promise<ResolvedMarket> {
  const { marketName, pricePrecision, quantityPrecision } = parameters;
  if (marketName !== undefined && pricePrecision !== undefined && quantityPrecision !== undefined) {
    return { name: marketName, pricePrecision, quantityPrecision };
  }

  const markets = await getMarkets(config, { chainId: parameters.chainId });
  const match = markets.find((m) => m.symbolId === parameters.marketId);
  if (!match) {
    throw new SymmError(
      "api",
      "RESOLVE_MARKET_NOT_FOUND",
      `Market id ${parameters.marketId} not returned by solver /contract-symbols.`,
    );
  }

  return {
    name: marketName ?? match.name,
    pricePrecision: pricePrecision ?? match.pricePrecision,
    quantityPrecision: quantityPrecision ?? match.quantityPrecision,
  };
}
