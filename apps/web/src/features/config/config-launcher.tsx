"use client";

import { ConfigPanel } from "@/features/config/config-panel";
import { useSymmioOverrides } from "@/features/config/symmio-overrides-store";
import { useState } from "react";

/**
 * Header control that opens the {@link ConfigPanel}. Shows a dot when the SDK is
 * running with any active overrides so a non-default config is never silent.
 */
export function ConfigLauncher() {
  const [open, setOpen] = useState(false);
  const { overrideCount, hasHydrated } = useSymmioOverrides();
  const active = hasHydrated && overrideCount > 0;

  return (
    <>
      <button
        type="button"
        aria-label={active ? `SDK config — ${overrideCount} override${overrideCount > 1 ? "s" : ""}` : "SDK config"}
        title="SDK config"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/40 border-border/70 relative inline-flex size-9 items-center justify-center rounded-xl border bg-transparent transition-colors outline-none focus-visible:ring-3"
      >
        <SlidersIcon className="size-[18px]" />
        {active ? (
          <span
            className="bg-info ring-background absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2"
            aria-hidden
          />
        ) : null}
      </button>
      <ConfigPanel open={open} onOpenChange={setOpen} />
    </>
  );
}

function SlidersIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M4 8h10M18 8h2M4 16h2M10 16h10" />
      <circle cx="16" cy="8" r="2.2" />
      <circle cx="8" cy="16" r="2.2" />
    </svg>
  );
}
