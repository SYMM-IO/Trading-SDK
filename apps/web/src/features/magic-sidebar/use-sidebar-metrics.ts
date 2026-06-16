"use client";
import { useEffect, useState } from "react";
import { MIN_SIDEBAR_WIDTH, useMagicSidebar } from "./magic-sidebar-store";

/** Below this viewport width (Tailwind `xl`) the sidebar overlays instead of docking. */
const PUSH_BREAKPOINT = 1280;
/** Page content never shrinks below this while the sidebar is docked. */
const MIN_CONTENT_WIDTH = 320;
/** SSR/first-paint fallback; only matters once the sidebar is open, which starts closed. */
const SSR_VIEWPORT_WIDTH = 1280;

/** Track the viewport width, reacting to resizes. */
function useViewportWidth(): number {
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === "undefined" ? SSR_VIEWPORT_WIDTH : window.innerWidth,
  );
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return viewportWidth;
}

/** Derived sidebar layout numbers shared by the panel (its width) and the inset (its padding). */
export interface SidebarMetrics {
  /** Width (px) to cap the panel at — bounded so docked page content keeps {@link MIN_CONTENT_WIDTH}. */
  panelMaxWidth: number;
  /** Right padding (px) the page reserves so content docks beside the panel; `0` when overlaying. */
  pushPadding: number;
  /** Whether the panel docks (pushes content) rather than overlaying at the current viewport. */
  docked: boolean;
}

/**
 * Resolve the sidebar's effective width and the page push-padding from the stored
 * width + the live viewport. On wide viewports the panel docks: it is capped so
 * the page keeps at least {@link MIN_CONTENT_WIDTH}, and the page reserves exactly
 * that width on its right so the two sit flush. On narrow viewports it overlays.
 */
export function useSidebarMetrics(): SidebarMetrics {
  const { open, width } = useMagicSidebar();
  const viewportWidth = useViewportWidth();
  const docked = viewportWidth >= PUSH_BREAKPOINT;
  const panelMaxWidth = docked
    ? Math.max(MIN_SIDEBAR_WIDTH, Math.min(width, viewportWidth - MIN_CONTENT_WIDTH))
    : width;
  const pushPadding = open && docked ? panelMaxWidth : 0;
  return { panelMaxWidth, pushPadding, docked };
}
