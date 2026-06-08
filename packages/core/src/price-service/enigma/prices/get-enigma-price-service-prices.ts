import { isAxiosError } from "axios";
import type { Config } from "../../../core/config";
import { SymmApiError, SymmError } from "../../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import {
  getPricesBySymbolAddressesApiV1PricesGet,
  type GetPricesBySymbolAddressesApiV1PricesGet200,
  type PriceData,
} from "../types/generated/enigma-price-service";

/** Symbol-address input accepted by Enigma price-service prices. */
export type EnigmaPriceServiceAddressList = readonly string[] | string;

/** Mark-price data returned by the Enigma price service for one symbol address. */
export type EnigmaPriceData = PriceData;

/** Mapping of symbol address to Enigma mark-price data. */
export type EnigmaPricesByAddress = GetPricesBySymbolAddressesApiV1PricesGet200;

/**
 * Parameters for {@link getEnigmaPriceServicePrices}.
 */
export type GetEnigmaPriceServicePricesParameters = Compute<
  ChainIdParameter & {
    /** Symbol addresses as an array or comma-separated string. Max 50 per API contract. */
    addresses: EnigmaPriceServiceAddressList;
  }
>;

/** Return type of {@link getEnigmaPriceServicePrices}: mark prices keyed by symbol address. */
export type GetEnigmaPriceServicePricesReturnType = EnigmaPricesByAddress;

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
 * const prices = await getEnigmaPriceServicePrices(config, {
 *   addresses: ["0x0000000000000000000000000000000000000000"],
 * });
 * ```
 */
export async function getEnigmaPriceServicePrices(
  config: Config,
  parameters: GetEnigmaPriceServicePricesParameters,
): Promise<GetEnigmaPriceServicePricesReturnType> {
  const { priceService } = config.getChainConfig(parameters.chainId);
  return fetchEnigmaPriceServicePrices(priceService.url, parameters.addresses);
}

async function fetchEnigmaPriceServicePrices(
  baseURL: string,
  addresses: EnigmaPriceServiceAddressList,
): Promise<EnigmaPricesByAddress> {
  try {
    const response = await getPricesBySymbolAddressesApiV1PricesGet(
      { addresses: joinAddresses(addresses) },
      { baseURL },
    );
    return response.data;
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw new SymmApiError({
        code: "FETCH_ENIGMA_PRICE_SERVICE_PRICES_FAILED",
        message: err.message,
        status: err.response?.status ?? 0,
        statusText: err.response?.statusText ?? "Unknown",
        responseData: err.response?.data,
        url: err.config?.url ? `${baseURL}${err.config.url}` : baseURL,
        method: err.config?.method?.toUpperCase() ?? "GET",
        cause: err,
      });
    }

    throw new SymmError(
      "api",
      "FETCH_ENIGMA_PRICE_SERVICE_PRICES_FAILED",
      `Failed to fetch Enigma price-service prices: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}

function joinAddresses(addresses: EnigmaPriceServiceAddressList): string {
  return typeof addresses === "string" ? addresses : addresses.join(",");
}
