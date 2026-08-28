import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { resolveListingService } from "../resolve-listing";
import type { WeeklyListingLimit } from "../types";
import { getWeeklyListingLimitV2MarketWeeklyListingLimitGet } from "../types/generated/listing-backend";
import { toWeeklyListingLimit } from "./to-weekly-limit";

/**
 * Parameters for {@link getWeeklyListingLimit}.
 *
 * The endpoint is public — no auth. Both fields are optional: when omitted the
 * config's default chain resolves the listing backend.
 */
export type GetWeeklyListingLimitParameters = Compute<ChainIdParameter>;

/** Return type of {@link getWeeklyListingLimit}: the protocol's global weekly listing cap. */
export type GetWeeklyListingLimitReturnType = WeeklyListingLimit;

/**
 * Fetch the protocol's **global** remaining new-market listings for the current
 * rolling weekly window.
 *
 * A **public** read (no token): the service caps how many pools may be created
 * across the whole protocol each week, not per user. Read this before an
 * {@link addMarket} flow and block creating a pool when `remaining` is `0` — the
 * cap is spent and no more pools can be listed until `resetAt`. Enigma-only.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain and solver overrides.
 * @returns The protocol's {@link WeeklyListingLimit} for the current window.
 * @throws {SymmApiError} when the endpoint request fails.
 * @throws {SymmError} `LISTING_NOT_CONFIGURED` when the chain has no listing
 *   backend. Gate with `supportsListingService` to hide Pools instead.
 *
 * @example
 * ```ts
 * const { remaining } = await getWeeklyListingLimit(config);
 * if (remaining === 0) disableCreatePool();
 * ```
 */
export async function getWeeklyListingLimit(
  config: Config,
  parameters: GetWeeklyListingLimitParameters = {},
): Promise<WeeklyListingLimit> {
  const { url: baseURL } = resolveListingService(config, { chainId: parameters.chainId });

  try {
    const response = await getWeeklyListingLimitV2MarketWeeklyListingLimitGet({ baseURL });

    return toWeeklyListingLimit(response.data);
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_WEEKLY_LISTING_LIMIT_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "FETCH_WEEKLY_LISTING_LIMIT_FAILED",
      `Failed to fetch the weekly listing limit: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
