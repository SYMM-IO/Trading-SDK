"use client";

import { useEffect, useRef, useState } from "react";

export type PriceFlash = "up" | "down" | null;

/** How long a flash stays visible. Shorter than the table's 1s tick throttle,
    so back-to-back ticks each get their own clean flash instead of merging. */
const FLASH_MS = 700;

/**
 * Tracks a live price across renders and reports which way it just moved.
 *
 * A tick is a bare number with no delta of its own — this is the one place
 * that remembers the previous value long enough to compare, then clears
 * itself so the next real change gets a fresh flash rather than an extended one.
 */
export function usePriceFlash(price: number | undefined): PriceFlash {
  const previousRef = useRef(price);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [flash, setFlash] = useState<PriceFlash>(null);

  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = price;
    if (price === undefined || previous === undefined || price === previous) return;

    setFlash(price > previous ? "up" : "down");
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setFlash(null), FLASH_MS);
  }, [price]);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  return flash;
}
