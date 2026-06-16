"use client";
import { cn } from "@symm-frontier/ui/lib/utils";
import { useCallback, useRef, type KeyboardEvent, type PointerEvent } from "react";

/** Pixels a single arrow-key press grows/shrinks the panel. */
const KEYBOARD_STEP = 24;

interface Props {
  /** Current panel width (px) — used for keyboard nudges and ARIA. */
  width: number;
  /** Smallest width the panel may be dragged to (px), for ARIA bounds. */
  minWidth: number;
  /** Largest width the panel may be dragged to (px), for ARIA bounds. */
  maxWidth: number;
  /** Report a new absolute width (px); the store clamps it. */
  onResize: (width: number) => void;
  /** Called when a drag begins (lets the page disable its push transition). */
  onResizeStart?: () => void;
  /** Called when a drag ends. */
  onResizeEnd?: () => void;
}

/**
 * Drag handle pinned to the left edge of a right-docked panel. Dragging left
 * widens the panel, right narrows it; the left edge tracks the pointer. Also
 * keyboard-resizable with the arrow keys. Reports an absolute target width
 * (`window.innerWidth - pointerX`) and leaves clamping to the caller.
 */
export function SidebarResizeHandle({ width, minWidth, maxWidth, onResize, onResizeStart, onResizeEnd }: Props) {
  const draggingRef = useRef(false);

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      draggingRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
      onResizeStart?.();
    },
    [onResizeStart],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      onResize(window.innerWidth - event.clientX);
    },
    [onResize],
  );

  const endDrag = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /** Capture may already be gone (e.g. pointer cancelled); ignore. */
      }
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      onResizeEnd?.();
    },
    [onResizeEnd],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onResize(width + KEYBOARD_STEP);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        onResize(width - KEYBOARD_STEP);
      }
    },
    [onResize, width],
  );

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuenow={Math.round(width)}
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      className={cn(
        "group absolute inset-y-0 left-0 z-50 flex w-2 -translate-x-1/2 cursor-col-resize touch-none items-center justify-center",
        "outline-none",
      )}
    >
      <span
        aria-hidden
        className="group-hover:bg-primary/40 group-focus-visible:bg-primary/60 absolute inset-y-0 left-1/2 w-px bg-transparent transition-colors"
      />
      <span
        aria-hidden
        className="bg-border/80 group-hover:bg-primary/70 group-focus-visible:bg-primary relative h-12 w-1 rounded-full transition-colors"
      />
    </div>
  );
}
