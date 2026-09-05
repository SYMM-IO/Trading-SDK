import type { RawBinanceMarkPriceFrame } from "../../price-service/binance/types";
import type { BinanceMarkPriceTick } from "../../price-service/types";

/**
 * Parse one inbound `!markPrice@arr@1s` frame into normalized ticks, or `null`
 * when the payload is not a price push (control frame, malformed JSON,
 * unexpected shape).
 *
 * Returning `null` rather than `[]` for a non-price frame matches
 * `parsePriceFrame`'s contract, so both watchers share the identical
 * "nothing to deliver" guard.
 *
 * Deliberately **not** a generalization of `parsePriceFrame`: that parser
 * requires `name` + `markPrice`, while Binance sends `s` + `p`, so feeding
 * Binance frames to it yields an empty array for every message — a feed that
 * reports `open` and never ticks. Two small parsers beat one that can silently
 * mis-handle either vendor.
 *
 * Accepts three envelopes so one watcher works against a raw stream, a combined
 * stream, and a single-symbol stream. Reads only the keys it needs, because the
 * live wire carries fields Binance's own docs omit (`ap`, `st`).
 *
 * @param data - Raw WebSocket payload (string or already-parsed value).
 * @returns Normalized ticks, or `null` when the frame is not a price push.
 */
export function parseBinancePriceFrame(data: unknown): BinanceMarkPriceTick[] | null {
  if (data === memoRaw) return memoParsed;

  const parsed = parseFrame(data);

  // Cache by reference identity only. The socket pool fans the *same* `data`
  // value synchronously to every listener, so N watchers on one stream would
  // otherwise each re-parse the full ~740-entry array once per second. Holding
  // one frame costs nothing and collapses that to a single parse.
  memoRaw = data;
  memoParsed = parsed;
  return parsed;
}

/** Last raw payload seen, held only to dedupe the per-listener fan-out. @internal */
let memoRaw: unknown = Symbol("no-frame");
/** Parse result for {@link memoRaw}. @internal */
let memoParsed: BinanceMarkPriceTick[] | null = null;

/** @internal */
function parseFrame(data: unknown): BinanceMarkPriceTick[] | null {
  const payload = decode(data);
  if (payload === null) return null;

  const entries = toEntries(payload);
  if (!entries) return null;

  const ticks: BinanceMarkPriceTick[] = [];
  for (const entry of entries) {
    const tick = toTick(entry);
    if (tick) ticks.push(tick);
  }
  return ticks;
}

/** @internal */
function decode(data: unknown): unknown {
  if (typeof data !== "string") return data ?? null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Unwrap the three envelopes: a top-level array (the raw-stream case), a
 * `{ stream, data }` combined-stream wrapper, and a bare single object.
 *
 * @internal
 */
function toEntries(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) return payload;
  if (typeof payload !== "object" || payload === null) return null;

  const wrapped = (payload as { data?: unknown }).data;
  if (Array.isArray(wrapped)) return wrapped;
  if (wrapped && typeof wrapped === "object") return [wrapped];

  // A bare object is only a price push if it carries the two required fields;
  // otherwise it is a control frame (subscribe ack, error, pong).
  const candidate = payload as Partial<RawBinanceMarkPriceFrame>;
  return typeof candidate.s === "string" && candidate.p !== undefined ? [payload] : null;
}

/**
 * Map one entry, or `null` when it lacks the two fields a mark price cannot be
 * built without.
 *
 * A numeric `p` is coerced with `String()` rather than arithmetic, so no price
 * is ever routed through a float. Missing optional fields default rather than
 * dropping the entry: a mark price with no funding attached is still a usable
 * mark price.
 *
 * @internal
 */
function toTick(entry: unknown): BinanceMarkPriceTick | null {
  if (typeof entry !== "object" || entry === null) return null;
  const raw = entry as Partial<RawBinanceMarkPriceFrame>;

  if (typeof raw.s !== "string" || raw.s.length === 0) return null;
  if (typeof raw.p !== "string" && typeof raw.p !== "number") return null;
  const markPrice = String(raw.p);
  if (markPrice.length === 0 || !Number.isFinite(Number(markPrice))) return null;

  return {
    provider: "binance",
    name: raw.s,
    markPrice,
    indexPrice: raw.i !== undefined ? String(raw.i) : "",
    binanceLastFundingRate: raw.r !== undefined ? String(raw.r) : "",
    binanceNextFundingTime: typeof raw.T === "number" ? raw.T : 0,
    ...(typeof raw.E === "number" ? { time: raw.E } : {}),
  };
}
