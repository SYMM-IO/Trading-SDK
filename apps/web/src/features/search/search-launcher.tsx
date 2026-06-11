"use client";

import { useEffect, useState } from "react";
import { CommandSearch } from "./command-search";

/**
 * Header control that opens the app-wide command palette. Click the trigger or
 * press ⌘K / Ctrl+K anywhere. Renders a compact pill on desktop (with the key
 * hint) and an icon-only button on mobile.
 */
export function SearchLauncher() {
  const [open, setOpen] = useState(false);
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    setIsMac(/mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent));
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <button
        type="button"
        aria-label="Search"
        title="Search"
        aria-keyshortcuts="Meta+K Control+K"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/40 border-border/70 inline-flex h-9 items-center gap-2 rounded-xl border bg-transparent px-2.5 transition-colors outline-none focus-visible:ring-3 sm:min-w-44 sm:justify-start"
      >
        <SearchIcon className="size-[18px] shrink-0" />
        <span className="hidden text-sm sm:inline">Search…</span>
        <kbd
          suppressHydrationWarning
          className="border-border/70 bg-muted/60 ml-auto hidden items-center rounded px-1.5 py-0.5 font-sans text-[0.7rem] font-medium sm:inline-flex"
        >
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      </button>
      <CommandSearch open={open} onOpenChange={setOpen} />
    </>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
