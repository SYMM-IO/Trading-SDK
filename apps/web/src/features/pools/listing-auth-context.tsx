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
 * session. The first client render matches the server (signed out) and the
 * stored token lands right after hydration.
 *
 * Once the backend rejects the held token — an authed read or write keyed on
 * this exact `accessToken` fails with `401` — the slot is cleared and every card
 * falls back to its sign-in prompt, instead of retrying a dead token forever.
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
   * Revoke the held token the moment the backend says it is dead. Every authed
   * Pools query carries its `accessToken` in the query key and every authed
   * mutation in its variables, so a `401` on a request that used *this* token
   * is proof the session expired — clear the slot and let the cards re-prompt.
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
      if (usedThisToken(event.query.queryKey[1])) revokeOn(event.action.error);
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
