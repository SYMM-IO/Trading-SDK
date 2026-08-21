"use client";

import type { DelegationSelector } from "@/features/wallet/use-trading-delegation";
import { cn } from "@/lib/cn";

export interface SelectorListProps {
  selectors: readonly DelegationSelector[];
  className?: string;
}

/**
 * Each function selector the session key needs, with its grant state.
 *
 * Shown wherever a grant is explained — the row's detail and the authorise
 * sheet — so a partial grant is legible as "close is missing" rather than a
 * bare "not authorised". A selector the account's margin model never calls is
 * listed but dimmed: it is granted anyway, and saying so avoids a puzzle.
 */
export function SelectorList({ selectors, className }: SelectorListProps) {
  return (
    <ul className={cn("flex flex-col gap-1", className)}>
      {selectors.map((selector) => (
        <li key={selector.label} className="flex items-center gap-2 text-sm">
          <span aria-hidden className={cn("size-[6px] shrink-0 rounded-full", dotClass(selector))} />
          <span className={selector.isRequired ? "text-fg-1" : "text-fg-3"}>{selector.label}</span>
          <span className="ml-auto text-2xs tracking-[0.12em] text-fg-3 uppercase">{stateLabel(selector)}</span>
        </li>
      ))}
    </ul>
  );
}

function dotClass(selector: DelegationSelector): string {
  if (!selector.isRequired) return "bg-bg-4";
  if (selector.isLoading) return "bg-fg-3";
  return selector.isActive ? "bg-long" : "bg-warn";
}

function stateLabel(selector: DelegationSelector): string {
  if (!selector.isRequired) return "not used here";
  if (selector.isLoading) return "checking";
  return selector.isActive ? "granted" : "missing";
}
