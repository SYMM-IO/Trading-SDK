/** True minus sign (U+2212). The design system forbids a hyphen on a number. */
const MINUS = "−";

const SUBSCRIPT_DIGITS = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];

function toSubscript(value: number): string {
  return String(value)
    .split("")
    .map((digit) => SUBSCRIPT_DIGITS[Number(digit)] ?? digit)
    .join("");
}

/** Replace a leading ASCII hyphen with a true minus. */
function withTrueMinus(text: string): string {
  return text.startsWith("-") ? `${MINUS}${text.slice(1)}` : text;
}

/**
 * Format a price for display.
 *
 * Prices below $0.001 use subscript-zero notation — `0.0₄284` means four
 * leading zeros after the decimal point. Above that, precision scales with
 * magnitude so a $64,000 mark and a $0.42 mark both read cleanly.
 */
export function formatPrice(value: number | string | undefined | null, precision?: number): string {
  const numeric = typeof value === "string" ? Number(value) : value;
  if (numeric === undefined || numeric === null || !Number.isFinite(numeric)) return "—";

  const magnitude = Math.abs(numeric);
  if (magnitude === 0) return "0.00";

  if (magnitude < 0.001) {
    const exponent = Math.floor(Math.log10(magnitude));
    const leadingZeros = Math.abs(exponent) - 1;
    const digits = magnitude.toExponential(3).split("e")[0]!.replace(".", "").replace(/0+$/, "") || "0";
    return `${numeric < 0 ? MINUS : ""}0.0${toSubscript(leadingZeros)}${digits}`;
  }

  const requested = precision !== undefined && Number.isFinite(precision) ? precision : undefined;
  const heuristic = magnitude >= 100 ? 2 : magnitude >= 1 ? 3 : 5;
  /* `toLocaleString` requires `0 <= minimumFractionDigits <= maximumFractionDigits <= 100`.
     A market's `pricePrecision` is untrusted here — clamp it into range so a low
     (0/1) or out-of-bounds value can never throw `RangeError`. */
  const maxDecimals = Math.min(100, Math.max(0, Math.trunc(requested ?? heuristic)));

  /* Sub-$1 prices keep two decimals of significance where the precision allows,
     but never more than the max — so a `pricePrecision` below 2 cannot make the
     minimum exceed the maximum. */
  const minDecimals = Math.min(magnitude >= 1 ? maxDecimals : 2, maxDecimals);

  return withTrueMinus(
    numeric.toLocaleString("en-US", {
      minimumFractionDigits: minDecimals,
      maximumFractionDigits: maxDecimals,
    }),
  );
}

/**
 * Format a USD amount. Compacts above $10K unless `exact` is set.
 *
 * `maxDecimals` is for the fee-scale figures — a funding charge or a platform
 * fee on a $2 position is fractions of a cent, and two decimal places render
 * every one of them as `$0.00`, which reads as "free". Raising the ceiling keeps
 * the trailing digits only where they exist: `$2.00` stays `$2.00`.
 */
export function formatUsd(
  value: number | string | undefined | null,
  options: { exact?: boolean; signed?: boolean; maxDecimals?: number } = {},
): string {
  const numeric = typeof value === "string" ? Number(value) : value;
  if (numeric === undefined || numeric === null || !Number.isFinite(numeric)) return "—";

  const magnitude = Math.abs(numeric);
  const sign = numeric > 0 && options.signed ? "+" : numeric < 0 ? MINUS : "";

  if (!options.exact && magnitude >= 10_000) {
    return `${sign}$${formatCompact(magnitude)}`;
  }
  return `${sign}$${magnitude.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: Math.max(2, options.maxDecimals ?? 2),
  })}`;
}

/**
 * A market's display name.
 *
 * A lowcap market's `name` carries the pool it trades in — `SYMM::80..5f_SFLOW` —
 * which is an identifier, not a label. Its `symbol` is the ticker a trader
 * recognises, so that wins wherever the market is known; the decorated name is
 * only stripped and shown when it is all there is.
 */
export function marketLabel(symbol: string | undefined, name: string | undefined): string {
  return symbol || marketDisplayName(name);
}

/** Compact a magnitude: 42_000_000 → `42M`. Sizes never render as bare longs. */
export function formatCompact(value: number): string {
  const magnitude = Math.abs(value);
  if (magnitude >= 1_000_000_000) return `${trim(magnitude / 1_000_000_000)}B`;
  if (magnitude >= 1_000_000) return `${trim(magnitude / 1_000_000)}M`;
  if (magnitude >= 1_000) return `${trim(magnitude / 1_000)}K`;
  return trim(magnitude);
}

