import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { Compute, ReadSolverParameter } from "../../shared/types/properties";
import { assertSolverKind } from "../assert-solver-kind";
import { getRevenue, getRevenueSymbolId } from "../types/generated/enigma-solver";
import { toSolverRevenue } from "./to-solver-revenue";
import type { SolverRevenue, SolverRevenueTimeRange } from "./types";

/**
 * Parameters for {@link getSolverRevenue}.
 */
export type GetSolverRevenueParameters = Compute<
  ReadSolverParameter & {
    /**
     * Restrict the totals to one market. **Omit for the protocol-wide total** —
     * that is the whole point of this read, and passing a `symbolId` narrows it
     * to a single market's share.
     */
    symbolId?: number;
    /**
     * Trailing window. Defaults to `"lifetime"` when omitted, matching the
     * solver's own default.
     */
    timeRange?: SolverRevenueTimeRange;
  }
>;

/** Return type of {@link getSolverRevenue}: revenue totals for the window. */
export type GetSolverRevenueReturnType = SolverRevenue;

/**
 * Read revenue totals from the chain's solver — protocol-wide by default, or for
 * a single market when `symbolId` is given.
 *
 * Figures come back as plain dollar `number`s and split into a hedger-fee share
 * and a funding share, whose sum is `totalRevenue`.
 *
 * Enigma-only: the endpoint does not exist on a rasa-kind solver, which fails
 * with `UNSUPPORTED_BY_SOLVER` rather than a confusing 404.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain, solver, market and window.
 * @returns The normalized {@link SolverRevenue} totals.
 * @throws {SymmApiError} when the API request fails.
 * @throws {SymmError} `UNSUPPORTED_BY_SOLVER` when the solver is not enigma-kind.
 *
 * @example
 * ```ts
 * // Protocol-wide, since listing.
 * const lifetime = await getSolverRevenue(config);
 *
 * // Trailing 24 hours, one market.
 * const day = await getSolverRevenue(config, { symbolId: 1, timeRange: "24h" });
 * ```
 */
export async function getSolverRevenue(
  config: Config,
  parameters: GetSolverRevenueParameters = {},
): Promise<GetSolverRevenueReturnType> {
  const solver = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId });
  assertSolverKind(solver, "enigma", "getSolverRevenue");
  return fetchSolverRevenue(solver.url, parameters);
}

async function fetchSolverRevenue(baseURL: string, parameters: GetSolverRevenueParameters): Promise<SolverRevenue> {
  /** Omitted rather than defaulted: the solver's own default is already `lifetime`. */
  const params = parameters.timeRange === undefined ? undefined : { time_range: parameters.timeRange };

  try {
    const response =
      parameters.symbolId === undefined
        ? await getRevenue(params, { baseURL })
        : await getRevenueSymbolId(parameters.symbolId, params, { baseURL });

    return toSolverRevenue(response.data);
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_SOLVER_REVENUE_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "FETCH_SOLVER_REVENUE_FAILED",
      `Failed to fetch solver revenue: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
