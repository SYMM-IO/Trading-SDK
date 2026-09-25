import { useEffect, useRef, useState } from "react";
import { useLivePrices } from "./use-prices.js";

/**
 * A rolling in-memory price history for one market, sampled from the live feed.
 * Feeds the detail sparkline. History resets when the market changes.
 */
export function usePriceHistory(name?: string, cap = 80): number[] {
  const { prices } = useLivePrices();
  const [series, setSeries] = useState<number[]>([]);
  const currentName = useRef<string | undefined>(undefined);

  const raw = name ? prices.get(name) : undefined;

  useEffect(() => {
    if (currentName.current !== name) {
      currentName.current = name;
      setSeries([]);
      return;
    }
    if (raw == null) return;
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    setSeries((prev) => {
      if (prev.length > 0 && prev[prev.length - 1] === value) return prev;
      return [...prev, value].slice(-cap);
    });
  }, [name, raw, cap]);

  return series;
}
