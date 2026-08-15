import type { SolverId } from "../../core/chains";
import type { Config } from "../../core/config";
import { searchEnigmaNotifications } from "./adapters/enigma-search";
import { searchRasaNotifications } from "./adapters/rasa-search";
import type { SearchNotificationsParameters, SearchNotificationsReturnType } from "./types";

export type {
  EnigmaNotificationSearchResult,
  NotificationSearchResult,
  NotificationSearchResultByKind,
  RasaNotificationSearchResult,
  SearchNotificationsParameters,
  SearchNotificationsReturnType,
} from "./types";

/**
 * Search stored notifications for a solver, dispatched by kind:
 *
 * - **enigma** → the standalone notification service (`POST /api/v1/search`),
 *   returning the matched documents.
 * - **rasa** → the solver's own position-state endpoint
 *   (`POST /position-state/{start}/{size}`), returning position-state rows.
 *
 * One interface for both: pass the common filters (`account`, `quoteId`,
 * `tempQuoteId`, `timestampGte`) plus `start`/`size`; the SDK maps them to the
 * resolved solver's native query. The result is a per-kind union — pass a
 * **literal** `solverId` to narrow it to that kind's variant, or narrow on the
 * returned `kind` discriminant.
 *
 * @param config - The SDK config.
 * @param parameters - Solver target, common filters, and pagination.
 * @returns `{ kind, count, rows, … }` — the enigma or rasa result variant.
 * @throws {SymmError} `NOTIFICATION_SEARCH_URL_NOT_CONFIGURED` (enigma) when no
 *   search URL is configured and no `baseUrl` is passed.
 * @throws {SymmApiError} when the search request fails.
 *
 * @example
 * ```ts
 * // chain default solver → the union; narrow on `kind`
 * const page = await searchNotifications(config, { account, quoteId: 1024 });
 *
 * // literal solverId → the exact variant
 * const rasa = await searchNotifications(config, { solverId: "rasa", account }); // RasaNotificationSearchResult
 * ```
 */
export async function searchNotifications<K extends SolverId = SolverId>(
  config: Config,
  parameters: SearchNotificationsParameters<K>,
): Promise<SearchNotificationsReturnType<K>> {
  const solver = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId });
  switch (solver.id) {
    case "enigma":
      return searchEnigmaNotifications(solver, parameters) as Promise<SearchNotificationsReturnType<K>>;
    case "rasa":
      return searchRasaNotifications(solver, parameters) as Promise<SearchNotificationsReturnType<K>>;
  }
}
