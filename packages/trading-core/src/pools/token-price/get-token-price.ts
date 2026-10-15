import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { resolveListingService } from "../resolve-listing";
import { TokenPriceChain, type TokenPrice } from "../types";
import type { CalculateSymbolPriceRequestChain } from "../types/generated/listing-backend";
import { calculateSymbolPriceV2MarketTokenPricePost } from "../types/generated/listing-backend";
import { toTokenPrice } from "./to-token-price";

/**
 * Parameters for {@link getTokenPrice}.
 *
 * Pool listing is chain-level, so this takes only a `chainId`: the listing
 * backend is resolved from the chain.
 */
export type GetTokenPriceParameters = Compute<
  ChainIdParameter & {
    /**
     * Bearer token from `authenticateListing`; required — the endpoint is authed.
     * Sent as the `Authorization: Bearer <token>` header; a bad or expired token
     * yields a `401`. An empty string is rejected before any request.
     */
    accessToken: string;
    /**
     * The chain the token lives on, by vendor chain **name**
     * ({@link TokenPriceChain}) — not a numeric chain id and not a
     * `ListingDepositChainId`. A value outside the enum is rejected before any
     * request.
     */
    chain: TokenPriceChain;
    /**
     * The token's contract address on `chain`: an EVM `0x…` address, or a
     * Solana base58 address when `chain` is `SOLANA`.
     */
    tokenAddress: string;
  }
>;

/** Return type of {@link getTokenPrice}: the token's pre-listing price estimate. */
export type GetTokenPriceReturnType = TokenPrice;

/**
 * Fetch a pre-listing **price estimate** for a token — what the Price Service
 * thinks one unit is worth in USD, before (or regardless of whether) the token
 * is listed as a pool.
 *
 * This POSTs to the authed `/v2/market/token-price` endpoint with the caller's
 * bearer token. The backend caches the figure for about five minutes and
 * rate-limits the endpoint (ten requests a minute per authenticated wallet,
 * thirty globally — cached responses count too), so the result is a display
 * estimate rather than a mark or trade price: render it with a `~`, serve
 * repeat reads from the cache, and do not poll. Enigma-only.
 *
 * @param config - The SDK config.
 * @param parameters - The bearer token, the token's chain (by name) and its contract address.
 * @returns The token's {@link TokenPrice} estimate.
 * @throws {SymmApiError} `FETCH_TOKEN_PRICE_FAILED` when the endpoint request
 *   fails: a `401` on a bad or expired token (re-run `authenticateListing`), a
 *   `422` on an address the service cannot resolve, and a `429` when the rate
 *   limit is exhausted (`retryAfterMs` carries the wait when the service sends one).
 * @throws {SymmError} `LISTING_NOT_CONFIGURED` when the chain has no listing
 *   backend. Gate with `supportsListingService` to hide Pools instead.
 * @throws {SymmError} `MISSING_ACCESS_TOKEN` (`kind: "validation"`) when
 *   `accessToken` is empty, before any request.
 * @throws {SymmError} `UNSUPPORTED_TOKEN_PRICE_CHAIN` (`kind: "validation"`)
 *   when `chain` is not a {@link TokenPriceChain} member, before any request.
 *
 * @example
 * ```ts
 * const estimate = await getTokenPrice(config, {
 *   accessToken: token.accessToken,
 *   chain: TokenPriceChain.ARC,
 *   tokenAddress: "0x648A…620a",
 * });
 *
 * // USD per token, an estimate:
 * estimate.price;
 * ```
 */
export async function getTokenPrice(config: Config, parameters: GetTokenPriceParameters): Promise<TokenPrice> {
  const { url: baseURL } = resolveListingService(config, { chainId: parameters.chainId });

  if (parameters.accessToken.trim() === "") {
    throw new SymmError(
      "validation",
      "MISSING_ACCESS_TOKEN",
      "getTokenPrice: `accessToken` is required — the endpoint is authed. Mint one with `authenticateListing`.",
    );
  }

  if (!Object.values(TokenPriceChain).includes(parameters.chain)) {
    throw new SymmError(
      "validation",
      "UNSUPPORTED_TOKEN_PRICE_CHAIN",
      `getTokenPrice: unsupported chain "${String(parameters.chain)}". Expected one of ${Object.values(TokenPriceChain).join(", ")}.`,
    );
  }

  try {
    const response = await calculateSymbolPriceV2MarketTokenPricePost(
      {
        // Value-preserving: CalculateSymbolPriceRequestChain shares the same string values as TokenPriceChain.
        chain: parameters.chain as unknown as CalculateSymbolPriceRequestChain,
        token_address: parameters.tokenAddress,
      },
      {
        baseURL,
        headers: { Authorization: `Bearer ${parameters.accessToken}` },
      },
    );

    return toTokenPrice(response.data);
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_TOKEN_PRICE_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "FETCH_TOKEN_PRICE_FAILED",
      `Failed to fetch the token price: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
