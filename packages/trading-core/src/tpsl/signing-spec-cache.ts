import type { SymmioTpSlConfig } from "../core/chains/types";
import type { Config } from "../core/config";
import type { TpSlSigningSpec } from "./types";

const MAX_AGE_MS = 5 * 60_000;
type Entry = { pending: Promise<TpSlSigningSpec> } | { value: TpSlSigningSpec; expiresAt: number };
const caches = new WeakMap<Config, Map<string, Entry>>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// Cache eligibility only: preserve the readers' existing return/error behavior
// for malformed handler responses, but never retain those responses for reuse.
function canCache(value: unknown): value is TpSlSigningSpec {
  if (!isRecord(value) || !isRecord(value.domain) || !isRecord(value.types)) return false;
  const { domain, types, primaryType } = value;
  return (
    isNonemptyString(domain.name) &&
    isNonemptyString(domain.version) &&
    typeof domain.chainId === "number" &&
    Number.isSafeInteger(domain.chainId) &&
    domain.chainId > 0 &&
    typeof domain.verifyingContract === "string" &&
    /^0x[0-9a-fA-F]{40}$/.test(domain.verifyingContract) &&
    isNonemptyString(primaryType) &&
    Object.hasOwn(types, primaryType) &&
    Array.isArray(types[primaryType]) &&
    types[primaryType].length > 0 &&
    Object.values(types).every(
      (fields) =>
        Array.isArray(fields) &&
        fields.every((field) => isRecord(field) && isNonemptyString(field.name) && isNonemptyString(field.type)),
    )
  );
}

/** Share schema reads within one SDK config, deployment and operation. Internal only. */
export function readCachedTpSlSigningSpec(
  config: Config,
  scope: { chainId?: number; handler: SymmioTpSlConfig; method: "POST" | "DELETE" },
  fetchSpec: () => Promise<TpSlSigningSpec>,
): Promise<TpSlSigningSpec> {
  const chainId = config.getChainConfig(scope.chainId).chainId;
  const key = JSON.stringify([
    chainId,
    config.getChainConfigKey(chainId),
    scope.handler.url,
    scope.handler.appName,
    scope.method,
  ]);
  let cache = caches.get(config);
  if (!cache) {
    cache = new Map();
    caches.set(config, cache);
  }
  const existing = cache.get(key);
  if (existing && "pending" in existing) return existing.pending;
  if (existing && existing.expiresAt > Date.now()) {
    return Promise.resolve(structuredClone(existing.value));
  }

  const entries = cache;
  const pending = Promise.resolve()
    .then(fetchSpec)
    .then((spec) => {
      if (canCache(spec)) {
        // Caller mutation must not modify a schema used by later signatures.
        entries.set(key, { value: structuredClone(spec), expiresAt: Date.now() + MAX_AGE_MS });
      } else {
        entries.delete(key);
      }
      return spec;
    })
    .catch((error: unknown) => {
      entries.delete(key);
      throw error;
    });
  entries.set(key, { pending });
  return pending;
}
