import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { resolveListingService } from "../resolve-listing";
import type { ListingDepositChainId, ListingMarketDetail } from "../types";
import { getMarketV2MarketGet } from "../types/generated/listing-backend";
import { toListingMarketDetail } from "./to-listing-market-detail";

/**
 * Parameters for {@link getListingMarketDetail}.
 *
 * A pool is addressed by its token **and** the chain it was deposited on: the
 * same token contract can be listed from more than one chain, so neither half
 * identifies a pool on its own.
 */
export type GetListingMarketDetailParameters = Compute<
  ChainIdParameter & {
    /**
     * The pool's token contract address. An EVM `0x…` address, or a Solana
     * base58 address for a Solana-deposited listing.
     */
    tokenContractAddress: string;
    /** The chain the token was deposited on. */
    depositChain: ListingDepositChainId;
  }
>;

/** Return type of {@link getListingMarketDetail}: one pool's public detail. */
export type GetListingMarketDetailReturnType = ListingMarketDetail;

/**
 * Fetch one pool's public detail — its aggregate stats (TVL, APY and reward
 * windows, solver revenue, pool balances, active LPs, age) and the inventory
 * position behind it.
 *
 * This is the read a pool page is built on. Fold the position fields into table
 * rows with `toPoolPositions`, which is a pure reshape and costs no extra
 * request.
 *
 * Public — no bearer token. Listed pools report live inventory balances;
 * a **delisted** pool returns cached remaining balances with `tvl` fixed at
 * zero.
 *
 * @param config - The SDK config.
 * @param parameters - The pool's token contract address and deposit chain.
 * @returns The pool's {@link ListingMarketDetail}.
 * @throws {SymmApiError} when the endpoint request fails.
 * @throws {SymmError} `LISTING_NOT_CONFIGURED` when the chain has no listing
 *   backend. Gate with `supportsListingService` to hide Pools instead.
 *
 * @example
 * ```ts
 * const detail = await getListingMarketDetail(config, {
 *   tokenContractAddress: "0x800822d361335b4d5F352Dac293cA4128b5B605f",
 *   depositChain: ListingDepositChainId.BASE,
 * });
 * ```
 */
export async function getListingMarketDetail(
  config: Config,
  parameters: GetListingMarketDetailParameters,
): Promise<GetListingMarketDetailReturnType> {
  const { url: baseURL } = resolveListingService(config, { chainId: parameters.chainId });

  try {
    const response = await getMarketV2MarketGet(
      {
        token_contract_address: parameters.tokenContractAddress,
        deposit_chain: parameters.depositChain,
      },
      { baseURL },
    );

    return toListingMarketDetail(response.data);
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_LISTING_MARKET_DETAIL_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "FETCH_LISTING_MARKET_DETAIL_FAILED",
      `Failed to fetch listing market detail: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
