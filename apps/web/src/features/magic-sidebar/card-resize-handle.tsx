"use client";

import { cn } from "@theoldvarorg/ui/lib/utils";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { CardResizeHandleProps } from "./use-card-resize";

/** Pixels a single arrow-key press grows/shrinks the card body. */
const KEYBOARD_STEP = 24;

/**
 * Drag handle pinned to a pinned card's bottom edge. Dragging down grows the
 * card body, up shrinks it; the body's bottom tracks the pointer. Also
 * keyboard-resizable (Arrow Up / Down) and resettable (double-click, or
 * Backspace / Delete) back to the content-driven auto height. Reports an
 * absolute target height and leaves clamping to the caller.
 */
export function CardResizeHandle({ height, min, max, measure, onResize, onReset }: CardResizeHandleProps) {
  /** Pointer origin + the height the drag started from; `null` when not dragging. */
  const dragRef = useRef<{ startY: number; base: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  /** Drop the global cursor / selection lock a drag puts on the page. */
  const releaseBody = useCallback(() => {
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }, []);

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragRef.current = { startY: event.clientY, base: height ?? measure() };
      event.currentTarget.setPointerCapture(event.pointerId);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "row-resize";
      setDragging(true);
    },
    [height, measure],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      onResize(drag.base + (event.clientY - drag.startY));
    },
    [onResize],
  );

  const endDrag = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return;
      dragRef.current = null;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /** Capture may already be gone (e.g. pointer cancelled); ignore. */
      }
      releaseBody();
      setDragging(false);
    },
    [releaseBody],
  );

  /** Safety net: if the card unmounts mid-drag (unpin / popout / reorder), the
      pointer-up never lands on the handle — drop the body lock on unmount. */
  useEffect(() => releaseBody, [releaseBody]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        onResize((height ?? measure()) + KEYBOARD_STEP);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        onResize((height ?? measure()) - KEYBOARD_STEP);
      } else if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        onReset();
      }
    },
    [height, measure, onResize, onReset],
  );

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize card · double-click to reset"
      aria-valuenow={height ?? undefined}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      onDoubleClick={onReset}
      title="Drag to resize · double-click to reset"
      className="group/resize border-border/50 flex h-3 cursor-row-resize touch-none items-center justify-center border-t outline-none"
    >
      <span
        aria-hidden
        className={cn(
          "h-1 w-9 rounded-full transition-colors",
          dragging
            ? "bg-primary"
            : "bg-border/70 group-hover/resize:bg-primary/70 group-focus-visible/resize:bg-primary",
        )}
      />
    </div>
  );
}
