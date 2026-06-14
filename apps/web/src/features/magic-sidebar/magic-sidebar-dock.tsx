"use client";

import { cn } from "@symm-frontier/ui/lib/utils";
import type { ReactNode } from "react";
import { useMagicSidebar } from "./magic-sidebar-store";

/**
 * Wraps the app shell and, while the magic sidebar is open, reserves a right
 * gutter on wide screens so the non-blocking panel docks beside the page instead
 * of over it. Below `xl` the panel overlays (the page stays interactive — it is
 * never blocked — but space is not reserved).
 */
export function MagicSidebarDock({ children }: { children: ReactNode }) {
  const { open } = useMagicSidebar();

  return (
    <div
      className={cn(
        "flex flex-1 flex-col transition-[padding] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
        open && "xl:pr-[34rem]",
      )}
    >
      {children}
    </div>
  );
}
