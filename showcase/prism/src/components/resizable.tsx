"use client";

import { cn } from "@/lib/cn";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";

/** How large a drag step one arrow-key press applies. */
const KEY_STEP = 24;

export interface ResizableOptions {
  /** `localStorage` key. The size survives a reload under this name. */
  storageKey: string;
  /** `y` drags vertically and sizes a height; `x` drags horizontally and sizes a width. */
  axis: "x" | "y";
  /** Size in pixels before the user has ever dragged. */
  initial: number;
  /** Lower bound in pixels. */
  min: number;
  /** Upper bound in pixels. A thunk is re-read on every drag frame, so it can track the container. */
  max: number | (() => number);
  /**
   * The element carrying the CSS custom property this size feeds, and the
   * property's name.
   *
   * During a drag the size is written straight onto that element instead of
   * through React state: a `pointermove` fires far more often than a paint, and
   * this grid's cells hold the chart, the order book, the ticket and a row of
   * blotter subscriptions — re-rendering all of them per frame is a visible
   * stutter for a value CSS can apply on its own.
   */
  surface: RefObject<HTMLElement | null>;
  /** The custom property to write, e.g. `--chart-h`. */
  cssVar: string;
  /**
   * Invert the drag direction.
   *
   * A handle sitting on the *leading* edge of the pane it sizes moves the
   * opposite way to the pane's size — dragging right makes a right-hand pane
   * narrower, not wider.
   */
  invert?: boolean;
  /** Accessible name for the handle. */
  label: string;
  /** `id` of the region this handle resizes. */
  controls?: string;
}

export interface Resizable {
  /** Current size in pixels, already clamped. Updated once per drag, on release. */
  size: number;
  /** True while a pointer drag is in flight. */
  isDragging: boolean;
  /** Restore `initial` and forget the stored value. */
  reset: () => void;
  /** Spread onto a {@link ResizeHandle} to make it drive the size. */
  handleProps: HandleProps;
}

interface HandleProps {
  role: "separator";
  "aria-orientation": "horizontal" | "vertical";
  "aria-valuenow": number;
  "aria-valuemin": number;
  "aria-valuemax": number;
  "aria-valuetext": string;
  "aria-label": string;
  "aria-controls"?: string;
  tabIndex: 0;
  "data-dragging": boolean;
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onDoubleClick: () => void;
}

/**
 * A persisted, keyboard-accessible pane size driven by a drag handle.
 *
 * Layout owns the number and the handle only reports deltas, which is what lets
 * a grid template stay declarative (`min(var(--chart-h), …)`) while the pointer
 * does its work outside React's render path.
 *
 * @example
 * ```tsx
 * const chart = useResizable({
 *   storageKey: "prism.chart-h", axis: "y", initial: 440, min: 220, max: 900,
 *   surface: gridRef, cssVar: "--chart-h", label: "Resize the chart",
 * });
 * <div ref={gridRef} style={{ "--chart-h": `${chart.size}px` }} className="prism-trade-grid">
 *   <PriceChart />
 *   <ResizeHandle {...chart.handleProps} axis="y" />
 *   <Blotter />
 * </div>
 * ```
 */
