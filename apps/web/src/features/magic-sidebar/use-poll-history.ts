"use client";

import { useEffect, useRef, useState } from "react";

/** One observed response in a live polling session. */
export interface PollHistoryEntry<T> {
  /** Monotonic id for stable React keys. */
  id: number;
  /** The response snapshot. */
  data: T;
  /** Wall-clock time this snapshot was first observed (ms epoch). */
  at: number;
  /** True once a newer, different response has superseded this one. */
  stale: boolean;
}

/**
 * Order-independent JSON string of a value, with `bigint` support, so two
 * responses that differ only in key order are treated as equal.
 */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (typeof val === "bigint") return `${val}n`;
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const record = val as Record<string, unknown>;
      return Object.fromEntries(
        Object.keys(record)
          .sort()
          .map((key) => [key, record[key]]),
      );
    }
    return val;
  });
}

/**
 * Accumulate a capped history of distinct poll responses. Each time `data`
 * changes (by value, not reference), the new response is prepended as the
 * current entry and every prior entry is marked stale. Identical consecutive
 * responses are ignored, so the history only grows when the data actually
 * changes.
 *
 * Reset by remounting (the sidebar does this when it opens or the pinned method
 * changes), so each polling session has its own history.
 *
 * @param data - The latest response, or `undefined` before the first fetch.
 * @param updatedAt - The fetch timestamp (e.g. react-query `dataUpdatedAt`).
 * @param max - Maximum entries to retain. Defaults to 10.
 * @returns Newest-first history, with the current entry at index 0.
 */
export function usePollHistory<T>(data: T | undefined, updatedAt: number, max = 10): PollHistoryEntry<T>[] {
  const [entries, setEntries] = useState<PollHistoryEntry<T>[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    if (data === undefined || updatedAt === 0) return;
    setEntries((prev) => {
      const key = stableStringify(data);
      const head = prev[0];
      if (head && stableStringify(head.data) === key) return prev;
      const entry: PollHistoryEntry<T> = { id: nextId.current++, data, at: updatedAt, stale: false };
      const staled = prev.map((e) => (e.stale ? e : { ...e, stale: true }));
      return [entry, ...staled].slice(0, max);
    });
  }, [updatedAt, data, max]);

  return entries;
}
