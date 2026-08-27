import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { resolveListingService } from "../resolve-listing";
import type { UserPoolProfit } from "../types";
import { getProfitByTokenV2ProfitTokenContractAddressGet } from "../types/generated/listing-backend";
import { toUserPoolProfit } from "./to-user-pool-profit";

/**
 * Parameters for {@link getUserProfit}.
 *
 * Pool listing is chain-level, so this takes only a `chainId`: the listing
 * backend is resolved from the chain.
 */
export type GetUserProfitParameters = Compute<
  ChainIdParameter & {
    /**
     * Bearer token from `authenticateListing`; required — the endpoint is authed.
     * Sent as the `Authorization: Bearer <token>` header; a bad or expired token
     * yields a `401`.
     */
    accessToken: string;
    /**
     * The pool's token contract address — the id that addresses a single market
     * in the listing API. An EVM `0x…` address, or a Solana base58 address for a
     * Solana-deposited listing.
     */
    tokenContractAddress: string;
  }
>;

/** Return type of {@link getUserProfit}: the signed-in user's position in one pool. */
export type GetUserProfitReturnType = UserPoolProfit;

/**
 * Fetch the signed-in user's LP position and profit in a single pool — their LP
 * shares, LP balance valued in tokens and USDC, claimable and claimed rewards,
 * deposited token amount, and the LP shares queued for withdrawal.
 *
 * This hits the authed `/v2/profit/{token_contract_address}` endpoint with the
 * caller's bearer token. Values come back as 18-decimal figures and are
 * normalized to `bigint` at `LISTING_VALUE_DECIMALS`, absent ones defaulting to
 * `0n`. Enigma-only.
 *
 * @param config - The SDK config.
 * @param parameters - The bearer token and the pool's token contract address.
 * @returns The user's {@link UserPoolProfit} for the pool.
 * @throws {SymmApiError} when the endpoint request fails, including a `401` on a bad or expired token.
 * @throws {SymmError} `LISTING_NOT_CONFIGURED` when the chain has no listing
 *   backend. Gate with `supportsListingService` to hide Pools instead.
 *
 * @example
 * ```ts
 * const profit = await getUserProfit(config, {
 *   accessToken: token.accessToken,
 *   tokenContractAddress: "0x1234…",
 * });
 * ```
 */
export async function getUserProfit(
  config: Config,
  parameters: GetUserProfitParameters,
): Promise<GetUserProfitReturnType> {
  const { url: baseURL } = resolveListingService(config, { chainId: parameters.chainId });

  try {
    const response = await getProfitByTokenV2ProfitTokenContractAddressGet(parameters.tokenContractAddress, {
      baseURL,
      headers: { Authorization: `Bearer ${parameters.accessToken}` },
    });

    return toUserPoolProfit(response.data);
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_USER_PROFIT_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "FETCH_USER_PROFIT_FAILED",
      `Failed to fetch user profit: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
