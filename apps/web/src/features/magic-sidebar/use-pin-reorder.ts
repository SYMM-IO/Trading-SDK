"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

/** Distance (px) from a scroll edge at which the list starts auto-scrolling during a drag. */
const EDGE_ZONE = 56;
/** Largest per-frame auto-scroll step (px) when the pointer is hard against the edge. */
const MAX_AUTOSCROLL_STEP = 14;

/** Pointer/keyboard props for a card's grip handle, spread onto the handle button. */
export interface PinReorderHandleProps {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
}

/** What {@link usePinReorder} hands back to the board to render a reorderable list. */
export interface PinReorder {
  /** Id of the pin currently being dragged, or `null` when idle. */
  activeId: string | null;
  /** Insertion slot (0…length) the drop indicator sits at, or `null` when idle. */
  indicatorIndex: number | null;
  /** Ref for the list container; used to locate the scroll parent for auto-scroll. */
  containerRef: (node: HTMLElement | null) => void;
  /** Per-id ref callback registering each card wrapper for slot hit-testing. */
  setItemRef: (id: string) => (node: HTMLElement | null) => void;
  /** Build the handler/aria props for one card's grip handle. */
  getHandleProps: (id: string) => PinReorderHandleProps;
  /** Whether dropping at `slot` would leave the order unchanged (indicator stays hidden there). */
  isNoOpSlot: (slot: number) => boolean;
}

/** Walk up from `el` to the nearest vertically scrollable ancestor, if any. */
function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const overflowY = getComputedStyle(node).overflowY;
    if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * Vertical drag-to-reorder for the pinned board. The drag is started from each
 * card's grip handle (pointer capture keeps it tracking outside the handle), the
 * dragged card stays in place while a drop indicator marks where it will land,
 * and the same move is available from the keyboard (Arrow Up / Arrow Down on the
 * focused handle). Auto-scrolls the list when the pointer nears an edge.
 *
 * @param ids Pin ids in current display order.
 * @param onReorder Commit a move: place `activeId` before `overId`, or at the end when `overId` is `null`.
 *
 * @example
 * const { activeId, indicatorIndex, containerRef, setItemRef, getHandleProps, isNoOpSlot } =
 *   usePinReorder(pins.map((p) => p.methodId), reorderPins);
 */
