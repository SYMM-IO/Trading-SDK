/**
 * Keys that configure TanStack Query behavior rather than identify the data.
 * They are stripped before an options object is turned into a query key so two
 * calls that differ only in, say, `staleTime` still share a cache entry.
 */
const NON_KEY_FIELDS = new Set(["query", "enabled", "config"]);

/**
 * Turn an options object into the plain, hashable payload that trails a query
 * key. Strips TanStack control fields and functions, drops `undefined`, and
 * recursively serializes `bigint` to its decimal string (TanStack's default key
 * hash throws on `bigint`).
 *
 * @param options - The query-options object passed to a factory.
 * @returns A plain object safe to embed in a query key.
 *
 * @example
 * ```ts
 * filterQueryOptions({ chainId: 999, user: "0x…", offset: 0n, query: { staleTime: 1 } });
 * // → { chainId: 999, user: "0x…", offset: "0" }
 * ```
 */
export function filterQueryOptions<type extends Record<string, unknown>>(options: type): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(options)) {
    if (NON_KEY_FIELDS.has(key)) continue;
    if (value === undefined) continue;
    if (typeof value === "function") continue;
    result[key] = serializeBigInts(value);
  }
  return result;
}

/**
 * Recursively replace every `bigint` in a value with its decimal string form so
 * the result survives `JSON.stringify`-based query-key hashing.
 */
function serializeBigInts(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(serializeBigInts);
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      result[key] = serializeBigInts(nested);
    }
    return result;
  }
  return value;
}
