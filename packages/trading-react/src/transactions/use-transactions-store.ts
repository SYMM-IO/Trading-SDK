"use client";

import type { Hash } from "viem";
import { create } from "zustand";

/**
 * State of a single tracked transaction.
 */
export interface TrackedTx {
  /** Transaction hash. Unique within a chain. */
  hash: Hash;
  /** Chain id the transaction was broadcast on. */
  chainId: number;
  /** Short human-readable label, e.g. `"Rename account"`. Shown in toasts. */
  label: string;
  /** Status the tx is in. Updated when the host calls `markConfirmed` / `markFailed`. */
  status: "pending" | "confirmed" | "failed";
  /** `Date.now()` at insertion time. Used for ordering. */
  createdAt: number;
}

/**
 * Store state plus the mutators used to update it.
 */
export interface TransactionsStoreState {
  txs: readonly TrackedTx[];
  /** Insert a pending transaction. Duplicate hashes are ignored. */
  add: (tx: Omit<TrackedTx, "status" | "createdAt">) => void;
  /** Promote a pending tx to `confirmed`. No-op if the hash is not tracked. */
  markConfirmed: (hash: Hash) => void;
  /** Promote a pending tx to `failed`. No-op if the hash is not tracked. */
  markFailed: (hash: Hash) => void;
  /** Wipe every tracked transaction. */
  clear: () => void;
}

/**
 * Lightweight zustand store for tracking in-flight transactions in the UI —
 * the data backing pending-tx badges, post-confirmation toasts, and "view in
 * explorer" links. Opt-in: hooks like `useEditAccountName` do **not** populate
 * this store automatically; the host wires it up.
 *
 * Usage is identical to any zustand store — call `useTransactionsStore()` from
 * a component to subscribe to the full state, or pass a selector for fine-
 * grained subscriptions:
 *
 * @example
 * const pending = useTransactionsStore((s) => s.txs.filter((t) => t.status === "pending"));
 *
 * @example
 * const { add, markConfirmed } = useTransactionsStore();
 * const hash = await sendTx();
 * add({ hash, chainId, label: "Rename account" });
 * await waitFor(hash);
 * markConfirmed(hash);
 */
export const useTransactionsStore = create<TransactionsStoreState>((set) => ({
  txs: [],
  add: (tx) =>
    set((state) => {
      if (state.txs.some((existing) => existing.hash === tx.hash)) return state;
      return {
        txs: [...state.txs, { ...tx, status: "pending", createdAt: Date.now() }],
      };
    }),
  markConfirmed: (hash) =>
    set((state) => ({
      txs: state.txs.map((tx) => (tx.hash === hash ? { ...tx, status: "confirmed" } : tx)),
    })),
  markFailed: (hash) =>
    set((state) => ({
      txs: state.txs.map((tx) => (tx.hash === hash ? { ...tx, status: "failed" } : tx)),
    })),
  clear: () => set({ txs: [] }),
}));
