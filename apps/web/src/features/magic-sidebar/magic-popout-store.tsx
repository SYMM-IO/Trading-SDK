"use client";

import { useAppGetWalletClient } from "@/app/use-app-wallet-client";
import { wagmiConfig } from "@/config/wagmi";
import { useSymmioOverrides } from "@/features/config/symmio-overrides-store";
import { SymmioProvider, type GetWalletClientFn } from "@symmio/trading-react";
import { PortalContainerProvider } from "@symmio/ui/lib/portal-container";
import { QueryClientProvider, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { findMagicMethod } from "./magic-catalog";
import { useMagicSidebar, type MagicPin } from "./magic-sidebar-store";
import { PopoutCard } from "./popout-card";
import { syncWindowChrome } from "./sync-window-styles";

/** Floating-window dimensions (px). */
const POPOUT_WIDTH = 460;
const POPOUT_HEIGHT = 600;

interface MagicPopoutContextValue {
  /** Open a floating window for a pinned method, or focus it if already open. */
  openPopout: (pin: MagicPin) => void;
  /** Close a method's window and restore its sidebar card. */
  closePopout: (methodId: string) => void;
  /** Bring a method's open window to the front. */
  focusPopout: (methodId: string) => void;
  /** Whether a method currently has an open window. */
  isPopoutOpen: (methodId: string) => boolean;
}

const MagicPopoutContext = createContext<MagicPopoutContextValue | undefined>(undefined);

/** Live handles for one open window, kept out of React state (non-serializable). */
interface PopoutRecord {
  window: Window;
  root: Root;
  /** Disconnects the style/theme observers wired up by {@link syncWindowChrome}. */
  cleanupStyles: () => void;
}

/**
 * Manages popped-out method windows: opening, focusing, and tearing them down.
 *
 * Each window hosts its own React root, so it must re-supply the providers a
 * method panel needs. It reuses the *same* `QueryClient` and `wagmiConfig`
 * instances as the main app, so a popped-out panel shares the query cache and
 * wallet connection rather than fetching or connecting twice. Mount inside the
 * SDK providers (and inside {@link MagicSidebarProvider}) so it can capture them
 * and react to unpins.
 */
export function MagicPopoutProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { overrides } = useSymmioOverrides();
  const getWalletClient = useAppGetWalletClient();
  const { pins } = useMagicSidebar();

  /**
   * Latest provider deps, read fresh when a window opens (avoids stale closures
   * without re-creating `openPopout` on every render).
   */
  const depsRef = useRef({ queryClient, overrides, getWalletClient });
  depsRef.current = { queryClient, overrides, getWalletClient };

  const recordsRef = useRef(new Map<string, PopoutRecord>());
  /** Method ids with an open window; drives the sidebar's placeholder rendering. */
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set());

  const teardown = useCallback((methodId: string) => {
    const record = recordsRef.current.get(methodId);
    if (!record) return;
    recordsRef.current.delete(methodId);
    setOpenIds((prev) => {
      if (!prev.has(methodId)) return prev;
      const next = new Set(prev);
      next.delete(methodId);
      return next;
    });
    record.cleanupStyles();
    /** Defer unmount: React forbids unmounting a root while it is rendering. */
    const { root, window: win } = record;
    setTimeout(() => {
      root.unmount();
      if (!win.closed) win.close();
    }, 0);
  }, []);

  const closePopout = useCallback((methodId: string) => teardown(methodId), [teardown]);

  const focusPopout = useCallback((methodId: string) => {
    recordsRef.current.get(methodId)?.window.focus();
  }, []);

  const isPopoutOpen = useCallback((methodId: string) => openIds.has(methodId), [openIds]);

  const openPopout = useCallback(
    (pin: MagicPin) => {
      const existing = recordsRef.current.get(pin.methodId);
      if (existing) {
        existing.window.focus();
        return;
      }

      const method = findMagicMethod(pin.methodId);
      if (!method) return;

      /** Open synchronously inside the click handler, or the popup is blocked. */
      const left = Math.max(0, window.screen.availWidth - POPOUT_WIDTH - 40);
      const features = `popup=yes,width=${POPOUT_WIDTH},height=${POPOUT_HEIGHT},left=${left},top=80`;
      const win = window.open("", `magic-popout-${pin.methodId}`, features);
      if (!win) return; // blocked — the browser shows its own indicator

      win.document.title = `${method.label} · Symmio`;
      /** Match the app background up-front so there is no white flash before CSS loads. */
      win.document.body.style.cssText = `margin:0;background:${getComputedStyle(document.body).backgroundColor}`;
      const mount = win.document.createElement("div");
      mount.id = "magic-popout-root";
      win.document.body.replaceChildren(mount);

      const cleanupStyles = syncWindowChrome(win);
      const root = createRoot(mount);
      const { queryClient, overrides, getWalletClient } = depsRef.current;
      root.render(
        <PopoutShell
          pin={pin}
          queryClient={queryClient}
          overrides={overrides}
          getWalletClient={getWalletClient}
          container={win.document.body}
          onRequestClose={() => teardown(pin.methodId)}
        />,
      );

      win.addEventListener("pagehide", () => teardown(pin.methodId), { once: true });

      recordsRef.current.set(pin.methodId, { window: win, root, cleanupStyles });
      setOpenIds((prev) => new Set(prev).add(pin.methodId));
    },
    [teardown],
  );

  /** Reap windows the user closed via the OS chrome (`pagehide` can be missed). */
  useEffect(() => {
    const timer = setInterval(() => {
      for (const [methodId, record] of recordsRef.current) {
        if (record.window.closed) teardown(methodId);
      }
    }, 1_000);
    return () => clearInterval(timer);
  }, [teardown]);

  /** A method window is orphaned once its pin is removed — close it. */
  useEffect(() => {
    const pinned = new Set(pins.map((p) => p.methodId));
    for (const methodId of [...recordsRef.current.keys()]) {
      if (!pinned.has(methodId)) teardown(methodId);
    }
  }, [pins, teardown]);

  /** Close every window when the host page goes away. */
  useEffect(() => {
    const closeAll = () => {
      for (const methodId of [...recordsRef.current.keys()]) teardown(methodId);
    };
    window.addEventListener("pagehide", closeAll);
    return () => {
      window.removeEventListener("pagehide", closeAll);
      closeAll();
    };
  }, [teardown]);

  const value = useMemo<MagicPopoutContextValue>(
    () => ({ openPopout, closePopout, focusPopout, isPopoutOpen }),
    [openPopout, closePopout, focusPopout, isPopoutOpen],
  );

  return <MagicPopoutContext.Provider value={value}>{children}</MagicPopoutContext.Provider>;
}

