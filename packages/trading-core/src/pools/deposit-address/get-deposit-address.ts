import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { resolveListingService } from "../resolve-listing";
import type { ListingDepositChainId, MarketDepositAddress } from "../types";
import type { SupportedDepositChains } from "../types/generated/listing-backend";
import { getDepositAddressV2MarketDepositAddressPost } from "../types/generated/listing-backend";
import { toMarketDepositAddress } from "./to-market-deposit-address";

/**
 * Parameters for {@link getDepositAddress}.
 *
 * Pool listing is chain-level, so this takes only a `chainId`: the listing
 * backend is resolved from the chain.
 */
export type GetDepositAddressParameters = Compute<
  ChainIdParameter & {
    /**
     * Bearer token from `authenticateListing`; required — the endpoint is authed.
     * Sent as the `Authorization: Bearer <token>` header; a bad or expired token
     * yields a `401`.
     */
    accessToken: string;
    /**
     * The market's token contract address — the id that addresses a single market
     * in the listing API. An EVM `0x…` address, or a Solana base58 address for a
     * Solana-deposited listing. Together with {@link GetDepositAddressParameters.depositChain}
     * it identifies the market to get (or create) a deposit wallet for.
     */
    tokenContractAddress: string;
    /**
     * The market's deposit chain — the chain the token lives on. Pairs with
     * {@link GetDepositAddressParameters.tokenContractAddress} to identify the
     * market.
     */
    depositChain: ListingDepositChainId;
  }
>;

/**
 * Return type of {@link getDepositAddress}: the signed-in user's deposit wallet
 * for one market.
 */
export type GetDepositAddressReturnType = MarketDepositAddress;

/**
 * Return (or create) the signed-in user's deposit wallet for a single market —
 * the address the user sends funds to in order to deposit into the market's pool.
 *
 * This POSTs to the authed `/v2/market/deposit-address` endpoint with the
 * caller's bearer token. The endpoint is an idempotent get-or-create: it returns
 * the user's existing wallet for the market, or provisions a new one on the first
 * call. Enigma-only.
 *
 * @param config - The SDK config.
 * @param parameters - The bearer token and the market's token contract address and deposit chain.
 * @returns The user's {@link MarketDepositAddress} for the market.
 * @throws {SymmApiError} when the endpoint request fails, including a `401` on a bad or expired token.
 * @throws {SymmError} `LISTING_NOT_CONFIGURED` when the chain has no listing
 *   backend. Gate with `supportsListingService` to hide Pools instead.
 *
 * @example
 * ```ts
 * const deposit = await getDepositAddress(config, {
 *   accessToken: token.accessToken,
 *   tokenContractAddress: "0x1234…",
 *   depositChain: ListingDepositChainId.HYPER_EVM,
 * });
 * ```
 */
export async function getDepositAddress(
  config: Config,
  parameters: GetDepositAddressParameters,
): Promise<MarketDepositAddress> {
  const { url: baseURL } = resolveListingService(config, { chainId: parameters.chainId });

  try {
    const response = await getDepositAddressV2MarketDepositAddressPost(
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

    return toMarketDepositAddress(response.data);
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_DEPOSIT_ADDRESS_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "FETCH_DEPOSIT_ADDRESS_FAILED",
      `Failed to fetch the deposit address: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
