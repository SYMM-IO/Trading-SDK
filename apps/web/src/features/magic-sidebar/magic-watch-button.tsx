"use client";

import { cn } from "@symmio/ui/lib/utils";
import type { Address } from "viem";
import { useMagicSidebar } from "./magic-sidebar-store";

/**
 * Catalog methods the "watch sub-account" trigger pins together: the reconciled
 * quote feed, the grouped-positions view, and the live notifications stream —
 * all keyed by a single partyA / sub-account address.
 */
const WATCH_METHOD_IDS = ["managed-quotes", "grouped-quotes", "notifications"] as const;

interface Props {
  /**
   * Sub-account (or VA) address to seed the watched cards with. The button is
   * disabled while undefined (e.g. before a sub-account is selected).
   */
  partyA?: Address;
}

/**
 * Toggle that opens the magic sidebar watching one sub-account across three live
 * cards — Quotes, Grouped positions, and Notifications — all seeded to `partyA`.
 *
 * - Not yet watching this account (unpinned, or pinned to a different address) →
 *   pins/retargets the three cards to `partyA` and reveals the board.
 * - Already watching this exact account → unpins the three cards.
 *
 * @example
 * ```tsx
 * <MagicWatchButton partyA={subAccount} />
 * ```
 */
export function MagicWatchButton({ partyA }: Props) {
  const { pins, pinMany, unpinMany } = useMagicSidebar();

  const watching =
    partyA !== undefined &&
    WATCH_METHOD_IDS.every((id) => pins.some((pin) => pin.methodId === id && pin.seed === partyA));

  const disabled = partyA === undefined;

  function onToggle() {
    if (partyA === undefined) return;
    if (watching) unpinMany([...WATCH_METHOD_IDS]);
    else pinMany(WATCH_METHOD_IDS.map((methodId) => ({ methodId, seed: partyA })));
  }

  const label = disabled
    ? "Select a sub-account to watch it in the magic sidebar"
    : watching
      ? "Watching this sub-account in the magic sidebar — click to stop"
      : "Watch this sub-account in the magic sidebar (Quotes, Grouped positions, Notifications)";

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={watching}
      aria-label={label}
      title={label}
      data-testid="instant-open-magic-watch"
      className={cn(
        "focus-visible:ring-ring/40 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
        watching
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted",
      )}
    >
      <WatchIcon className="size-4" />
      {watching ? "Watching" : "Watch in sidebar"}
    </button>
  );
}

/** A sidebar panel with a spark — "open this in the live magic sidebar". */
function WatchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <path d="M14.5 4.5v15" />
      <path d="M17.6 8.4 18.3 10.3 20.2 11 18.3 11.7 17.6 13.6 16.9 11.7 15 11 16.9 10.3 17.6 8.4Z" />
    </svg>
  );
}
