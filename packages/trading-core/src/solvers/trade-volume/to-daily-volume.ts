import type { ApiDailyTradeVolumeResponse } from "../types/generated/enigma-solver";
import type { SolverDailyVolume } from "./types";

/**
 * Normalize a valid daily observation without inventing zero volume.
 * @param raw - Untrusted daily row from the solver.
 * @returns The original timestamp/decimal volume, or undefined for malformed rows.
 * @throws Does not throw for malformed input.
 * @example toSolverDailyVolume({ timestamp: "2026-10-17T00:00:00Z", volume: "0" });
 */
export function toSolverDailyVolume(raw: ApiDailyTradeVolumeResponse): SolverDailyVolume | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const timestamp = raw.timestamp;
  const volume = raw.volume;
  if (typeof timestamp !== "string" || !timestamp.trim() || !Number.isFinite(Date.parse(timestamp))) return undefined;
  if (typeof volume !== "string" || !volume.trim() || !Number.isFinite(Number(volume))) return undefined;
  return { timestamp, volume };
}
