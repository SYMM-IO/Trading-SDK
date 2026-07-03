import { isAxiosError } from "axios";
import type { Config } from "../../../core/config";
import { SymmApiError, SymmError } from "../../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import {
  getSymbolPricesBatchApiV1PricesNamesGet,
  type GetSymbolPricesBatchApiV1PricesNamesGet200,
} from "../types/generated/enigma-price-service";

/** Mapping of symbol name to Enigma mark-price data. */
export type EnigmaPricesByName = GetSymbolPricesBatchApiV1PricesNamesGet200;

/**
 * Parameters for {@link getEnigmaPriceServicePricesByNames}.
 */
export type GetEnigmaPriceServicePricesByNamesParameters = Compute<
  ChainIdParameter & {
    /** Market names to fetch prices for. Max 50 per API contract. */
    names: readonly string[];
  }
>;

/** Return type of {@link getEnigmaPriceServicePricesByNames}: mark prices keyed by market name. */
export type GetEnigmaPriceServicePricesByNamesReturnType = EnigmaPricesByName;

/**
 * Fetch mark prices for market names from the chain's Enigma price service.
 *
 * @param config - The SDK config.
 * @param parameters - Market names and optional chain id.
 * @returns Mark prices keyed by market name.
 * @throws {SymmApiError} when the API request fails.
 * @throws {SymmError} when the chain is unsupported.
 *
 * @example
 * ```ts
 * const prices = await getEnigmaPriceServicePricesByNames(config, {
 *   names: ["BTCUSDT", "ETHUSDT"],
 * });
 * ```
 */
export async function getEnigmaPriceServicePricesByNames(
  config: Config,
  parameters: GetEnigmaPriceServicePricesByNamesParameters,
): Promise<GetEnigmaPriceServicePricesByNamesReturnType> {
  const { priceService } = config.getChainConfig(parameters.chainId);
  return fetchEnigmaPriceServicePricesByNames(priceService.url, parameters.names);
}

async function fetchEnigmaPriceServicePricesByNames(
  baseURL: string,
  names: readonly string[],
): Promise<EnigmaPricesByName> {
  try {
    const response = await getSymbolPricesBatchApiV1PricesNamesGet(names.join(","), { baseURL });
    return response.data;
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_ENIGMA_PRICE_SERVICE_PRICES_BY_NAMES_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "FETCH_ENIGMA_PRICE_SERVICE_PRICES_BY_NAMES_FAILED",
      `Failed to fetch Enigma price-service prices by names: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
