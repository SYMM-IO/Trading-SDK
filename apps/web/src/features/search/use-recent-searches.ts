"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "symm:search:recent";
const LIMIT = 6;

/**
 * A small most-recently-used list of selected search-entry ids, persisted to
 * `localStorage`. SSR-safe: starts empty and hydrates after mount, so the first
 * client render matches the server.
 */
export function useRecentSearches() {
  const [recentIds, setRecentIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setRecentIds(JSON.parse(raw) as string[]);
    } catch {
      /* ignore unreadable/corrupt storage */
    }
  }, []);

  const push = useCallback((id: string) => {
    setRecentIds((prev) => {
      const next = [id, ...prev.filter((existing) => existing !== id)].slice(0, LIMIT);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota/availability errors */
      }
      return next;
    });
  }, []);

  return { recentIds, push };
}
