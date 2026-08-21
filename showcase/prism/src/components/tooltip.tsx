"use client";

import { cn } from "@/lib/cn";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Distance between the trigger's edge and the bubble. */
const OFFSET = 8;

/** Keeps the bubble off the viewport edges when a trigger sits near one. */
const MARGIN = 8;

export interface TooltipProps {
  /** What the bubble says. Rich content is allowed — a title plus a definition. */
  content: ReactNode;
  /** The element that opens it. Must accept a ref-forwarding wrapper (it gets a span). */
  children: ReactNode;
  /** Preferred side. Flips automatically when there is no room. */
  side?: "top" | "bottom";
  /** Bubble width cap. Definitions want more room than labels do. */
  width?: number;
  className?: string;
}

interface Placement {
  top: number;
  left: number;
  side: "top" | "bottom";
}

/**
 * The app's only tooltip.
 *
 * Hand-rolled, like the modal — Prism ships no UI dependency. It exists because
 * half the figures in a position's detail sheet are *defined* rather than
 * self-evident: "maintenance margin" is locked CVA plus locked LF, and a trader
 * who does not know that cannot tell whether the number is good news. A native
 * `title` cannot carry that (no formatting, a one-second delay, invisible on
 * touch), so the explanation has to be a real layer.
 *
 * Rendered through a portal at fixed coordinates measured from the trigger. Both
 * halves of that matter: the sheet this mostly appears in scrolls inside itself
 * and clips its overflow, so an inline bubble would be cut off by the very panel
 * it explains — and a `position: fixed` child still resolves against an animated
 * ancestor's transform, which the modal has.
 *
 * Opens on hover **and** on focus, and closes on Escape, so the definitions are
 * reachable from the keyboard rather than being mouse-only trivia.
 */
export function Tooltip({ content, children, side = "top", width = 240, className }: TooltipProps) {
  const [placement, setPlacement] = useState<Placement | undefined>(undefined);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const open = placement !== undefined;

  /* Measured after paint against the real bubble, not against an assumed
     height: these bubbles hold a title and a sentence, so their height varies
     by a factor of three and a guess puts half of them over their trigger. */
  useEffect(() => {
    if (!open) return;

    const reposition = () => {
      const anchor = triggerRef.current?.getBoundingClientRect();
      const bubble = bubbleRef.current?.getBoundingClientRect();
      if (!anchor || !bubble) return;

      const fitsAbove = anchor.top - bubble.height - OFFSET >= MARGIN;
      const resolved = side === "top" && fitsAbove ? "top" : side === "top" ? "bottom" : "bottom";

      const top =
        resolved === "top" ? anchor.top - bubble.height - OFFSET : Math.min(anchor.bottom + OFFSET, window.innerHeight);

      const left = Math.min(
        Math.max(MARGIN, anchor.left + anchor.width / 2 - bubble.width / 2),
        window.innerWidth - bubble.width - MARGIN,
      );

      setPlacement((current) =>
        current && current.top === top && current.left === left && current.side === resolved
          ? current
          : { top, left, side: resolved },
      );
    };

    reposition();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPlacement(undefined);
    };

    window.addEventListener("keydown", onKeyDown);
    /* `capture` because the sheet scrolls in its own box, not the window. */
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, side]);

  const show = () => setPlacement((current) => current ?? { top: -9999, left: -9999, side });
  const hide = () => setPlacement(undefined);

  return (
    <>
      <span
        ref={triggerRef}
        tabIndex={0}
        aria-describedby={open ? id : undefined}
        onPointerEnter={show}
        onPointerLeave={hide}
        onFocus={show}
        onBlur={hide}
        className={cn(
          "inline-flex cursor-help items-center gap-1 rounded-sm",
          "focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none",
          className,
        )}
      >
        {children}
      </span>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={bubbleRef}
              id={id}
              role="tooltip"
              style={{ top: placement.top, left: placement.left, maxWidth: width }}
              className={cn(
                "prism-rise pointer-events-none fixed z-50 rounded-lg border border-line bg-bg-2 px-3 py-2",
                "text-sm leading-relaxed text-fg-1 shadow-[var(--shadow-pop)]",
              )}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export interface InfoTipProps {
  /** The bubble's heading — the term being defined. */
  title: string;
  /** The definition itself. */
  children: ReactNode;
  width?: number;
}

/**
 * A label's information dot.
 *
 * The dot is the trigger rather than the label, so a definition never competes
 * with the row's own hover affordance — a whole row that lights up on hover
 * reads as clickable, and most of these rows are not.
 */
export function InfoTip({ title, children, width }: InfoTipProps) {
  return (
    <Tooltip
      width={width}
      content={
        <span className="flex flex-col gap-1">
          <span className="font-display text-sm font-semibold text-fg-0">{title}</span>
          <span className="text-2xs leading-relaxed text-fg-2">{children}</span>
        </span>
      }
    >
      <svg viewBox="0 0 12 12" width="11" height="11" fill="none" aria-label={`About ${title}`} role="img">
        <circle cx="6" cy="6" r="5.25" stroke="currentColor" strokeWidth="1" opacity="0.5" />
        <path d="M6 5.1v3.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="6" cy="3.5" r="0.7" fill="currentColor" />
      </svg>
    </Tooltip>
  );
}
