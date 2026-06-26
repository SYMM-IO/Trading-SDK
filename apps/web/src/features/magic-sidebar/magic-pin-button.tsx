"use client";

import { cn } from "@theoldvarorg/ui/lib/utils";
import { useMagicSidebar } from "./magic-sidebar-store";

/**
 * Inline toggle that pins/unpins a method to the magic sidebar. Rendered in a
 * read card's header (via `MethodCard`'s `magicMethodId`). Pinning reveals the
 * board so the new live card is immediately visible, seeded with the card's
 * current input so it inherits the card's data.
 */
export function MagicPinButton({ methodId, input }: { methodId: string; input?: string }) {
  const { isPinned, unpin, pinAndReveal } = useMagicSidebar();
  const pinned = isPinned(methodId);

  return (
    <button
      type="button"
      aria-pressed={pinned}
      aria-label={pinned ? "Remove from magic sidebar" : "Pin to magic sidebar"}
      title={pinned ? "Pinned — click to remove from magic sidebar" : "Pin to magic sidebar"}
      onClick={() => (pinned ? unpin(methodId) : pinAndReveal(methodId, input))}
      className={cn(
        "focus-visible:ring-ring/40 inline-flex size-7 shrink-0 items-center justify-center rounded-lg border transition-colors outline-none focus-visible:ring-2",
        pinned
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted",
      )}
    >
      <PinIcon filled={pinned} />
    </button>
  );
}

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 4h6M10 4l-.6 5.1a3 3 0 0 1-1 1.9L6 13.5h12l-2.4-2.5a3 3 0 0 1-1-1.9L14 4M12 13.5V20" />
    </svg>
  );
}
