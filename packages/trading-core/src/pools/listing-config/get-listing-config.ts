import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { resolveListingService } from "../resolve-listing";
import type { ListingConfig } from "../types";
import { getClientConfigV2ConfigsGet } from "../types/generated/listing-backend";
import { toListingConfig } from "./to-listing-config";

/**
 * Parameters for {@link getListingConfig}.
 *
 * The endpoint is public — no auth. Both fields are optional: when omitted the
 * config's default chain resolves the listing backend.
 */
export type GetListingConfigParameters = Compute<ChainIdParameter>;

/** Return type of {@link getListingConfig}: the service's public client config. */
export type GetListingConfigReturnType = ListingConfig;

/**
 * Fetch the listing service's **public** client configuration — the initial-deposit
 * guidance, listing fee, supported deposit chains, rate limits, and protocol
 * reward share a create-listing flow needs.
 *
 * Mirrors the public {@link getListingMarkets} read: no auth, resolved through
 * `resolveListingService`. The three USDC figures come back as `bigint` at
 * `LISTING_VALUE_DECIMALS` (18); `supportedDepositChains` is the source of truth
 * for a deposit-chain picker. Enigma-only.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain and solver overrides.
 * @returns The normalized {@link ListingConfig}.
 * @throws {SymmApiError} when the service request fails.
 * @throws {SymmError} `LISTING_NOT_CONFIGURED` when the chain has no listing
 *   backend. Gate with `supportsListingService` to hide Pools instead.
 *
 * @example
 * ```ts
 * const cfg = await getListingConfig(config);
 * const min = formatUnits(cfg.minimumInitialDepositUsdc, LISTING_VALUE_DECIMALS);
 * ```
 */
export async function getListingConfig(
  config: Config,
  parameters: GetListingConfigParameters = {},
): Promise<GetListingConfigReturnType> {
  const { url: baseURL } = resolveListingService(config, { chainId: parameters.chainId });

  try {
    const response = await getClientConfigV2ConfigsGet({ baseURL });

    return toListingConfig(response.data);
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_LISTING_CONFIG_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "FETCH_LISTING_CONFIG_FAILED",
      `Failed to fetch listing config: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
