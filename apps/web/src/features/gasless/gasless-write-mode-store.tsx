"use client";

import { useSessionKey } from "@/features/session-keys/use-session-key";
import { useSupportsGaslessService, useSymmioChainId, useSymmioConfig } from "@symmio/trading-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Address } from "viem";
import { getSessionKeyBlockedReason } from "./session-key-write-policy";

/** Where the app-wide session-key default survives a reload. */
const SESSION_KEY_DEFAULT_STORAGE_KEY = "symm:gasless:session-key-default";

interface GaslessWriteModeContextValue {
  /** Per-method relay overrides, keyed by contract method name. */
  relayOverrides: Readonly<Record<string, boolean>>;
  /** Force one method onto (`true`) or off (`false`) the relay. Off takes it off the session key too. */
  setRelayOverride: (method: string, enabled: boolean) => void;
  /** Whether write cards sign with the session key unless a card says otherwise. */
  sessionKeyDefault: boolean;
  /** Set the app-wide default. Clears every card's own choice, so the switch always means "every card". */
  setSessionKeyDefault: (enabled: boolean) => void;
  /** Cards whose signer differs from {@link sessionKeyDefault}, keyed by contract method name. */
  sessionKeyOverrides: Readonly<Record<string, boolean>>;
  /** Sign one method with the session key (`true`) or the connected wallet (`false`). */
  setSessionKeyOverride: (method: string, enabled: boolean) => void;
  /** The browser-local session key, when one is loaded. */
  sessionKeyAddress?: Address;
}

const GaslessWriteModeContext = createContext<GaslessWriteModeContextValue | undefined>(undefined);

/**
 * Holds the dispatch choices a write card sends with its next call: whether it
 * rides the gasless relay, and whether the session key signs it. A card's
 * header controls write here and the card body reads back through
 * {@link useGaslessWriteOption}, so the header and the mutation stay in sync
 * without threading props through every card.
 *
 * The signer has an app-wide default — the session-key switch in the wallet
 * menu — and per-card exceptions. The default persists across reloads, since
 * "sign with my session key" is a standing preference; the exceptions and the
 * relay overrides stay in-memory, because they are "send this one differently"
 * decisions for the session. The persistent, app-wide relay switch is the chain
 * config's `gasless.execution.mode` in the config panel.
 *
 * Mount it inside `SymmioProvider` — the hooks read the resolved chain config
 * and the connected wallet.
 */
export function GaslessWriteModeProvider({ children }: { children: ReactNode }) {
  const [relayOverrides, setRelayOverrides] = useState<Record<string, boolean>>({});
  const [sessionKeyDefault, setSessionKeyDefaultState] = useState(false);
  const [sessionKeyOverrides, setSessionKeyOverrides] = useState<Record<string, boolean>>({});
  /**
   * The one session-key subscription behind every key control. It also loads the
   * connected wallet's stored key (or mints one), which is why it runs once
   * here: read per card, a page of write cards initialized the key once per card.
   */
  const { sessionKeyAddress } = useSessionKey();

  /** Restore the persisted default after mount, so the first client render matches the server's. */
  useEffect(() => {
    try {
      if (localStorage.getItem(SESSION_KEY_DEFAULT_STORAGE_KEY) === "on") setSessionKeyDefaultState(true);
    } catch {
      /* storage unavailable: keep the wallet as the default signer */
    }
  }, []);

  const setSessionKeyDefault = useCallback((enabled: boolean) => {
    setSessionKeyDefaultState(enabled);
    /** Re-baseline every card, so that after "off" nothing signs with the key until a card opts back in. */
    setSessionKeyOverrides({});
    try {
      localStorage.setItem(SESSION_KEY_DEFAULT_STORAGE_KEY, enabled ? "on" : "off");
    } catch {
      /* storage unavailable: the choice still holds for this session */
    }
  }, []);

  const setSessionKeyOverride = useCallback(
    (method: string, enabled: boolean) => {
      setSessionKeyOverrides((prev) => withSessionKeyOverride(prev, method, enabled, sessionKeyDefault));
    },
    [sessionKeyDefault],
  );

  const setRelayOverride = useCallback(
    (method: string, enabled: boolean) => {
      setRelayOverrides((prev) => ({ ...prev, [method]: enabled }));
      /** The session key signs only through the relay, so leaving the relay leaves the key too. */
      if (!enabled) {
        setSessionKeyOverrides((prev) => withSessionKeyOverride(prev, method, false, sessionKeyDefault));
      }
    },
    [sessionKeyDefault],
  );

  const value = useMemo<GaslessWriteModeContextValue>(
    () => ({
      relayOverrides,
      setRelayOverride,
      sessionKeyDefault,
      setSessionKeyDefault,
      sessionKeyOverrides,
      setSessionKeyOverride,
      sessionKeyAddress: sessionKeyAddress ?? undefined,
    }),
    [
      relayOverrides,
      setRelayOverride,
      sessionKeyDefault,
      setSessionKeyDefault,
      sessionKeyOverrides,
      setSessionKeyOverride,
      sessionKeyAddress,
    ],
  );

  return <GaslessWriteModeContext.Provider value={value}>{children}</GaslessWriteModeContext.Provider>;
}

