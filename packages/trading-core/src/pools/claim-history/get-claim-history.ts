import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { resolveListingService } from "../resolve-listing";
import type { PoolClaimHistoryPage } from "../types";
import { postSearchClaimsV2ClaimSearchStartSizeGet } from "../types/generated/listing-backend";
import { toPoolClaimHistoryPage } from "./to-pool-claim";

/**
 * Parameters for {@link getClaimHistory}.
 *
 * Pool listing is chain-level, so this takes only a `chainId`: the listing
 * backend is resolved from the chain. The endpoint is authed and scoped to the
 * caller — it only ever returns the signed-in user's own claims — so the filters
 * narrow *within* that set.
 */
export type GetClaimHistoryParameters = Compute<
  ChainIdParameter & {
    /**
     * Bearer token from `authenticateListing`; required — the endpoint is authed
     * and returns only the authenticated user's claims. Sent as the
     * `Authorization: Bearer <token>` header; a bad or expired token yields a
     * `401`.
     */
    accessToken: string;
    /**
     * Narrow to one pool by its token contract address. Omit for the user's
     * claims across **every** pool.
     */
    tokenContractAddress?: string;
    /**
     * Narrow to claims credited to one sub-account. Omit for the user's claims
     * across all of their sub-accounts.
     */
    accountAddress?: string;
    /** Row offset. @default 0 */
    start?: number;
    /** Page size. @default 150 */
    size?: number;
  }
>;

/** Return type of {@link getClaimHistory}: one page of the user's past claims. */
export type GetClaimHistoryReturnType = PoolClaimHistoryPage;

/**
 * Fetch the signed-in user's claim history — their past pool-reward claims,
 * newest first.
 *
 * Hits the authed `/v2/claim/search/{start}/{size}` endpoint with the caller's
 * bearer token; it only ever returns claims the user owns. Optionally narrow to
 * one pool (`tokenContractAddress`) or one receiving sub-account
 * (`accountAddress`). Pagination is path-based (`/{start}/{size}`), and `count`
 * is the total across all pages — so it is what a pager should divide, not
 * `items.length`. Enigma-only.
 *
 * @param config - The SDK config.
 * @param parameters - The bearer token, optional pool/sub-account filters, and paging.
 * @returns One {@link PoolClaimHistoryPage}.
 * @throws {SymmApiError} `FETCH_CLAIM_HISTORY_FAILED` when the endpoint request fails, including a `401` on a bad or expired token.
 * @throws {SymmError} `LISTING_NOT_CONFIGURED` when the chain has no listing
 *   backend. Gate with `supportsListingService` to hide the claim history instead.
 *
 * @example
 * ```ts
 * const page = await getClaimHistory(config, {
 *   accessToken: token.accessToken,
 *   tokenContractAddress: "0xToken…", // optional — omit for all pools
 *   size: 25,
 * });
 * ```
 */
export async function getClaimHistory(
  config: Config,
  parameters: GetClaimHistoryParameters,
): Promise<GetClaimHistoryReturnType> {
  const { url: baseURL } = resolveListingService(config, { chainId: parameters.chainId });
  const { start = 0, size = 150 } = parameters;

  try {
    const response = await postSearchClaimsV2ClaimSearchStartSizeGet(
      start,
      size,
      {
        ...(parameters.tokenContractAddress === undefined
          ? {}
          : { token_contract_address: parameters.tokenContractAddress }),
        ...(parameters.accountAddress === undefined ? {} : { account_address: parameters.accountAddress }),
      },
      { baseURL, headers: { Authorization: `Bearer ${parameters.accessToken}` } },
    );

    return toPoolClaimHistoryPage(response.data);
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_CLAIM_HISTORY_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "FETCH_CLAIM_HISTORY_FAILED",
      `Failed to fetch claim history: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
