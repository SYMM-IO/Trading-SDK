import type { Config } from "../../../core/config";
import { requestLegacyOrder } from "../internal";
import type { GetLegacyCollateralLockedParameters } from "../types";

/**
 * Read legacy conditional-order locked collateral without introducing a zero fallback.
 * @param config - Selected deployment.
 * @param parameters - PartyA/account, stored token and solver context.
 * @returns Human decimal collateral string supplied by the service.
 */
export async function getLegacyCollateralLocked(
  config: Config,
  parameters: GetLegacyCollateralLockedParameters,
): Promise<string> {
  const row = await requestLegacyOrder<{ collateral_locked: string }>(config, parameters, {
    method: "GET",
    url: `/${encodeURIComponent(parameters.account)}/collateral-locked`,
  });
  return row.collateral_locked;
}
