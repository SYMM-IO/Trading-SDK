import type { Config } from "../../../core/config";
import { getEnigmaPriceServicePricesByNames } from "../../../price-service/enigma/prices-by-names/get-enigma-price-service-prices-by-names";
import { SymmError } from "../../../shared/errors/symm-error";

/**
 * Parameters for {@link resolveMarkPrice}.
 */
export interface ResolveMarkPriceParameters {
  chainId?: number;
  marketName: string;
  markPrice?: string;
}

/**
 * Resolve a mark price for `marketName`. Returns the caller-supplied value
 * when present; otherwise fetches the Enigma price service.
 *
 * Shared by the instant-open and instant-close wizards.
 *
 * @throws {SymmError} `RESOLVE_MARK_PRICE_NOT_FOUND` when the price service
 *   omits the requested name from its response.
 */
export async function resolveMarkPrice(config: Config, parameters: ResolveMarkPriceParameters): Promise<string> {
  if (parameters.markPrice !== undefined) return parameters.markPrice;

  const prices = await getEnigmaPriceServicePricesByNames(config, {
    chainId: parameters.chainId,
    names: [parameters.marketName],
  });
  const entry = prices[parameters.marketName];
  if (!entry) {
    throw new SymmError(
      "api",
      "RESOLVE_MARK_PRICE_NOT_FOUND",
      `Mark price not returned by Enigma price service for market "${parameters.marketName}".`,
    );
  }
  return String(entry.markPrice);
}