export function usePinReorder(ids: string[], onReorder: (activeId: string, overId: string | null) => void): PinReorder {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [indicatorIndex, setIndicatorIndex] = useState<number | null>(null);

  const itemEls = useRef(new Map<string, HTMLElement>());
  const containerEl = useRef<HTMLElement | null>(null);
  const scrollParent = useRef<HTMLElement | null>(null);
  const pointerY = useRef(0);
  const rafId = useRef<number | null>(null);
  const activeIdRef = useRef<string | null>(null);
  /** Latest order, read inside event handlers without re-binding them. */
  const idsRef = useRef(ids);
  idsRef.current = ids;

  const containerRef = useCallback((node: HTMLElement | null) => {
    containerEl.current = node;
  }, []);

  const setItemRef = useCallback(
    (id: string) => (node: HTMLElement | null) => {
      if (node) itemEls.current.set(id, node);
      else itemEls.current.delete(id);
    },
    [],
  );

  /** Insertion slot for a viewport Y: the count of cards whose midpoint sits above it. */
  const slotForY = useCallback((y: number) => {
    let slot = 0;
    for (const id of idsRef.current) {
      const el = itemEls.current.get(id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (y > rect.top + rect.height / 2) slot += 1;
    }
    return slot;
  }, []);

  const stopAutoScroll = useCallback(() => {
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
  }, []);

  const tickAutoScroll = useCallback(() => {
    const parent = scrollParent.current;
    if (!parent || activeIdRef.current === null) {
      rafId.current = null;
      return;
    }
    const rect = parent.getBoundingClientRect();
    const y = pointerY.current;
    let delta = 0;
    if (y < rect.top + EDGE_ZONE) {
      delta = -Math.ceil(((rect.top + EDGE_ZONE - y) / EDGE_ZONE) * MAX_AUTOSCROLL_STEP);
    } else if (y > rect.bottom - EDGE_ZONE) {
      delta = Math.ceil(((y - (rect.bottom - EDGE_ZONE)) / EDGE_ZONE) * MAX_AUTOSCROLL_STEP);
    }
    if (delta !== 0) {
      parent.scrollTop += delta;
      setIndicatorIndex(slotForY(y));
    }
    rafId.current = requestAnimationFrame(tickAutoScroll);
  }, [slotForY]);

  const resetBodyStyles = useCallback(() => {
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }, []);

  const finishDrag = useCallback(() => {
    activeIdRef.current = null;
    setActiveId(null);
    setIndicatorIndex(null);
    scrollParent.current = null;
    stopAutoScroll();
    resetBodyStyles();
  }, [resetBodyStyles, stopAutoScroll]);

  const handlePointerDown = useCallback(
    (id: string, event: ReactPointerEvent<HTMLElement>) => {
      /** Ignore secondary buttons; let them pass through to default behavior. */
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      activeIdRef.current = id;
      pointerY.current = event.clientY;
      scrollParent.current = findScrollParent(containerEl.current);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "grabbing";
      setActiveId(id);
      setIndicatorIndex(slotForY(event.clientY));
      if (rafId.current === null) rafId.current = requestAnimationFrame(tickAutoScroll);
    },
    [slotForY, tickAutoScroll],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (activeIdRef.current === null) return;
      pointerY.current = event.clientY;
      setIndicatorIndex(slotForY(event.clientY));
    },
    [slotForY],
  );

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const id = activeIdRef.current;
      if (id === null) return;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /** Capture may already be gone (e.g. pointer cancelled); ignore. */
      }
      const slot = slotForY(event.clientY);
      const order = idsRef.current;
      const from = order.indexOf(id);
      /** `from` and `from + 1` are the two slots that leave `id` exactly where it is. */
      if (from !== -1 && slot !== from && slot !== from + 1) {
        onReorder(id, order[slot] ?? null);
      }
      finishDrag();
    },
    [finishDrag, onReorder, slotForY],
  );

  const handlePointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (activeIdRef.current === null) return;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /** Capture may already be gone; ignore. */
      }
      finishDrag();
    },
    [finishDrag],
  );

  const handleKeyDown = useCallback(
    (id: string, event: ReactKeyboardEvent<HTMLElement>) => {
      const order = idsRef.current;
      const index = order.indexOf(id);
      if (index === -1) return;
      if (event.key === "ArrowUp" && index > 0) {
        event.preventDefault();
        onReorder(id, order[index - 1] ?? null);
      } else if (event.key === "ArrowDown" && index < order.length - 1) {
        event.preventDefault();
        /** Insert before the card two slots down, or append when moving to the end. */
        onReorder(id, order[index + 2] ?? null);
      }
    },
    [onReorder],
  );

  const getHandleProps = useCallback(
    (id: string): PinReorderHandleProps => ({
      onPointerDown: (event) => handlePointerDown(id, event),
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
      onKeyDown: (event) => handleKeyDown(id, event),
    }),
    [handleKeyDown, handlePointerCancel, handlePointerDown, handlePointerMove, handlePointerUp],
  );

  const isNoOpSlot = useCallback(
    (slot: number) => {
      if (activeId === null) return true;
      const from = idsRef.current.indexOf(activeId);
      return from === -1 || slot === from || slot === from + 1;
    },
    [activeId],
  );

  /** Safety net: drop the auto-scroll loop and any body-style locks on unmount. */
  useEffect(() => stopAutoScroll, [stopAutoScroll]);
  useEffect(() => resetBodyStyles, [resetBodyStyles]);

  return { activeId, indicatorIndex, containerRef, setItemRef, getHandleProps, isNoOpSlot };
}
