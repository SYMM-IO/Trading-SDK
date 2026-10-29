"use client";

import { Button } from "@symmio/ui/components/button";
import type { ReactNode } from "react";

interface Props {
  /** Prefix for the `data-testid` hooks (`{testId}-item`, `{testId}-remove`, `{testId}-clear`). */
  testId: string;
  items: readonly string[];
  onItemsChange: (items: readonly string[]) => void;
  /** How one item reads in its chip; defaults to the raw text. */
  renderItem?: (item: string) => ReactNode;
  /** The control that adds items — a picker, a paste box, a market select. */
  children: ReactNode;
}

/**
 * A list built one entry at a time: the adder in `children`, then one removable
 * chip per item. The list owns no parsing — the adder hands it items that are
 * already valid — so the same chips serve addresses, hashes, ids and markets.
 */
export function ListInput({ testId, items, onItemsChange, renderItem, children }: Props) {
  return (
    <div className="flex flex-col gap-2">
      {children}
      {items.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5" data-testid={`${testId}-items`}>
          {items.map((item) => (
            <span
              key={item}
              data-testid={`${testId}-item`}
              data-value={item}
              className="border-border/70 bg-muted/40 inline-flex max-w-full items-center gap-1 rounded-md border py-0.5 pr-0.5 pl-2 font-mono text-xs"
            >
              <span className="truncate" title={item}>
                {renderItem ? renderItem(item) : item}
              </span>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                className="size-5 px-0"
                aria-label={`Remove ${item}`}
                data-testid={`${testId}-remove`}
                onClick={() => onItemsChange(items.filter((candidate) => candidate !== item))}
              >
                ✕
              </Button>
            </span>
          ))}
          {items.length > 1 ? (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              data-testid={`${testId}-clear`}
              onClick={() => onItemsChange([])}
            >
              Clear
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** `items` with `added` appended, skipping any already in the list (case-insensitive, for addresses). */
export function appendItems(items: readonly string[], added: readonly string[]): readonly string[] {
  const seen = new Set(items.map((item) => item.toLowerCase()));
  const next = [...items];
  for (const item of added) {
    if (seen.has(item.toLowerCase())) continue;
    seen.add(item.toLowerCase());
    next.push(item);
  }
  return next;
}
