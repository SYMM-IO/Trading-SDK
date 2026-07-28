import { isAxiosError } from "axios";
import type { Address } from "viem";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { Compute, ReadSolverParameter } from "../../shared/types/properties";
import { assertSolverKind } from "../assert-solver-kind";
import {
  searchPositionStatePositionStateStartSizePost,
  type PositionsStateOutputSchema,
} from "../types/generated/rasa-solver";

/** Parameters for {@link searchPositionStates}. */
export type SearchPositionStatesParameters = Compute<
  ReadSolverParameter & {
    /** Page offset (row index to start from). */
    start: number;
    /** Page size (number of rows). */
    size: number;
    /** Filter: counterparty (subaccount) address. */
    address?: Address;
    /** Filter: on-chain quote id. */
    quoteId?: number;
    /** Filter: created at/after this unix timestamp. */
    createTimeGte?: number;
    /** Filter: modified at/after this unix timestamp. */
    modifyTimeGte?: number;
  }
>;

/** Return type of {@link searchPositionStates}. */
export type SearchPositionStatesReturnType = PositionsStateOutputSchema;

/**
 * Search the solver's position-state records (paged) via the Rasa-only
 * `POST /position-state/{start}/{size}` endpoint.
 *
 * @param config - The SDK config.
 * @param parameters - Paging plus optional filters and chain/solver.
 * @returns `{ count, position_state }` page.
 * @throws {SymmError} `UNSUPPORTED_BY_SOLVER` when the resolved solver is not a `rasa` solver.
 * @throws {SymmApiError} when the API request fails.
 */
export async function searchPositionStates(
  config: Config,
  parameters: SearchPositionStatesParameters,
): Promise<SearchPositionStatesReturnType> {
  const solver = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId });
  assertSolverKind(solver, "rasa", "searchPositionStates");
  try {
    const response = await searchPositionStatePositionStateStartSizePost(
      parameters.start,
      parameters.size,
      {
        address: parameters.address ?? null,
        quote_id: parameters.quoteId ?? null,
        create_time_gte: parameters.createTimeGte ?? null,
        modify_time_gte: parameters.modifyTimeGte ?? null,
      },
      { baseURL: solver.url },
    );
    return response.data;
  } catch (err) {
    if (err instanceof SymmError) throw err;
    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "SEARCH_POSITION_STATES_FAILED", baseURL: solver.url });
    }
    throw new SymmError(
      "api",
      "SEARCH_POSITION_STATES_FAILED",
      `Failed to search position states: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
