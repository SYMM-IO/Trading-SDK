import { useInput } from "ink";
import { useEffect, useMemo, useState } from "react";
import type { MarketMeta } from "../../sdk/use-markets.js";
import { useAppState } from "../app-state.js";

interface Options {
  active: boolean;
  initialSearching?: boolean;
  onEnter?: (market: MarketMeta) => void;
}

export interface MarketFilter {
  query: string;
  searching: boolean;
  filtered: MarketMeta[];
  index: number;
  selected?: MarketMeta;
}

/**
 * Incremental, fzf-style market search bound to the shared `marketId`. Press `/`
 * to search; typing filters live and ↑/↓ move through the results; `⏎` fires
 * `onEnter`; `esc` clears. Selection lives in app state so the Markets tab, the
 * Trade ticket, and the picker overlay all stay in sync.
 */
export function useMarketFilter(
  markets: MarketMeta[],
  { active, initialSearching = false, onEnter }: Options,
): MarketFilter {
  const { marketId, setMarketId, setTextEditing } = useAppState();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(initialSearching);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return markets;
    return markets.filter(
      (market) => market.symbol.toLowerCase().includes(needle) || market.name.toLowerCase().includes(needle),
    );
  }, [markets, query]);

  const index = Math.max(
    0,
    filtered.findIndex((market) => market.symbolId === marketId),
  );
  const selected = filtered[index];

  useEffect(() => {
    if (filtered.length > 0 && !filtered.some((market) => market.symbolId === marketId)) {
      setMarketId(filtered[0]!.symbolId);
    }
  }, [filtered, marketId, setMarketId]);

  useEffect(() => {
    setTextEditing(active && searching);
    return () => setTextEditing(false);
  }, [active, searching, setTextEditing]);

  function move(delta: number) {
    const next = Math.min(filtered.length - 1, Math.max(0, index + delta));
    const market = filtered[next];
    if (market) setMarketId(market.symbolId);
  }

  useInput(
    (input, key) => {
      if (key.upArrow) return move(-1);
      if (key.downArrow) return move(1);

      if (searching) {
        if (key.return) {
          setSearching(false);
          if (selected && onEnter) onEnter(selected);
        } else if (key.escape) {
          setSearching(false);
          setQuery("");
        } else if (key.backspace || key.delete) {
          setQuery((current) => current.slice(0, -1));
        } else if (input.length === 1 && !key.ctrl && !key.meta) {
          setQuery((current) => current + input);
        }
        return;
      }

      if (input === "/") setSearching(true);
      else if (key.return && selected && onEnter) onEnter(selected);
      else if (input === "j") move(1);
      else if (input === "k") move(-1);
      else if (input === "g") setMarketId(filtered[0]?.symbolId ?? marketId ?? 0);
      else if (input === "G") setMarketId(filtered[filtered.length - 1]?.symbolId ?? marketId ?? 0);
    },
    { isActive: active },
  );

  return { query, searching, filtered, index, selected };
}
