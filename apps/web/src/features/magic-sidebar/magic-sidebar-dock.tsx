"use client";

import { cn } from "@symm-frontier/ui/lib/utils";
import type { ReactNode } from "react";
import { useMagicSidebar } from "./magic-sidebar-store";
import { useSidebarMetrics } from "./use-sidebar-metrics";

/**
 * Wraps the app shell and, while the magic sidebar is open, reserves a right
 * gutter the exact width of the (drag-resizable) panel on wide screens, so the
 * non-blocking panel docks beside the page instead of over it. The gutter tracks
 * the resize instantly (its transition is suppressed mid-drag) and animates on
 * open/close. Below `xl` the panel overlays — the page stays interactive but no
 * space is reserved.
 */
export function MagicSidebarDock({ children }: { children: ReactNode }) {
  const { isResizing } = useMagicSidebar();
  const { pushPadding } = useSidebarMetrics();

  return (
    <div
      style={{ paddingRight: pushPadding }}
      className={cn(
        "flex flex-1 flex-col",
        isResizing ? null : "transition-[padding] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
      )}
    >
      {children}
    </div>
  );
}
