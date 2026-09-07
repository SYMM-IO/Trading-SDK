"use client";

import { useSupportsGaslessService, useSymmioChainId, useSymmioConfig } from "@symmio/trading-react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

interface GaslessWriteModeContextValue {
  /** Per-method relay overrides, keyed by contract method name. */
  overrides: Readonly<Record<string, boolean>>;
  /** Force one method onto (`true`) or off (`false`) the relay. */
  setOverride: (method: string, enabled: boolean) => void;
}

const GaslessWriteModeContext = createContext<GaslessWriteModeContextValue | undefined>(undefined);

/**
 * Holds the per-method gasless overrides the write cards send with their next
 * call. A card's toggle writes here and the card body reads back through
 * {@link useGaslessWriteMode}, so the header control and the mutation stay in
 * sync without threading props through every card.
 *
 * Deliberately in-memory: an override is a "send this one differently" decision
 * for the session, not configuration. The persistent, app-wide switch is the
 * chain config's `gasless.execution.mode` in the config panel.
 *
 * Mount it inside `SymmioProvider` — the hook reads the resolved chain config.
 */
export function GaslessWriteModeProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const setOverride = useCallback((method: string, enabled: boolean) => {
    setOverrides((prev) => ({ ...prev, [method]: enabled }));
  }, []);

  const value = useMemo<GaslessWriteModeContextValue>(() => ({ overrides, setOverride }), [overrides, setOverride]);

  return <GaslessWriteModeContext.Provider value={value}>{children}</GaslessWriteModeContext.Provider>;
}

/** How one write card dispatches its next call. */
export interface GaslessWriteMode {
  /**
   * Whether a gasless choice exists at all — i.e. the connected chain has a
   * usable relayer. `false` hides the toggle. Whether the *write itself* is
   * relayable is the card's own declaration (`MethodCard`'s `gaslessRelayable`).
   */
  available: boolean;
  /** Effective relay state: the card's override when set, else the config's mode. */
  enabled: boolean;
  /** Whether {@link enabled} comes from the card's own toggle rather than the config. */
  isOverridden: boolean;
  /** Put this method on (`true`) or off (`false`) the relay for subsequent calls. */
  setEnabled: (enabled: boolean) => void;
}

/**
 * Read (and set) the gasless dispatch mode for one write method.
 *
 * @param method - The contract method name, as shown on the card.
 *
 * @example
 * ```tsx
 * const { available, enabled, setEnabled } = useGaslessWriteMode("depositForAccount");
 * ```
 */
export function useGaslessWriteMode(method: string): GaslessWriteMode {
  const ctx = useContext(GaslessWriteModeContext);
  if (!ctx) throw new Error("useGaslessWriteMode must be used within a GaslessWriteModeProvider");

  const config = useSymmioConfig();
  const chainId = useSymmioChainId();
  const supported = useSupportsGaslessService();
  const { overrides, setOverride } = ctx;

  /** What the chain config would do on its own, with no per-call override. */
  const configEnabled = supported && config.getChainConfig(chainId).gasless?.execution?.mode === "gasless";
  const override = overrides[method];

  const setEnabled = useCallback((enabled: boolean) => setOverride(method, enabled), [method, setOverride]);

  return { available: supported, enabled: override ?? configEnabled, isOverridden: override !== undefined, setEnabled };
}

/**
/** Parameters for {@link useGaslessWriteOption}. */
export interface UseGaslessWriteOptionParameters {
  /**
   * Set when the relayer cannot carry *this* call as the card can build it —
   * e.g. a write the SDK refuses in some input state, or one whose relay needs
   * an input the card has no way to collect. The call is then pinned to the
   * wallet path (`gasless: false`) rather than left to the chain config, and
   * the card's toggle renders disabled with this text as its explanation.
   *
   * Pass the same string to `MethodCard`'s `gaslessBlockedReason` so the header
   * and the call agree — derive both from one local value.
   */
  blockedReason?: string;
}

/**
 * The `gasless` write parameter a card should forward to its mutation.
 *
 * Returns `undefined` until the user actually flips the card's toggle, so an
 * untouched card keeps the SDK's own behavior (the chain config's
 * `gasless.execution.mode` decides) instead of hard-coding today's value into
 * every call. A {@link UseGaslessWriteOptionParameters.blockedReason} overrides
 * that and returns `false`: a card that knows the relay would be refused must
 * say so explicitly, because leaving it `undefined` lets a config on
 * `mode: "gasless"` attempt the relay anyway and fail.
 *
 * @param method - The contract method name, as shown on the card.
 * @param parameters - Optional per-call relay block.
 * @returns `true` to relay this call, `false` to force the wallet path, or
 *   `undefined` to let the config decide.
 *
 * @example
 * ```tsx
 * const gasless = useGaslessWriteOption("depositForAccount");
 * mutation.mutate({ account, amount, gasless });
 * ```
 */
export function useGaslessWriteOption(
  method: string,
  parameters: UseGaslessWriteOptionParameters = {},
): boolean | undefined {
  const { available, enabled, isOverridden } = useGaslessWriteMode(method);
  if (parameters.blockedReason) return false;
  if (!available || !isOverridden) return undefined;
  return enabled;
}
