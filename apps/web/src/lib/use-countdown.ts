"use client";

import { useEffect, useState } from "react";

/**
 * Live "time remaining" until `targetMs`, re-rendering as it counts down — every
 * second inside the final hour, every 30 s before that. `ready` flips true at 0.
 * Every new `targetMs` re-reads the clock right away, so a refetched target that
 * is already in the past reads as ready instead of keeping a stale remainder.
 * The withdraw cooldown is a protocol-configured on-chain value, so this handles
 * a longer-than-a-day cooldown too (see {@link formatRemaining}).
 */
export function useCountdown(targetMs: number): { remainingMs: number; ready: boolean } {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let timeout: number;
    /** Refresh `now`, then keep ticking only while time remains. */
    const tick = () => {
      const current = Date.now();
      setNow(current);
      const remaining = targetMs - current;
      if (remaining <= 0) return;
      timeout = window.setTimeout(tick, remaining < 3_600_000 ? 1000 : 30_000);
    };
    /**
     * The first tick is scheduled rather than run inline, so the effect never
     * sets state synchronously; it still fires immediately, even for a target
     * that is already in the past.
     */
    timeout = window.setTimeout(tick, 0);
    return () => window.clearTimeout(timeout);
  }, [targetMs]);
  const remainingMs = targetMs - now;
  return { remainingMs, ready: remainingMs <= 0 };
}

/**
 * Human "time remaining" — `2d 3h 10m` / `3h 10m` / `10m 04s` / `4s`. Includes a
 * day segment when ≥ 24 h so a cooldown longer than a day never renders as a bare
 * clock time.
 */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return "now";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}
