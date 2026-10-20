import { getFundingInfo as requestFundingInfo } from "../../types/generated/enigma-solver";
import { toMarketFundingInfo } from "../to-funding-info";
import type { EnigmaMarketFundingInfo } from "../types";
/** Fetch Enigma symbol-ID funding through its generated client. @internal */
export async function fetchEnigmaFundingInfo(
  baseURL: string,
  symbolIds?: readonly number[],
): Promise<EnigmaMarketFundingInfo[]> {
  const response = await requestFundingInfo(symbolIds ? { symbol_ids: [...symbolIds] } : undefined, {
    baseURL,
    // The solver accepts repeated keys, not Axios's default bracketed arrays.
    paramsSerializer: { indexes: null },
  });
  return Object.entries(response.data).flatMap(([key, raw]) => {
    const symbolId = Number(key);
    if (!Number.isSafeInteger(symbolId) || symbolId <= 0 || !raw || typeof raw !== "object") return [];
    return [toMarketFundingInfo(symbolId, raw)];
  });
}