/**
 * A card's session-key exception, recorded only while it differs from the
 * default: choosing the default's value again drops the entry, and with it the
 * card's "overridden" marker.
 */
function withSessionKeyOverride(
  overrides: Readonly<Record<string, boolean>>,
  method: string,
  enabled: boolean,
  defaultEnabled: boolean,
): Record<string, boolean> {
  const next = Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== method));
  if (enabled !== defaultEnabled) next[method] = enabled;
  return next;
}

/** Parameters shared by the per-card hooks below. */
export interface UseGaslessWriteOptionParameters {
  /**
   * Set when the relayer cannot carry *this* call as the card can build it —
   * e.g. a write the SDK refuses in some input state, or one whose relay needs
   * an input the card has no way to collect. The call is then pinned to the
   * wallet path (`gasless: false`) rather than left to the chain config, the
   * card's relay toggle renders disabled with this text as its explanation, and
   * the session key is blocked with it, since the key signs only through the
   * relay.
   *
   * Pass the same string to `MethodCard`'s `gaslessBlockedReason` so the header
   * and the call agree — derive both from one local value.
   */
  blockedReason?: string;
}

/** One card's dispatch state, resolved from the store, the chain config and the policy. */
interface ResolvedWriteMode {
  /** The connected chain has a usable relayer. */
  supported: boolean;
  /** The card's own relay choice, when it made one. */
  relayOverride?: boolean;
  /** Effective relay state, the session key included. */
  relayEnabled: boolean;
  /** Why the session key can never sign this call, when it can't. */
  sessionKeyBlockedReason?: string;
  /** The session key signs this card's next call. */
  sessionKeyEnabled: boolean;
  /** The card's signer differs from the app-wide default. */
  sessionKeyOverridden: boolean;
  sessionKeyAddress?: Address;
  setRelay: (enabled: boolean) => void;
  setSessionKey: (enabled: boolean) => void;
}

/**
 * The single place a card's dispatch is resolved, so the header controls and the
 * call parameters can never disagree.
 *
 * The signer is the card's own exception when it has one, else the app-wide
 * default. The session key signs only through the relay — on the wallet path it
 * holds no gas and is not the account owner — so a card whose key is on is on
 * the relay whatever its own relay choice says. That choice is left untouched
 * and comes back when the key goes off.
 */
function useResolvedWriteMode(
  method: string,
  gaslessBlockedReason: string | undefined,
  hook: string,
): ResolvedWriteMode {
  const ctx = useContext(GaslessWriteModeContext);
  if (!ctx) throw new Error(`${hook} must be used within a GaslessWriteModeProvider`);

  const config = useSymmioConfig();
  const chainId = useSymmioChainId();
  const supported = useSupportsGaslessService();
  const {
    relayOverrides,
    setRelayOverride,
    sessionKeyDefault,
    sessionKeyOverrides,
    setSessionKeyOverride,
    sessionKeyAddress,
  } = ctx;

  const setRelay = useCallback((enabled: boolean) => setRelayOverride(method, enabled), [method, setRelayOverride]);
  const setSessionKey = useCallback(
    (enabled: boolean) => setSessionKeyOverride(method, enabled),
    [method, setSessionKeyOverride],
  );

  /** What the chain config would do on its own, with no per-card override. */
  const configEnabled = supported && config.getChainConfig(chainId).gasless?.execution?.mode === "gasless";
  const relayOverride = relayOverrides[method];

  const sessionKeyBlockedReason =
    getSessionKeyBlockedReason(method) ??
    (gaslessBlockedReason ? "the key signs only through the relay, which this call cannot use" : undefined);
  const sessionKeyOverride = sessionKeyOverrides[method];
  const sessionKeyEnabled =
    supported &&
    sessionKeyAddress !== undefined &&
    sessionKeyBlockedReason === undefined &&
    (sessionKeyOverride ?? sessionKeyDefault);

  return {
    supported,
    relayOverride,
    relayEnabled: gaslessBlockedReason === undefined && (sessionKeyEnabled || (relayOverride ?? configEnabled)),
    sessionKeyBlockedReason,
    sessionKeyEnabled,
    sessionKeyOverridden: sessionKeyOverride !== undefined,
    sessionKeyAddress,
    setRelay,
    setSessionKey,
  };
}

