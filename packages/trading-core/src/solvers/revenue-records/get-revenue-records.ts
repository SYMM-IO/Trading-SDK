import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { Compute, ReadSolverParameter } from "../../shared/types/properties";
import { assertSolverKind } from "../assert-solver-kind";
import { getRevenueRecords as requestRevenueRecords } from "../types/generated/enigma-solver";
import { toRevenueRecord } from "./to-revenue-record";
import type { GetRevenueRecordsReturnType } from "./types";

/**
 * Parameters for {@link getRevenueRecords}.
 */
export type GetRevenueRecordsParameters = Compute<
  ReadSolverParameter & {
    /** Last-seen revenue record id, used as the cursor for the next page. */
    id?: number;
    /** Restrict the result to these market symbol ids (max 100). */
    symbolIds?: readonly number[];
    /** Number of records to skip before the page. */
    offset?: number;
    /** Maximum number of records to return (max 500, default 100). */
    limit?: number;
  }
>;

/**
 * Fetch incremental revenue records from the chain's solver `/revenue/records`
 * endpoint. Records are cursor-paginated: pass the `id` of the last record seen
 * to fetch the next page. The solver base URL is resolved from `config` per
 * call, so multiple chains never clobber each other.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain id, cursor `id`, `symbolIds` filter, and paging.
 * @returns The page of normalized revenue records plus the total available count.
 * @throws {SymmApiError} when the API request fails.
 * @throws {SymmError} when the chain is unsupported.
 *
 * @example
 * ```ts
 * const { records, count } = await getRevenueRecords(config, { limit: 50 });
 * const nextCursor = records.at(-1)?.id;
 * ```
 */
export async function getRevenueRecords(
  config: Config,
  parameters: GetRevenueRecordsParameters = {},
): Promise<GetRevenueRecordsReturnType> {
  const solver = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId });
  assertSolverKind(solver, "enigma", "getRevenueRecords");
  return fetchRevenueRecords(solver.url, parameters);
}

/**
 * Call the solver's `/revenue/records` endpoint with a per-call base URL and map
 * the response into the SDK's normalized shape.
 *
 * @internal
 */
async function fetchRevenueRecords(
  baseURL: string,
  parameters: GetRevenueRecordsParameters,
): Promise<GetRevenueRecordsReturnType> {
  try {
    const response = await requestRevenueRecords(
      {
        id: parameters.id,
        symbolIds: parameters.symbolIds ? [...parameters.symbolIds] : undefined,
        offset: parameters.offset,
        limit: parameters.limit,
      },
      { baseURL },
    );
    return {
      records: (response.data.records ?? []).map(toRevenueRecord),
      count: response.data.count ?? 0,
    };
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_REVENUE_RECORDS_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "FETCH_REVENUE_RECORDS_FAILED",
      `Failed to fetch revenue records: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
