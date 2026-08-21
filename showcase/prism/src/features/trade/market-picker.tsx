"use client";

import { FAMILY_PALETTE } from "@/config/deployments";
import { groupByFamily } from "@/features/markets/balanced-groups";
import type { PrismMarket } from "@/features/markets/types";
import { usePrismPrices, useTickSignal } from "@/features/prices/price-provider";
import { cn } from "@/lib/cn";
import { formatPrice, marketDisplayName } from "@/lib/format";
import { useMemo, useState } from "react";

export interface MarketPickerProps {
  markets: readonly PrismMarket[];
  selected?: PrismMarket;
  onSelect: (key: string) => void;
}

/** How many rows the list may render before the search field has to narrow it. */
const RESULT_BUDGET = 60;

/**
 * Market switcher.
 *
 * Searches across both solvers at once — the merged book is the default, and
 * each result keeps its own family color so the source is never ambiguous.
 *
 * The rows are budgeted per family rather than sliced off the front of the
 * merged list: the merged sort is by `maxNotionalValue`, a per-solver tier, so
 * a flat slice showed 60 lowcaps and not one majors market. Grouping the
 * budget makes the unified list actually unified, and the section headers say
 * how much of each family is still behind the search field.
 */
export function MarketPicker({ markets, selected, onSelect }: MarketPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { priceOf } = usePrismPrices();
  /* The list reads hundreds of markets, so one throttled repaint is cheaper
     than a subscription per row. */
  useTickSignal(1000);

  const { groups, shown, matched } = useMemo(() => {
    const needle = query.trim().toLowerCase();
    /* A pool-priced market's identity in the wild is its token address, and the
       SDK puts it on the Enigma variant — so the search offer of "a ticker or a
       contract address" is one the picker can actually keep. Narrowing on
       `kind` is what makes the field reachable at all: a Rasa market has none. */
    const filtered = needle
      ? markets.filter(
          (entry) =>
            entry.market.name.toLowerCase().includes(needle) ||
            entry.market.symbol.toLowerCase().includes(needle) ||
            (entry.market.kind === "enigma" && entry.market.tokenAddress.toLowerCase().includes(needle)),
        )
      : markets;

    const grouped = groupByFamily(filtered, RESULT_BUDGET);

    return {
      groups: grouped,
      shown: grouped.reduce((total, group) => total + group.shown.length, 0),
      matched: filtered.length,
    };
  }, [markets, query]);

  /* Read off the whole book, not the filtered set, so the field does not
     rename itself the moment a query happens to match one family. */
  const familyCount = useMemo(() => new Set(markets.map((entry) => entry.family)).size, [markets]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex cursor-pointer items-center gap-2.5 rounded-md border border-line bg-bg-2 px-3 py-2 transition-colors duration-[var(--dur-fast)] hover:border-line-strong"
      >
        {selected ? (
          <>
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ background: FAMILY_PALETTE[selected.family].base }}
            />
            <span className="font-display text-lg font-semibold text-fg-0">
              {marketDisplayName(selected.market.name)}
            </span>
            <span className="text-sm text-fg-3">{selected.deployment.chainName}</span>
          </>
        ) : (
          <span className="text-md text-fg-3">Select market</span>
        )}
        <svg viewBox="0 0 12 12" className="size-3 text-fg-3" aria-hidden>
          <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="prism-rise absolute left-0 z-40 mt-2 flex w-[420px] flex-col rounded-lg border border-line bg-bg-1 shadow-[var(--shadow-pop)]">
            <div className="border-b border-line-subtle p-2">
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={familyCount > 1 ? "Search both solvers…" : "Search markets…"}
                className="w-full rounded-md bg-bg-2 px-3 py-2 text-md text-fg-0 outline-none placeholder:text-fg-3"
              />
            </div>
            <div className="max-h-[380px] overflow-y-auto">
              {shown === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-fg-3">
                  Nothing matches that. Try a ticker or a contract address.
                </p>
              ) : (
                groups.map((group) => (
                  <section key={group.family} className="border-t border-line-subtle first:border-t-0">
                    <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-line-subtle bg-bg-1 px-3 py-1.5">
                      <span
                        className="flex items-center gap-1.5 font-mono text-2xs font-semibold tracking-[0.12em] uppercase"
                        style={{ color: FAMILY_PALETTE[group.family].base }}
                      >
                        <span
                          aria-hidden
                          className="size-1.5 shrink-0 rounded-full"
                          style={{ background: FAMILY_PALETTE[group.family].base }}
                        />
                        {group.label}
                      </span>
                      <span className="tnum text-2xs text-fg-3">
                        {group.shown.length === group.matched
                          ? group.matched
                          : `${group.shown.length} of ${group.matched}`}
                      </span>
                    </header>

                    {group.shown.map((entry) => {
                      const price = priceOf(entry.family, entry.market.name);
                      return (
                        <button
                          key={entry.key}
                          type="button"
                          onClick={() => {
                            onSelect(entry.key);
                            setOpen(false);
                            setQuery("");
                          }}
                          className={cn(
                            "flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left",
                            "transition-colors duration-[var(--dur-fast)] hover:bg-bg-2",
                            entry.key === selected?.key ? "bg-bg-2" : null,
                          )}
                        >
                          <span
                            aria-hidden
                            className="size-1.5 shrink-0 rounded-full"
                            style={{ background: FAMILY_PALETTE[entry.family].base }}
                          />
                          <span className="min-w-0 flex-1 truncate font-display text-md font-semibold text-fg-0">
                            {marketDisplayName(entry.market.name)}
                          </span>
                          <span className="tnum w-24 text-right text-sm text-fg-1">
                            {price === undefined ? "—" : formatPrice(price)}
                          </span>
                        </button>
                      );
                    })}
                  </section>
                ))
              )}
            </div>
            {matched > shown ? (
              <p className="border-t border-line-subtle px-3 py-2 text-2xs text-fg-3">
                Showing {shown} of {matched} matches — keep typing to narrow.
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
