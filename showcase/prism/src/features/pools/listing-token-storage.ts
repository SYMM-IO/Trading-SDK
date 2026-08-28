import type { ListingAuthToken } from "@symmio/trading-core";

/** Storage-key prefix. Versioned so a shape change cannot resurrect old tokens. */
const PREFIX = "prism.listing.token.v1";

const listeners = new Set<() => void>();

/**
 * The slot one listing session lives in.
 *
 * Keyed by the exact pair SIWE binds — chain id and signing address — so a
 * token minted for one wallet is never presented for another, and switching
 * back to a wallet restores the session it already had.
 */
export function listingTokenKey(chainId: number, address: string | undefined): string | null {
  if (!address) return null;
  return `${PREFIX}:${chainId}:${address.toLowerCase()}`;
}

/**
 * Subscribe to token changes, in this tab and in every other one.
 *
 * The `storage` event only fires in *other* tabs, so same-tab writes are
 * announced through the listener set. Signing in once lights up every open tab.
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
 * Read the raw stored string.
 *
 * Deliberately unparsed: `useSyncExternalStore` compares snapshots by identity,
 * and a fresh object from `JSON.parse` on every read would loop forever.
 */
export function readListingTokenRaw(key: string | null): string | null {
  if (!key) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Parse a stored token, treating anything malformed as signed out. */
export function parseListingToken(raw: string | null): ListingAuthToken | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const { accessToken, tokenType } = value as Partial<ListingAuthToken>;
    if (typeof accessToken !== "string" || accessToken.length === 0) return null;
    if (typeof tokenType !== "string") return null;
    return { accessToken, tokenType };
  } catch {
    return null;
  }
}

/** Persist a token and notify this tab. Storage failures degrade to no session. */
export function writeListingToken(key: string | null, token: ListingAuthToken): void {
  if (!key) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(token));
  } catch {
    /* Private mode or blocked storage: the emit below still re-renders, which
       reads back null and leaves the app honestly signed out. */
  }
  emit();
}

/** Drop a token and notify this tab. */
export function clearListingToken(key: string | null): void {
  if (!key) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* Nothing to do — the read below already reports signed out. */
  }
  emit();
}

function emit(): void {
  for (const listener of listeners) listener();
}
