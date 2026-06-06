/**
 * Options for {@link formatRelativeTimestamp}.
 */
export interface FormatRelativeTimestampOptions {
  /**
   * Current Unix timestamp in seconds. Defaults to `Date.now()`.
   *
   * Passing this in tests or server rendering keeps output deterministic.
   */
  nowSeconds?: number;
  /** Label for zero or negative timestamps. Defaults to `"Not set"`. */
  unsetLabel?: string;
  /** Label when `timestampSeconds` equals `nowSeconds`. Defaults to `"now"`. */
  nowLabel?: string;
  /** Label for timestamps too large to safely convert to a JavaScript number. */
  tooLargeLabel?: string;
  /** Convert a future duration into the final string. Defaults to `in ${duration}`. */
  formatFuture?: (duration: string) => string;
  /** Convert a past duration into the final string. Defaults to `${duration} ago`. */
  formatPast?: (duration: string) => string;
}

/**
 * Format a Unix timestamp in seconds as a short relative duration.
 *
 * The formatter is intentionally domain-neutral. Product-specific wording such
 * as "expires in" or "expired ... ago" should be supplied with
 * `formatFuture` / `formatPast`.
 *
 * @example
 * ```ts
 * formatRelativeTimestamp(1_700_000_060n, { nowSeconds: 1_700_000_000 }); // "in 1m"
 * formatRelativeTimestamp(1_699_999_940n, { nowSeconds: 1_700_000_000 }); // "1m ago"
 * formatRelativeTimestamp(0n); // "Not set"
 * ```
 */
export function formatRelativeTimestamp(
  timestampSeconds: bigint,
  options: FormatRelativeTimestampOptions = {},
): string {
  const {
    nowSeconds = Math.floor(Date.now() / 1000),
    unsetLabel = "Not set",
    nowLabel = "now",
    tooLargeLabel = "Timestamp is too large to format",
    formatFuture = (duration) => `in ${duration}`,
    formatPast = (duration) => `${duration} ago`,
  } = options;

  if (timestampSeconds <= 0n) return unsetLabel;

  if (timestampSeconds > BigInt(Number.MAX_SAFE_INTEGER)) {
    return tooLargeLabel;
  }

  const targetSeconds = Number(timestampSeconds);
  const deltaSeconds = targetSeconds - nowSeconds;

  if (deltaSeconds === 0) return nowLabel;

  const relative = formatDuration(Math.abs(deltaSeconds));
  return deltaSeconds > 0 ? formatFuture(relative) : formatPast(relative);
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);

  if (days > 0) {
    return [formatUnit(days, "d"), hours > 0 ? formatUnit(hours, "h") : null].filter(Boolean).join(" ");
  }

  if (hours > 0) {
    return [formatUnit(hours, "h"), minutes > 0 ? formatUnit(minutes, "m") : null].filter(Boolean).join(" ");
  }

  return formatUnit(minutes, "m");
}

function formatUnit(value: number, unit: string): string {
  return `${value}${unit}`;
}
