"use client";

import { useCallback, useRef, type CSSProperties, type RefObject } from "react";
import { usePersistentPinState } from "./magic-value-store";

/** Smallest height (px) a card body may be resized to. */
const MIN_CARD_BODY_HEIGHT = 96;
/** Largest height (px) a card body may be resized to. */
const MAX_CARD_BODY_HEIGHT = 1_200;
/** Fallback cap (px) for a card whose method declares no `bodyMaxHeight`. */
export const DEFAULT_CARD_BODY_MAX_HEIGHT = 380;

/** Clamp a candidate body height into the allowed range, guarding against NaN. */
function clampHeight(height: number): number {
  if (!Number.isFinite(height)) return MIN_CARD_BODY_HEIGHT;
  return Math.min(Math.max(Math.round(height), MIN_CARD_BODY_HEIGHT), MAX_CARD_BODY_HEIGHT);
}

/** Wiring a {@link CardResizeHandle} needs to drive its card's scroll region. */
export interface CardResizeHandleProps {
  /** Current explicit height (px), or `null` while the card auto-sizes to its content. */
  height: number | null;
  /** Smallest height the card may be dragged to (px), for ARIA bounds. */
  min: number;
  /** Largest height the card may be dragged to (px), for ARIA bounds. */
  max: number;
  /** Rendered height (px) of the scroll region right now — seeds a drag started from the auto state. */
  measure: () => number;
  /** Report a new absolute height (px); the caller clamps it. */
  onResize: (height: number) => void;
  /** Clear the user override, returning the card to content-driven auto height. */
  onReset: () => void;
}

/** What {@link useCardResize} hands back to a pinned card. */
export interface CardResize {
  /** Attach to the scroll region; measured to seed a drag started from the auto (uncapped) state. */
  scrollRef: RefObject<HTMLDivElement | null>;
  /** Inline style for the scroll region — a content-capped `max-height`, or the user's fixed `height`. */
  scrollStyle: CSSProperties;
  /** Props to spread onto the {@link CardResizeHandle} at the card's bottom edge. */
  handle: CardResizeHandleProps;
}

/**
 * Make a pinned card's body grow with its content up to `maxHeight`, then scroll
 * inside the card, and let the user drag its bottom edge to pin an explicit
 * height instead. The chosen height persists across reloads (keyed off the pin's
 * `persistKey`) and is dropped with the rest of the pin's state when it is
 * unpinned. Resetting (double-click / Backspace on the handle) returns the card
 * to the content-driven auto height.
 *
 * @param persistKey - Stable per-pin key (the pin's `methodId`).
 * @param maxHeight - Cap (px) for the auto height before the body starts scrolling.
 * @returns A ref + style for the scroll region and props for the bottom resize handle.
 *
 * @example
 * const resize = useCardResize(pin.methodId, method.bodyMaxHeight ?? DEFAULT_CARD_BODY_MAX_HEIGHT);
 * <div ref={resize.scrollRef} className="overflow-y-auto" style={resize.scrollStyle}>…</div>
 * <CardResizeHandle {...resize.handle} />
 */
export function useCardResize(persistKey: string, maxHeight: number): CardResize {
  const [height, setHeight] = usePersistentPinState<number | null>(`${persistKey}:cardHeight`, null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const measure = useCallback(
    () => Math.round(scrollRef.current?.getBoundingClientRect().height ?? maxHeight),
    [maxHeight],
  );

  const onResize = useCallback((next: number) => setHeight(clampHeight(next)), [setHeight]);
  const onReset = useCallback(() => setHeight(null), [setHeight]);

  return {
    scrollRef,
    scrollStyle: height === null ? { maxHeight } : { height },
    handle: { height, min: MIN_CARD_BODY_HEIGHT, max: MAX_CARD_BODY_HEIGHT, measure, onResize, onReset },
  };
}
