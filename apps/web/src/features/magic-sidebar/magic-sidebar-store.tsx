"use client";

import { useAccountChangeEffect } from "@/features/wallet/use-account-change";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { findMagicMethod } from "./magic-catalog";
import { clearAllPinValues, clearPinValue, magicInputPersistKey, removePinValue } from "./magic-value-store";

/**
 * Selectable poll cadences (ms). `0` is the "Off" option — a `refetchInterval` of
 * `0` disables TanStack's periodic refetch, so the source loads once and stops
 * idle-polling (a `hybrid` source still updates live off its socket).
 */
export const POLL_INTERVALS = [1_000, 3_000, 5_000, 10_000, 0] as const;

/** Default cadence for a freshly pinned method that declares no override. */
const DEFAULT_INTERVAL_MS = 3_000;

/**
 * Initial poll cadence (ms) a method adopts when first pinned: its catalog
 * `defaultIntervalMs` if it declares one, else {@link DEFAULT_INTERVAL_MS}. Lets a
 * socket-backed `hybrid` source (the quotes feeds) default to "Off" (`0`)
 * idle-polling while still updating live off its socket.
 */
function defaultIntervalFor(methodId: string): number {
  return findMagicMethod(methodId)?.defaultIntervalMs ?? DEFAULT_INTERVAL_MS;
}

const STORAGE_KEY = "symmio.magic.pins.v1";
const WIDTH_STORAGE_KEY = "symmio.magic.width.v1";
const CLOSE_NOTICE_STORAGE_KEY = "symmio.magic.closeNotice.dismissed.v1";

/** Default sidebar width (px) — matches the previous fixed 34rem cap. */
export const DEFAULT_SIDEBAR_WIDTH = 544;
/** Smallest width the sidebar may be resized to (px). */
export const MIN_SIDEBAR_WIDTH = 360;
/** Largest width the sidebar may be resized to (px); the viewport caps it further via `w-full`. */
export const MAX_SIDEBAR_WIDTH = 1_400;

