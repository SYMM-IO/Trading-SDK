"use client";

import type { ListingAuthToken } from "@symmio/trading-core";
import type { SymmioRequestError } from "@symmio/trading-react";
import { useAuthenticateListing, useWalletAccount } from "@symmio/trading-react";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import {
  clearListingToken,
  listingTokenKey,
  parseListingToken,
  readListingTokenRaw,
  subscribeListingTokens,
  writeListingToken,
} from "./listing-token-storage";
import { POOLS_CHAIN_ID } from "./pools-deployment";

/**
 * The pools reads that carry the bearer token.
 *
 * Needed because the SDK strips `accessToken` from every query key — it is a
 * credential, not a cache dimension — so a 401 cannot be traced back to the
 * token through the key. Matching the key's root instead is what lets a dead
 * session be dropped the moment any authed read rejects.
 *
 * ## This set is a correctness invariant, not a convenience list
 *
 * Because the token is stripped, **no other dimension of an authed key names
 * the wallet**: `getUserProfit` is keyed by the pool address, `getClaimHistory`
 * by the page window, `getListingMarketConfig` by the token contract. Two
 * wallets therefore share one cache entry. The wallet-change effect below purges
 * these roots for exactly that reason, and a root that is missing from this set
 * is not purged — wallet A's claim history, transfers and market-config opinion
 * keep rendering under wallet B's address until each query happens to refetch.
 *
 * So: **every time an authed pools read is added anywhere in the app, its
 * `queryKey[0]` must be added here.** The root string is the first element of
 * the SDK's `getXQueryKey` — verify it in the vendored build rather than
 * guessing it from the hook name.
 */
const AUTHED_QUERY_ROOTS = new Set([
  "getUserListingMarkets",
  "getUserProfit",
  "getDepositAddress",
  "getUserRewardChart",
  "getUserTotalReward",
  "getClaimHistory",
  "getUserTransactions",
  "getListingMarketConfig",
]);

export interface ListingSessionValue {
  /** The held token, or `null` when signed out. */
  token: ListingAuthToken | null;
  /**
   * The bearer string, empty when signed out.
   *
   * Every authed pools hook self-gates on a non-empty token, so cards pass this
   * straight through and stay mounted-but-inert rather than branching on it.
   */
  accessToken: string;
  isSignedIn: boolean;
  /** Run the SIWE exchange. Needs the wallet on the pools chain. */
  signIn: () => void;
  /** Drop the session for this wallet on this chain. */
  signOut: () => void;
  isSigningIn: boolean;
  /** Why the last sign-in failed, if it did. */
  error: SymmioRequestError | null;
}

const ListingSessionContext = createContext<ListingSessionValue | undefined>(undefined);

/**
 * One listing session for the whole Pools surface.
 *
 * The listing backend is the only thing in Prism that authenticates: it is a
 * custodial REST service, not a contract, so it cannot read a signature off a
 * transaction and asks for SIWE instead. The token it returns is the key to
 * every "your" figure on these screens — your pools, your LP position, your
 * deposit address, your withdrawal — and it is held once here rather than
 * re-minted per panel, so a reader signs a message once and not five times.
 *
 * It is persisted for the same reason a session key is: a token held only in
 * memory is re-minted on every reload, which is a wallet popup for a page
 * refresh.
 */
export function ListingSessionProvider({ children }: { children: ReactNode }) {
  const { address } = useWalletAccount();
  const queryClient = useQueryClient();
  const authenticate = useAuthenticateListing();

  const slot = listingTokenKey(POOLS_CHAIN_ID, address);

  /* The raw string is the snapshot on purpose — see readListingTokenRaw. The
     server snapshot is null so the first client render matches the server's
     signed-out markup and the stored token lands after hydration. */
  const raw = useSyncExternalStore(
    subscribeListingTokens,
    () => readListingTokenRaw(slot),
    () => null,
  );

  const token = useMemo(() => parseListingToken(raw), [raw]);

  /**
   * Drop the session as soon as the backend rejects it.
   *
   * A listing token has no expiry the client can see, so the only honest signal
   * that it died is a 401 — and without this the app would keep showing five
   * panels' worth of sign-in-shaped errors while a dead token sat in storage.
   */
  useEffect(() => {
    if (!slot || !token) return;

    const revokeOn = (status: number | undefined) => {
      if (status === 401) clearListingToken(slot);
    };

    const unsubscribeQueries = queryClient.getQueryCache().subscribe((event) => {
      /* The ACTION, not the resting state. A query that failed with a 401 stays
         in `status: "error"` for as long as it is cached, and every later
         update to it — a refetch starting, a subscriber attaching — is an
         "updated" event carrying that same error. Reading the resting state
         would therefore revoke a freshly minted token the moment any stale
         errored query stirred, and the user could never sign back in. */
      if (event.type !== "updated" || event.action.type !== "error") return;
      const root = event.query.queryKey[0];
      if (typeof root !== "string" || !AUTHED_QUERY_ROOTS.has(root)) return;
      revokeOn((event.action.error as SymmioRequestError | null)?.status);
    });

    const unsubscribeMutations = queryClient.getMutationCache().subscribe((event) => {
      /* Same rule as the query cache: only a mutation that just transitioned to
         error revokes anything. */
      if (event.type !== "updated" || event.action.type !== "error") return;
      const state = event.mutation?.state;
      if (state?.status !== "error") return;
      const variables = state.variables as { accessToken?: string } | undefined;
      if (variables?.accessToken !== token.accessToken) return;
      revokeOn((state.error as SymmioRequestError | null)?.status);
    });

    return () => {
      unsubscribeQueries();
      unsubscribeMutations();
    };
  }, [queryClient, slot, token]);

  /**
   * Drop every authed pools result when the wallet changes.
   *
   * The SDK strips `accessToken` from these query keys and no other user
   * dimension takes its place — `getUserProfit` is keyed by the pool address
   * alone, `getUserListingMarkets` by the page window — so two wallets share
   * one cache entry. Without this, switching accounts renders the previous
   * wallet's deposit, share and LP balance under the new address until each
   * query happens to refetch.
   */
  useEffect(() => {
    queryClient.removeQueries({
      predicate: (query) => {
        const root = query.queryKey[0];
        return typeof root === "string" && AUTHED_QUERY_ROOTS.has(root);
      },
    });
  }, [queryClient, address]);

  const signIn = useCallback(() => {
    authenticate.mutate(
      { chainId: POOLS_CHAIN_ID },
      {
        onSuccess: (next) => writeListingToken(slot, next),
      },
    );
  }, [authenticate, slot]);

  const signOut = useCallback(() => clearListingToken(slot), [slot]);

  const value = useMemo<ListingSessionValue>(
    () => ({
      token,
      accessToken: token?.accessToken ?? "",
      isSignedIn: token !== null,
      signIn,
      signOut,
      isSigningIn: authenticate.isPending,
      error: authenticate.error,
    }),
    [token, signIn, signOut, authenticate.isPending, authenticate.error],
  );

  return <ListingSessionContext.Provider value={value}>{children}</ListingSessionContext.Provider>;
}

/** Read the shared listing session. Throws outside the provider. */
export function useListingSession(): ListingSessionValue {
  const context = useContext(ListingSessionContext);
  if (!context) {
    throw new Error("useListingSession must be used inside <ListingSessionProvider>.");
  }
  return context;
}
