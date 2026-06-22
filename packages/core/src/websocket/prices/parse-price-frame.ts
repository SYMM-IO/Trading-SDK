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
  if (!Array.isArray(parsed)) return null;

  const ticks: EnigmaPriceTick[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    if (typeof raw.name !== "string") continue;
    let markPriceStr: string | null = null;
    if (typeof raw.markPrice === "number" && Number.isFinite(raw.markPrice)) {
      markPriceStr = String(raw.markPrice);
    } else if (typeof raw.markPrice === "string" && raw.markPrice.length > 0) {
      markPriceStr = raw.markPrice;
    }
    if (markPriceStr === null) continue;
    const tick: EnigmaPriceTick = { name: raw.name, markPrice: markPriceStr };
    if (typeof raw.time === "number" && Number.isFinite(raw.time)) tick.time = raw.time;
    if (typeof raw.address === "string" && raw.address.length > 0) tick.address = raw.address;
    ticks.push(tick);
  }
  return ticks;
}
