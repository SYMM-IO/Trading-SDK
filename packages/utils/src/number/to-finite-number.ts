/**
 * Coerce a value that may be a `number`, a numeric string, or nullish into a
 * finite `number`, defaulting to `0`. Non-finite results (`NaN`, `Infinity`,
 * unparseable strings) also fall back to `0`.
 *
 * Handy for decoding JSON fields whose spec type and served type disagree —
 * e.g. a field declared `number` in an OpenAPI schema but returned as a decimal
 * string by the running service.
 *
 * @param value - A number, a numeric string, or a nullish placeholder.
 * @returns The parsed finite number, or `0` when the input is nullish or not a
 * finite number.
 *
 * @example
 * toFiniteNumber("112258.59"); // 112258.59
 * toFiniteNumber(undefined);   // 0
 * toFiniteNumber("oops");      // 0
 */
export function toFiniteNumber(value?: number | string | null): number {
  if (value === undefined || value === null) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
