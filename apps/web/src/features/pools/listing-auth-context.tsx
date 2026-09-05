"use client";

import type { ListingAuthToken } from "@symmio/trading-core";
import { SymmioRequestError, useAuthenticateListing, useWalletAccount } from "@symmio/trading-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useChainId } from "wagmi";
import {
  clearListingToken,
  listingTokenStorageKey,
  parseListingToken,
  readListingTokenRaw,
  subscribeListingTokens,
  writeListingToken,
} from "./listing-token-storage";

type SignInError = ReturnType<typeof useAuthenticateListing>["error"];

/** The shared listing session every authed Pools card on the page reads. */
interface ListingAuthValue {
  /** The current bearer token, or `null` when signed out. */
  token: ListingAuthToken | null;
  /** Convenience accessor for `token?.accessToken` — the bearer string authed reads need. */
  accessToken: string | null;
  /** Run the SIWE sign-in once and store the returned token for the whole page. */
  signIn: () => void;
  /** Drop the stored token (sign out). */
  signOut: () => void;
  /** `true` while the SIWE exchange is in flight. */
  isSigningIn: boolean;
  /** The last sign-in error, or `null`. */
  error: SignInError;
}

const ListingAuthContext = createContext<ListingAuthValue | null>(null);

/**
 * `queryKey[0]` of every `@symmio/trading-core` pools read that sends the
 * listing bearer token. Core strips `accessToken` from query keys
 * (`filterQueryOptions` treats it as a credential, not a cache dimension) and
 * derives the user from the token server-side, so these keys carry neither the
 * token nor the wallet address. This set is therefore how the provider finds
 * the family: to match a `401` back to the session, to refetch after a token
 * swap, and to evict cached rows when the signed-in account changes. Keep in
 * sync with the core pools reads that require `accessToken`.
 */
const AUTHED_LISTING_QUERY_KEYS = new Set([
  "getClaimHistory",
  "getDepositAddress",
  "getListingMarketConfig",
  "getRetryListingInfo",
  "getUserListingMarkets",
  "getUserProfit",
  "getUserRewardChart",
  "getUserTotalReward",
  "getUserTransactions",
]);

function isAuthedListingQueryKey(queryKey: readonly unknown[]): boolean {
  return typeof queryKey[0] === "string" && AUTHED_LISTING_QUERY_KEYS.has(queryKey[0]);
}

/**
 * The slot the authed listing cache was last populated under. Module-scoped on
 * purpose: the shared query cache outlives the Pools page, so a wallet switch
 * that happens while no {@link ListingAuthProvider} is mounted must still be
 * detected — and the stale account's rows evicted — on the next mount.
 */
let lastSeenAuthedSlot: string | null | undefined;

function getServerSnapshot(): null {
  return null;
}

/**
 * Holds the listing bearer token for the whole Pools page, so the user signs in
 * **once** and every authed card (the sign-in card, Your Pools, …) reuses the
 * same token — across cards, re-reads, and full page reloads.
 *
 * The token is persisted to `localStorage` in a slot keyed by chain id and
 * wallet address, the two things the SIWE session is bound to. Switching wallet
 * or chain resolves a different slot, so a token is never presented for an
 * account it was not minted for, and switching back restores the earlier
 * session. Because authed query keys carry no user identity, the cached authed
 * rows are evicted whenever the slot changes — one account's data is never
 * shown under another. The first client render matches the server (signed out)
 * and the stored token lands right after hydration.
 *
 * Once the backend rejects the held token — an authed listing read or write
 * fails with `401` — the slot is cleared and every card falls back to its
 * sign-in prompt, instead of retrying a dead token forever.
 */
