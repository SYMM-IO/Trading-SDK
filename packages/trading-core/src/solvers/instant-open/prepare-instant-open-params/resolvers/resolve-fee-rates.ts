import type { Address } from "viem";
import type { Config } from "../../../../core/config";
import { getFeeForUser, type FeeForUser } from "../../../../symmio-contracts/symmio/actions/get-fee-for-user";
import type { ComputePlatformFeeRates } from "../../shared/trade-math";

/**
 * Parameters for {@link resolveFeeRates}.
 */
export interface ResolveFeeRatesParameters {
  chainId?: number;
  subAccountAddress: Address;
  marketId: number;
  /**
   * Pre-fetched on-chain fee rates (matches `getFeeForUser` return shape).
   * When supplied, the fetch is skipped.
   */
  feeRates?: FeeForUser;
}

/**
 * Resolve `openFee` / `closeFee` rates. Returns caller-supplied values when
 * present; otherwise calls `getFeeForUser` on-chain.
 */
export async function resolveFeeRates(
  config: Config,
  parameters: ResolveFeeRatesParameters,
): Promise<ComputePlatformFeeRates> {
  if (parameters.feeRates) {
    return { openFee: parameters.feeRates.openFee, closeFee: parameters.feeRates.closeFee };
  }

  const fee = await getFeeForUser(config, {
    chainId: parameters.chainId,
    user: parameters.subAccountAddress,
    symbolId: BigInt(parameters.marketId),
  });
  return { openFee: fee.openFee, closeFee: fee.closeFee };
}
