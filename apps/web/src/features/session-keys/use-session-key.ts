"use client";

import { useWalletAccount } from "@symm-frontier/react";
import type { SessionKeyMetadata, SessionKeyState } from "@symm-frontier/session-key";
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
    console.log("useEffect", isConnected, address);
    if (!isConnected || !address) {
      console.log("useEffect destroy", address, manager);
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
        setError(reason instanceof Error ? reason : new Error(String(reason)));
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [address, isConnected, manager, refreshMetadata]);

  const initialize = useCallback(async () => {
    if (!address) throw new Error("Wallet not connected.");
    setIsLoading(true);
    setError(null);
    try {
      const next = await manager.initialize(address);
      await refreshMetadata(address);
      return next;
    } catch (reason) {
      const nextError = reason instanceof Error ? reason : new Error(String(reason));
      setError(nextError);
      throw nextError;
    } finally {
      setIsLoading(false);
    }
  }, [address, manager, refreshMetadata]);

  const rotate = useCallback(async () => {
    if (!address) throw new Error("Wallet not connected.");
    setIsLoading(true);
    setError(null);
    try {
      const next = await manager.rotate(address);
      await refreshMetadata(address);
      return next;
    } catch (reason) {
      const nextError = reason instanceof Error ? reason : new Error(String(reason));
      setError(nextError);
      throw nextError;
    } finally {
      setIsLoading(false);
    }
  }, [address, manager, refreshMetadata]);

  const importPrivateKey = useCallback(
    async (privateKey: Hex) => {
      if (!address) throw new Error("Wallet not connected.");
      setIsLoading(true);
      setError(null);
      try {
        const next = await manager.importPrivateKey(address, privateKey);
        await refreshMetadata(address);
        return next;
      } catch (reason) {
        const nextError = reason instanceof Error ? reason : new Error(String(reason));
        setError(nextError);
        throw nextError;
      } finally {
        setIsLoading(false);
      }
    },
    [address, manager, refreshMetadata],
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
        const nextError = reason instanceof Error ? reason : new Error(String(reason));
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
