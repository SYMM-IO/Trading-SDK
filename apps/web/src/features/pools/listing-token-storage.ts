import type { ListingAuthToken } from "@symmio/trading-core";

const STORAGE_PREFIX = "symmio.listing.token.v1";

/** Listeners notified when this tab writes or clears a listing token. */
const listeners = new Set<() => void>();

/**
 * Storage slot for one wallet on one chain. The SIWE session is bound to both
 * (the message carries the address and the EIP-155 chain id), so a token minted
 * for one pair must never be presented for another — switching wallet or chain
 * simply resolves a different slot.
 */
export function listingTokenStorageKey(chainId: number, address: string): string {
  return `${STORAGE_PREFIX}:${chainId}:${address.toLowerCase()}`;
}

/**
 * Subscribe to listing-token changes for `useSyncExternalStore`: same-tab
 * writes go through {@link writeListingToken} / {@link clearListingToken}, and
 * the `storage` event carries writes from other tabs, so signing in once is
 * enough for every open Pools tab.
 */
export function subscribeListingTokens(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/**
 * The raw stored string for a slot, or `null` when empty or storage is
 * unavailable. Returned unparsed so it is referentially stable across renders —
 * the snapshot `useSyncExternalStore` needs; parse with {@link parseListingToken}.
 */
export function readListingTokenRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Parse a stored slot back into a {@link ListingAuthToken}; corrupt or foreign data reads as signed out. */
export function parseListingToken(raw: string | null): ListingAuthToken | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return isListingAuthToken(value) ? { accessToken: value.accessToken, tokenType: value.tokenType } : null;
  } catch {
    return null;
  }
}

/** Persist a freshly minted token into its slot and notify subscribers. */
export function writeListingToken(key: string, token: ListingAuthToken): void {
  try {
    localStorage.setItem(key, JSON.stringify(token));
  } catch {
    /* ignore quota/availability errors — the session just will not survive a reload */
  }
  emit();
}

/** Drop a slot (sign out, or a `401` proving the token is dead) and notify subscribers. */
export function clearListingToken(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore availability errors */
  }
  emit();
}

function emit(): void {
  for (const listener of listeners) listener();
}

function isListingAuthToken(value: unknown): value is ListingAuthToken {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ListingAuthToken>;
  return (
    typeof candidate.accessToken === "string" &&
    candidate.accessToken.length > 0 &&
    typeof candidate.tokenType === "string"
  );
}
