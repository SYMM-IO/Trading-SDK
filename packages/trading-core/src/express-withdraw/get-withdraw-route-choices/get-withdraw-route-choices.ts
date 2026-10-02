import type { Config } from "../../core/config";
import { resolveWithdrawRoutes } from "../get-withdraw-route/resolve-withdraw-routes";
import type { GetWithdrawRouteChoicesParameters, WithdrawRouteChoices } from "../types";

/**
 * Prepare the automatic recommendation and all routes available for explicit selection.
 *
 * Unlike {@link getWithdrawRoute}, this action asks the Express service for
 * alternatives even when Classic is immediately available. It performs at most
 * one options request and preserves the existing automatic recommendation.
 *
 * @param config - SDK configuration.
 * @param parameters - Withdrawal intent and optional automatic-route policy.
 * @returns The automatic recommendation plus Classic and valid Express choices.
 * @throws {SymmError} `WITHDRAW_INSUFFICIENT_BALANCE` when `amount` (collateral base
 *   units, scaled to 18 decimals) exceeds a non-CUSTOM account's available balance.
 *   Every route debits that balance, so none is offered and no options request is made.
 */
export async function getWithdrawRouteChoices(
  config: Config,
  parameters: GetWithdrawRouteChoicesParameters,
): Promise<WithdrawRouteChoices> {
  return resolveWithdrawRoutes(config, parameters, { includeAlternatives: true });
}