interface PopoutShellProps {
  pin: MagicPin;
  queryClient: QueryClient;
  /** Captured at open time; overrides change rarely, so a snapshot is fine. */
  overrides: ReturnType<typeof useSymmioOverrides>["overrides"];
  getWalletClient: GetWalletClientFn;
  /** The popup window's `<body>`, so overlays (dropdowns, tooltips) portal here. */
  container: HTMLElement;
  onRequestClose: () => void;
}

/**
 * Provider chain re-supplied inside a popped-out window's React root. Reuses the
 * main app's `QueryClient` and `wagmiConfig` so cache and wallet state are shared;
 * the theme is mirrored onto the window's `<html>` by {@link syncWindowChrome}, so
 * no `ThemeProvider` is needed here. `PortalContainerProvider` redirects overlay
 * portals (Select/Popover/Tooltip/Dialog) to this window's `<body>` instead of the
 * main document's.
 */
function PopoutShell({ pin, queryClient, overrides, getWalletClient, container, onRequestClose }: PopoutShellProps) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <SymmioProvider symmioConfig={overrides} getWalletClient={getWalletClient}>
          <PortalContainerProvider container={container}>
            <PopoutCard pin={pin} onClose={onRequestClose} />
          </PortalContainerProvider>
        </SymmioProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

/** Read the magic popout manager. Throws if used outside {@link MagicPopoutProvider}. */
export function useMagicPopout(): MagicPopoutContextValue {
  const ctx = useContext(MagicPopoutContext);
  if (!ctx) throw new Error("useMagicPopout must be used within a MagicPopoutProvider");
  return ctx;
}
