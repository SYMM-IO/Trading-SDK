"use client";

import { cn } from "@theoldvarorg/ui/lib/utils";
import { useState } from "react";
import { MagicCloseNotice } from "./magic-close-notice";
import { MagicSidebarPanel } from "./magic-sidebar-panel";
import { useMagicSidebar } from "./magic-sidebar-store";

/**
 * Header control that opens the {@link MagicSidebarPanel} — to the board when
 * methods are pinned, otherwise to the searchable catalog. Shows the pinned
 * count, or a live pulse while open.
 */
export function MagicSidebarLauncher() {
  const { open, setOpen, openSidebar, pins, closeNoticeDismissed, dismissCloseNotice } = useMagicSidebar();
  const [noticeOpen, setNoticeOpen] = useState(false);
  const count = pins.length;

  /**
   * Intercept closing while methods are pinned: the panel stays mounted and keeps
   * polling/streaming in the background, so warn once (until opted out) instead of
   * closing silently. Opening, and any close with no pins, pass straight through.
   */
  const handleOpenChange = (next: boolean) => {
    if (!next && open && count > 0 && !closeNoticeDismissed) {
      setNoticeOpen(true);
      return;
    }
    setOpen(next);
  };

  return (
    <>
      <button
        type="button"
        aria-label={count > 0 ? `Magic sidebar — ${count} pinned` : "Magic sidebar — browse methods"}
        title="Magic sidebar"
        aria-expanded={open}
        onClick={openSidebar}
        className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/40 border-border/70 relative inline-flex size-9 items-center justify-center rounded-xl border bg-transparent transition-colors outline-none focus-visible:ring-3"
      >
        <SparkIcon className="size-[18px]" />
        {count > 0 ? (
          <span
            className={cn(
              "bg-primary text-primary-foreground ring-background absolute -top-1 -right-1 inline-flex min-w-4 items-center justify-center rounded-full px-1 font-mono text-[10px] leading-4 ring-2",
              open && "animate-pulse",
            )}
            aria-hidden
          >
            {count}
          </span>
        ) : open ? (
          <span
            className="bg-primary ring-background absolute -top-0.5 -right-0.5 size-2 animate-pulse rounded-full ring-2"
            aria-hidden
          />
        ) : null}
      </button>
      <MagicSidebarPanel open={open} onOpenChange={handleOpenChange} />
      <MagicCloseNotice
        open={noticeOpen}
        pinCount={count}
        onCancel={() => setNoticeOpen(false)}
        onConfirm={(dontShowAgain) => {
          if (dontShowAgain) dismissCloseNotice();
          setNoticeOpen(false);
          setOpen(false);
        }}
      />
    </>
  );
}

function SparkIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 3.5 13.7 8.3 18.5 10 13.7 11.7 12 16.5 10.3 11.7 5.5 10 10.3 8.3 12 3.5Z" />
      <path d="M18.5 15.5 19.3 17.7 21.5 18.5 19.3 19.3 18.5 21.5 17.7 19.3 15.5 18.5 17.7 17.7 18.5 15.5Z" />
    </svg>
  );
}
