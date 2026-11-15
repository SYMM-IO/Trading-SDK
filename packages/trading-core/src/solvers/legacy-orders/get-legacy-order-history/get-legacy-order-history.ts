import type { Config } from "../../../core/config";
import { requestLegacyOrder, toLegacyOrder, type LegacyOrderWire } from "../internal";
import type { GetLegacyOrderHistoryParameters, LegacyOrderHistoryEntry } from "../types";

/**
 * Read stored-session order history. Does not sign in or change session state.
 * @param config - Selected deployment.
 * @param parameters - Account, token and explicit solver context.
 * @returns History in server order; sorting remains a consumer policy.
 */
export async function getLegacyOrderHistory(
  config: Config,
  parameters: GetLegacyOrderHistoryParameters,
): Promise<LegacyOrderHistoryEntry[]> {
  const rows = await requestLegacyOrder<Array<LegacyOrderWire & { status: LegacyOrderHistoryEntry["status"] }>>(
    config,
    parameters,
    { method: "GET", url: `/orders/${encodeURIComponent(parameters.account)}/history` },
  );
  return rows.map((row) => ({ ...toLegacyOrder(row), status: row.status }));
}
