import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { resolveListingService } from "../resolve-listing";
import type { ListingDepositChainId } from "../types";
import { listMarketV2MarketListMarketPost } from "../types/generated/listing-backend";
import { toCreatedPool } from "./to-created-pool";
import { toListMarketRequest } from "./to-list-market-request";
import type { CreatedPool } from "./types";

/**
 * Parameters for {@link listMarket}.
 *
 * `accessToken`, `tokenContractAddress`, `buyBackRatio`, `maxLeverage`, and
 * `depositChain` are required — the endpoint is authed and the service needs the
 * token and its pool economics to open an application. Every other field is an
 * optional listing extra: it is sent only when set, so an omitted extra is left
 * absent from the request rather than defaulted. `chainId` picks the deployment
 * whose listing backend is called.
 */
export type ListMarketParameters = Compute<
  ChainIdParameter & {
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

/** Return type of {@link listMarket}: the created (or relisted) pool application. */
export type ListMarketReturnType = CreatedPool;

/**
 * List a token — or relist a delisted one — with the permissionless listing
 * service.
 *
 * POSTs the token and its pool economics to `/v2/market/list-market` with the
 * caller's bearer token. One call covers both cases:
 *
 * - **New token** — the service records the application, resolves the token's
 *   name/ticker/decimals from the contract, provisions a custodial deposit
 *   wallet, and returns the {@link CreatedPool}.
 * - **Delisted market** — the service relists it through the same flow and
 *   returns the {@link CreatedPool} with the deposit wallet to fund again. The
 *   original listing time is kept; the relist time is recorded separately by the
 *   service.
 *
 * Either way the result is at {@link ListingMarketStatus.WAITING_FOR_DEPOSIT}
 * until the listing deposit lands at `walletPublicKey`. Relisting works only from
 * `DELISTED`: for a market that exists in any other status the service rejects
 * the call, and a relist whose token validation fails is rejected too and leaves
 * the market delisted. Both rejections surface as `LIST_MARKET_FAILED` with the
 * service's status and response body as-is. Enigma-only.
 *
 * @param config - The SDK config.
 * @param parameters - The bearer token, token address, pool economics, deposit chain, and any listing extras.
 * @returns The created or relisted pool application, normalized to a {@link CreatedPool}.
 * @throws {SymmApiError} `LIST_MARKET_FAILED` when the endpoint request fails — including a `401` on a bad or expired token, a market that already exists and is not delisted, a failed token validation, and the service's weekly-listing-limit rejections. The service's `status` and `responseData` are kept as-is; a request that gets no response has `status` `0`.
 * @throws {SymmError} `LIST_MARKET_FAILED` (`kind: "api"`) on any other failure.
 * @throws {SymmError} `LISTING_NOT_CONFIGURED` when the chain has no listing
 *   backend. Gate with `supportsListingService` to hide the listing flow instead.
 *
 * @example
 * ```ts
 * const pool = await listMarket(config, {
 *   accessToken: token.accessToken,
 *   tokenContractAddress: "0xToken…",
 *   buyBackRatio: 50,
 *   maxLeverage: 20,
 *   depositChain: ListingDepositChainId.BASE,
 * });
 * // send the listing deposit to `pool.walletPublicKey`
 * ```
 */
export async function listMarket(config: Config, parameters: ListMarketParameters): Promise<ListMarketReturnType> {
  const { url: baseURL } = resolveListingService(config, { chainId: parameters.chainId });

  try {
    const response = await listMarketV2MarketListMarketPost(toListMarketRequest(parameters), {
      baseURL,
      headers: { Authorization: `Bearer ${parameters.accessToken}` },
    });

    return toCreatedPool(response.data);
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "LIST_MARKET_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "LIST_MARKET_FAILED",
      `Failed to list market: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
