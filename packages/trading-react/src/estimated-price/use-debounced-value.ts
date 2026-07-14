"use client";

import { useEffect, useState } from "react";

/**
 * Debounce a fast-changing value: returns `value` only after it has stayed
 * unchanged for `delayMs`. Used to hold back solver requests while the user is
 * still typing an amount. A `delayMs <= 0` passes the value through immediately.
 *
 * @internal
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (delayMs <= 0) {
      setDebounced(value);
      return;
    }
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
