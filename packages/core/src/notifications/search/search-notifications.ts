import axios, { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import type { NotificationDocument, NotificationSearchFilter, NotificationSearchResult } from "../types";

/**
 * Parameters for {@link searchNotifications}.
 */
export type SearchNotificationsParameters = Compute<
  ChainIdParameter & {
    /**
     * Equality filter sent as the request `query`; see {@link NotificationSearchFilter}.
     * Named `filter` (not `query`) so it never collides with the TanStack
     * `query` overrides on the matching query-options factory.
     */
    filter: NotificationSearchFilter;
    /** Maximum number of results to return (1–100). Defaults to 100 (the backend default). */
    size?: number;
    /** Zero-based offset of the first result. Defaults to 0. */
    start?: number;
    /**
     * Override the notification-search base URL. Defaults to the chain config's
     * `notifications.searchUrl`. The action appends `/api/v1/search`.
     */
    baseUrl?: string;
  }
>;

/** Return type of {@link searchNotifications}. */
export type SearchNotificationsReturnType = NotificationSearchResult;

/** Raw shape of the notification service's `POST /api/v1/search` response. */
interface NotificationsSearchResponse {
  total: number;
  count: number;
  data: NotificationDocument[];
}

/**
 * Search stored notifications via the notification service's
 * `POST /api/v1/search` endpoint.
 *
 * The filter is a free-form equality match over the stored document: every key
 * is compared exactly, whether it is a top-level field (`app_name`, `address`,
 * `type`, …) or a dotted path into the nested payload (`data.temp_quote_id`,
 * `data.quote_id`, …). Known fields are offered as autocomplete; any other
 * string key is still accepted.
 *
 * The base URL resolves from the chain config's `notifications.searchUrl`, or
 * the per-call `baseUrl` override.
 *
 * @param config - The SDK config.
 * @param parameters - `filter`, optional `size` / `start` pagination, optional
 *   `chainId`, optional `baseUrl`.
 * @returns The matched documents plus `total` and `count`.
 * @throws {SymmApiError} when the search request fails.
 * @throws {SymmError} when no search URL is configured for the chain and no
 *   `baseUrl` is passed.
 *
 * @example
 * ```ts
 * const { documents, total } = await searchNotifications(config, {
 *   filter: { app_name: "Base_Superflow_Stage", "data.temp_quote_id": -172 },
 *   size: 50,
 * });
 * ```
 */
export async function searchNotifications(
  config: Config,
  parameters: SearchNotificationsParameters,
): Promise<SearchNotificationsReturnType> {
  const { notifications } = config.getChainConfig(parameters.chainId);
  const baseURL = parameters.baseUrl ?? notifications.searchUrl;
  if (!baseURL) {
    throw new SymmError(
      "config",
      "NOTIFICATION_SEARCH_URL_NOT_CONFIGURED",
      "No notification search URL is configured for this chain. Set `notifications.searchUrl` in the chain config or pass `baseUrl`.",
    );
  }

  try {
    const response = await axios.post<NotificationsSearchResponse>(
      "/api/v1/search",
      { query: parameters.filter, size: parameters.size, start: parameters.start },
      { baseURL },
    );
    const { total, count, data } = response.data;
    return { total, count, documents: data ?? [] };
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "SEARCH_NOTIFICATIONS_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "SEARCH_NOTIFICATIONS_FAILED",
      `Failed to search notifications: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
