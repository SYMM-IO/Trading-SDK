import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError } from "../../shared/errors/symm-error";
import type { ChainIdParameter } from "../../shared/types/properties";
import { resolveListingService } from "../resolve-listing";
import type { PoolClaim } from "../types";
import { getClaimProfitV2ClaimClaimRequestIdGet } from "../types/generated/listing-backend";
import { toPoolClaim } from "./to-pool-claim";

/** Identity and bearer token for a single accepted claim. */
export type GetPoolClaimParameters = ChainIdParameter & { claimRequestId: string; accessToken: string };

/** Read a claim by its UUID, independently of a history page's current filters. */
export async function getPoolClaim(config: Config, parameters: GetPoolClaimParameters): Promise<PoolClaim> {
  const { url: baseURL } = resolveListingService(config, parameters);
  try {
    const { data } = await getClaimProfitV2ClaimClaimRequestIdGet(parameters.claimRequestId, {
      baseURL,
      headers: { Authorization: `Bearer ${parameters.accessToken}` },
    });
    return toPoolClaim(data);
  } catch (error) {
    if (isAxiosError(error)) throw SymmApiError.fromAxios(error, { code: "GET_POOL_CLAIM_FAILED", baseURL });
    throw error;
  }
}
