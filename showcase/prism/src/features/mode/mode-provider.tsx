"use client";

import { DEPLOYMENTS, deploymentsForMode, type Deployment, type PrismMode } from "@/config/deployments";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { announceMode } from "./mode-announcer";

interface ModeContextValue {
  /** The active palette mode. */
  mode: PrismMode;
  /** Switch the global palette. Changes color and data scope — never layout. */
  setMode: (mode: PrismMode) => void;
  /** Deployments the current mode reads from. */
  deployments: readonly Deployment[];
  /** True when every deployment is in scope. */
  isUnified: boolean;
}

const ModeContext = createContext<ModeContextValue | undefined>(undefined);

const STORAGE_KEY = "prism.mode";

/**
 * Owns the global palette mode.
 *
 * The mode drives exactly two things: the `data-mode` attribute on `<html>`
 * (which re-points the tier-3 contextual tokens, re-theming the whole app), and
 * which deployments the data hooks fan out over.
 */
export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<PrismMode>("unified");

  /* `setMode` is created once, so it cannot close over `mode` to tell a real
     switch from a no-op. A ref tracks the live value without re-creating the
     callback — and without announcing from inside a state updater, which React
     is free to run twice. */
  const modeRef = useRef<PrismMode>("unified");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "unified" || stored === "majors" || stored === "lowcaps") {
      modeRef.current = stored;
      setModeState(stored);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.mode = mode;
  }, [mode]);

  const setMode = useCallback((next: PrismMode) => {
    if (modeRef.current === next) return;
    modeRef.current = next;
    setModeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    /* Restoring the stored mode on mount deliberately skips this: the reveal
       announces a switch the user just made, not the one they made last week. */
    announceMode(next);
  }, []);

  const value = useMemo<ModeContextValue>(
    () => ({
      mode,
      setMode,
      deployments: deploymentsForMode(mode),
      isUnified: mode === "unified",
    }),
    [mode, setMode],
  );

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

/** Read the active palette mode and the deployments it scopes to. */
export function usePrismMode(): ModeContextValue {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error("usePrismMode must be used inside <ModeProvider>.");
  }
  return context;
}

/** Every deployment, regardless of the active mode. */
export function useAllDeployments(): readonly Deployment[] {
  return DEPLOYMENTS;
}
