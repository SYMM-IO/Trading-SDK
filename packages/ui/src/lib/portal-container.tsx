"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * DOM node that overlay primitives portal their floating content into. `null`
 * means "use the Radix default" — the host document's `<body>`.
 */
const PortalContainerContext = createContext<HTMLElement | null>(null);

/**
 * Sets the container that overlay primitives (Tooltip, Popover, Select, Dialog,
 * Sheet, command palette) portal their floating content into.
 *
 * Overlays default to the document `<body>`. Provide a container when rendering a
 * subtree into a *different* document — a popped-out window or an iframe — so the
 * overlays appear in that document instead of the main one. Without it, a portal
 * resolves the global `document.body` and the overlay opens in the wrong window.
 *
 * @example
 * <PortalContainerProvider container={popupWindow.document.body}>
 *   <PanelWithDropdowns />
 * </PortalContainerProvider>
 */
export function PortalContainerProvider({
  container,
  children,
}: {
  container: HTMLElement | null;
  children: ReactNode;
}) {
  return <PortalContainerContext.Provider value={container}>{children}</PortalContainerContext.Provider>;
}

/**
 * The container overlays should portal into, or `null` to use the Radix default.
 * Overlay primitives forward this to their Radix `Portal`'s `container` prop
 * (mapping `null` to `undefined` so Radix falls back to its default `<body>`).
 */
export function usePortalContainer(): HTMLElement | null {
  return useContext(PortalContainerContext);
}
