"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@theoldvarorg/ui/components/popover";
import { cn } from "@theoldvarorg/ui/lib/utils";
import { useState, type ReactNode } from "react";
import { CardResizeHandle } from "./card-resize-handle";
import { findMagicMethod } from "./magic-catalog";
import { useMagicPopout } from "./magic-popout-store";
import { POLL_INTERVALS, useMagicSidebar, type MagicPin } from "./magic-sidebar-store";
import type { MagicMethod } from "./magic-types";
import { SourceBadge } from "./source-badge";
import { DEFAULT_CARD_BODY_MAX_HEIGHT, useCardResize } from "./use-card-resize";

interface Props {
  pin: MagicPin;
  /** Grip handle that starts a reorder drag; omitted when reordering is unavailable (a single pin). */
  handle?: ReactNode;
  /** `true` while this card is the one being dragged, so it lifts and dims. */
  dragging?: boolean;
}

/** A single pinned method on the board: a live card with cadence, collapse, and unpin. */
export function PinnedMethodCard({ pin, handle, dragging = false }: Props) {
  const { unpin, setPinInterval } = useMagicSidebar();
  const { openPopout, isPopoutOpen, focusPopout, closePopout } = useMagicPopout();
  const [collapsed, setCollapsed] = useState(false);
  const method = findMagicMethod(pin.methodId);
  const resize = useCardResize(pin.methodId, method?.bodyMaxHeight ?? DEFAULT_CARD_BODY_MAX_HEIGHT);
  if (!method) return null;

  const Panel = method.Panel;

  /** While popped out, the card stands in for the window the panel now lives in. */
  if (isPopoutOpen(method.id)) {
    return (
      <PoppedOutPlaceholder
        method={method}
        handle={handle}
        onFocus={() => focusPopout(method.id)}
        onReturn={() => closePopout(method.id)}
      />
    );
  }

  return (
    <section
      data-dragging={dragging || undefined}
      className={cn(
        "bg-card/40 relative overflow-hidden rounded-2xl border transition-[border-color,box-shadow,opacity] duration-150",
        collapsed ? "border-border/60" : "border-border/70",
        dragging && "border-primary/50 ring-primary/40 z-10 opacity-60 shadow-lg ring-1",
      )}
    >
      {collapsed ? null : <span className="bg-primary/70 absolute inset-y-0 left-0 w-0.5" aria-hidden />}

      <header className="flex items-center gap-2 px-4 py-2.5">
        {handle}
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          aria-label={
            collapsed
              ? `Expand ${method.label}`
              : `Collapse ${method.label} (pauses ${method.source === "socket" ? "the stream" : "polling"})`
          }
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/40 inline-flex size-6 shrink-0 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2"
        >
          <ChevronIcon className={cn("size-4 transition-transform duration-200", !collapsed && "rotate-90")} />
        </button>

        <span className="text-foreground truncate text-sm font-medium">{method.label}</span>
        <SourceBadge source={method.source} intervalMs={pin.intervalMs} live={!collapsed} />

        <div className="ml-auto flex items-center gap-1">
          {/* Every polled source — `poll` and socket-accelerated `hybrid` — exposes the
              cadence control; only a pure `socket` feed has no interval to tune. */}
          {method.source !== "socket" ? (
            <IntervalControl value={pin.intervalMs} onChange={(ms) => setPinInterval(method.id, ms)} />
          ) : null}
          <button
            type="button"
            onClick={() => openPopout(pin)}
            aria-label={`Open ${method.label} in a separate window`}
            title="Open in window"
            className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/40 inline-flex size-6 shrink-0 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2"
          >
            <PopoutIcon />
          </button>
          <button
            type="button"
            onClick={() => unpin(method.id)}
            aria-label={`Unpin ${method.label}`}
            title="Unpin"
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 focus-visible:ring-ring/40 inline-flex size-6 shrink-0 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2"
          >
            <XIcon />
          </button>
        </div>
      </header>

      {/* Keep the panel mounted while collapsed so its input and response/log
          history survive; `enabled={!collapsed}` pauses the poll/stream instead.
          The body grows with its content up to the card's cap, then scrolls
          inside the card; drag the bottom edge to pin a custom height. */}
      <div className={cn("border-border/60 border-t", collapsed && "hidden")}>
        <div ref={resize.scrollRef} className="overflow-y-auto px-4 py-4" style={resize.scrollStyle}>
          <Panel
            intervalMs={pin.intervalMs}
            enabled={!collapsed}
            initialInput={pin.seed}
            persistKey={pin.methodId}
            seedToken={pin.seedVersion}
          />
        </div>
        <CardResizeHandle {...resize.handle} />
      </div>
    </section>
  );
}

/** Cadence label for the interval control — `Off` for `0`, else `Xs`. */
function intervalLabel(ms: number): string {
  return ms === 0 ? "Off" : `${ms / 1_000}s`;
}

function IntervalControl({ value, onChange }: { value: number; onChange: (ms: number) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Poll interval"
          title="Poll interval"
          className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/40 inline-flex h-6 items-center rounded-md border border-transparent px-1.5 font-mono text-[11px] transition-colors outline-none focus-visible:ring-2"
        >
          {intervalLabel(value)}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-auto p-1">
        <div className="flex flex-col">
          {POLL_INTERVALS.map((ms) => (
            <button
              key={ms}
              type="button"
              onClick={() => onChange(ms)}
              aria-pressed={ms === value}
              className={cn(
                "rounded-md px-3 py-1.5 text-left font-mono text-xs transition-colors",
                ms === value
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {intervalLabel(ms)}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Stands in for a card whose panel has been popped out into its own window. */
function PoppedOutPlaceholder({
  method,
  handle,
  onFocus,
  onReturn,
}: {
  method: MagicMethod;
  handle?: ReactNode;
  onFocus: () => void;
  onReturn: () => void;
}) {
  return (
    <section className="bg-card/30 border-border/60 relative overflow-hidden rounded-2xl border border-dashed">
      <header className="flex items-center gap-2 px-4 py-2.5">
        {handle}
        <span className="text-muted-foreground/70 inline-flex size-6 shrink-0 items-center justify-center">
          <PopoutIcon />
        </span>
        <span className="text-foreground truncate text-sm font-medium">{method.label}</span>
        <span className="border-border/70 text-muted-foreground rounded-md border px-1.5 py-0.5 font-mono text-[10px] tracking-wide uppercase">
          window
        </span>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onFocus}
            title="Focus window"
            className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/40 inline-flex h-6 items-center rounded-md px-2 text-[11px] font-medium transition-colors outline-none focus-visible:ring-2"
          >
            Focus
          </button>
          <button
            type="button"
            onClick={onReturn}
            aria-label={`Return ${method.label} to the sidebar`}
            title="Bring back to sidebar"
            className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/40 inline-flex size-6 shrink-0 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2"
          >
            <ReturnIcon />
          </button>
        </div>
      </header>

      <div className="border-border/60 text-muted-foreground border-t px-4 py-3 text-xs leading-5">
        Live in a separate window — it keeps polling there. Focus it, or bring it back to the sidebar.
      </div>
    </section>
  );
}

function PopoutIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-4" aria-hidden>
      <path
        d="M7 3.5H4.5A1.5 1.5 0 0 0 3 5v6.5A1.5 1.5 0 0 0 4.5 13H11a1.5 1.5 0 0 0 1.5-1.5V9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9.5 3h3.5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 3 8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ReturnIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-3.5" aria-hidden>
      <path
        d="M10 3.5 5.5 8l4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M5.5 8H13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-3.5" aria-hidden>
      <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
