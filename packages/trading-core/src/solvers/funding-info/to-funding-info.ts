import { toFiniteNumber } from "@symmio/utils/number";
import type { ApiFundingInfoResponse } from "../types/generated/enigma-solver";
import type { EnigmaMarketFundingInfo } from "./types";

/** One market's raw entry from `ApiFundingInfoResponse` (the map value). */
type RawFundingInfo = ApiFundingInfoResponse[string];

/**
 * Map one `ApiFundingInfoResponse` entry (keyed by symbol ID) into the SDK's
 * {@link MarketFundingInfo}. Missing numeric fields default to `0`.
 *
 * @param symbolId - The market ID (the response map key).
 * @param raw - The raw funding entry for that market.
 * @returns Funding figures identified by symbol ID, with unchanged rate/time units.
 * @throws Does not throw for a valid funding entry.
 * @example
 * toMarketFundingInfo(12, { next_funding_rate_long: "0.001", next_funding_time: 1783209600000 });
 */
export function toMarketFundingInfo(symbolId: number, raw: RawFundingInfo): EnigmaMarketFundingInfo {
  return {
    kind: "enigma",
    symbolId,
    nextFundingRateLong: toFiniteNumber(raw.next_funding_rate_long),
    nextFundingRateShort: toFiniteNumber(raw.next_funding_rate_short),
    nextFundingTime: toFiniteNumber(raw.next_funding_time),
    epochDurationSeconds: toFiniteNumber(raw.funding_rate_epoch_duration),
  };
}
