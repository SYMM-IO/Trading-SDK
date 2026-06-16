"use client";

import { cn } from "@symm-frontier/ui/lib/utils";
import { Fragment } from "react";
import { findMagicMethod } from "./magic-catalog";
import { useMagicSidebar } from "./magic-sidebar-store";
import { PinnedMethodCard } from "./pinned-method-card";
import { usePinReorder, type PinReorderHandleProps } from "./use-pin-reorder";

/** The pinned board: one live card per pinned method, or an empty-state prompt. */
export function MagicBoardView() {
  const { pins, setView, reorderPins } = useMagicSidebar();
  const valid = pins.filter((pin) => findMagicMethod(pin.methodId));
  const reorder = usePinReorder(
    valid.map((pin) => pin.methodId),
    reorderPins,
  );
  /** A lone card has nothing to reorder against, so the grip is hidden. */
  const canReorder = valid.length > 1;

  if (valid.length === 0) {
    return (
      <div className="border-border/60 bg-muted/20 flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center">
        <p className="text-foreground text-sm font-medium">No methods pinned yet</p>
        <p className="text-muted-foreground max-w-xs text-xs leading-5">
          Pin a read method from its card, or browse the catalog to add one. Each pinned method polls live and tracks
          its response history.
        </p>
        <button
          type="button"
          onClick={() => setView("catalog")}
          className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 focus-visible:ring-ring/40 mt-1 inline-flex items-center gap-2 rounded-xl border px-3.5 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2"
        >
          Browse methods
        </button>
      </div>
    );
  }

  return (
    <div ref={reorder.containerRef} className="flex flex-col gap-3">
      {valid.map((pin, index) => {
        const method = findMagicMethod(pin.methodId);
        return (
          <Fragment key={pin.methodId}>
            <DropIndicator active={reorder.indicatorIndex === index && !reorder.isNoOpSlot(index)} />
            <div ref={reorder.setItemRef(pin.methodId)}>
              <PinnedMethodCard
                pin={pin}
                dragging={reorder.activeId === pin.methodId}
                handle={
                  canReorder ? (
                    <DragHandle label={method?.label ?? pin.methodId} {...reorder.getHandleProps(pin.methodId)} />
                  ) : undefined
                }
              />
            </div>
          </Fragment>
        );
      })}
      <DropIndicator active={reorder.indicatorIndex === valid.length && !reorder.isNoOpSlot(valid.length)} />
    </div>
  );
}

/** Glowing line marking where a dragged card will land; renders nothing when inactive. */
function DropIndicator({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div aria-hidden className="-my-1 flex items-center gap-1.5">
      <span className="bg-primary size-1.5 shrink-0 rounded-full" />
      <span
        className="bg-primary/80 h-px flex-1 rounded-full"
        style={{ boxShadow: "0 0 8px color-mix(in oklab, var(--primary) 70%, transparent)" }}
      />
    </div>
  );
}

interface DragHandleProps extends PinReorderHandleProps {
  /** Method label, used in the accessible name. */
  label: string;
}

/** Grip affordance in a card header; drag to reorder, or focus and use Arrow Up / Down. */
function DragHandle({ label, ...handlers }: DragHandleProps) {
  return (
    <button
      type="button"
      aria-label={`Reorder ${label}`}
      aria-keyshortcuts="ArrowUp ArrowDown"
      title="Drag to reorder"
      className={cn(
        "text-muted-foreground/50 hover:text-foreground hover:bg-muted focus-visible:ring-ring/40 inline-flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2 active:cursor-grabbing",
      )}
      {...handlers}
    >
      <GripIcon />
    </button>
  );
}

function GripIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="size-3.5" aria-hidden>
      <circle cx="6" cy="4" r="1.1" />
      <circle cx="10" cy="4" r="1.1" />
      <circle cx="6" cy="8" r="1.1" />
      <circle cx="10" cy="8" r="1.1" />
      <circle cx="6" cy="12" r="1.1" />
      <circle cx="10" cy="12" r="1.1" />
    </svg>
  );
}
