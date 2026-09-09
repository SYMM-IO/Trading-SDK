"use client";

import { useSessionKey } from "@/features/session-keys/use-session-key";
import { useSupportsGaslessService, useSymmioChainId, useSymmioConfig } from "@symmio/trading-react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Address } from "viem";

interface GaslessWriteModeContextValue {
  /** Per-method relay overrides, keyed by contract method name. */
  overrides: Readonly<Record<string, boolean>>;
  /** Force one method onto (`true`) or off (`false`) the relay. */
  setOverride: (method: string, enabled: boolean) => void;
  /** Whether relayable writes should be signed by the local session key. */
  signWithSessionKey: boolean;
  /** Turn session-key signing on or off for every relayable card. */
  setSignWithSessionKey: (enabled: boolean) => void;
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
  const [signWithSessionKey, setSignWithSessionKey] = useState(false);

  const setOverride = useCallback((method: string, enabled: boolean) => {
    setOverrides((prev) => ({ ...prev, [method]: enabled }));
  }, []);

  const value = useMemo<GaslessWriteModeContextValue>(
    () => ({ overrides, setOverride, signWithSessionKey, setSignWithSessionKey }),
    [overrides, setOverride, signWithSessionKey],
  );

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
/** Whether the app can sign relayable writes with the local session key, and the switch for it. */
export interface SessionKeySigning {
  /** `true` when a session key is loaded and can therefore be named as the signer. */
  available: boolean;
  /** Whether relayable writes are currently routed to the session key. */
  enabled: boolean;
  /** The session key's address, when one is loaded. */
  sessionKeyAddress?: Address;
  /** Route relayable writes to the session key (`true`) or the owner wallet (`false`). */
  setEnabled: (enabled: boolean) => void;
}

/**
 * Read (and set) whether relayable writes are signed by the browser-local
 * session key instead of the connected wallet.
 *
 * This is the app-level half of the SDK's `from` contract: the SDK does no
 * address matching of its own, it just hands `from` to the wallet-client
 * resolver, and `useAppGetWalletClient` returns the session-key client when
 * `from` matches the loaded key.
 *
 * Deliberately **not** gated on whether the key holds the right delegation.
 * The dispatcher pre-flights that per selector and throws a typed
 * `GASLESS_SIGNER_NOT_DELEGATED`, which is a far more useful thing to show in
 * an inspector than a control that silently disables itself. Grant the
 * selectors on the Session Keys page.
 */
export function useSessionKeySigning(): SessionKeySigning {
  const ctx = useContext(GaslessWriteModeContext);
  if (!ctx) throw new Error("useSessionKeySigning must be used within a GaslessWriteModeProvider");

  const { sessionKeyAddress } = useSessionKey();
  const { signWithSessionKey, setSignWithSessionKey } = ctx;

  return {
    available: Boolean(sessionKeyAddress),
    enabled: Boolean(sessionKeyAddress) && signWithSessionKey,
    sessionKeyAddress: sessionKeyAddress ?? undefined,
    setEnabled: setSignWithSessionKey,
  };
}

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

/** The write parameters a card forwards to its mutation. */
export interface GaslessWriteOption {
  /**
   * `true` to relay this call, `false` to force the wallet path, or `undefined`
   * to let the chain config's `gasless.execution.mode` decide.
   */
  gasless?: boolean;
  /**
   * Signer to resolve the wallet client with — the session key's address when
   * session-key signing is on, otherwise `undefined` so the resolver falls back
   * to the connected wallet.
   */
  from?: Address;
}

/**
 * The write parameters a card should forward to its mutation.
 *
 * `gasless` is `undefined` until the user actually flips the card's toggle, so
 * an untouched card keeps the SDK's own behavior (the chain config decides)
 * instead of hard-coding today's value into every call. A
 * {@link UseGaslessWriteOptionParameters.blockedReason} overrides that and
 * returns `false`: a card that knows the relay would be refused must say so
 * explicitly, because leaving it `undefined` lets a config on `mode: "gasless"`
 * attempt the relay anyway and fail.
 *
 * `from` carries the session key when session-key signing is on. It is set
 * independently of `gasless`, because the two are orthogonal: the SDK resolves
 * the signer the same way on the wallet path, and a session key that is not the
 * account owner will be rejected there by `onlyAccountOwner` — which is the
 * honest failure to surface rather than one this hook papers over.
 *
 * Spread it into the mutation rather than picking fields off it, so a field
 * added here can never be silently dropped at a call site.
 *
 * @param method - The contract method name, as shown on the card.
 * @param parameters - Optional per-call relay block.
 *
 * @example
 * ```tsx
 * const write = useGaslessWriteOption("depositForAccount");
 * mutation.mutate({ account, amount, ...write });
 * ```
 */
export function useGaslessWriteOption(
  method: string,
  parameters: UseGaslessWriteOptionParameters = {},
): GaslessWriteOption {
  const { available, enabled, isOverridden } = useGaslessWriteMode(method);
  const sessionKey = useSessionKeySigning();

  const from = sessionKey.enabled ? sessionKey.sessionKeyAddress : undefined;

  if (parameters.blockedReason) return { gasless: false, from };
  if (!available || !isOverridden) return { gasless: undefined, from };
  return { gasless: enabled, from };
}
