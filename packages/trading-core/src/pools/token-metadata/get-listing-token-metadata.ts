import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter } from "../../shared/types/properties";
import { resolveListingService } from "../resolve-listing";
import { getTokenMetaDataV2MarketTokenMetaDataGet } from "../types/generated/listing-backend";

/** Listing token metadata; price retains the service's decimal string without rounding. */
export interface ListingTokenMetadata {
  /** Token address, preserving Solana case. */ tokenContractAddress: string;
  /** Chain the token lives on. */ depositChain: number;
  /** Display name. */ tokenName: string;
  /** Ticker when known. */ tokenTicker: string | null;
  /** Token's own decimals. */ decimals: number | null;
  /** Service price, not a selected display price. */ price: string | null;
}
/** Inputs for {@link getListingTokenMetadata}. Deployment chainId is separate from depositChain. */
export type GetListingTokenMetadataParameters = ChainIdParameter & {
  /** Token address on the deposit chain. */
  tokenContractAddress: string;
  /** Token's chain, including Solana's zero sentinel. */
  depositChain: number;
  /** Listing bearer token. */
  accessToken: string;
};
/** Result of {@link getListingTokenMetadata}. */
export type GetListingTokenMetadataReturnType = ListingTokenMetadata;

/**
 * Read token metadata from the configured listing service.
 * @param config - SDK configuration.
 * @param parameters - Token identity and request parameters.
 * @returns The normalized service result.
 * @example
 * await getListingTokenMetadata(config, { chainId: 42161, depositChain: 0, tokenContractAddress: mint, accessToken: token });
 */
export async function getListingTokenMetadata(
  config: Config,
  parameters: GetListingTokenMetadataParameters,
): Promise<GetListingTokenMetadataReturnType> {
  const { url: baseURL } = resolveListingService(config, { chainId: parameters.chainId });
  try {
    const { data } = await getTokenMetaDataV2MarketTokenMetaDataGet(
      { contract_address: parameters.tokenContractAddress, chain: parameters.depositChain },
      { baseURL, headers: { Authorization: `Bearer ${parameters.accessToken}` } },
    );
    return {
      tokenContractAddress: data.token_contract_address,
      depositChain: data.chain,
      tokenName: data.token_name,
      tokenTicker: data.token_ticker,
      decimals: data.decimals ?? null,
      price: data.price ?? null,
    };
  } catch (error) {
    if (error instanceof SymmError) throw error;
    if (isAxiosError(error))
      throw SymmApiError.fromAxios(error, { code: "GET_LISTING_TOKEN_METADATA_FAILED", baseURL });
    throw new SymmError("api", "GET_LISTING_TOKEN_METADATA_FAILED", "Listing request failed", { cause: error });
  }
}
