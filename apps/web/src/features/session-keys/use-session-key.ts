"use client";

import {
  SessionKeyLoadError,
  SessionKeyOperationSupersededError,
  type SessionKeyMetadata,
  type SessionKeyState,
} from "@symmio/session-key";
import { useWalletAccount } from "@symmio/trading-react";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Address, Hex } from "viem";
import { getAppSessionKeyManager } from "./session-key-manager";

const EMPTY_STATE: SessionKeyState = {
  isReady: false,
  isExpired: false,
  publicAddress: null,
  expiresAt: null,
};

export function useSessionKey() {
  const { address, isConnected } = useWalletAccount();
  const manager = useMemo(() => getAppSessionKeyManager(), []);
  const [isLoading, setIsLoading] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [metadata, setMetadata] = useState<SessionKeyMetadata | null>(null);

  const subscribe = useCallback((listener: () => void) => manager.subscribe(listener), [manager]);
  const getSnapshot = useCallback(() => manager.getSnapshot(), [manager]);
  const sessionKeyAddress = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const state = sessionKeyAddress ? manager.getState() : EMPTY_STATE;

  const refreshMetadata = useCallback(
    async (owner?: Address) => {
      if (!owner) {
        setMetadata(null);
        return;
      }
      setMetadata(await manager.getMetadata(owner));
    },
    [manager],
  );

  useEffect(() => {
    if (!isConnected || !address) {
      void manager.destroy();
      setMetadata(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    manager
      .initialize(address)
      .then(async () => {
        if (cancelled) return;
        await refreshMetadata(address);
        setIsLoading(false);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setIsLoading(false);
        /** A newer lifecycle call took over; what it publishes is what this key shows. */
        if (reason instanceof SessionKeyOperationSupersededError) return;
        setError(toError(reason));
      });

    return () => {
      cancelled = true;
    };
  }, [address, isConnected, manager, refreshMetadata]);

  /**
   * Run one lifecycle call for the connected owner. A call a newer one
   * supersedes resolves `undefined` instead of failing: it never published a
   * key, and the newer call's outcome is the one to show.
   */
  const runLifecycle = useCallback(
    async (operation: (owner: Address) => Promise<SessionKeyState>): Promise<SessionKeyState | undefined> => {
      if (!address) throw new Error("Wallet not connected.");
      setIsLoading(true);
      setError(null);
      try {
        const next = await operation(address);
        await refreshMetadata(address);
        return next;
      } catch (reason) {
        if (reason instanceof SessionKeyOperationSupersededError) return undefined;
        const nextError = toError(reason);
        setError(nextError);
        throw nextError;
      } finally {
        setIsLoading(false);
      }
    },
    [address, refreshMetadata],
  );

  const initialize = useCallback(() => runLifecycle((owner) => manager.initialize(owner)), [manager, runLifecycle]);
  const rotate = useCallback(() => runLifecycle((owner) => manager.rotate(owner)), [manager, runLifecycle]);
  const importPrivateKey = useCallback(
    (privateKey: Hex) => runLifecycle((owner) => manager.importPrivateKey(owner, privateKey)),
    [manager, runLifecycle],
  );

  const destroy = useCallback(async () => {
    await manager.destroy(address);
    setMetadata(null);
    setError(null);
  }, [address, manager]);

  const signMessage = useCallback(
    async (message: string) => {
      setIsSigning(true);
      setError(null);
      try {
        return await manager.sign(message);
      } catch (reason) {
        const nextError = toError(reason);
        setError(nextError);
        throw nextError;
      } finally {
        setIsSigning(false);
      }
    },
    [manager],
  );

  return {
    owner: address,
    sessionKeyAddress,
    state,
    metadata,
    isLoading,
    isSigning,
    error,
    /**
     * `true` when a key is stored for this wallet but could not be loaded. The
     * record is left untouched — it may still hold a delegation — so loading
     * again cannot help until storage recovers; rotating or importing replaces it.
     */
    loadFailed: error instanceof SessionKeyLoadError,
    initialize,
    rotate,
    importPrivateKey,
    destroy,
    signMessage,
    getPrivateKey: () => manager.getPrivateKey(),
  };
}

function getServerSnapshot(): Address | null {
  return null;
}

function toError(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error(String(reason));
}
