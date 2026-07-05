import { toFiniteNumber } from "@symmio/utils/number";
import type { ApiFundingInfoResponse } from "../types/generated/enigma-solver";
import type { MarketFundingInfo } from "./types";

/** One market's raw entry from `ApiFundingInfoResponse` (the map value). */
type RawFundingInfo = ApiFundingInfoResponse[string];

/**
 * Map one `ApiFundingInfoResponse` entry (keyed by market name) into the SDK's
 * {@link MarketFundingInfo}. Missing numeric fields default to `0`.
 *
 * @param symbol - The market name (the response map key).
 * @param raw - The raw funding entry for that market.
 */
export function toMarketFundingInfo(symbol: string, raw: RawFundingInfo): MarketFundingInfo {
  return {
    symbol,
    nextFundingRateLong: toFiniteNumber(raw.next_funding_rate_long),
    nextFundingRateShort: toFiniteNumber(raw.next_funding_rate_short),
    nextFundingTime: toFiniteNumber(raw.next_funding_time),
    epochDurationSeconds: toFiniteNumber(raw.funding_rate_epoch_duration),
  };
}
