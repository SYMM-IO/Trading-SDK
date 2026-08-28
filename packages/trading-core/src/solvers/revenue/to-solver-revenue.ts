import { toFiniteNumber } from "@symmio/utils/number";
import type { ApiRevenueResponse } from "../types/generated/enigma-solver";
import type { SolverRevenue } from "./types";

/**
 * Map the solver's `/revenue` response into the SDK's {@link SolverRevenue}.
 *
 * Every field is optional in the generated schema, so each defaults to `0` — the
 * solver omits a dimension rather than sending a zero when it has nothing for it.
 *
 * @param raw - The raw `/revenue` (or `/revenue/{symbolId}`) response body.
 * @returns The normalized revenue totals.
 */
export function toSolverRevenue(raw: ApiRevenueResponse): SolverRevenue {
  return {
    totalRevenue: toFiniteNumber(raw.total_revenue),
    hedgerFeeRevenue: toFiniteNumber(raw.hedger_fee_revenue),
    fundingRevenue: toFiniteNumber(raw.funding_revenue),
    recordCount: toFiniteNumber(raw.record_count),
  };
}
