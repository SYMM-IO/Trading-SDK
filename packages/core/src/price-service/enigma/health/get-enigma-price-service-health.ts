import { isAxiosError } from "axios";
import type { Config } from "../../../core/config";
import { SymmApiError, SymmError } from "../../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { healthCheckHealthGet } from "../types/generated/enigma-price-service";

/** Health-check payload returned by the Enigma price service. */
export type EnigmaPriceServiceHealth = unknown;

/**
 * Parameters for {@link getEnigmaPriceServiceHealth}.
 */
export type GetEnigmaPriceServiceHealthParameters = Compute<ChainIdParameter>;

/** Return type of {@link getEnigmaPriceServiceHealth}: service health payload. */
export type GetEnigmaPriceServiceHealthReturnType = EnigmaPriceServiceHealth;

/**
 * Read the health endpoint from the chain's Enigma price service.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain id.
 * @returns The health-check payload returned by the service.
 * @throws {SymmApiError} when the API request fails.
 * @throws {SymmError} when the chain is unsupported.
 *
 * @example
 * ```ts
 * const health = await getEnigmaPriceServiceHealth(config, {});
 * ```
 */
export async function getEnigmaPriceServiceHealth(
  config: Config,
  parameters: GetEnigmaPriceServiceHealthParameters = {},
): Promise<GetEnigmaPriceServiceHealthReturnType> {
  const { priceService } = config.getChainConfig(parameters.chainId);
  return fetchEnigmaPriceServiceHealth(priceService.url);
}

async function fetchEnigmaPriceServiceHealth(baseURL: string): Promise<EnigmaPriceServiceHealth> {
  try {
    const response = await healthCheckHealthGet({ baseURL });
    return response.data;
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw new SymmApiError({
        code: "FETCH_ENIGMA_PRICE_SERVICE_HEALTH_FAILED",
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
      "FETCH_ENIGMA_PRICE_SERVICE_HEALTH_FAILED",
      `Failed to fetch Enigma price-service health: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
