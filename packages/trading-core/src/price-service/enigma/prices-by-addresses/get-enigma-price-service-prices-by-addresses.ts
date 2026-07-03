import { isAxiosError } from "axios";
import type { Config } from "../../../core/config";
import { SymmApiError, SymmError } from "../../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import {
  getPricesBySymbolAddressesApiV1PricesGet,
  type GetPricesBySymbolAddressesApiV1PricesGet200,
  type PriceData,
} from "../types/generated/enigma-price-service";

/** Mark-price data returned by the Enigma price service for one symbol. */
export type EnigmaPriceData = PriceData;

/** Mapping of symbol address to Enigma mark-price data. */
export type EnigmaPricesByAddress = GetPricesBySymbolAddressesApiV1PricesGet200;

/**
 * Parameters for {@link getEnigmaPriceServicePricesByAddresses}.
 */
export type GetEnigmaPriceServicePricesByAddressesParameters = Compute<
  ChainIdParameter & {
    /** Symbol addresses to fetch prices for. Max 50 per API contract. */
    addresses: readonly string[];
  }
>;

/** Return type of {@link getEnigmaPriceServicePricesByAddresses}: mark prices keyed by symbol address. */
export type GetEnigmaPriceServicePricesByAddressesReturnType = EnigmaPricesByAddress;

/**
 * Fetch mark prices for symbol addresses from the chain's Enigma price service.
 *
 * @param config - The SDK config.
 * @param parameters - Symbol addresses and optional chain id.
 * @returns Mark prices keyed by symbol address.
 * @throws {SymmApiError} when the API request fails.
 * @throws {SymmError} when the chain is unsupported.
 *
 * @example
 * ```ts
 * const prices = await getEnigmaPriceServicePricesByAddresses(config, {
 *   addresses: ["0x0000000000000000000000000000000000000000"],
 * });
 * ```
 */
export async function getEnigmaPriceServicePricesByAddresses(
  config: Config,
  parameters: GetEnigmaPriceServicePricesByAddressesParameters,
): Promise<GetEnigmaPriceServicePricesByAddressesReturnType> {
  const { priceService } = config.getChainConfig(parameters.chainId);
  return fetchEnigmaPriceServicePricesByAddresses(priceService.url, parameters.addresses);
}

async function fetchEnigmaPriceServicePricesByAddresses(
  baseURL: string,
  addresses: readonly string[],
): Promise<EnigmaPricesByAddress> {
  try {
    const response = await getPricesBySymbolAddressesApiV1PricesGet({ addresses: addresses.join(",") }, { baseURL });
    return response.data;
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_ENIGMA_PRICE_SERVICE_PRICES_BY_ADDRESSES_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "FETCH_ENIGMA_PRICE_SERVICE_PRICES_BY_ADDRESSES_FAILED",
      `Failed to fetch Enigma price-service prices by addresses: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
