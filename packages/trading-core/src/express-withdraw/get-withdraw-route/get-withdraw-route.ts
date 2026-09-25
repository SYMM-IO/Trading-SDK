import type { Config } from "../../core/config";
import type { GetWithdrawRouteParameters, WithdrawRoute } from "../types";
import { resolveWithdrawRoutes } from "./resolve-withdraw-routes";

/**
 * Select the safest withdrawal route without submitting a transaction.
 *
 * @param config - SDK configuration.
 * @param parameters - Withdrawal intent and optional route policy.
 * @returns A classic or signed Express route ready for display/submission.
 */
export async function getWithdrawRoute(config: Config, parameters: GetWithdrawRouteParameters): Promise<WithdrawRoute> {
  return (await resolveWithdrawRoutes(config, parameters, { includeAlternatives: false })).recommended;
}