/** How one write card rides — or skips — the gasless relay. */
export interface GaslessWriteMode {
  /**
   * Whether a gasless choice exists at all — i.e. the connected chain has a
   * usable relayer. `false` hides the toggle. Whether the *write itself* is
   * relayable is the card's own declaration (`MethodCard`'s `gaslessRelayable`).
   */
  available: boolean;
  /** Effective relay state: on while the card's session key is on, else its override, else the config. */
  enabled: boolean;
  /** Whether the card made its own relay choice rather than following the config. */
  isOverridden: boolean;
  /** `true` while the card's session key holds it on the relay — the key signs nowhere else. */
  forcedBySessionKey: boolean;
  /** Put this method on (`true`) or off (`false`) the relay. Off takes it off the session key too. */
  setEnabled: (enabled: boolean) => void;
}

/**
 * Read (and set) the gasless dispatch mode for one write method.
 *
 * @param method - The contract method name, as shown on the card.
 * @param parameters - Optional per-call relay block.
 *
 * @example
 * ```tsx
 * const { available, enabled, setEnabled } = useGaslessWriteMode("allocate");
 * ```
 */
export function useGaslessWriteMode(
  method: string,
  parameters: UseGaslessWriteOptionParameters = {},
): GaslessWriteMode {
  const mode = useResolvedWriteMode(method, parameters.blockedReason, "useGaslessWriteMode");
  return {
    available: mode.supported,
    enabled: mode.relayEnabled,
    isOverridden: mode.relayOverride !== undefined,
    forcedBySessionKey: mode.sessionKeyEnabled,
    setEnabled: mode.setRelay,
  };
}

/** Whether one write card is signed by the local session key, and the switch for it. */
export interface SessionKeyWriteMode {
  /**
   * `true` when a session key is loaded and the chain has a relayer — the only
   * path the key can sign on. `false` hides the control.
   */
  available: boolean;
  /**
   * Why the key can never sign this write, when it can't. The control then
   * renders disabled with this text as its explanation.
   */
  blockedReason?: string;
  /** Whether this card's next call is signed by the session key. */
  enabled: boolean;
  /** Whether the card made its own choice rather than following the app-wide default. */
  isOverridden: boolean;
  /** The session key's address, when one is loaded. */
  sessionKeyAddress?: Address;
  /** Sign this card's calls with the session key (`true`) or the connected wallet (`false`). */
  setEnabled: (enabled: boolean) => void;
}

/**
 * Read (and set) whether one write card is signed by the browser-local session
 * key instead of the connected wallet. The card follows the app-wide default
 * ({@link useSessionKeyDefault}) until it is switched itself.
 *
 * This is the app-level half of the SDK's `from` contract: the SDK does no
 * address matching of its own, it just hands `from` to the wallet-client
 * resolver, and `useAppGetWalletClient` returns the session-key client when
 * `from` matches the loaded key.
 *
 * Blocked per *method* — for the writes {@link getSessionKeyBlockedReason}
 * lists — but deliberately **not** per account. Whether the key holds a
 * delegation depends on the account the card picks, and the dispatcher
 * pre-flights that per selector and throws a typed
 * `GASLESS_SIGNER_NOT_DELEGATED`, which is a far more useful thing to show in
 * an inspector than a control that silently disables itself. Grant the
 * selectors on the Session Keys page.
 *
 * @param method - The contract method name, as shown on the card.
 * @param parameters - The card's relay block, which blocks the key as well.
 *
 * @example
 * ```tsx
 * const { available, enabled, setEnabled } = useSessionKeyWriteMode("allocate");
 * ```
 */
export function useSessionKeyWriteMode(
  method: string,
  parameters: { gaslessBlockedReason?: string } = {},
): SessionKeyWriteMode {
  const mode = useResolvedWriteMode(method, parameters.gaslessBlockedReason, "useSessionKeyWriteMode");
  return {
    available: mode.supported && mode.sessionKeyAddress !== undefined,
    blockedReason: mode.sessionKeyBlockedReason,
    enabled: mode.sessionKeyEnabled,
    isOverridden: mode.sessionKeyOverridden,
    sessionKeyAddress: mode.sessionKeyAddress,
    setEnabled: mode.setSessionKey,
  };
}

