"use client";

import type { PendingInstantOpen } from "@symmio/trading-core";
import { create } from "zustand";

/**
 * Store state plus the mutators used to update it. Holds only optimistic
 * instant-open records that a poll has not yet observed, keyed by their hedger
 * `tempQuoteId`.
 */
export interface OptimisticQuotesStoreState {
  /**
   * Optimistic instant-open records awaiting their first poll, keyed by `tempQuoteId`.
   */
  entries: Record<number, PendingInstantOpen>;
  /**
   * Wipe every optimistic entry.
   */
  clear: () => void;
  /**
   * Insert (or overwrite) an optimistic instant-open. Keyed by `entry.tempQuoteId`.
   */
  add: (entry: PendingInstantOpen) => void;
  /**
   * Drop every entry whose `tempQuoteId` now appears on-chain (so the poll owns
   * it and the optimistic seed is no longer needed). No-op for unknown ids.
   */
  clearSettled: (seenTempQuoteIds: readonly number[]) => void;
}

/**
 * Cross-component bridge for optimistic instant-opens. When a `useInstantOpen`
 * mutation succeeds, the host seeds the freshly returned {@link PendingInstantOpen}
 * here so {@link useManagedQuotes} can render the new row instantly — before the
 * first hedger/on-chain poll observes it — then `clearSettled` removes the seed
 * once the real row lands.
 *
 * Usage is identical to any zustand store — call `useOptimisticQuotesStore()`
 * from a component to subscribe to the full state, or pass a selector for
 * fine-grained subscriptions.
 *
 * @example
 * const add = useOptimisticQuotesStore((s) => s.add);
 * const pending = await instantOpen(variables);
 * add(pending);
 *
 * @example
 * const entries = useOptimisticQuotesStore((s) => s.entries);
 * const seeds = Object.values(entries);
 */
export const useOptimisticQuotesStore = create<OptimisticQuotesStoreState>((set) => ({
  entries: {},
  clear: () => set({ entries: {} }),
  add: (entry) => set((state) => ({ entries: { ...state.entries, [entry.tempQuoteId]: entry } })),
  clearSettled: (seenTempQuoteIds) =>
    set((state) => {
      if (seenTempQuoteIds.length === 0) return state;

      const seen = new Set(seenTempQuoteIds);

      let changed = false;
      const next: Record<number, PendingInstantOpen> = {};

      for (const [id, entry] of Object.entries(state.entries)) {
        if (seen.has(Number(id))) {
          changed = true;
          continue;
        }
        next[Number(id)] = entry;
      }

      return changed ? { entries: next } : state;
    }),
}));
