import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { resolveListingService } from "../resolve-listing";
import type { ListingDepositChainId, ListingStatus } from "../types";
import type { SupportedDepositChains } from "../types/generated/listing-backend";
import { getMarketListingStatusV2MarketListingStatusGet } from "../types/generated/listing-backend";
import { toListingStatus } from "./to-listing-status";

/**
 * Parameters for {@link getListingStatus}.
 *
 * Pool listing is chain-level, so this takes only a `chainId`: the listing
 * backend is resolved from the chain. A market is addressed by its token contract
 * address together with its deposit chain.
 */
export type GetListingStatusParameters = Compute<
  ChainIdParameter & {
    /**
     * The market's token contract address — the id that addresses a single market
     * in the listing API. An EVM `0x…` address, or a Solana base58 address for a
     * Solana-deposited listing. Together with
     * {@link GetListingStatusParameters.depositChain} it identifies the market.
     */
    tokenContractAddress: string;
    /**
     * The market's deposit chain — the chain the token lives on. Pairs with
     * {@link GetListingStatusParameters.tokenContractAddress} to identify the
     * market.
     */
    depositChain: ListingDepositChainId;
  }
>;

/** Return type of {@link getListingStatus}: the market's listing-pipeline status. */
export type GetListingStatusReturnType = ListingStatus;

/**
 * Fetch a market's **listing status** — its overall lifecycle status plus where it
 * sits in the backend's listing pipeline (the current step, all steps, retry
 * count/limit, and any step error).
 *
 * This is a public read (no bearer token) against
 * `/v2/market/listing-status`, keyed by the market's token address and deposit
 * chain. Poll it — via the hook's `refetchInterval` — to track a freshly created
 * pool as it moves from `WAITING_FOR_DEPOSIT` toward `LISTED`. Enigma-only.
 *
 * @param config - The SDK config.
 * @param parameters - The market's token contract address and deposit chain.
 * @returns The market's {@link ListingStatus}.
 * @throws {SymmApiError} `FETCH_LISTING_STATUS_FAILED` when the endpoint request fails.
 * @throws {SymmError} `LISTING_NOT_CONFIGURED` when the chain has no listing
 *   backend. Gate with `supportsListingService` to hide Pools instead.
 *
 * @example
 * ```ts
 * const status = await getListingStatus(config, {
 *   tokenContractAddress: "0x1234…",
 *   depositChain: ListingDepositChainId.HYPER_EVM,
 * });
 * ```
 */
export async function getListingStatus(config: Config, parameters: GetListingStatusParameters): Promise<ListingStatus> {
  const { url: baseURL } = resolveListingService(config, { chainId: parameters.chainId });

  try {
    const response = await getMarketListingStatusV2MarketListingStatusGet(
      {
        token_contract_address: parameters.tokenContractAddress,
        // Value-preserving: SupportedDepositChains shares the same numeric chain-id values as ListingDepositChainId.
        deposit_chain: parameters.depositChain as unknown as SupportedDepositChains,
      },
      { baseURL },
    );

    return toListingStatus(response.data);
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_LISTING_STATUS_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "FETCH_LISTING_STATUS_FAILED",
      `Failed to fetch the listing status: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
