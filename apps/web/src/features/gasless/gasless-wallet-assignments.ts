"use client";

import { useSymmioChainId, useSymmioConfig, useWalletAccount } from "@symmio/trading-react";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { Address } from "viem";

/**
 * Which wallet id each gasless flow on this page uses, remembered per browser.
 *
 * A GaslessWallet is identified by `(owner, walletId)` — every id is a separate
 * address with its own balance, and a deposit settlement sweeps the *whole*
 * balance of the id it names. Which id a workflow belongs to is therefore app
 * state, not chain state: nothing on-chain says "wallet 3 is where this user's
 * deposits land", so the app has to remember it or it will fund one wallet and
 * sweep another.
 *
 * The record is keyed by the deployment *and* the owner, because the same id
 * means a different wallet on a different GaslessLayer, a different protocol
 * instance or for a different owner. Every storage touch is guarded: the store
 * is a convenience, and a browser that refuses it still renders the default.
 */

/** Single localStorage entry holding the whole scope → assignment record. */
const STORAGE_KEY = "symmio.gasless.wallet-assignments.v1";

/** Which of the page's two gasless-wallet flows an id is remembered for. */
export type GaslessWalletSlot = "deposit" | "execute";

/**
 * The wallet ids one owner uses on one deployment. Stored as the text that was
 * typed, so an in-progress edit round-trips; validate with
 * {@link parseGaslessWalletIdText} before sending anything on-chain.
 */
export interface GaslessWalletAssignments {
  /** Wallet id the deposit card funds and settles. */
  deposit: string;
  /** Wallet id the wallet-execute card runs its batch from. */
  execute: string;
}

/** Everything that makes a pair of wallet ids mean one pair of addresses. */
export interface GaslessWalletAssignmentScope {
  /** Chain the GaslessLayer lives on. */
  chainId: number;
  /** The GaslessLayer that derives the wallet addresses. */
  gaslessLayerAddress: Address;
  /** Protocol instance the requests are routed to — empty when the url pins it. */
  protocolInstance: string;
  /** Owner the wallets belong to (the connected wallet). */
  owner: Address;
}

/** Wallet `0` is the original wallet, and the id every SDK call defaults to. */
export const DEFAULT_GASLESS_WALLET_ASSIGNMENTS: GaslessWalletAssignments = { deposit: "0", execute: "0" };

const listeners = new Set<() => void>();
let storageListenerBound = false;

/**
 * The record key for one owner on one deployment.
 *
 * @param scope - Chain, GaslessLayer, protocol instance and owner.
 * @returns The key the assignments are stored under.
 */
export function gaslessWalletAssignmentKey(scope: GaslessWalletAssignmentScope): string {
  return `${scope.chainId}:${scope.gaslessLayerAddress}:${scope.protocolInstance}:${scope.owner}`;
}

function bindStorageListener(): void {
  if (storageListenerBound || typeof window === "undefined") return;
  storageListenerBound = true;
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      for (const listener of listeners) listener();
    }
  });
}

/** Subscribe to assignment changes (this tab and others). Returns the unsubscribe. */
export function subscribeGaslessWalletAssignments(listener: () => void): () => void {
  bindStorageListener();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Raw snapshot for `useSyncExternalStore` — the unparsed string stays referentially stable. */
export function readGaslessWalletAssignmentsRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function parseRecord(raw: string | null): Record<string, Partial<GaslessWalletAssignments>> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, Partial<GaslessWalletAssignments>>)
      : {};
  } catch {
    return {};
  }
}

function pickAssignments(
  record: Record<string, Partial<GaslessWalletAssignments>>,
  key: string,
): GaslessWalletAssignments {
  const entry = record[key];
  return {
    deposit: typeof entry?.deposit === "string" ? entry.deposit : DEFAULT_GASLESS_WALLET_ASSIGNMENTS.deposit,
    execute: typeof entry?.execute === "string" ? entry.execute : DEFAULT_GASLESS_WALLET_ASSIGNMENTS.execute,
  };
}

