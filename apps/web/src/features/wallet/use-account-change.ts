"use client";

import { useWalletAccount } from "@symmio/trading-react";
import { useEffect, useRef } from "react";

/**
 * Identity of the account the app is acting as: the connected address scoped by
 * its chain, or `undefined` while no wallet is connected. Sub-accounts, Virtual
 * Accounts, and allowances are all chain-scoped, so switching chain invalidates
 * the same values switching address does.
 */
function accountIdentity(address?: string, chainId?: number): string | undefined {
  if (!address || chainId === undefined) return undefined;
  return `${chainId}:${address.toLowerCase()}`;
}

/**
 * Run `onChange` whenever the app switches to a *different* connected account —
 * a new address, or the same address on a new chain.
 *
 * Deliberately quiet where nothing can be stale: the first connect of a session
 * (there is no earlier account to leave behind, so anything typed before
 * connecting survives) and a plain disconnect (the last identity is remembered,
 * so reconnecting the same wallet — including wagmi's reconnect after a reload —
 * is a no-op). Disconnecting and then connecting a *different* wallet does fire,
 * because the comparison is against the last identity seen, not against the gap.
 *
 * @param onChange - Called once per account switch. Always the latest callback
 *   passed in; it does not need to be memoized.
 *
 * @example
 * useAccountChangeEffect(() => setReceiver(""));
 */
export function useAccountChangeEffect(onChange: () => void): void {
  const { address, chainId } = useWalletAccount();
  const identity = accountIdentity(address, chainId);

  /** Declared first so it re-points the ref before the identity effect below reads it. */
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  /** Last identity actually seen connected; disconnect gaps never overwrite it. */
  const lastIdentityRef = useRef(identity);
  useEffect(() => {
    if (identity === undefined) return;
    const previous = lastIdentityRef.current;
    lastIdentityRef.current = identity;
    if (previous === undefined || previous === identity) return;
    onChangeRef.current();
  }, [identity]);
}
