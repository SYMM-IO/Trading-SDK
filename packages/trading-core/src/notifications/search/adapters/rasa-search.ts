import { isAxiosError } from "axios";
import type { SymmioResolvedSolver } from "../../../core/chains";
import { SymmApiError, SymmError } from "../../../shared/errors/symm-error";
import { searchPositionStatePositionStateStartSizePost } from "../../../solvers/types/generated/rasa-solver";
import type { RasaNotificationSearchResult, SearchNotificationsParameters } from "../types";

/**
 * Search a rasa solver's notification history via its own position-state
 * endpoint (`POST /position-state/{start}/{size}`) — the rasa protocol's
 * notification search. `timestampGte` filters on the record's create time.
 *
 * @throws {SymmApiError} when the request fails.
 *
 * @internal
 */
export async function searchRasaNotifications(
  solver: SymmioResolvedSolver,
  parameters: SearchNotificationsParameters,
): Promise<RasaNotificationSearchResult> {
  try {
    const response = await searchPositionStatePositionStateStartSizePost(
      parameters.start ?? 0,
      parameters.size ?? 100,
      {
        address: parameters.account ?? null,
        quote_id: parameters.quoteId ?? null,
        create_time_gte: parameters.timestampGte ?? null,
        modify_time_gte: null,
      },
      { baseURL: solver.url },
    );
    return { kind: "rasa", count: response.data.count, rows: response.data.position_state };
  } catch (err) {
    if (err instanceof SymmError) throw err;
    if (isAxiosError(err))
      throw SymmApiError.fromAxios(err, { code: "SEARCH_NOTIFICATIONS_FAILED", baseURL: solver.url });
    throw new SymmError(
      "api",
      "SEARCH_NOTIFICATIONS_FAILED",
      `Failed to search notifications: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
