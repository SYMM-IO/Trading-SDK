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

/**
 * v3 widens the row to the identity the vendor doc requires — the deployment
 * and protocol instance that accepted the workflow, its owner, the wallet ids
 * it selected and the idempotency key that could resubmit it — and records the
 * last status seen, so a reload can tell a pending workflow from a finished
 * one before re-enabling the same action. A v2 row carries none of that, so the
 * key is bumped rather than migrated.
 */
const STORAGE_PREFIX = "symmio.gasless.requests.v3";
const MAX_ENTRIES = 20;

/** One persisted gasless request reference. */
export interface StoredGaslessRequest {
  requestId: string;
  /** Which sub-service stores the request (mirrors the SDK's `GaslessService`). */
  service: "operations" | "deposits";
  /** Instance the request was accepted on (empty when a proxy hides it). */
  protocolInstance: string;
  operationType: string;
  /** Owner the workflow was submitted for, when the acceptance named one. */
  owner?: string;
  /** Wallet ids the submit selected, as decimal strings (`["0"]` for ordinary relays). */
  walletIds?: string[];
  /** The key that resubmits this exact request after a lost response. */
  idempotencyKey?: string;
  /** Last status observed, so a reload knows whether the workflow is still open. */
  lastStatus?: string;
  /** Unix ms at persistence time. */
  at: number;
}

/** Statuses that end a workflow; anything else is still in flight. */
const TERMINAL_STATUSES = new Set(["succeeded", "reverted", "failed", "rejected"]);

/** Whether a stored row is still running, and so blocks a duplicate submit. */
export function isStoredGaslessRequestPending(entry: StoredGaslessRequest): boolean {
  return !entry.lastStatus || !TERMINAL_STATUSES.has(entry.lastStatus);
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

/**
 * The newest still-running workflow for an operation type, if any.
 *
 * The gateway has no list-by-wallet endpoint, so this local record is the only
 * way a reload can know an action is already in flight and refuse to submit it
 * twice.
 */
export function findPendingGaslessRequest(
  chainId: number,
  match: { operationType: string; protocolInstance?: string },
): StoredGaslessRequest | undefined {
  return parseGaslessRequests(readGaslessRequestsRaw(chainId)).find(
    (entry) =>
      entry.operationType === match.operationType &&
      isStoredGaslessRequestPending(entry) &&
      (match.protocolInstance === undefined || entry.protocolInstance === match.protocolInstance),
  );
}

/** Record the status a workflow reached, so a later load stops treating it as open. */
export function updateStoredGaslessRequestStatus(chainId: number, requestId: string, lastStatus: string): void {
  try {
    const current = parseGaslessRequests(readGaslessRequestsRaw(chainId));
    const index = current.findIndex((row) => row.requestId === requestId);
    if (index === -1 || current[index]?.lastStatus === lastStatus) return;
    const next = current.map((row, position) => (position === index ? { ...row, lastStatus } : row));
    window.localStorage.setItem(storageKey(chainId), JSON.stringify(next));
    for (const listener of listeners) listener();
  } catch {
    /** Storage may be unavailable — persistence is best-effort. */
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
