"use client";

import { cn } from "@symmio/ui/lib/utils";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  "aria-label"?: string;
}

/**
 * Refined two-or-more segmented control: a tinted track with a raised active
 * pill. When the options overflow their track it scrolls horizontally, with a
 * right-edge button that pages right and — once the end is reached — flips to
 * page back to the start.
 */
export function Segmented<T extends string>({ options, value, onChange, ...rest }: Props<T>) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [atEnd, setAtEnd] = useState(false);

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setOverflowing(el.scrollWidth > el.clientWidth + 1);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }, []);

  // Re-measure on mount, when the option set changes, and on resize.
  useLayoutEffect(measure, [measure, options.length]);
  useEffect(() => {
    const el = trackRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  function handleScroll() {
    const el = trackRef.current;
    if (!el) return;
    if (atEnd) el.scrollTo({ left: 0, behavior: "smooth" });
    else el.scrollBy({ left: Math.round(el.clientWidth * 0.7), behavior: "smooth" });
  }

  return (
    <div className="relative flex items-center">
      <div
        ref={trackRef}
        role="tablist"
        aria-label={rest["aria-label"]}
        onScroll={measure}
        className={cn(
          "bg-muted/70 ring-border/70 flex items-center gap-1 rounded-xl p-1 ring-1",
          "[scrollbar-width:none] overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden",
          overflowing && "pr-11",
        )}
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(option.value)}
              data-testid={`tab-${option.value}`}
              className={cn(
                "shrink-0 rounded-lg px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-all duration-200 outline-none",
                "focus-visible:ring-ring/40 focus-visible:ring-2 motion-reduce:transition-none",
                active
                  ? "bg-background text-foreground ring-border shadow-sm ring-1"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {overflowing ? (
        <button
          type="button"
          onClick={handleScroll}
          aria-label={atEnd ? "Scroll tabs to start" : "Scroll tabs right"}
          data-testid="tab-scroll"
          className={cn(
            "from-muted/95 via-muted/90 absolute inset-y-1 right-1 flex items-center rounded-lg bg-gradient-to-l to-transparent pr-1 pl-4",
            "text-muted-foreground hover:text-foreground focus-visible:ring-ring/40 outline-none focus-visible:ring-2",
          )}
        >
          <span
            aria-hidden
            className={cn("inline-block text-lg leading-none transition-transform", atEnd && "rotate-180")}
          >
            ›
          </span>
        </button>
      ) : null}
    </div>
  );
}