export function ListingAuthProvider({ children }: { children: ReactNode }) {
  const { mutate, isPending, error } = useAuthenticateListing();
  const queryClient = useQueryClient();
  const chainId = useChainId();
  const { address } = useWalletAccount();
  const slot = address ? listingTokenStorageKey(chainId, address) : null;

  const getSnapshot = useCallback(() => (slot ? readListingTokenRaw(slot) : null), [slot]);
  const raw = useSyncExternalStore(subscribeListingTokens, getSnapshot, getServerSnapshot);
  const token = useMemo(() => parseListingToken(raw), [raw]);

  const signIn = useCallback(() => {
    mutate(
      {},
      {
        onSuccess: (next) => {
          if (slot) writeListingToken(slot, next);
        },
      },
    );
  }, [mutate, slot]);

  const signOut = useCallback(() => {
    if (slot) clearListingToken(slot);
  }, [slot]);

  /**
   * Authed listing rows are cached under keys with no user identity (see
   * {@link AUTHED_LISTING_QUERY_KEYS}), so after a wallet or chain switch the
   * previous account's balances would be served verbatim to the next one until
   * its refetch resolves. Evict the whole family the moment the slot changes.
   */
  useEffect(() => {
    if (lastSeenAuthedSlot !== undefined && lastSeenAuthedSlot !== slot) {
      queryClient.removeQueries({ predicate: (query) => isAuthedListingQueryKey(query.queryKey) });
    }
    lastSeenAuthedSlot = slot;
  }, [queryClient, slot]);

  /**
   * Revoke the held token the moment the backend says it is dead. Authed
   * mutations carry their `accessToken` in the variables and are matched on it
   * exactly; authed reads cannot be (core strips the token from query keys), so
   * they are matched by family name via {@link AUTHED_LISTING_QUERY_KEYS}. A
   * `401` on either means the session expired — clear the slot and let the
   * cards re-prompt. A matched read failure belongs to *this* token, not a
   * predecessor: the hooks only fetch with the token held here, and the
   * invalidation effect below cancels in-flight fetches when the token swaps.
   */
  useEffect(() => {
    if (!token || !slot) return;
    const { accessToken } = token;
    const usedThisToken = (value: unknown) =>
      typeof value === "object" && value !== null && (value as { accessToken?: unknown }).accessToken === accessToken;
    const revokeOn = (failure: unknown) => {
      if (failure instanceof SymmioRequestError && failure.status === 401) clearListingToken(slot);
    };

    const unsubscribeQueries = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" || event.action.type !== "error") return;
      if (isAuthedListingQueryKey(event.query.queryKey)) revokeOn(event.action.error);
    });
    const unsubscribeMutations = queryClient.getMutationCache().subscribe((event) => {
      if (event.type !== "updated" || event.action.type !== "error") return;
      if (usedThisToken(event.mutation.state.variables)) revokeOn(event.action.error);
    });

    return () => {
      unsubscribeQueries();
      unsubscribeMutations();
    };
  }, [queryClient, token, slot]);

  /**
   * The token is not part of any query key, so swapping it (a fresh sign-in, or
   * another tab refreshing the slot) neither refetches authed reads nor cancels
   * fetches still running with the previous token. Do both whenever a new token
   * lands: invalidating cancels the stale in-flight fetch (so its late `401`
   * cannot revoke the fresh token) and refetches active authed reads with the
   * new one. Skipped on the first run — the initial fetches already use the
   * restored token.
   */
  const previousAccessToken = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const accessToken = token?.accessToken ?? null;
    const previous = previousAccessToken.current;
    previousAccessToken.current = accessToken;
    if (accessToken === null || previous === undefined || accessToken === previous) return;
    void queryClient.invalidateQueries({ predicate: (query) => isAuthedListingQueryKey(query.queryKey) });
  }, [queryClient, token]);

  const value = useMemo<ListingAuthValue>(
    () => ({
      token,
      accessToken: token?.accessToken ?? null,
      signIn,
      signOut,
      isSigningIn: isPending,
      error,
    }),
    [token, signIn, signOut, isPending, error],
  );

  return <ListingAuthContext.Provider value={value}>{children}</ListingAuthContext.Provider>;
}

/** Read the shared listing session. Throws when used outside a {@link ListingAuthProvider}. */
export function useListingAuth(): ListingAuthValue {
  const value = useContext(ListingAuthContext);
  if (value === null) {
    throw new Error("useListingAuth must be used within a ListingAuthProvider");
  }
  return value;
}