/**
 * Read one scope's assignments out of a raw snapshot. Anything missing or not a
 * string reads as wallet `0`.
 *
 * @param raw - The unparsed snapshot, as {@link readGaslessWalletAssignmentsRaw} returns it.
 * @param key - The scope key from {@link gaslessWalletAssignmentKey}.
 * @returns The remembered pair, defaulted.
 */
export function parseGaslessWalletAssignments(raw: string | null, key: string): GaslessWalletAssignments {
  return pickAssignments(parseRecord(raw), key);
}

/**
 * Remember one slot's wallet id for one scope.
 *
 * @param scope - Chain, GaslessLayer, protocol instance and owner.
 * @param slot - Which flow the id belongs to.
 * @param walletId - The id as typed; stored verbatim so an edit round-trips.
 */
export function storeGaslessWalletAssignment(
  scope: GaslessWalletAssignmentScope,
  slot: GaslessWalletSlot,
  walletId: string,
): void {
  try {
    const key = gaslessWalletAssignmentKey(scope);
    const record = parseRecord(readGaslessWalletAssignmentsRaw());
    const current = pickAssignments(record, key);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...record, [key]: { ...current, [slot]: walletId } }));
    for (const listener of listeners) listener();
  } catch {
    /** Storage may be unavailable (SSR, private mode) — remembering is best-effort. */
  }
}

/** What {@link useGaslessWalletAssignments} returns. */
export interface UseGaslessWalletAssignmentsResult {
  /** The remembered pair for this scope, defaulted to wallet `0`. */
  assignments: GaslessWalletAssignments;
  /** Write one slot. A no-op while the scope is unknown (no wallet connected). */
  setAssignment: (slot: GaslessWalletSlot, walletId: string) => void;
}

/**
 * Subscribe to the wallet ids remembered for one owner on one deployment.
 *
 * Both gasless cards read the same store, so the deposit card can warn that its
 * id collides with the execute card's without either owning the other's state.
 *
 * @param scope - The deployment and owner, or `null` while either is unknown.
 * @returns The remembered pair and a setter.
 *
 * @example
 * ```tsx
 * const { assignments, setAssignment } = useGaslessWalletAssignments(scope);
 * <WalletIdField value={assignments.deposit} onChange={(next) => setAssignment("deposit", next)} />
 * ```
 */
export function useGaslessWalletAssignments(
  scope: GaslessWalletAssignmentScope | null,
): UseGaslessWalletAssignmentsResult {
  const raw = useSyncExternalStore(
    subscribeGaslessWalletAssignments,
    readGaslessWalletAssignmentsRaw,
    /** No storage on the server: hydrate from the defaults, then re-read on the client. */
    () => null,
  );
  const key = scope ? gaslessWalletAssignmentKey(scope) : null;
  const assignments = useMemo(
    () => (key === null ? DEFAULT_GASLESS_WALLET_ASSIGNMENTS : parseGaslessWalletAssignments(raw, key)),
    [raw, key],
  );

  const setAssignment = useCallback(
    (slot: GaslessWalletSlot, walletId: string) => {
      if (!scope) return;
      storeGaslessWalletAssignment(scope, slot, walletId);
    },
    [scope],
  );

  return { assignments, setAssignment };
}

/**
 * Build the assignment scope from the connected wallet and the chain's resolved
 * gasless block, memoized so it is safe to pass to
 * {@link useGaslessWalletAssignments}.
 *
 * @returns The scope, or `null` while no wallet is connected or the chain has no gasless block.
 *
 * @example
 * ```tsx
 * const { assignments, setAssignment } = useGaslessWalletAssignments(useGaslessWalletAssignmentScope());
 * ```
 */
export function useGaslessWalletAssignmentScope(): GaslessWalletAssignmentScope | null {
  const { address } = useWalletAccount();
  const chainId = useSymmioChainId();
  const gasless = useSymmioConfig().getChainConfig(chainId).gasless;
  const gaslessLayerAddress = gasless?.gaslessLayerAddress;
  const protocolInstance = gasless?.protocolInstance ?? "";

  return useMemo(
    () => (address && gaslessLayerAddress ? { chainId, gaslessLayerAddress, protocolInstance, owner: address } : null),
    [address, chainId, gaslessLayerAddress, protocolInstance],
  );
}
