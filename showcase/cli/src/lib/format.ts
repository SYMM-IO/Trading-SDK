import { WEI_DECIMALS } from "@symmio/utils";
import { formatUnits, getAddress, type Address } from "viem";

/**
 * Display formatting for the terminal. Everything here is pure and
 * synchronous — it turns raw on-chain `bigint`s and decimal strings into the
 * short, aligned strings the TUI renders. On-chain amounts are 18-decimal wei
 * unless a position/collateral flow says otherwise (deposit/withdraw use the
 * collateral token's decimals — see {@link formatToken}'s `decimals` arg).
 */

/**
 * A plain decimal string for a value — never exponential.
 *
 * `String(5e-7)` yields `"5e-7"`, and every formatter here parses by splitting
 * on `"."`, so an exponent silently renders as garbage (`+$5e-7`). Sub-cent PnL
 * and lowcap prices land in exactly that range, so expand them instead.
 */
function toPlainString(value: string | number): string {
  const text = String(value);
  if (!/e/i.test(text)) return text;
  const num = Number(value);
  if (!Number.isFinite(num)) return text;
  /** `toFixed` only expands below 1e21; at or above it the value is a whole number. */
  if (Math.abs(num) >= 1e21) return BigInt(num).toString();
  /** 20 is the most `toFixed` allows, and enough for any price we display. */
  return num.toFixed(20).replace(/0+$/, "").replace(/\.$/, "");
}

/** Group the integer part of a decimal string with thousands separators. */
function groupThousands(intPart: string): string {
  const negative = intPart.startsWith("-");
  const digits = negative ? intPart.slice(1) : intPart;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return negative ? `-${grouped}` : grouped;
}

/** Truncate (not round) a decimal string to at most `maxFrac` fraction digits. */
function trimFraction(value: string | number, maxFrac: number, stripZeros = true): string {
  const [intPart = "0", fracPart = ""] = toPlainString(value).split(".");
  let frac = fracPart.slice(0, Math.max(0, maxFrac));
  if (stripZeros) frac = frac.replace(/0+$/, "");
  const grouped = groupThousands(intPart);
  return frac ? `${grouped}.${frac}` : grouped;
}

/** Format a raw on-chain amount (`bigint`) as a grouped decimal string. */
export function formatToken(raw: bigint, decimals = WEI_DECIMALS, maxFrac = 4): string {
  return trimFraction(formatUnits(raw, decimals), maxFrac);
}

/** Format a raw amount as USD, e.g. `$1,204.35`. */
export function formatUsd(raw: bigint, decimals = WEI_DECIMALS, maxFrac = 2): string {
  return `$${formatToken(raw, decimals, maxFrac)}`;
}

/** Format an already-decimal string/number as USD. */
export function formatUsdString(value: string | number, maxFrac = 2): string {
  return `$${trimFraction(String(value), maxFrac)}`;
}

/** Format an already-decimal string/number amount (no currency symbol). */
export function formatDecimal(value: string | number, maxFrac = 4): string {
  return trimFraction(String(value), maxFrac);
}

/**
 * Format a price with adaptive precision: a market's `price_precision` when
 * known, otherwise enough fraction digits to be meaningful for the magnitude.
 */
export function formatPrice(value: string | number, precision?: number): string {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return "—";
  if (precision != null) return trimFraction(String(value), precision, false);
  const abs = Math.abs(num);
  const frac = abs >= 1000 ? 2 : abs >= 1 ? 4 : abs >= 0.001 ? 6 : 8;
  return trimFraction(String(value), frac);
}

/** Signed USD from a decimal number/string, e.g. `+$12.40` / `-$3.10`. */
export function formatSignedUsd(value: number | string, maxFrac = 2): string {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return "—";
  const sign = num > 0 ? "+" : num < 0 ? "-" : "";
  return `${sign}$${trimFraction(String(Math.abs(num)), maxFrac)}`;
}

/**
 * Signed USD that keeps sub-cent amounts legible. Two decimals once the value
 * reaches a cent, more below it — so a small realized PnL reads `-$0.0004`
 * rather than collapsing to a bare `-$0`.
 */
export function formatSignedUsdFine(value: number | string): string {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return "—";
  if (num === 0) return "$0";
  const abs = Math.abs(num);
  const frac = abs >= 0.01 ? 2 : abs >= 0.0001 ? 4 : 6;
  return formatSignedUsd(num, frac);
}

/** Signed percentage, e.g. `+4.21%`. */
export function formatSignedPercent(value: number | string, digits = 2): string {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return "—";
  const sign = num > 0 ? "+" : num < 0 ? "-" : "";
  return `${sign}${Math.abs(num).toFixed(digits)}%`;
}

/** Plain percentage, e.g. `12.50%`. */
export function formatPercent(value: number | string, digits = 2): string {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return "—";
  return `${num.toFixed(digits)}%`;
}

/** Compact large numbers: `1.2K`, `3.4M`, `1.1B`. */
export function formatCompact(value: number | string): string {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return "—";
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(2)}K`;
  return `${sign}${trimFraction(String(abs), 2)}`;
}

/** `$1.2M`-style compact USD. */
export function formatCompactUsd(value: number | string): string {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return "—";
  return `${num < 0 ? "-" : ""}$${formatCompact(Math.abs(num))}`;
}

/** `0x1234…abcd` — checksummed, middle-elided. */
export function shortAddress(address: string, lead = 6, tail = 4): string {
  if (!address) return "—";
  let value = address;
  try {
    value = getAddress(address as Address);
  } catch {
    /* not a valid address — show as-is */
  }
  if (value.length <= lead + tail + 1) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}

/** A unix-seconds timestamp → `2026-07-15 23:54` (local, sortable order). */
export function formatDateTime(seconds: bigint | number): string {
  const ms = Number(seconds) * 1000;
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const date = new Date(ms);
  const pad2 = (value: number) => String(value).padStart(2, "0");
  const day = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  return `${day} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** Coarse relative label like `4m ago`, `2h ago`, `just now`. */
export function formatRelative(seconds: bigint | number, nowMs = Date.now()): string {
  const then = Number(seconds) * 1000;
  if (!Number.isFinite(then) || then <= 0) return "—";
  const delta = Math.max(0, nowMs - then);
  const s = Math.floor(delta / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/** A remaining-time countdown from now to a unix-seconds deadline. */
export function formatCountdown(targetSeconds: bigint | number, nowMs = Date.now()): string {
  const remaining = Math.floor((Number(targetSeconds) * 1000 - nowMs) / 1000);
  if (!Number.isFinite(remaining) || remaining <= 0) return "ready";
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