function trim(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: value >= 100 ? 0 : value >= 10 ? 1 : 2 });
}

/**
 * Format a position size. Always carries its symbol and compacts above 10K —
 * the design system forbids a bare number here.
 */
export function formatSize(value: number | string | undefined | null, symbol?: string): string {
  const numeric = typeof value === "string" ? Number(value) : value;
  if (numeric === undefined || numeric === null || !Number.isFinite(numeric)) return "—";

  const magnitude = Math.abs(numeric);
  const body = magnitude >= 10_000 ? formatCompact(magnitude) : trim(magnitude);
  const sign = numeric < 0 ? MINUS : "";
  return symbol ? `${sign}${body} ${symbol}` : `${sign}${body}`;
}

/**
 * Format an order-book depth size.
 *
 * Depth ladders carry sizes across several orders of magnitude — 27 BTC on one
 * level and 0.004 on the next — and the compact formatter rounds the small ones
 * to a bare `0`, which reads as "no liquidity" rather than "a little". This
 * keeps significant digits all the way down and only compacts above 10K.
 */
export function formatDepth(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const magnitude = Math.abs(value);
  if (magnitude === 0) return "0";
  if (magnitude >= 10_000) return formatCompact(magnitude);
  if (magnitude >= 1) return magnitude.toLocaleString("en-US", { maximumFractionDigits: 2 });
  /* Below 1, show three significant digits so 0.004 never collapses to 0. */
  return magnitude.toPrecision(3).replace(/0+$/, "").replace(/\.$/, "");
}

/** Format a signed P&L figure. Always signed, always a true minus. */
export function formatPnl(value: number | string | undefined | null): string {
  return formatUsd(value, { signed: true, exact: true });
}

/** Format a percentage. Signed when `signed` is set. */
export function formatPercent(
  value: number | undefined | null,
  options: { signed?: boolean; decimals?: number } = {},
): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return "—";
  const decimals = options.decimals ?? 2;
  const sign = value > 0 && options.signed ? "+" : value < 0 ? MINUS : "";
  return `${sign}${Math.abs(value).toFixed(decimals)}%`;
}

/** Format leverage. The design system uses `×`, never `x`. */
export function formatLeverage(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return "—";
  return `${trim(value)}×`;
}

/** Relative time. Under an hour reads as `12s ago` / `4m ago`; older is a date. */
export function formatRelativeTime(timestamp: number | undefined | null): string {
  if (!timestamp) return "—";
  const millis = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  const delta = Date.now() - millis;
  if (delta < 0) return "now";

  const seconds = Math.floor(delta / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(millis).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * A short, ticking "time left" — `45s`, `1m 12s`, `1h 04m`.
 *
 * Deliberately coarse above the hour: a countdown a trader is waiting on is
 * read, not measured, and a seconds field that keeps moving under an hourly
 * wait is noise.
 */
export function formatCountdown(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  if (total < 60) return `${total}s`;

  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes}m ${String(total % 60).padStart(2, "0")}s`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
}

/** Clock time for blotter rows. */
export function formatClock(timestamp: number | undefined | null): string {
  if (!timestamp) return "—";
  const millis = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  return new Date(millis).toLocaleTimeString("en-US", { hour12: false });
}

/** Shorten an address to `0x7a3f…c21e`. */
export function shortenAddress(address: string | undefined | null, lead = 6, tail = 4): string {
  if (!address) return "—";
  if (address.length <= lead + tail + 1) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}

/** Strip a solver's market-name decoration, e.g. `BTCUSDT` / `WIF::` → `BTC` / `WIF`. */
export function marketDisplayName(name: string | undefined | null): string {
  if (!name) return "—";
  return name.replace(/::+$/, "").replace(/USDT$/, "").replace(/USD$/, "") || name;
}

/** Convert a wei-scaled bigint to a JS number using the given decimals. */
export function fromWei(value: bigint | undefined | null, decimals = 18): number {
  if (value === undefined || value === null) return 0;
  return Number(value) / 10 ** decimals;
}

/** Calendar date for grants and expiries — `Aug 20, 2027`. Accepts seconds, millis or a `Date`. */
export function formatDate(value: number | Date | undefined | null): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value < 1e12 ? value * 1000 : value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
