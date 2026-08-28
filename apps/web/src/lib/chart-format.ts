import { formatCompactCurrency } from "@symmio/utils";
import { formatUnits } from "@symmio/utils/decimal";

/** Formatters shared by every series chart on the inspector pages. */

/** A fixed-point USD `bigint` as the plain number a chart scales. */
export function toChartUsd(raw: bigint, decimals: number): number {
  return Number(formatUnits(raw, decimals));
}

/** Compact dollars for axis ticks and tooltips — `$1.2K`, `$0.56`. */
export function formatChartUsd(value: number): string {
  return formatCompactCurrency(value, { maxDecimals: 2 });
}

/** An x position in **milliseconds** as a short axis label — `Jul 9`. */
export function formatChartDay(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** An x position in **milliseconds** as the tooltip's full date — `Jul 9, 2026`. */
export function formatChartDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
