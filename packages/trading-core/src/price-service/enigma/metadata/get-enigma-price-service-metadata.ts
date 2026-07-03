import { isAxiosError } from "axios";
import type { Config } from "../../../core/config";
import { SymmApiError, SymmError } from "../../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import {
  getMetadataApiV1MetadataGet,
  type GetMetadataApiV1MetadataGet200,
  type MetadataResponse,
} from "../types/generated/enigma-price-service";

/** Symbol metadata returned by the Enigma price service. */
export type EnigmaMetadata = MetadataResponse;

/** Mapping of symbol address to Enigma metadata. */
export type EnigmaMetadataByAddress = Exclude<GetMetadataApiV1MetadataGet200, MetadataResponse[]>;

/**
 * Parameters for {@link getEnigmaPriceServiceMetadata}.
 */
export type GetEnigmaPriceServiceMetadataParameters = Compute<
  ChainIdParameter & {
    /** Symbol addresses. Max 50 per API contract. */
    addresses: readonly string[];
  }
>;

/** Return type of {@link getEnigmaPriceServiceMetadata}: metadata keyed by symbol address. */
export type GetEnigmaPriceServiceMetadataReturnType = EnigmaMetadataByAddress;

/**
 * Fetch metadata for symbol addresses from the chain's Enigma price service.
 *
 * @param config - The SDK config.
 * @param parameters - Symbol addresses and optional chain id.
 * @returns Metadata keyed by symbol address.
 * @throws {SymmApiError} when the API request fails.
 * @throws {SymmError} when the chain is unsupported.
 *
 * @example
 * ```ts
 * const metadata = await getEnigmaPriceServiceMetadata(config, {
 *   addresses: ["0x0000000000000000000000000000000000000000"],
 * });
 * ```
 */
export async function getEnigmaPriceServiceMetadata(
  config: Config,
  parameters: GetEnigmaPriceServiceMetadataParameters,
): Promise<GetEnigmaPriceServiceMetadataReturnType> {
  const { priceService } = config.getChainConfig(parameters.chainId);
  return fetchEnigmaPriceServiceMetadata(priceService.url, parameters.addresses);
}

async function fetchEnigmaPriceServiceMetadata(
  baseURL: string,
  addresses: readonly string[],
): Promise<EnigmaMetadataByAddress> {
  try {
    const response = await getMetadataApiV1MetadataGet({ addresses: addresses.join(",") }, { baseURL });
    return response.data as EnigmaMetadataByAddress;
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_ENIGMA_PRICE_SERVICE_METADATA_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "FETCH_ENIGMA_PRICE_SERVICE_METADATA_FAILED",
      `Failed to fetch Enigma price-service metadata: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
