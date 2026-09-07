/**
 * App-side persistence for gasless request ids.
 *
 * The service has no list-by-wallet endpoint, so an in-flight workflow whose
 * `requestId` is lost to a reload is unrecoverable. Every accepted request is
 * appended here (keyed by chain), and the request card offers the recent ones
 * back for resumed polling. Versioned key, per-chain slot, unparsed-string
 * snapshot for `useSyncExternalStore`, cross-tab sync via the `storage` event,
 * try/catch around every localStorage touch — mirroring the listing-token
 * store.
 */

const STORAGE_PREFIX = "symmio.gasless.requests.v2";
const MAX_ENTRIES = 20;

/** One persisted gasless request reference. */
export interface StoredGaslessRequest {
  requestId: string;
  /** Which sub-service stores the request (mirrors the SDK's `GaslessService`). */
  service: "operations" | "deposits";
  /** Instance the request was accepted on (empty when a proxy hides it). */
  protocolInstance: string;
  operationType: string;
  /** Unix ms at persistence time. */
  at: number;
}

const listeners = new Set<() => void>();
let storageListenerBound = false;

function storageKey(chainId: number): string {
  return `${STORAGE_PREFIX}:${chainId}`;
}

function bindStorageListener(): void {
  if (storageListenerBound || typeof window === "undefined") return;
  storageListenerBound = true;
  window.addEventListener("storage", (event) => {
    if (event.key?.startsWith(STORAGE_PREFIX)) {
      for (const listener of listeners) listener();
    }
  });
}

/** Subscribe to store changes (this tab and others). Returns the unsubscribe. */
export function subscribeGaslessRequests(listener: () => void): () => void {
  bindStorageListener();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Raw snapshot for `useSyncExternalStore` — the unparsed string stays referentially stable. */
export function readGaslessRequestsRaw(chainId: number): string | null {
  try {
    return window.localStorage.getItem(storageKey(chainId));
  } catch {
    return null;
  }
}

/** Parse a raw snapshot; corrupt data reads as an empty list. */
export function parseGaslessRequests(raw: string | null): StoredGaslessRequest[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredGaslessRequest[]) : [];
  } catch {
    return [];
  }
}

/** Append one request (newest first, deduped by id, capped). */
export function storeGaslessRequest(chainId: number, entry: StoredGaslessRequest): void {
  try {
    const current = parseGaslessRequests(readGaslessRequestsRaw(chainId));
    const next = [entry, ...current.filter((row) => row.requestId !== entry.requestId)].slice(0, MAX_ENTRIES);
    window.localStorage.setItem(storageKey(chainId), JSON.stringify(next));
    for (const listener of listeners) listener();
  } catch {
    /** Storage may be unavailable (SSR, private mode) — persistence is best-effort. */
  }
}
