import type { ApiRevenueRecordItem } from "../types/generated/enigma-solver";
import type { SolverRevenueRecord } from "./types";

/**
 * Map one raw `ApiRevenueRecordItem` from the solver's `/revenue/records`
 * response into the SDK's normalized {@link SolverRevenueRecord}. Missing fields
 * default to `0` (numbers) or `""` (strings).
 *
 * @param raw - The raw revenue record item.
 */
export function toRevenueRecord(raw: ApiRevenueRecordItem): SolverRevenueRecord {
  return {
    id: raw.id ?? 0,
    symbolId: raw.symbol_id ?? 0,
    amount: raw.amount ?? "0",
    createdAt: raw.created_at ?? "",
  };
}
