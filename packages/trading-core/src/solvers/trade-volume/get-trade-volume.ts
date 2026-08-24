import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { Compute, ReadSolverParameter } from "../../shared/types/properties";
import { assertSolverKind } from "../assert-solver-kind";
import { getTradeVolumeSymbolId } from "../types/generated/enigma-solver";
import { toSolverDailyVolume } from "./to-daily-volume";
import type { SolverDailyVolume } from "./types";

/**
 * Parameters for {@link getTradeVolume}.
 */
export type GetTradeVolumeParameters = Compute<
  ReadSolverParameter & {
    /** Solver market id (`symbol_id`) to read daily trade volume for. Required. */
    symbolId: number;
  }
>;

/** Return type of {@link getTradeVolume}: one entry per day, ascending. */
export type GetTradeVolumeReturnType = SolverDailyVolume[];

/**
 * Fetch the last N daily trade-volume rows for one market from the chain's
 * enigma solver `/trade-volume/{symbol_id}` endpoint. Rows are returned in
 * ascending day order. The solver base URL is resolved from `config` per call,
 * so multiple chains never clobber each other.
 *
 * `/trade-volume/{symbol_id}` is an **Enigma-only** endpoint; the action asserts
 * the resolved solver is an `enigma` solver and throws before hitting the wire
 * otherwise.
 *
 * @param config - The SDK config.
 * @param parameters - The required `symbolId` plus optional chain id / solver.
 * @returns Normalized daily volume, one {@link SolverDailyVolume} per day.
 * @throws {SymmApiError} when the API request fails.
 * @throws {SymmError} `UNSUPPORTED_BY_SOLVER` when the resolved solver is not an `enigma` solver, or when the chain is unsupported.
 *
 * @example
 * ```ts
 * const volume = await getTradeVolume(config, { symbolId: 1 });
 * const latest = volume.at(-1);
 * console.log(latest?.volume); // notional traded on the most recent day
 * ```
 */
export async function getTradeVolume(
  config: Config,
  parameters: GetTradeVolumeParameters,
): Promise<GetTradeVolumeReturnType> {
  const solver = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId });
  assertSolverKind(solver, "enigma", "getTradeVolume");
  return fetchTradeVolume(solver.url, parameters.symbolId);
}

/**
 * Call the solver's `/trade-volume/{symbol_id}` endpoint with a per-call base URL
 * and map each raw daily row into the SDK's normalized array.
 *
 * @internal
 */
async function fetchTradeVolume(baseURL: string, symbolId: number): Promise<SolverDailyVolume[]> {
  try {
    const response = await getTradeVolumeSymbolId(symbolId, { baseURL });
    return (response.data ?? []).map(toSolverDailyVolume);
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_TRADE_VOLUME_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "FETCH_TRADE_VOLUME_FAILED",
      `Failed to fetch trade volume: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
