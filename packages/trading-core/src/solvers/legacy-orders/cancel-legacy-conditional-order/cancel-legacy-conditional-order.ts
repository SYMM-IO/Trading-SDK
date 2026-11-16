import type { Config } from "../../../core/config";
import { requestLegacyOrder } from "../internal";
import type { CancelLegacyConditionalOrderParameters } from "../types";

/**
 * Cancel a legacy bearer-authenticated order.
 * @param config - Selected deployment.
 * @param parameters - Stored credential and handler order identifier.
 * @returns True when the handler accepts the delete; settlement is event-owned.
 */
export async function cancelLegacyConditionalOrder(
  config: Config,
  parameters: CancelLegacyConditionalOrderParameters,
): Promise<boolean> {
  await requestLegacyOrder<unknown>(config, parameters, {
    method: "DELETE",
    url: `/orders/${encodeURIComponent(parameters.orderId)}`,
  });
  return true;
}