/** The app-wide session-key default, and the switch for it. */
export interface SessionKeyDefault {
  /**
   * The connected chain has a gasless relayer — the only path the key can sign
   * on. Where it has none the preference still holds, but applies to nothing.
   */
  supported: boolean;
  /** Whether write cards sign with the session key unless a card says otherwise. */
  enabled: boolean;
  /** The session key's address, when one is loaded. */
  sessionKeyAddress?: Address;
  /**
   * Make the session key (`true`) or the connected wallet (`false`) the default
   * signer. Persists across reloads, and clears every card's own choice.
   */
  setEnabled: (enabled: boolean) => void;
}

/**
 * Read (and set) the default signer for every write that can use the session
 * key — one switch instead of one per card. A card switched on its own keeps
 * that exception until the default is flipped again; the Integration flows'
 * account writes follow the default through {@link useFlowWriteOption}.
 *
 * Writes the key can never sign (see {@link getSessionKeyBlockedReason}) are
 * unaffected. The instant-trading flows are too: they always sign with the key.
 *
 * @example
 * ```tsx
 * const { supported, enabled, setEnabled } = useSessionKeyDefault();
 * ```
 */
export function useSessionKeyDefault(): SessionKeyDefault {
  const ctx = useContext(GaslessWriteModeContext);
  if (!ctx) throw new Error("useSessionKeyDefault must be used within a GaslessWriteModeProvider");

  return {
    supported: useSupportsGaslessService(),
    enabled: ctx.sessionKeyDefault,
    sessionKeyAddress: ctx.sessionKeyAddress,
    setEnabled: ctx.setSessionKeyDefault,
  };
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
   * the card signs with it, otherwise absent so the resolver falls back to the
   * connected wallet.
   */
  from?: Address;
}

/**
 * The write parameters a card should forward to its mutation.
 *
 * `gasless` is `undefined` until the user actually flips the card's relay
 * toggle, so an untouched card keeps the SDK's own behavior (the chain config
 * decides) instead of hard-coding today's value into every call. A
 * {@link UseGaslessWriteOptionParameters.blockedReason} overrides that and
 * returns `false`: a card that knows the relay would be refused must say so
 * explicitly, because leaving it `undefined` lets a config on `mode: "gasless"`
 * attempt the relay anyway and fail.
 *
 * Signing with the session key returns `{ gasless: true, from: <key> }`
 * together, never `from` alone: on the wallet path the key holds no gas and is
 * not the account owner, so that call could only fail.
 *
 * Spread it into the mutation rather than picking fields off it, so a field
 * added here can never be silently dropped at a call site.
 *
 * @param method - The contract method name, as shown on the card.
 * @param parameters - Optional per-call relay block.
 *
 * @example
 * ```tsx
 * const write = useGaslessWriteOption("allocate");
 * mutation.mutate({ account, amount, ...write });
 * ```
 */
export function useGaslessWriteOption(
  method: string,
  parameters: UseGaslessWriteOptionParameters = {},
): GaslessWriteOption {
  const mode = useResolvedWriteMode(method, parameters.blockedReason, "useGaslessWriteOption");

  if (parameters.blockedReason) return { gasless: false };
  if (mode.sessionKeyEnabled) return { gasless: true, from: mode.sessionKeyAddress };
  if (!mode.supported || mode.relayOverride === undefined) return { gasless: undefined };
  return { gasless: mode.relayEnabled };
}

/**
 * The write parameters for a write with no card of its own — an Integration
 * flow step. It follows the app-wide session-key default only: there is no
 * card toggle whose exception could apply, and no relay toggle either, so with
 * the key off it adds nothing and the chain config decides, exactly as before.
 *
 * A write the key can never sign ({@link getSessionKeyBlockedReason}) stays on
 * the wallet whatever the default says. A signable one still needs its
 * delegation on the flow's sub-account; without it the SDK's pre-flight throws
 * `GASLESS_SIGNER_NOT_DELEGATED`, naming the selectors to grant.
 *
 * Spread it into the mutation, like {@link useGaslessWriteOption}.
 *
 * @param method - The contract method the step sends, checked against the never-signable list.
 *
 * @example
 * ```tsx
 * const write = useFlowWriteOption("requestToCancelQuote");
 * cancel.mutate({ account, quoteId, ...write });
 * ```
 */
export function useFlowWriteOption(method: string): GaslessWriteOption {
  const ctx = useContext(GaslessWriteModeContext);
  if (!ctx) throw new Error("useFlowWriteOption must be used within a GaslessWriteModeProvider");

  const supported = useSupportsGaslessService();
  const { sessionKeyDefault, sessionKeyAddress } = ctx;

  if (!supported || !sessionKeyDefault || sessionKeyAddress === undefined) return {};
  if (getSessionKeyBlockedReason(method) !== undefined) return {};
  return { gasless: true, from: sessionKeyAddress };
}
