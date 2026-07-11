"use client";

import { symmioChains } from "@/config/symmio";
import { countOverrides } from "@/config/symmio-config-schema";
import type { CreateConfigParameters } from "@symmio/trading-core";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type ChainOverrides = CreateConfigParameters["symmioConfig"];

const STORAGE_KEY = "symmio.config.overrides.v1";

interface SymmioOverridesContextValue {
  /** Per-chain overrides currently fed to `SymmioProvider`. */
  overrides: ChainOverrides;
  /** Replace the active overrides and persist them to local storage. */
  setOverrides: (next: ChainOverrides) => void;
  /** Number of fields (across all chains) that differ from the SDK defaults. */
  overrideCount: number;
  /** Whether persisted overrides have been read from local storage yet. */
  hasHydrated: boolean;
}

const SymmioOverridesContext = createContext<SymmioOverridesContextValue | undefined>(undefined);

function readStored(): ChainOverrides | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ChainOverrides) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Holds the app's runtime SDK config overrides. Seeds from the app baseline,
 * rehydrates any persisted edits after mount, and exposes a setter that both
 * updates `SymmioProvider` (by reference) and writes through to local storage.
 *
 * Mount this **outside** `SymmioProvider` so its value can drive the SDK config,
 * and read it with {@link useSymmioOverrides}.
 */
export function SymmioOverridesProvider({ children }: { children: ReactNode }) {
  /**
   * The first render (server + hydration) must be deterministic, so it always
   * uses the app baseline; persisted edits are applied in the effect below.
   */
  const [overrides, setOverridesState] = useState<ChainOverrides>(symmioChains);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    const stored = readStored();
    if (stored !== undefined) setOverridesState(stored);
    setHasHydrated(true);
  }, []);

  const setOverrides = useCallback((next: ChainOverrides) => {
    setOverridesState(next);
    if (typeof window === "undefined") return;
    try {
      if (!next || Object.keys(next).length === 0) window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /** Storage can be unavailable (private mode, quota); overrides still work in-memory. */
    }
  }, []);

  const value = useMemo<SymmioOverridesContextValue>(
    () => ({ overrides, setOverrides, overrideCount: countOverrides(overrides), hasHydrated }),
    [overrides, setOverrides, hasHydrated],
  );

  return <SymmioOverridesContext.Provider value={value}>{children}</SymmioOverridesContext.Provider>;
}

/** Read the runtime overrides store. Throws if used outside {@link SymmioOverridesProvider}. */
export function useSymmioOverrides(): SymmioOverridesContextValue {
  const ctx = useContext(SymmioOverridesContext);
  if (!ctx) throw new Error("useSymmioOverrides must be used within a SymmioOverridesProvider");
  return ctx;
}
