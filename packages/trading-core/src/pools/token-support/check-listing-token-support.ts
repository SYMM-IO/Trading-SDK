import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter } from "../../shared/types/properties";
import { resolveListingService } from "../resolve-listing";
import { checkTokenSupportV2MarketTokenSupportGet } from "../types/generated/listing-backend";

/** Inputs for {@link checkListingTokenSupport}. Deployment chainId is separate from depositChain. */
export type CheckListingTokenSupportParameters = ChainIdParameter & {
  /** Token address on the deposit chain. */
  tokenContractAddress: string;
  /** Token's chain, including Solana's zero sentinel. */
  depositChain: number;
  /** Listing bearer token. */
  accessToken: string;
};
/** Result of {@link checkListingTokenSupport}. */
export type CheckListingTokenSupportReturnType = boolean;

/**
 * Check whether the listing service accepts a token, including errors returned with HTTP 200.
 * @param config - SDK configuration.
 * @param parameters - Token identity and request parameters.
 * @returns The normalized service result.
 * @example
 * await checkListingTokenSupport(config, { chainId: 42161, depositChain: 0, tokenContractAddress: mint, accessToken: token });
 */
export async function checkListingTokenSupport(
  config: Config,
  parameters: CheckListingTokenSupportParameters,
): Promise<CheckListingTokenSupportReturnType> {
  const { url: baseURL } = resolveListingService(config, { chainId: parameters.chainId });
  try {
    const { data } = await checkTokenSupportV2MarketTokenSupportGet(
      { contract_address: parameters.tokenContractAddress, chain: parameters.depositChain },
      { baseURL, headers: { Authorization: `Bearer ${parameters.accessToken}` } },
    );
    if (typeof data === "object" && data !== null && "error_code" in data && typeof data.error_code === "number") {
      throw new SymmApiError({
        code: "LISTING_TOKEN_SUPPORT_FAILED",
        message:
          "error_message" in data && typeof data.error_message === "string"
            ? data.error_message
            : "Token support check failed",
        status: 200,
        statusText: "OK",
        responseData: data,
        url: baseURL + "/v2/market/token-support",
        method: "GET",
      });
    }
    return true;
  } catch (error) {
    if (error instanceof SymmError) throw error;
    if (isAxiosError(error))
      throw SymmApiError.fromAxios(error, { code: "CHECK_LISTING_TOKEN_SUPPORT_FAILED", baseURL });
    throw new SymmError("api", "CHECK_LISTING_TOKEN_SUPPORT_FAILED", "Listing request failed", { cause: error });
  }
}
