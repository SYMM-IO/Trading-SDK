"use client";

import { useConsoleStorageKey } from "@/features/wallet/mocker-connection";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

/** Local-storage key prefix for a pinned card's persisted value snapshot. */
const MAGIC_VALUE_PREFIX = "symmio.magic.value.v1:";

export function usePinValuePrefix(): string {
  return useConsoleStorageKey(MAGIC_VALUE_PREFIX);
}

/**
 * JSON-serialize with `bigint` support: each bigint becomes `{ "$bigint": "123" }`
 * so it round-trips through {@link deserialize}. Plain `JSON.stringify` throws on
 * bigint, and SDK responses (quotes, balances, positions) are full of them.
 */
function serialize(value: unknown): string {
  return JSON.stringify(value, (_key, val) => (typeof val === "bigint" ? { $bigint: val.toString() } : val));
}

/** Reverse of {@link serialize}: restores `{ "$bigint": "123" }` markers to real `bigint`s. */
function deserialize<T>(text: string): T {
  return JSON.parse(text, (_key, val) => {
    if (val && typeof val === "object" && typeof (val as { $bigint?: unknown }).$bigint === "string") {
      return BigInt((val as { $bigint: string }).$bigint);
    }
    return val;
  }) as T;
}

/** Read a pinned card's persisted value snapshot, or `undefined` if none/unavailable. */
export function readPinValue<T>(methodId: string, prefix = MAGIC_VALUE_PREFIX): T | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(prefix + methodId);
    if (!raw) return undefined;
    return deserialize<T>(raw);
  } catch {
    return undefined;
  }
}

/** Persist a pinned card's value snapshot (bigint-safe). No-op if storage is unavailable. */
export function writePinValue(methodId: string, value: unknown, prefix = MAGIC_VALUE_PREFIX): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(prefix + methodId, serialize(value));
  } catch {
    /** Storage can be unavailable (private mode, quota); the value still lives in-memory. */
  }
}

/**
 * Namespaced key for a pinned card's input/"form" value, kept under the card's
 * main value key so {@link clearPinValue} removes both when the pin is dropped.
 * Returns `undefined` (persistence off) when the card has no stable key.
 */
export function magicInputPersistKey(persistKey: string | undefined): string | undefined {
  return persistKey === undefined ? undefined : `${persistKey}:input`;
}

/**
 * Drop exactly one persisted key, leaving the card's other state intact. Takes
 * the same key {@link readPinValue} / {@link writePinValue} take, so it accepts a
 * namespaced sub-key (e.g. {@link magicInputPersistKey}'s `:input`) as readily as
 * a bare `methodId` — use it to reset one facet of a pin rather than all of it.
 */
export function removePinValue(key: string, prefix = MAGIC_VALUE_PREFIX): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(prefix + key);
  } catch {
    /** Storage can be unavailable; nothing to remove. */
  }
}

/**
 * Drop a single pinned card's persisted state (call when the pin is removed) —
 * both its main value key and any namespaced sub-keys (e.g. its `:input` form
 * value), so re-pinning the same method starts clean.
 */
export function clearPinValue(methodId: string, prefix = MAGIC_VALUE_PREFIX): void {
  if (typeof window === "undefined") return;
  try {
    const base = prefix + methodId;
    const keys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key && (key === base || key.startsWith(`${base}:`))) keys.push(key);
    }
    for (const key of keys) window.localStorage.removeItem(key);
  } catch {
    /** Nothing to do if storage is unavailable. */
  }
}

/** Drop every persisted pin value (call when the board is emptied), guarding against orphans. */
export function clearAllPinValues(prefix = MAGIC_VALUE_PREFIX): void {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key && key.startsWith(prefix)) keys.push(key);
    }
    for (const key of keys) window.localStorage.removeItem(key);
  } catch {
    /** Storage unavailable; nothing to clear. */
  }
}

/**
 * A `useState` that persists across reloads, keyed by a pinned card's `methodId`.
 * The first render returns the deterministic `initial` value (so the server pass
 * and client hydration match); a mount effect then loads any stored snapshot, and
 * every later change is written back to local storage.
 *
 * Pass `methodId === undefined` to opt out of persistence (behaves as a plain
 * `useState`) — e.g. when a card is rendered outside the pinned board.
 *
 * Pass `seedToken` to make the state re-adopt `initial` on demand: each time the
 * token changes to a new defined value, the current value is replaced with
 * `initial` (and persisted), even on an already-mounted card. The first render
 * never re-adopts, so a fresh mount keeps its hydrated value. Leave `seedToken`
 * undefined for plain persisted state (snapshots, logs, heights) whose `initial`
 * is a constant that must never reset the stored value.
 *
 * @param methodId - Stable per-pin key, or `undefined` to disable persistence.
 * @param initial - Value used on first paint, when nothing is stored yet, and
 *   when `seedToken` bumps.
 * @param seedToken - Monotonic re-seed signal; bump it to force-adopt `initial`.
 * @returns A `[value, setValue]` tuple, identical in shape to `useState`.
 */
export function usePersistentPinState<T>(
  methodId: string | undefined,
  initial: T,
  seedToken?: number,
): [T, Dispatch<SetStateAction<T>>] {
  const prefix = usePinValuePrefix();
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!methodId) {
      setHydrated(true);
      return;
    }
    const stored = readPinValue<T>(methodId, prefix);
    if (stored !== undefined) setValue(stored);
    setHydrated(true);
  }, [methodId, prefix]);

  useEffect(() => {
    if (!hydrated || !methodId) return;
    writePinValue(methodId, value, prefix);
  }, [hydrated, methodId, value, prefix]);

  /**
   * Re-adopt `initial` when an external prefill bumps `seedToken` (e.g. the
   * "watch this sub-account" trigger retargets an already-pinned card). Seeded
   * with the first token so the initial mount never overwrites the hydrated
   * value; only a later change re-seeds.
   */
  const seedTokenRef = useRef(seedToken);
  useEffect(() => {
    if (seedToken === undefined || seedToken === seedTokenRef.current) return;
    seedTokenRef.current = seedToken;
    setValue(initial);
  }, [seedToken, initial]);

  return [value, setValue];
}
