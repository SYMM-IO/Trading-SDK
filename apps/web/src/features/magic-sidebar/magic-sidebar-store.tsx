"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/** Selectable poll cadences (ms). */
export const POLL_INTERVALS = [1_000, 3_000, 5_000, 10_000] as const;

/** Default cadence for a freshly pinned method. */
const DEFAULT_INTERVAL_MS = 3_000;

const STORAGE_KEY = "symmio.magic.pins.v1";

/** A pinned method and its chosen cadence. */
export interface MagicPin {
  /** Catalog method id. */
  methodId: string;
  /** Poll cadence in milliseconds. */
  intervalMs: number;
  /**
   * Initial input the panel seeds from when pinned (e.g. the partyA / quote id
   * the source card was showing), so the live card inherits its data via the
   * shared query cache instead of starting blank.
   */
  seed?: string;
}

/** Which view the sidebar shows. */
export type MagicView = "board" | "catalog";

interface MagicSidebarContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Open the sidebar to the catalog (browse + add) or the board if methods are pinned. */
  openSidebar: () => void;
  view: MagicView;
  setView: (view: MagicView) => void;
  /** Pinned methods, in display order. */
  pins: MagicPin[];
  isPinned: (methodId: string) => boolean;
  /** Pin a method (no-op if already pinned). `seed` is the panel's initial input. */
  pin: (methodId: string, seed?: string) => void;
  /** Unpin a method. */
  unpin: (methodId: string) => void;
  /** Pin from a card: pins (seeded with the card's input), opens the sidebar, reveals the board. */
  pinAndReveal: (methodId: string, seed?: string) => void;
  /** Change a pinned method's cadence. */
  setPinInterval: (methodId: string, intervalMs: number) => void;
  /** Whether persisted pins have been read from local storage yet. */
  hasHydrated: boolean;
}

const MagicSidebarContext = createContext<MagicSidebarContextValue | undefined>(undefined);

function readStoredPins(): MagicPin[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is MagicPin => typeof entry?.methodId === "string" && typeof entry?.intervalMs === "number",
      )
      .map((entry) => ({
        methodId: entry.methodId,
        intervalMs: entry.intervalMs,
        seed: typeof entry.seed === "string" ? entry.seed : undefined,
      }));
  } catch {
    return [];
  }
}

/**
 * Holds the magic sidebar's state — open/view, the pinned methods, and each
 * method's cadence — and persists the pins to local storage. Mount inside the
 * SDK providers so pinned methods' hooks can resolve config + chain.
 */
export function MagicSidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<MagicView>("catalog");
  /** First render (server + hydration) is deterministic; persisted pins load in the effect below. */
  const [pins, setPins] = useState<MagicPin[]>([]);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    const stored = readStoredPins();
    if (stored.length > 0) {
      setPins(stored);
      setView("board");
    }
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (!hasHydrated || typeof window === "undefined") return;
    try {
      if (pins.length === 0) window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
    } catch {
      /** Storage can be unavailable (private mode, quota); pins still work in-memory. */
    }
  }, [pins, hasHydrated]);

  const isPinned = useCallback((methodId: string) => pins.some((pin) => pin.methodId === methodId), [pins]);

  const pin = useCallback((methodId: string, seed?: string) => {
    setPins((prev) =>
      prev.some((entry) => entry.methodId === methodId)
        ? prev
        : [...prev, { methodId, intervalMs: DEFAULT_INTERVAL_MS, seed }],
    );
  }, []);

  const unpin = useCallback((methodId: string) => {
    setPins((prev) => prev.filter((entry) => entry.methodId !== methodId));
  }, []);

  const pinAndReveal = useCallback(
    (methodId: string, seed?: string) => {
      pin(methodId, seed);
      setView("board");
      setOpen(true);
    },
    [pin],
  );

  const setPinInterval = useCallback((methodId: string, intervalMs: number) => {
    setPins((prev) => prev.map((entry) => (entry.methodId === methodId ? { ...entry, intervalMs } : entry)));
  }, []);

  const openSidebar = useCallback(() => {
    setView(pins.length > 0 ? "board" : "catalog");
    setOpen(true);
  }, [pins.length]);

  const value = useMemo<MagicSidebarContextValue>(
    () => ({
      open,
      setOpen,
      openSidebar,
      view,
      setView,
      pins,
      isPinned,
      pin,
      unpin,
      pinAndReveal,
      setPinInterval,
      hasHydrated,
    }),
    [open, openSidebar, view, pins, isPinned, pin, unpin, pinAndReveal, setPinInterval, hasHydrated],
  );

  return <MagicSidebarContext.Provider value={value}>{children}</MagicSidebarContext.Provider>;
}

/** Read the magic sidebar store. Throws if used outside {@link MagicSidebarProvider}. */
export function useMagicSidebar(): MagicSidebarContextValue {
  const ctx = useContext(MagicSidebarContext);
  if (!ctx) throw new Error("useMagicSidebar must be used within a MagicSidebarProvider");
  return ctx;
}
