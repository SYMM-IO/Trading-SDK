import type { ApiDailyTradeVolumeResponse } from "../types/generated/enigma-solver";
import type { SolverDailyVolume } from "./types";

/**
 * Map one daily observation, preserving the existing missing-field defaults.
 * This mapper does not validate rows; getTradeVolume filters malformed input first.
 * @param raw - One raw daily-volume object from the solver.
 * @returns A row with unchanged strings; missing timestamp/volume default to ""/"0".
 * @throws Does not throw for inputs matching the declared type.
 * @example toSolverDailyVolume({ timestamp: "2026-10-17T00:00:00Z", volume: "0" });
 */
export function toSolverDailyVolume(raw: ApiDailyTradeVolumeResponse): SolverDailyVolume {
  return {
    timestamp: raw.timestamp ?? "",
    volume: raw.volume ?? "0",
  };
}
