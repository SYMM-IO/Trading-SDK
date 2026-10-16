import type { Config } from "../../core/config";
import type { GetWithdrawRouteParameters, WithdrawRoute } from "../types";
import { resolveWithdrawRoutes } from "./resolve-withdraw-routes";

/**
 * Select the safest withdrawal route without submitting a transaction.
 *
 * @param config - SDK configuration.
 * @param parameters - Withdrawal intent and optional route policy.
 * @returns A classic or signed Express route ready for display/submission.
 * @throws {SymmError} `WITHDRAW_INSUFFICIENT_BALANCE` when `amount` (collateral base
 *   units, scaled to 18 decimals) exceeds a non-CUSTOM account's available balance.
 *   Every route debits that balance, so none is returned, whatever `policy.fallback` says.
 */
export async function getWithdrawRoute(config: Config, parameters: GetWithdrawRouteParameters): Promise<WithdrawRoute> {
  return (await resolveWithdrawRoutes(config, parameters, { includeAlternatives: false })).recommended;
}
