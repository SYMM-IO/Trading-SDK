"use client";

import { symmioChains } from "@/config/symmio";
import { countOverrides } from "@/config/symmio-config-schema";
import { findGaslessDeployment } from "@/config/symmio-presets";
import type { CreateConfigParameters } from "@symmio/trading-core";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type ChainOverrides = CreateConfigParameters["symmioConfig"];

/**
 * A persisted blob replaces the app baseline wholesale after hydration, so the
 * key is bumped whenever the baseline changes **shape**.
 *
 * v2 — the Arbitrum deployment profiles: a v1 blob kept the stale InstantLayer
 * and never received the `gasless` block.
 *
 * v3 — the registry moved Arbitrum to production and dropped its built-in
 * `gasless` block and HyperEVM. A v2 blob carries a partial `gasless` override
 * (no `gaslessLayerAddress`) that used to inherit from that block, so
 * `createConfig` now rejects it with `GASLESS_OVERRIDE_INCOMPLETE`.
 *
 * A moved **gasless endpoint** no longer needs a bump: every persisted chain is
 * rebased onto the deployment facts in `src/config/symmio-presets.ts` on load
 * and on every write (see {@link rebaseGaslessDeploymentFacts}), so a gateway
 * origin, protocol instance, GaslessLayer address or stream flag changed in
 * code reaches a returning browser on its next reload. Bump the key for a shape
 * change only.
 */
const STORAGE_KEY = "symmio.config.overrides.v3";

/**
 * Re-apply gasless deployment facts from code onto a set of chain overrides.
 *
 * A gasless endpoint is a **deployment fact**, not a user preference: the
 * gateway origin, the protocol instance, the GaslessLayer proxy and whether the
 * status stream is served all move when the vendor redeploys. A blob persisted
 * before such a move would otherwise pin the old ones forever — the browser
 * would keep signing for a gateway that no longer answers, and the only cure
 * would be bumping {@link STORAGE_KEY} and discarding every other edit with it.
 *
 * So for each chain: identify the deployment by its InstantLayer (see
 * {@link findGaslessDeployment}), write that deployment's facts from code, and
 * keep exactly one persisted field — the user's `execution.mode`, which is
 * theirs and not the vendor's. The facts are written whether or not the chain
 * came in carrying a gasless block, because the config editor does not model
 * the endpoint and drops it on every Apply: a chain that names a deployment's
 * InstantLayer is entitled to that deployment's gateway, and losing it would
 * leave the app holding one deployment's addresses with no relayer at all.
 *
 * A gasless block belonging to no known deployment (a retired gateway, a
 * hand-edited blob, a chain whose addresses were pointed elsewhere) is dropped
 * rather than repaired: there is nothing to rebase it onto, and an incomplete
 * block fails `createConfig` outright.
 *
 * Restoring the endpoint does **not** turn the relay on. Without a persisted
 * `execution.mode` the dispatcher stays disabled and writes keep going through
 * the connected wallet — only the gasless reads and the per-card opt-ins come
 * back.
 *
 * @param overrides - Chain overrides, from storage or from the config editor.
 * @returns The same overrides with every gasless block rebased or dropped.
 */
export function rebaseGaslessDeploymentFacts(overrides: ChainOverrides): ChainOverrides {
  const rebased: NonNullable<ChainOverrides> = {};
  for (const [key, chain] of Object.entries(overrides ?? {})) {
    const chainId = Number(key);
    if (!chain) {
      rebased[chainId] = chain;
      continue;
    }
    /** A stored blob is `JSON.parse`d, so even a required block can be missing at runtime. */
    const deployment = findGaslessDeployment(chainId, chain.addresses?.instantLayerAddress);
    if (!deployment) {
      if (!chain.gasless) {
        rebased[chainId] = chain;
        continue;
      }
      const withoutGasless = { ...chain };
      delete withoutGasless.gasless;
      rebased[chainId] = withoutGasless;
      continue;
    }
    const mode = chain.gasless?.execution?.mode;
    rebased[chainId] = {
      ...chain,
      gasless: { ...deployment.gasless, ...(mode ? { execution: { mode } } : {}) },
    };
  }
  return rebased;
}

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
    if (stored !== undefined) setOverridesState(rebaseGaslessDeploymentFacts(stored));
    setHasHydrated(true);
  }, []);

  const setOverrides = useCallback((next: ChainOverrides) => {
    /**
     * Rebase here too, not only on hydration. The config editor models the
     * `execution.mode` and nothing else of the gasless block, so what it hands
     * over carries no endpoint at all; an Apply would otherwise persist a chain
     * whose addresses name a deployment but whose relayer is gone, and every
     * gasless surface would switch itself off until the preset was re-applied.
     */
    const rebased = rebaseGaslessDeploymentFacts(next);
    setOverridesState(rebased);
    if (typeof window === "undefined") return;
    try {
      if (!rebased || Object.keys(rebased).length === 0) window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rebased));
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
