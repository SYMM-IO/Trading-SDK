import { isAxiosError } from "axios";
import type { Config } from "../../../core/config";
import { SymmApiError, SymmError } from "../../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { getSymbolsInfoApiV1SymbolsInfoGet, type SymbolInfo } from "../types/generated/enigma-price-service";

/** Symbol listing information returned by the Enigma price service. */
export type EnigmaSymbolInfo = SymbolInfo;

/**
 * Parameters for {@link getEnigmaPriceServiceSymbolsInfo}.
 */
export type GetEnigmaPriceServiceSymbolsInfoParameters = Compute<ChainIdParameter>;

/** Return type of {@link getEnigmaPriceServiceSymbolsInfo}: known Enigma symbol listings. */
export type GetEnigmaPriceServiceSymbolsInfoReturnType = EnigmaSymbolInfo[];

/**
 * Fetch known symbols from the chain's Enigma price service.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain id.
 * @returns Symbol names, statuses, and addresses.
 * @throws {SymmApiError} when the API request fails.
 * @throws {SymmError} when the chain is unsupported.
 *
 * @example
 * ```ts
 * const symbols = await getEnigmaPriceServiceSymbolsInfo(config, {});
 * ```
 */
export async function getEnigmaPriceServiceSymbolsInfo(
  config: Config,
  parameters: GetEnigmaPriceServiceSymbolsInfoParameters = {},
): Promise<GetEnigmaPriceServiceSymbolsInfoReturnType> {
  const { priceService } = config.getChainConfig(parameters.chainId);
  return fetchEnigmaPriceServiceSymbolsInfo(priceService.url);
}

async function fetchEnigmaPriceServiceSymbolsInfo(baseURL: string): Promise<EnigmaSymbolInfo[]> {
  try {
    const response = await getSymbolsInfoApiV1SymbolsInfoGet({ baseURL });
    return response.data;
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_ENIGMA_PRICE_SERVICE_SYMBOLS_INFO_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "FETCH_ENIGMA_PRICE_SERVICE_SYMBOLS_INFO_FAILED",
      `Failed to fetch Enigma price-service symbols info: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
