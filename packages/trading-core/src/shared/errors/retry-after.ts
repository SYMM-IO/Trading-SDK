/**
 * Parse an HTTP `Retry-After` value into a delay in milliseconds.
 *
 * Accepts both forms RFC 9110 §10.2.3 defines: delay-seconds (`"120"`) and an
 * HTTP-date (`"Wed, 21 Oct 2026 07:28:00 GMT"`). A date is measured against
 * `now` and clamps to `0` once it has passed. Anything else — a negative or
 * fractional number, an unparseable date, a delay too large to be a safe
 * integer of milliseconds — yields `null`.
 *
 * @param value - The raw header value, or `undefined` when the header is absent.
 * @param now - Reference time in epoch ms for an HTTP-date. Defaults to `Date.now()`.
 * @returns The delay in ms, or `null` when the header carries no usable value.
 *
 * @internal
 */
export function parseRetryAfterMs(value?: string, now: number = Date.now()): number | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    const ms = Number(trimmed) * 1000;
    return Number.isSafeInteger(ms) ? ms : null;
  }

  /**
   * An HTTP-date always spells out a weekday or month. Without a letter the
   * value is a malformed number, which `Date.parse` would happily read as a year.
   */
  if (!/[a-z]/i.test(trimmed)) return null;
  const at = Date.parse(trimmed);
  return Number.isNaN(at) ? null : Math.max(0, at - now);
}
