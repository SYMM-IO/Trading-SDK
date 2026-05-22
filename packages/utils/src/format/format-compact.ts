import Decimal from "decimal.js";
import { formatWithCommas, type FormatWithCommasOptions } from "./format-with-commas";

/** Compact-notation suffix unit. */
export type CompactUnit = "K" | "M" | "B" | "T" | "Q";

/**
 * Options for {@link formatCompact}.
 */
export interface FormatCompactOptions extends FormatWithCommasOptions {
  /**
   * Smallest unit at which compact notation kicks in. Values below the
   * threshold get the regular `formatWithCommas` treatment. Defaults to `"K"`.
   */
  threshold?: CompactUnit;
}

const COMPACT_MAP: Record<CompactUnit, { threshold: Decimal; suffix: string }> = {
  K: { threshold: new Decimal(1_000), suffix: "K" },
  M: { threshold: new Decimal(1_000_000), suffix: "M" },
  B: { threshold: new Decimal(1_000_000_000), suffix: "B" },
  T: { threshold: new Decimal(1_000_000_000_000), suffix: "T" },
  Q: { threshold: new Decimal(1_000_000_000_000_000), suffix: "Q" },
};

/**
 * Format a number in compact notation (`K`, `M`, `B`, `T`, `Q`).
 *
 * @example
 * formatCompact(1500);                  // "1.5K"
 * formatCompact(1_500_000);             // "1.5M"
 * formatCompact(12_345_678, { maxDecimals: 1 }); // "12.3M"
 * formatCompact(1500, { threshold: "M" });       // "1,500" — under threshold, regular formatting
 * formatCompact(-1_234_567, { maxDecimals: 1 }); // "-1.2M"
 */
export function formatCompact(value?: Decimal.Value | null, options: FormatCompactOptions = {}): string {
  const { threshold = "K", ...formatWithCommasOptions } = options;

  /**
   * `null`/`undefined` flow through to `formatWithCommas`, which renders `"0"`.
   */
  if (value === null || value === undefined) {
    return formatWithCommas(value, formatWithCommasOptions);
  }

  const decimal = new Decimal(value);
  const thresholdValue = COMPACT_MAP[threshold].threshold;

  if (decimal.abs().gte(thresholdValue)) {
    /**
     * Order matters: walk largest → smallest so the first match wins. A value
     * of 1.5e12 picks `T`, not `B`.
     */
    const compactUnits = [COMPACT_MAP.Q, COMPACT_MAP.T, COMPACT_MAP.B, COMPACT_MAP.M, COMPACT_MAP.K];

    const absValue = decimal.abs();
    const compactUnit = compactUnits.find((unit) => absValue.gte(unit.threshold));

    if (!compactUnit) {
      return formatWithCommas(value, formatWithCommasOptions);
    }

    const compactValue = decimal.div(compactUnit.threshold);
    return formatWithCommas(compactValue, formatWithCommasOptions) + compactUnit.suffix;
  }

  return formatWithCommas(value, formatWithCommasOptions);
}
