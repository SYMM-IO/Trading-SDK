import { toFiniteNumber } from "@symmio/utils/number";
import { getFundingInfoGetFundingInfoGet } from "../../types/generated/rasa-solver";
import type { RasaMarketFundingInfo } from "../types";
/** Fetch Rasa's existing ticker-based funding response. @internal */
export async function fetchRasaFundingInfo(
  baseURL: string,
  symbols?: readonly string[],
): Promise<RasaMarketFundingInfo[]> {
  const response = await getFundingInfoGetFundingInfoGet(symbols ? { symbols: [...symbols] } : undefined, {
    baseURL,
    paramsSerializer: { indexes: null },
  });
  return Object.entries(response.data).map(([symbol, raw]) => ({
    kind: "rasa",
    symbol,
    nextFundingRateLong: toFiniteNumber(raw.next_funding_rate_long),
    nextFundingRateShort: toFiniteNumber(raw.next_funding_rate_short),
    nextFundingTime: toFiniteNumber(raw.next_funding_time),
    epochDurationSeconds: toFiniteNumber(raw.funding_rate_epoch_duration),
  }));
}
