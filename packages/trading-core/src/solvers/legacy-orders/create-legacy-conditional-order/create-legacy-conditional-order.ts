import type { Config } from "../../../core/config";
import { requestLegacyOrder, toLegacyOrder, toLegacyOrderWire, type LegacyOrderWire } from "../internal";
import type { CreateLegacyConditionalOrderParameters, LegacyConditionalOrder } from "../types";

/**
 * Submit a legacy bearer-authenticated order. Prefer signed TP/SL APIs for new integrations.
 * @param config - Selected deployment.
 * @param parameters - Existing credential and order in human decimal units.
 * @returns Accepted order; HTTP acceptance does not establish execution.
 */
export async function createLegacyConditionalOrder(
  config: Config,
  parameters: CreateLegacyConditionalOrderParameters,
): Promise<LegacyConditionalOrder> {
  return toLegacyOrder(
    await requestLegacyOrder<LegacyOrderWire>(config, parameters, {
      method: "POST",
      url: "/orders",
      data: toLegacyOrderWire(parameters.order),
    }),
  );
}
