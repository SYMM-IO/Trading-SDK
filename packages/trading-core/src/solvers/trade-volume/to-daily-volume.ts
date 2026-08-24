import type { ApiDailyTradeVolumeResponse } from "../types/generated/enigma-solver";
import type { SolverDailyVolume } from "./types";

/**
 * Map one raw `/trade-volume/{symbol_id}` row into the SDK's
 * {@link SolverDailyVolume}. The timestamp is the solver's ISO 8601 datetime
 * string, passed through unchanged; a missing timestamp or volume defaults to
 * `""` / `"0"`.
 *
 * @param raw - One raw daily-volume row from the solver.
 */
export function toSolverDailyVolume(raw: ApiDailyTradeVolumeResponse): SolverDailyVolume {
  return {
    timestamp: raw.timestamp ?? "",
    volume: raw.volume ?? "0",
  };
}
