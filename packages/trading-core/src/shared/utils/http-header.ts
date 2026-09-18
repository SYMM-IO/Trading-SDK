/**
 * Read one HTTP header from a response-headers bag, ignoring case.
 *
 * Axios hands back an `AxiosHeaders` instance, while adapters and test doubles
 * may pass a plain object in any casing. Both expose each header as an own
 * enumerable property, so one scan covers them without importing axios at
 * runtime. A repeated header yields its first value.
 *
 * @param headers - The response headers as the HTTP client exposes them (any shape).
 * @param name - The header name, in any casing.
 * @returns The header's value, or `undefined` when it is absent or not a string or finite number.
 *
 * @internal
 */
export function readHttpHeader(headers: unknown, name: string): string | undefined {
  if (headers === null || typeof headers !== "object") return undefined;
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== wanted) continue;
    const first: unknown = Array.isArray(value) ? value[0] : value;
    if (typeof first === "string") return first;
    if (typeof first === "number" && Number.isFinite(first)) return String(first);
    return undefined;
  }
  return undefined;
}
