"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(listener: () => void): () => void {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

/**
 * True when the visitor has asked the OS for reduced motion.
 *
 * `globals.css` already collapses every animation and transition to ~0ms under
 * that setting, so a motion-driven overlay cannot simply run "faster" — it
 * would flash. Components that time themselves in JavaScript read this and
 * render a still frame instead.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
