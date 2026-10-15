import type { EnigmaPriceTick } from "./types";

/**
 * Parse one inbound frame from the Enigma lowcap price WebSocket into an
 * array of {@link EnigmaPriceTick}s, or `null` when the frame is not a price
 * push (control frame, malformed JSON, unexpected shape).
 *
 * @param data - The raw `event.data` (a JSON string, or an already-parsed object).
 */
export function parsePriceFrame(data: unknown): EnigmaPriceTick[] | null {
  let parsed: unknown = data;
  if (typeof data === "string") {
    try {
      parsed = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(parsed) && (!parsed || typeof parsed !== "object")) return null;

  const ticks: EnigmaPriceTick[] = [];
  for (const item of Array.isArray(parsed) ? parsed : [parsed]) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const name = typeof raw.name === "string" ? raw.name : typeof raw.symbol === "string" ? raw.symbol : undefined;
    if (name === undefined) continue;
    const mark = raw.mark_price ?? raw.markPrice;
    let markPriceStr: string | null = null;
    if (typeof mark === "number" && Number.isFinite(mark)) {
      markPriceStr = String(mark);
    } else if (typeof mark === "string" && mark.length > 0) {
      markPriceStr = mark;
    }
    if (markPriceStr === null) continue;
    const tick: EnigmaPriceTick = { name, markPrice: markPriceStr };
    const time = raw.timestamp ?? raw.time;
    if (typeof time === "number" && Number.isFinite(time)) tick.time = time;
    const symbolId = Number(raw.symbol_id ?? raw.symbolId);
    if (Number.isSafeInteger(symbolId) && symbolId > 0) tick.symbolId = symbolId;
    if (typeof raw.symbol === "string") tick.symbol = raw.symbol;
    for (const [key, value] of [
      ["indexPrice", raw.index_price ?? raw.indexPrice],
      ["fundingRate", raw.funding_rate ?? raw.fundingRate],
    ] as const) {
      if (typeof value === "string" || (typeof value === "number" && Number.isFinite(value))) tick[key] = String(value);
    }
    if (typeof raw.address === "string" && raw.address.length > 0) tick.address = raw.address;
    ticks.push(tick);
  }
  return !Array.isArray(parsed) && ticks.length === 0 ? null : ticks;
}
