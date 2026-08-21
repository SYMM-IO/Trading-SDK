"use client";

import { createSessionKeyManager, type SessionKeyManager, type SessionKeyState } from "@symmio/session-key";
import { useWalletAccount } from "@symmio/trading-react";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Address } from "viem";
import { createPrismSessionKeyStorage } from "./session-key-storage";

const EMPTY_STATE: SessionKeyState = {
  isReady: false,
  isExpired: false,
  publicAddress: null,
  expiresAt: null,
};

let sharedManager: SessionKeyManager | undefined;

/**
 * The app's single session-key manager.
 *
 * One instance per browser session: the manager holds the loaded key in memory
 * and publishes changes through a subscription, so a second instance would give
 * two components two different keys.
 */
export function getSessionKeyManager(): SessionKeyManager {
  sharedManager ??= createSessionKeyManager({ storage: createPrismSessionKeyStorage() });
  return sharedManager;
}

export interface PrismSessionKey {
  /** The connected wallet the key belongs to. */
  owner: Address | undefined;
  /** The session key's public address — the signer instant trades are signed by. */
  address: Address | null;
  state: SessionKeyState;
  isLoading: boolean;
  error: Error | null;
  /** Mint a fresh key, dropping every delegation the old one held. */
  rotate: () => Promise<void>;
}

/**
 * The wallet's local session key, loaded on connect and persisted across reloads.
 *
 * Instant trading exists to remove the per-order wallet popup: the order is
 * signed by a local key the sub-account has delegated to, not by the wallet
 * itself. That makes the key a piece of durable state, not a transient — it is
 * loaded from storage on mount and only minted when storage has nothing valid,
 * because minting a new one silently invalidates every delegation granted to
 * the old one.
 */
export function useSessionKey(): PrismSessionKey {
  const { address: owner, isConnected } = useWalletAccount();
  const manager = useMemo(() => getSessionKeyManager(), []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const subscribe = useCallback((listener: () => void) => manager.subscribe(listener), [manager]);
  const getSnapshot = useCallback(() => manager.getSnapshot(), [manager]);
  const address = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (!isConnected || !owner) {
      void manager.destroy();
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    manager
      .initialize(owner)
      .then(() => {
        if (!cancelled) setIsLoading(false);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason : new Error(String(reason)));
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isConnected, owner, manager]);

  const rotate = useCallback(async () => {
    if (!owner) return;
    setIsLoading(true);
    try {
      await manager.rotate(owner);
    } finally {
      setIsLoading(false);
    }
  }, [manager, owner]);

  return {
    owner,
    address,
    state: address ? manager.getState() : EMPTY_STATE,
    isLoading,
    error,
    rotate,
  };
}

/** The server has no `localStorage`, so it has no session key either. */
function getServerSnapshot(): Address | null {
  return null;
}
