"use client";

import { useEffect, useState } from "react";

/**
 * Trail a fast-changing value.
 *
 * The catalog's search, chain and status controls are all **server-side**: each
 * keystroke would otherwise be its own request and its own cache entry. This
 * debounces the value, not the request — combined with `placeholderData` the
 * table keeps the last page on screen while the trailing fetch runs, so the
 * grid never blinks.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
