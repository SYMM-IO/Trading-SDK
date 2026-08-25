"use client";

import { useEffect, useState } from "react";

/**
 * Trail `value` by `delayMs`, resetting the timer on every change.
 *
 * Used to keep a search box responsive while the query behind it is
 * server-side: the input updates on every keystroke, the request does not.
 *
 * @param value - The value to trail.
 * @param delayMs - Quiet period before the trailing value catches up.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
