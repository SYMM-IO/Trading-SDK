import type { Config } from "../../core/config";
import type { ReadSolverParameter } from "../../shared/types/properties";
import { finite, invalid, readEnigma, record, symbolId } from "../read";

/** Parameters for the Enigma symbol-ID funding read. */
export type GetEnigmaFundingInfoParameters = ReadSolverParameter;
/** Advertised per-epoch funding. Decimal rates retain their original precision. */
export interface EnigmaSymbolFunding {
  symbolId: number;
  fundingRate: string;
  nextFundingTime: number;
  nextFundingRateLong?: string;
  nextFundingRateShort?: string;
  epochDurationSeconds?: number;
  accumulatedFundingRate?: string;
}
/** All advertised funding rows, identified by symbol ID. */
export type GetEnigmaFundingInfoReturnType = EnigmaSymbolFunding[];
/** Read `/funding-info`; never associate a rate through a display ticker. */
export async function getEnigmaFundingInfo(
  config: Config,
  parameters: GetEnigmaFundingInfoParameters = {},
): Promise<GetEnigmaFundingInfoReturnType> {
  const data = record(await readEnigma(config, parameters, "/funding-info"));
  if (!data) invalid("Invalid funding-info response");
  const result: EnigmaSymbolFunding[] = [];
  for (const [key, value] of Object.entries(data)) {
    const id = symbolId(key),
      row = record(value);
    if (id === undefined || !row || !("next_funding_time" in row)) continue;
    result.push({
      symbolId: id,
      fundingRate: String(row.next_funding_rate_long ?? row.funding_rate ?? "0"),
      nextFundingTime: finite(row.next_funding_time),
      ...(row.next_funding_rate_long != null ? { nextFundingRateLong: String(row.next_funding_rate_long) } : {}),
      ...(row.next_funding_rate_short != null ? { nextFundingRateShort: String(row.next_funding_rate_short) } : {}),
      ...(row.funding_rate_epoch_duration != null
        ? { epochDurationSeconds: finite(row.funding_rate_epoch_duration) }
        : {}),
      ...(row.accumulated_funding_rate != null ? { accumulatedFundingRate: String(row.accumulated_funding_rate) } : {}),
    });
  }
  return result;
}
