import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { getDepositAddress } from "../deposit-address/get-deposit-address";
import { resolveListingService } from "../resolve-listing";
import type { ListingDepositChainId } from "../types";
import { updateMarketConfigV2MarketConfigPost } from "../types/generated/listing-backend";
import { toListingMarketConfig } from "./to-listing-market-config";
import { toUpdateListingMarketConfigRequest } from "./to-update-listing-market-config-request";
import type { ListingMarketConfig } from "./types";

/**
 * Parameters for {@link updateListingMarketConfig}.
 *
 * Pool listing is chain-level, so this takes only a `chainId`: the listing
 * backend is resolved from the chain. At least one of
 * {@link UpdateListingMarketConfigParameters.maxLeverage} and
 * {@link UpdateListingMarketConfigParameters.buybackRatio} must be present.
 */
export type UpdateListingMarketConfigParameters = Compute<
  ChainIdParameter & {
    /**
     * Bearer token from `authenticateListing`; required — the endpoint is authed.
     * Sent as the `Authorization: Bearer <token>` header; a bad or expired token
     * yields a `401`. The token decides whose opinion is recorded.
     */
    accessToken: string;
    /**
     * The market's token contract address — the id that addresses a single market
     * in the listing API. An EVM `0x…` address, or a Solana base58 address for a
     * Solana-deposited listing.
     */
    tokenContractAddress: string;
    /**
     * The market's deposit chain — the market's `ListingMarket.chainId`. Pairs
     * with {@link UpdateListingMarketConfigParameters.tokenContractAddress} to
     * identify the market.
     */
    depositChain: ListingDepositChainId;
    /**
     * The caller's max-leverage opinion, a whole multiplier within
     * `LISTING_MARKET_CONFIG_BOUNDS.maxLeverage`. Omit to leave the caller's
     * current max leverage untouched.
     */
    maxLeverage?: number;
    /**
     * The caller's buyback opinion, a whole percent within
     * `LISTING_MARKET_CONFIG_BOUNDS.buybackRatio`. Omit to leave the caller's
     * current buyback untouched.
     */
    buybackRatio?: number;
    /**
     * Mint the caller's deposit wallet for the market before submitting, by
     * calling `getDepositAddress` first. Defaults to `true`.
     *
     * The service only counts an opinion from an LP that holds a deposit address
     * on the market, and `getDepositAddress` is an idempotent get-or-create — so
     * the default is safe to leave on. Pass `false` to skip the extra round trip
     * when the caller is already known to hold one (for example right after a
     * deposit flow that fetched it).
     */
    ensureDepositAddress?: boolean;
  }
>;

/**
 * Return type of {@link updateListingMarketConfig}: the market config as it
 * stands after the opinion is recorded, including the re-blended pool values.
 */
export type UpdateListingMarketConfigReturnType = ListingMarketConfig;

/**
 * Submit the signed-in user's configuration opinion for one market — their
 * preferred max leverage, buyback percentage, or both.
 *
 * This never overwrites the pool's configuration. The service records the value
 * as *this LP's* opinion and folds it into a deposit-weighted average across
 * every LP, so one call nudges the pool rather than setting it. The returned
 * {@link ListingMarketConfig} carries both halves: `userMaxLeverage` /
 * `userBuybackRatio` are what was just recorded, `maxLeverage` / `buybackRatio`
 * are the re-blended pool values. Enigma-only.
 *
 * By default the caller's deposit wallet is minted first (see
 * {@link UpdateListingMarketConfigParameters.ensureDepositAddress}) — the
 * service only counts an opinion from an LP that holds one.
 *
 * The endpoint is rate limited to five successful updates per authenticated user
 * per market in a rolling 24-hour window; read the current cap from
 * `getListingConfig`'s `rateLimits.marketConfigUpdatesPerDay`. Exceeding it
 * surfaces as a `SymmApiError` with the service's `429`.
 *
 * @param config - The SDK config.
 * @param parameters - The bearer token, the market's token contract address and deposit chain, and at least one of `maxLeverage` / `buybackRatio`.
 * @returns The market's {@link ListingMarketConfig} after the update.
 * @throws {SymmError} `MISSING_MARKET_CONFIG_VALUES` when both `maxLeverage` and `buybackRatio` are omitted — the service rejects a body with neither, so this is caught before the request.
 * @throws {SymmApiError} `UPDATE_LISTING_MARKET_CONFIG_FAILED` when the endpoint request fails — including a `401` on a bad or expired token, a `422` on a value outside the service's accepted range, and a `429` when the five-per-day cap is exhausted.
 * @throws {SymmError} `LISTING_NOT_CONFIGURED` when the chain has no listing
 *   backend. Gate with `supportsListingService` to hide Pools instead.
 *
 * @example
 * ```ts
 * const updated = await updateListingMarketConfig(config, {
 *   accessToken: token.accessToken,
 *   tokenContractAddress: "0xToken…",
 *   depositChain: market.chainId,
 *   buybackRatio: 50, // 50%
 *   maxLeverage: 20, // 20x
 * });
 * // the pool value after this LP's opinion was folded in
 * updated.buybackRatio;
 * ```
 */
export async function updateListingMarketConfig(
  config: Config,
  parameters: UpdateListingMarketConfigParameters,
): Promise<UpdateListingMarketConfigReturnType> {
  const { url: baseURL } = resolveListingService(config, { chainId: parameters.chainId });

  if (parameters.maxLeverage === undefined && parameters.buybackRatio === undefined) {
    throw new SymmError(
      "validation",
      "MISSING_MARKET_CONFIG_VALUES",
      "updateListingMarketConfig: at least one of `maxLeverage` or `buybackRatio` is required.",
    );
  }

  try {
    /**
     * The service only counts an opinion from an LP that holds a deposit wallet
     * on the market. `getDepositAddress` is an idempotent get-or-create, so this
     * is a no-op for a caller who already has one.
     */
    if (parameters.ensureDepositAddress ?? true) {
      await getDepositAddress(config, {
        chainId: parameters.chainId,
        accessToken: parameters.accessToken,
        tokenContractAddress: parameters.tokenContractAddress,
        depositChain: parameters.depositChain,
      });
    }

    const response = await updateMarketConfigV2MarketConfigPost(toUpdateListingMarketConfigRequest(parameters), {
      baseURL,
      headers: { Authorization: `Bearer ${parameters.accessToken}` },
    });

    return toListingMarketConfig(response.data);
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "UPDATE_LISTING_MARKET_CONFIG_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "UPDATE_LISTING_MARKET_CONFIG_FAILED",
      `Failed to update the market config: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
