"use client";

import { findMagicMethod } from "./magic-catalog";
import type { MagicPin } from "./magic-sidebar-store";
import { SourceBadge } from "./source-badge";

interface Props {
  pin: MagicPin;
  /** Close the window and return the method to the sidebar. */
  onClose: () => void;
}

/**
 * The content rendered inside a popped-out method window: a header (label,
 * cadence, return control) above the method's live panel. The panel runs at the
 * pin's cadence and shares the app's query cache, so it shows the same data the
 * sidebar card would — just in its own floating window.
 */
export function PopoutCard({ pin, onClose }: Props) {
  const method = findMagicMethod(pin.methodId);
  if (!method) return null;

  const Panel = method.Panel;

  return (
    <div className="bg-background flex h-screen flex-col">
      <header className="border-border/60 bg-card/40 flex items-center gap-2 border-b px-4 py-2.5">
        <span className="bg-primary/70 h-4 w-0.5 shrink-0 rounded-full" aria-hidden />
        <span className="text-foreground truncate text-sm font-medium">{method.label}</span>
        <SourceBadge source={method.source} intervalMs={pin.intervalMs} live />
        <button
          type="button"
          onClick={onClose}
          aria-label={`Return ${method.label} to the sidebar`}
          title="Return to sidebar"
          className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/40 ml-auto inline-flex size-6 shrink-0 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2"
        >
          <ReturnIcon />
        </button>
      </header>

      <div className="flex-1 overflow-auto px-4 py-4">
        <Panel intervalMs={pin.intervalMs} enabled initialInput={pin.seed} persistKey={pin.methodId} />
      </div>
    </div>
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