export function useResizable(options: ResizableOptions): Resizable {
  const { storageKey, axis, initial, min, max, surface, cssVar, invert = false, label, controls } = options;

  const [size, setSize] = useState(initial);
  const [isDragging, setIsDragging] = useState(false);
  /* `aria-valuemax` has to be a rendered attribute, and the ceiling depends on
     the container's height — reading that during render would both lie on the
     first client pass (the ref is still null) and force a sync reflow on every
     subsequent one. */
  const [ceiling, setCeiling] = useState(() => (typeof max === "function" ? initial : max));

  const drag = useRef<{ origin: number; from: number; latest: number } | null>(null);
  const frame = useRef<number | null>(null);

  const resolveMax = useCallback(() => (typeof max === "function" ? max() : max), [max]);

  const clamp = useCallback(
    (value: number) => Math.min(Math.max(value, min), Math.max(min, resolveMax())),
    [min, resolveMax],
  );

  /* Read the stored size after mount rather than during the first render, so
     the server and the client agree on the initial markup. */
  useEffect(() => {
    const stored = Number(window.localStorage.getItem(storageKey));
    if (Number.isFinite(stored) && stored > 0) setSize(clamp(stored));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  /* Track the container so the announced ceiling stays honest as the window
     changes, without measuring during render. */
  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    const update = () => setCeiling(resolveMax());
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [surface, resolveMax]);

  const commit = useCallback(
    (next: number) => {
      const clamped = clamp(next);
      setSize(clamped);
      window.localStorage.setItem(storageKey, String(Math.round(clamped)));
    },
    [clamp, storageKey],
  );

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      /* Focus the handle the pointer grabbed so the arrow keys fine-tune what
         was just dragged, without a second click. */
      event.currentTarget.focus({ preventScroll: true });
      drag.current = { origin: axis === "y" ? event.clientY : event.clientX, from: size, latest: size };
      setIsDragging(true);
    },
    [axis, size],
  );

  /* Move and release are bound to the window rather than the handle, so a fast
     drag that outruns six pixels of hit area keeps tracking. */
  useEffect(() => {
    if (!isDragging) return;

    function paint() {
      frame.current = null;
      const state = drag.current;
      if (!state) return;
      surface.current?.style.setProperty(cssVar, `${Math.round(state.latest)}px`);
    }

    function onMove(event: globalThis.PointerEvent) {
      const state = drag.current;
      if (!state) return;
      const position = axis === "y" ? event.clientY : event.clientX;
      const delta = (position - state.origin) * (invert ? -1 : 1);
      state.latest = clamp(state.from + delta);
      frame.current ??= window.requestAnimationFrame(paint);
    }

    function onUp() {
      const state = drag.current;
      drag.current = null;
      if (frame.current !== null) {
        window.cancelAnimationFrame(frame.current);
        frame.current = null;
      }
      /* Hand the value back to React exactly once. The inline property written
         during the drag is removed in the same pass the new state paints, so
         there is no frame where the two disagree. */
      surface.current?.style.removeProperty(cssVar);
      setIsDragging(false);
      if (state) commit(state.latest);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    /* The cursor has to survive leaving the handle, and text selection has to
       stop, or a drag across the blotter selects half the table. */
    const previousCursor = document.body.style.cursor;
    const previousSelect = document.body.style.userSelect;
    document.body.style.cursor = axis === "y" ? "row-resize" : "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelect;
    };
  }, [isDragging, axis, invert, clamp, commit, cssVar, surface]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const decrease = axis === "y" ? "ArrowUp" : "ArrowLeft";
      const increase = axis === "y" ? "ArrowDown" : "ArrowRight";
      const direction = event.key === decrease ? -1 : event.key === increase ? 1 : 0;

      if (direction !== 0) {
        event.preventDefault();
        commit(size + direction * KEY_STEP * (invert ? -1 : 1));
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        commit(min);
      } else if (event.key === "End") {
        event.preventDefault();
        commit(resolveMax());
      } else if (event.key === "Enter") {
        event.preventDefault();
        commit(initial);
      }
    },
    [axis, commit, initial, invert, min, resolveMax, size],
  );

  const reset = useCallback(() => commit(initial), [commit, initial]);

  return {
    size,
    isDragging,
    reset,
    handleProps: {
      role: "separator",
      "aria-orientation": axis === "y" ? "horizontal" : "vertical",
      "aria-valuenow": Math.round(size),
      "aria-valuemin": min,
      "aria-valuemax": Math.round(Math.max(min, ceiling)),
      "aria-valuetext": `${Math.round(size)} pixels`,
      "aria-label": label,
      ...(controls ? { "aria-controls": controls } : {}),
      tabIndex: 0,
      "data-dragging": isDragging,
      onPointerDown,
      onKeyDown,
      onDoubleClick: reset,
    },
  };
}

export interface ResizeHandleProps extends HandleProps {
  /** Matches the `axis` the size was created with. */
  axis: "x" | "y";
  className?: string;
  style?: CSSProperties;
}

/**
 * The visible grip for a {@link useResizable} size.
 *
 * The gutter *is* the handle: twelve pixels of hit area with one pixel of ink,
 * so the divider reads as a hairline until the pointer is on it. Focus shows
 * the same state, which is what makes keyboard resizing visible.
 */
export function ResizeHandle({ axis, className, style, ...handle }: ResizeHandleProps) {
  return (
    <div
      {...handle}
      style={style}
      className={cn(
        "group relative z-10 flex h-full w-full touch-none items-center justify-center outline-none select-none",
        axis === "y" ? "cursor-row-resize" : "cursor-col-resize",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "block rounded-full bg-line transition-colors duration-[var(--dur-fast)]",
          "group-hover:bg-accent group-focus-visible:bg-accent group-data-[dragging=true]:bg-accent",
          axis === "y" ? "h-px w-full group-hover:h-[2px]" : "h-full w-px group-hover:w-[2px]",
        )}
      />
      <span
        aria-hidden
        className={cn(
          "absolute rounded-full bg-line-strong opacity-0 transition-opacity duration-[var(--dur-fast)]",
          "group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[dragging=true]:opacity-100",
          axis === "y" ? "h-[3px] w-8" : "h-8 w-[3px]",
        )}
      />
    </div>
  );
}
