import { isAxiosError } from "axios";
import type { Address } from "viem";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { Compute, ReadSolverParameter } from "../../shared/types/properties";
import { assertSolverKind } from "../assert-solver-kind";
import {
  searchNotificationNotificationsStartSizePost,
  type NotificationsSearchResponseSchema,
} from "../types/generated/rasa-solver";

/** Parameters for {@link searchSolverNotifications}. */
export type SearchSolverNotificationsParameters = Compute<
  ReadSolverParameter & {
    /** Page offset (row index to start from). */
    start: number;
    /** Page size (number of rows). */
    size: number;
    /** Filter: counterparty (subaccount) address. */
    counterpartyAddress?: Address;
    /** Filter: on-chain quote id. */
    quoteId?: number;
    /** Filter: emitted at/after this unix timestamp. */
    timestampGte?: number;
  }
>;

/** Return type of {@link searchSolverNotifications}. */
export type SearchSolverNotificationsReturnType = NotificationsSearchResponseSchema;

/**
 * Search the solver's own notification log (paged) via the Rasa-only
 * `POST /notifications/{start}/{size}` endpoint. This is the SOLVER's log —
 * distinct from the standalone notification service behind
 * `searchNotifications`.
 *
 * @param config - The SDK config.
 * @param parameters - Paging plus optional filters and chain/solver.
 * @returns `{ count, notification_data }` page.
 * @throws {SymmError} `UNSUPPORTED_BY_SOLVER` when the resolved solver is not a `rasa` solver.
 * @throws {SymmApiError} when the API request fails.
 */
export async function searchSolverNotifications(
  config: Config,
  parameters: SearchSolverNotificationsParameters,
): Promise<SearchSolverNotificationsReturnType> {
  const solver = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId });
  assertSolverKind(solver, "rasa", "searchSolverNotifications");
  try {
    const response = await searchNotificationNotificationsStartSizePost(
      parameters.start,
      parameters.size,
      {
        counterparty_address: parameters.counterpartyAddress ?? null,
        quote_id: parameters.quoteId ?? null,
        timestamp_gte: parameters.timestampGte ?? null,
      },
      { baseURL: solver.url },
    );
    return response.data;
  } catch (err) {
    if (err instanceof SymmError) throw err;
    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "SEARCH_SOLVER_NOTIFICATIONS_FAILED", baseURL: solver.url });
    }
    throw new SymmError(
      "api",
      "SEARCH_SOLVER_NOTIFICATIONS_FAILED",
      `Failed to search solver notifications: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
