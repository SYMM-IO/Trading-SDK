"use client";

import { findMagicMethod } from "./magic-catalog";
import { useMagicSidebar } from "./magic-sidebar-store";
import { PinnedMethodCard } from "./pinned-method-card";

/** The pinned board: one live card per pinned method, or an empty-state prompt. */
export function MagicBoardView() {
  const { pins, setView } = useMagicSidebar();
  const valid = pins.filter((pin) => findMagicMethod(pin.methodId));

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
    <div className="flex flex-col gap-3">
      {valid.map((pin) => (
        <PinnedMethodCard key={pin.methodId} pin={pin} />
      ))}
    </div>
  );
}
