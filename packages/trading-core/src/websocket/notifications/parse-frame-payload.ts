/**
 * Decode an inbound `event.data` into a plain object, or `null` when it is not
 * one (malformed JSON, primitives, binary). Shared first step of every
 * protocol adapter's frame parser.
 */
export function parseFramePayload(data: unknown): Record<string, unknown> | null {
  let parsed: unknown = data;
  if (typeof data === "string") {
    try {
      parsed = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  return parsed as Record<string, unknown>;
}