/** Clamp a candidate width into the allowed range, guarding against NaN. */
function clampWidth(width: number): number {
  if (!Number.isFinite(width)) return DEFAULT_SIDEBAR_WIDTH;
  return Math.min(Math.max(Math.round(width), MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH);
}

function readStoredWidth(): number {
  if (typeof window === "undefined") return DEFAULT_SIDEBAR_WIDTH;
  try {
    const raw = window.localStorage.getItem(WIDTH_STORAGE_KEY);
    if (!raw) return DEFAULT_SIDEBAR_WIDTH;
    return clampWidth(Number(raw));
  } catch {
    return DEFAULT_SIDEBAR_WIDTH;
  }
}

function readStoredCloseNoticeDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(CLOSE_NOTICE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

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
  /**
   * Monotonic re-seed signal handed to the panel as `seedToken`. Bumped whenever
   * {@link MagicSidebarContextValue.pinMany} retargets an already-pinned card to
   * a new `seed`, so the live panel re-adopts it instead of keeping a stale
   * input. Absent on pins that were never prefilled from outside.
   */
  seedVersion?: number;
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
  /**
   * Pin several methods to a shared `seed` and reveal the board. Unlike
   * {@link pin}, this retargets methods that are *already* pinned: it overwrites
   * their `seed` and bumps `seedVersion`, so each live panel re-adopts the new
   * input. Use for "watch this account across these cards" triggers.
   */
  pinMany: (entries: { methodId: string; seed?: string }[]) => void;
  /** Unpin several methods at once (clears each one's persisted value). */
  unpinMany: (methodIds: string[]) => void;
  /** Change a pinned method's cadence. */
  setPinInterval: (methodId: string, intervalMs: number) => void;
  /**
   * Reorder the board: move the pin `activeId` so it sits immediately before
   * `overId`, or to the end of the list when `overId` is `null`. No-op when the
   * move would not change the order.
   */
  reorderPins: (activeId: string, overId: string | null) => void;
  /** Current sidebar width in px (drag-resizable, persisted). */
  width: number;
  /** Set the sidebar width (px); clamped to the allowed range. */
  setWidth: (width: number) => void;
  /** `true` while the user is actively dragging the resize handle. */
  isResizing: boolean;
  /** Flag/unflag an in-progress resize drag (disables the page-push transition for instant tracking). */
  setIsResizing: (resizing: boolean) => void;
  /**
   * Whether the user opted out of the "pinned methods keep running while closed"
   * notice (the modal's "don't show again"). Persisted to local storage.
   */
  closeNoticeDismissed: boolean;
  /** Permanently dismiss the close notice (persists the opt-out). */
  dismissCloseNotice: () => void;
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
  /** Deterministic default on first render; the persisted width loads in the mount effect. */
  const [width, setWidthState] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [closeNoticeDismissed, setCloseNoticeDismissed] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  /** Source of the monotonic `seedVersion` stamped on retargeted pins. */
  const seedVersionRef = useRef(0);

  useEffect(() => {
    const stored = readStoredPins();
    if (stored.length > 0) {
      setPins(stored);
      setView("board");
    }
    setWidthState(readStoredWidth());
    setCloseNoticeDismissed(readStoredCloseNoticeDismissed());
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (!hasHydrated || typeof window === "undefined") return;
    try {
      if (pins.length === 0) {
        window.localStorage.removeItem(STORAGE_KEY);
        clearAllPinValues();
      } else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
    } catch {
      /** Storage can be unavailable (private mode, quota); pins still work in-memory. */
    }
  }, [pins, hasHydrated]);

  useEffect(() => {
    if (!hasHydrated || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(WIDTH_STORAGE_KEY, String(width));
    } catch {
      /** Storage can be unavailable; the width still applies in-memory. */
    }
  }, [width, hasHydrated]);

  /**
   * Drop every pinned card's seeded input when the wallet switches. A pin's seed
   * is an address (partyA, sub-account, quote owner) belonging to the account it
   * was pinned from, so it means nothing under a different wallet — and because
   * a pinned panel keeps polling whether or not the sidebar is open, a stale one
   * would go on fetching the previous account until noticed. Clearing the seed
   * and bumping `seedVersion` walks each live panel down the same re-seed path
   * {@link pinMany} uses to retarget a card, landing it on an empty input. The
   * pins themselves stay on the board.
   *
   * The stored input is dropped as well as re-seeded: a panel that is collapsed
   * or behind a closed sidebar right now is unmounted, so no `seedToken` reaches
   * it, and it would otherwise hydrate the previous wallet's address back on its
   * next mount.
   */
  useAccountChangeEffect(() => {
    if (pins.length === 0) return;
    seedVersionRef.current += 1;
    const version = seedVersionRef.current;
    for (const entry of pins) {
      const inputKey = magicInputPersistKey(entry.methodId);
      if (inputKey) removePinValue(inputKey);
    }
    setPins((prev) => prev.map((entry) => ({ ...entry, seed: undefined, seedVersion: version })));
  });

  const setWidth = useCallback((next: number) => setWidthState(clampWidth(next)), []);

  const isPinned = useCallback((methodId: string) => pins.some((pin) => pin.methodId === methodId), [pins]);

  const pin = useCallback((methodId: string, seed?: string) => {
    setPins((prev) =>
      prev.some((entry) => entry.methodId === methodId)
        ? prev
        : [...prev, { methodId, intervalMs: defaultIntervalFor(methodId), seed }],
    );
  }, []);

  const unpin = useCallback((methodId: string) => {
    setPins((prev) => prev.filter((entry) => entry.methodId !== methodId));
    clearPinValue(methodId);
  }, []);

  const pinMany = useCallback((entries: { methodId: string; seed?: string }[]) => {
    if (entries.length === 0) return;
    seedVersionRef.current += 1;
    const version = seedVersionRef.current;
    setPins((prev) => {
      const next = prev.slice();
      for (const { methodId, seed } of entries) {
        const index = next.findIndex((entry) => entry.methodId === methodId);
        const existing = index === -1 ? undefined : next[index];
        if (existing === undefined) {
          next.push({ methodId, intervalMs: defaultIntervalFor(methodId), seed, seedVersion: version });
        } else {
          /** Retarget an existing pin: new seed + bumped version re-seeds its live panel. */
          next[index] = { ...existing, seed, seedVersion: version };
        }
      }
      return next;
    });
    setView("board");
    setOpen(true);
  }, []);

  const unpinMany = useCallback((methodIds: string[]) => {
    if (methodIds.length === 0) return;
    setPins((prev) => prev.filter((entry) => !methodIds.includes(entry.methodId)));
    for (const methodId of methodIds) clearPinValue(methodId);
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

  const reorderPins = useCallback((activeId: string, overId: string | null) => {
    if (activeId === overId) return;
    setPins((prev) => {
      const from = prev.findIndex((entry) => entry.methodId === activeId);
      if (from === -1) return prev;
      const next = prev.slice();
      const [moved] = next.splice(from, 1);
      if (!moved) return prev;
      const to = overId === null ? next.length : next.findIndex((entry) => entry.methodId === overId);
      if (to === -1) return prev;
      next.splice(to, 0, moved);
      /** Bail out if the new order is identical, so we don't churn state or storage. */
      const unchanged = next.every((entry, index) => entry.methodId === prev[index]?.methodId);
      return unchanged ? prev : next;
    });
  }, []);

  const openSidebar = useCallback(() => {
    setView(pins.length > 0 ? "board" : "catalog");
    setOpen(true);
  }, [pins.length]);

  const dismissCloseNotice = useCallback(() => {
    setCloseNoticeDismissed(true);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(CLOSE_NOTICE_STORAGE_KEY, "1");
    } catch {
      /** Storage can be unavailable; the opt-out still applies in-memory for this session. */
    }
  }, []);

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
      pinMany,
      unpinMany,
      setPinInterval,
      reorderPins,
      width,
      setWidth,
      isResizing,
      setIsResizing,
      closeNoticeDismissed,
      dismissCloseNotice,
      hasHydrated,
    }),
    [
      open,
      openSidebar,
      view,
      pins,
      isPinned,
      pin,
      unpin,
      pinAndReveal,
      pinMany,
      unpinMany,
      setPinInterval,
      reorderPins,
      width,
      setWidth,
      isResizing,
      closeNoticeDismissed,
      dismissCloseNotice,
      hasHydrated,
    ],
  );

  return <MagicSidebarContext.Provider value={value}>{children}</MagicSidebarContext.Provider>;
}

/** Read the magic sidebar store. Throws if used outside {@link MagicSidebarProvider}. */
export function useMagicSidebar(): MagicSidebarContextValue {
  const ctx = useContext(MagicSidebarContext);
  if (!ctx) throw new Error("useMagicSidebar must be used within a MagicSidebarProvider");
  return ctx;
}
