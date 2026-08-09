import axios, { isAxiosError } from "axios";
import type { SymmioResolvedSolver } from "../../../core/chains";
import { SymmApiError, SymmError } from "../../../shared/errors/symm-error";
import type { NotificationDocument, NotificationSearchFilter } from "../../types";
import type { EnigmaNotificationSearchResult, SearchNotificationsParameters } from "../types";

/** Raw shape of the notification service's `POST /api/v1/search` response. */
interface EnigmaSearchResponse {
  total: number;
  count: number;
  data: NotificationDocument[];
}

/** Map the unified common filters onto the enigma service's equality filter. */
function toEnigmaFilter(parameters: SearchNotificationsParameters): NotificationSearchFilter {
  const filter: NotificationSearchFilter = { ...parameters.filter };
  if (parameters.account !== undefined) filter.address = parameters.account;
  if (parameters.quoteId !== undefined) filter["data.quote_id"] = parameters.quoteId;
  if (parameters.tempQuoteId !== undefined) filter["data.temp_quote_id"] = parameters.tempQuoteId;
  return filter;
}

/**
 * Search an enigma solver's stored notifications via the standalone notification
 * service's `POST /api/v1/search`. The base URL resolves from the solver's
 * `notifications.searchUrl`, or the per-call `baseUrl` override.
 *
 * @throws {SymmError} `NOTIFICATION_SEARCH_URL_NOT_CONFIGURED` when neither is set.
 * @throws {SymmApiError} when the request fails.
 *
 * @internal
 */
export async function searchEnigmaNotifications(
  solver: SymmioResolvedSolver,
  parameters: SearchNotificationsParameters,
): Promise<EnigmaNotificationSearchResult> {
  const baseURL = parameters.baseUrl ?? solver.notifications.searchUrl;
  if (!baseURL) {
    throw new SymmError(
      "config",
      "NOTIFICATION_SEARCH_URL_NOT_CONFIGURED",
      "No notification search URL is configured for this solver. Set `notifications.searchUrl` in the solver config or pass `baseUrl`.",
    );
  }

  try {
    const response = await axios.post<EnigmaSearchResponse>(
      "/api/v1/search",
      { query: toEnigmaFilter(parameters), size: parameters.size, start: parameters.start },
      { baseURL },
    );
    const { total, count, data } = response.data;
    return { kind: "enigma", total: total ?? 0, count: count ?? 0, rows: data ?? [] };
  } catch (err) {
    if (err instanceof SymmError) throw err;
    if (isAxiosError(err)) throw SymmApiError.fromAxios(err, { code: "SEARCH_NOTIFICATIONS_FAILED", baseURL });
    throw new SymmError(
      "api",
      "SEARCH_NOTIFICATIONS_FAILED",
      `Failed to search notifications: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
