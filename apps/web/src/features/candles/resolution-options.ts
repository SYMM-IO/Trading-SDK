import type { CandleResolution } from "@symmio/trading-core";

/** Resolutions offered by the picker, in ascending bar size. */
export const RESOLUTION_OPTIONS = [
  { value: "1m", label: "1m" },
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "1h", label: "1h" },
  { value: "4h", label: "4h" },
  { value: "1d", label: "1D" },
] as const satisfies readonly { value: CandleResolution; label: string }[];

/** The subset of {@link CandleResolution} this page's picker offers. */
export type PickerResolution = (typeof RESOLUTION_OPTIONS)[number]["value"];

/** How many bars the page loads up front for each resolution. */
export const DEFAULT_BAR_COUNT = 500;

/**
 * Nominal span of a resolution in milliseconds, used only to derive the
 * initial `from` bound from {@link DEFAULT_BAR_COUNT}.
 */
const RESOLUTION_MS: Record<PickerResolution, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "1h": 3_600_000,
  "4h": 14_400_000,
  "1d": 86_400_000,
};

/**
 * Compute the window covering {@link DEFAULT_BAR_COUNT} bars ending at `now`.
 *
 * `now` is passed in rather than read here so the caller controls when the
 * range changes — a live `Date.now()` inside the query parameters would mint a
 * new cache entry on every render.
 */
export function toCandleRange(resolution: PickerResolution, now: number) {
  return { from: now - DEFAULT_BAR_COUNT * RESOLUTION_MS[resolution], to: now };
}
