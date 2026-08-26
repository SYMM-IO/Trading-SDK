import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { Compute, ReadSolverParameter } from "../../shared/types/properties";
import { resolveListingService } from "../resolve-listing";
import type { ListingDepositChainId } from "../types";
import { addMarketV2MarketAddMarketPost } from "../types/generated/listing-backend";
import { toAddMarketRequest } from "./to-add-market-request";
import { toCreatedPool } from "./to-created-pool";
import type { CreatedPool } from "./types";

/**
 * Parameters for {@link addMarket}.
 *
 * `accessToken`, `tokenContractAddress`, `buyBackRatio`, `maxLeverage`, and
 * `depositChain` are required — the endpoint is authed and the service needs the
 * token and its pool economics to open an application. Every other field is an
 * optional listing extra: it is sent only when set, so an omitted extra is left
 * absent from the request rather than defaulted.
 */
export type AddMarketParameters = Compute<
  ReadSolverParameter & {
    /**
     * Bearer token from `authenticateListing`; required — the endpoint is authed.
     * Sent as the `Authorization: Bearer <token>` header; a bad or expired token
     * yields a `401`.
     */
    accessToken: string;
    /** The token to list, as an EVM (`0x…`) or Solana (base58) contract address. */
    tokenContractAddress: string;
    /** Share of trading fees routed to buy-backs, `0`–`100`. */
    buyBackRatio: number;
    /** Maximum leverage the market allows, as a whole multiplier (`20` = 20x), `1`–`100`. */
    maxLeverage: number;
    /** Chain the token lives on and where its listing deposit will be made. Required. */
    depositChain: ListingDepositChainId;
    /** Whether the token charges a transfer tax. Sent only when set. */
    isTax?: boolean;
    /** Whether the deposit wallet is whitelisted from the token's transfer tax. Sent only when set. */
    userWhitelistTax?: boolean;
    /** Extra chain ids the token can also be deposited on. Sent only when set (an empty array is sent as an empty list). */
    additionalChains?: readonly number[];
    /** An existing pool address to attach, when the token already has one. Sent only when set. */
    poolAddress?: string;
    /** CEX names the token trades on, e.g. `"Binance"`. Sent only when set. */
    cexList?: readonly string[];
  }
>;

/** Return type of {@link addMarket}: the created pool application. */
export type AddMarketReturnType = CreatedPool;

/**
 * List a new token — submit a create-pool application to the permissionless
 * listing service.
 *
 * POSTs the token and its pool economics to `/v2/market/add-market` with the
 * caller's bearer token. The service records the application, resolves the
 * token's name/ticker/decimals from the contract, provisions a custodial deposit
 * wallet to seed the pool, and returns the accepted {@link CreatedPool} — status
 * {@link ListingMarketStatus.WAITING_FOR_DEPOSIT} until the listing deposit
 * lands at `walletPublicKey`. Enigma-only.
 *
 * @param config - The SDK config.
 * @param parameters - The bearer token, token address, pool economics, deposit chain, and any listing extras.
 * @returns The created pool application, normalized to a {@link CreatedPool}.
 * @throws {SymmApiError} `ADD_MARKET_FAILED` when the endpoint request fails — including a `401` on a bad or expired token, and the service's weekly-listing-limit rejections, which surface with the service's message and status as-is.
 * @throws {SymmError} `LISTING_UNSUPPORTED` when the resolved solver does not use
 *   the listing service, or `LISTING_NOT_CONFIGURED` when the chain has no
 *   listing backend. Gate with `supportsListingService` to hide the create-pool
 *   flow instead.
 *
 * @example
 * ```ts
 * const pool = await addMarket(config, {
 *   accessToken: token.accessToken,
 *   tokenContractAddress: "0xToken…",
 *   buyBackRatio: 50,
 *   maxLeverage: 20,
 *   depositChain: ListingDepositChainId.BASE,
 * });
 * // send the listing deposit to `pool.walletPublicKey`
 * ```
 */
export async function addMarket(config: Config, parameters: AddMarketParameters): Promise<CreatedPool> {
  const { url: baseURL } = resolveListingService(config, {
    chainId: parameters.chainId,
    solverId: parameters.solverId,
  });

  try {
    const response = await addMarketV2MarketAddMarketPost(toAddMarketRequest(parameters), {
      baseURL,
      headers: { Authorization: `Bearer ${parameters.accessToken}` },
    });

    return toCreatedPool(response.data);
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "ADD_MARKET_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "ADD_MARKET_FAILED",
      `Failed to add market: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
