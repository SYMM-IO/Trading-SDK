import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { resolveListingService } from "../resolve-listing";
import type { ListingDepositChainId } from "../types";
import type { SupportedDepositChains } from "../types/generated/listing-backend";
import { getMarketConfigV2MarketConfigGet } from "../types/generated/listing-backend";
import { toListingMarketConfig } from "./to-listing-market-config";
import type { ListingMarketConfig } from "./types";

/**
 * Parameters for {@link getListingMarketConfig}.
 *
 * Pool listing is chain-level, so this takes only a `chainId`: the listing
 * backend is resolved from the chain. The market is addressed by its token
 * contract address plus its deposit chain — the same pair
 * `getListingMarketDetail` takes.
 */
export type GetListingMarketConfigParameters = Compute<
  ChainIdParameter & {
    /**
     * Bearer token from `authenticateListing`; required — the endpoint is authed.
     * Sent as the `Authorization: Bearer <token>` header; a bad or expired token
     * yields a `401`. The config is per-user, so the token decides whose opinion
     * comes back in the `user*` fields.
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
     * with {@link GetListingMarketConfigParameters.tokenContractAddress} to
     * identify the market.
     */
    depositChain: ListingDepositChainId;
  }
>;

/**
 * Return type of {@link getListingMarketConfig}: the caller's own config opinion
 * for one market, plus the pool-level values in force.
 */
export type GetListingMarketConfigReturnType = ListingMarketConfig;

/**
 * Read the signed-in user's configuration opinion for one market — their own
 * max leverage and buyback percentage, alongside the deposit-weighted pool
 * values those opinions blend into.
 *
 * GETs the authed `/v2/market/config` endpoint with the caller's bearer token.
 * Use it to prefill an edit form with what the caller previously set:
 * `userMaxLeverage` and `userBuybackRatio` are `null` until they have ever
 * submitted an opinion for this market. Enigma-only.
 *
 * The write on the same path is not a read — `updateListingMarketConfig` with
 * both values omitted is rejected, so this GET is the only way to read the
 * caller's opinion back.
 *
 * @param config - The SDK config.
 * @param parameters - The bearer token and the market's token contract address and deposit chain.
 * @returns The caller's {@link ListingMarketConfig} for the market.
 * @throws {SymmApiError} `FETCH_LISTING_MARKET_CONFIG_FAILED` when the endpoint request fails — including a `401` on a bad or expired token, and a `404` on a listing backend where this read is not deployed yet (the write can be available while the read is not; treat a `404` as "unknown opinion", not as an error worth blocking on).
 * @throws {SymmError} `LISTING_NOT_CONFIGURED` when the chain has no listing
 *   backend. Gate with `supportsListingService` to hide Pools instead.
 *
 * @example
 * ```ts
 * const marketConfig = await getListingMarketConfig(config, {
 *   accessToken: token.accessToken,
 *   tokenContractAddress: "0xToken…",
 *   depositChain: market.chainId,
 * });
 * // null until this user has ever configured the market
 * const mine = marketConfig.userBuybackRatio;
 * ```
 */
export async function getListingMarketConfig(
  config: Config,
  parameters: GetListingMarketConfigParameters,
): Promise<GetListingMarketConfigReturnType> {
  const { url: baseURL } = resolveListingService(config, { chainId: parameters.chainId });

  try {
    const response = await getMarketConfigV2MarketConfigGet(
      {
        token_contract_address: parameters.tokenContractAddress,
        // Value-preserving: SupportedDepositChains shares the same numeric chain-id values as ListingDepositChainId.
        deposit_chain: parameters.depositChain as unknown as SupportedDepositChains,
      },
      {
        baseURL,
        headers: { Authorization: `Bearer ${parameters.accessToken}` },
      },
    );

    return toListingMarketConfig(response.data);
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_LISTING_MARKET_CONFIG_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "FETCH_LISTING_MARKET_CONFIG_FAILED",
      `Failed to fetch the market config: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
