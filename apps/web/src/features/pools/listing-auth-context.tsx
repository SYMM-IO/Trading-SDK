"use client";

import type { ListingAuthToken } from "@symmio/trading-core";
import { useAuthenticateListing } from "@symmio/trading-react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

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
 * Holds the listing bearer token for the whole Pools page **in memory**, so the
 * user signs in **once** and every authed card (the sign-in card, Your Pools, …)
 * reuses the same token. A refresh then re-reads with the held token instead of
 * prompting a fresh signature.
 *
 * In-memory by design: the token is dropped on a full page reload, and once it
 * expires the next authed read returns `401`, which surfaces as an error the user
 * clears by signing in again. Persisting it (sessionStorage) would survive a
 * reload at the cost of putting a bearer token in web storage — a deliberate
 * trade left to the integrating app.
 */
export function ListingAuthProvider({ children }: { children: ReactNode }) {
  const login = useAuthenticateListing();
  const [token, setToken] = useState<ListingAuthToken | null>(null);

  const signIn = useCallback(() => {
    login.mutate({}, { onSuccess: (next) => setToken(next) });
  }, [login]);

  const signOut = useCallback(() => setToken(null), []);

  const value = useMemo<ListingAuthValue>(
    () => ({
      token,
      accessToken: token?.accessToken ?? null,
      signIn,
      signOut,
      isSigningIn: login.isPending,
      error: login.error,
    }),
    [token, signIn, signOut, login.isPending, login.error],
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
