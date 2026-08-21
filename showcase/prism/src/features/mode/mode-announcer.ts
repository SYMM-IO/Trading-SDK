import type { PrismMode } from "@/config/deployments";
import { useSyncExternalStore } from "react";

/**
 * One user-driven mode switch, waiting to be announced on screen.
 *
 * The `id` is what makes a repeat switch re-trigger the reveal: flipping
 * `majors → lowcaps → majors` publishes three distinct announcements even
 * though only two modes are involved.
 */
export interface ModeAnnouncement {
  /** The mode the user just switched *to*. */
  readonly mode: PrismMode;
  /** Monotonic id. Doubles as the React `key` for the reveal. */
  readonly id: number;
}

/**
 * Announcements live in a module store rather than in `ModeContext`.
 *
 * `usePrismMode()` is read by nearly every screen, so widening its context
 * value would re-render the whole app twice per switch — once to raise the
 * announcement and once to clear it when the reveal finishes. A store that only
 * the overlay subscribes to keeps both writes off everyone else's render path.
 */
let announcement: ModeAnnouncement | null = null;
let lastId = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Publish a mode switch for the reveal to play.
 *
 * Called only from `setMode`, and only when the mode actually changes — the
 * `localStorage` restore on mount must not fire a reveal at the user.
 */
export function announceMode(mode: PrismMode): void {
  lastId += 1;
  announcement = { mode, id: lastId };
  emit();
}

/**
 * Retire an announcement once its reveal has finished playing.
 *
 * The `id` guard makes this a no-op when a newer switch has already replaced
 * the announcement, so a slow reveal cannot cancel the one that interrupted it.
 */
export function retireAnnouncement(id: number): void {
  if (announcement?.id !== id) return;
  announcement = null;
  emit();
}

/** Subscribe to the pending mode announcement. `null` when nothing is playing. */
export function useModeAnnouncement(): ModeAnnouncement | null {
  return useSyncExternalStore(
    subscribe,
    () => announcement,
    () => null,
  );
}
