"use client";

import { cn } from "@/lib/cn";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MicroLabel } from "./panel";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Micro-label above the title. Flows use it to name the account they target. */
  eyebrow?: ReactNode;
  /** Docked action row pinned under a hairline at the bottom of the sheet. */
  footer?: ReactNode;
  /**
   * `wide` for a sheet that reads as a document rather than a form — a long
   * label/value list needs the extra measure or every value wraps.
   *
   * A prop rather than a `className` override because `cn` is a plain join with
   * no `tailwind-merge` behind it, so a second `max-w-*` would land in the same
   * cascade layer at the same specificity and win or lose by source order.
   */
  width?: "default" | "wide";
  children: ReactNode;
  className?: string;
}

/**
 * The app's only dialog.
 *
 * Deliberately hand-rolled: Prism ships no UI dependency, so there is no Radix
 * here. Escape and a backdrop click both close, and the page behind it is locked
 * while the sheet is up — the sheet is bounded by the viewport and scrolls its
 * own body, so the page never has a scroll to give. Focus is *not* trapped:
 * tabbing out is a smaller cost than shipping a trap that fights the browser.
 *
 * ## Why it renders through a portal
 *
 * A sheet is opened from wherever its trigger happens to sit — and several of
 * them are opened from *inside another sheet*, off a `DetailRow` whose value
 * cell is `truncate`d. Rendered in place, the dialog inherits that cell's
 * `white-space: nowrap`, so every paragraph in it runs onto one line and the
 * body grows a horizontal scrollbar instead of wrapping. `position: fixed` does
 * not save it either: the parent sheet animates its own `transform`, which makes
 * it the containing block for anything fixed inside it, so a nested dialog
 * centres on the parent sheet and paints across its border rather than covering
 * the viewport. Both are the same fix — leave the tree, mount on `<body>`.
 */
export function Modal({ open, onClose, title, eyebrow, footer, children, width = "default", className }: ModalProps) {
  /* `document` only exists after hydration, and the portal target has to be the
     same on both passes — so the first client render matches the server's
     nothing, and the sheet mounts on the one after it. */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-40 flex justify-center p-4 sm:p-8">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 cursor-default bg-[rgba(8,9,13,0.74)]"
      />

      {/* The sheet is bounded by the viewport and scrolls inside itself, rather
          than growing past the fold and handing the scroll to the page. A long
          sheet — the position details run to twice a laptop's height — would
          otherwise carry its title off the top and its actions below the
          bottom, so the one control that closes it and the one that acts on it
          are both somewhere else. `min-h-0` on the body is what actually lets it
          shrink: a flex child's default `min-height: auto` refuses to go below
          its content, and the overflow silently moves back out to the page. */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "prism-rise relative z-10 m-auto flex max-h-full w-full flex-col rounded-xl border border-line bg-bg-1",
          width === "wide" ? "max-w-[520px]" : "max-w-[440px]",
          "shadow-[var(--shadow-modal)]",
          className,
        )}
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-line-subtle px-4 py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            {eyebrow ? <MicroLabel>{eyebrow}</MicroLabel> : null}
            <h2 className="truncate font-display text-lg font-semibold tracking-[-0.02em] text-fg-0">{title}</h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="ml-auto flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-sm text-fg-3 transition-colors duration-[var(--dur-fast)] hover:bg-bg-2 hover:text-fg-0"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-4">{children}</div>

        {footer ? <div className="flex shrink-0 flex-col gap-2 border-t border-line-subtle p-4">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden>
      <path d="M3.5 3.5l9 9m0-9l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
