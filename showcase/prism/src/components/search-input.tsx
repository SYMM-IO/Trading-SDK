"use client";

import { cn } from "@/lib/cn";

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** What a screen reader calls the box — name what is being searched, not the control. */
  ariaLabel?: string;
  /**
   * Width lives here, at the call site.
   *
   * `cn` joins class names and does not merge Tailwind ones, so a width baked
   * into the base class would sit alongside an override rather than lose to it,
   * and which one won would come down to stylesheet order.
   */
  className?: string;
}

/**
 * Compact search for a panel header.
 *
 * Not `<Field>`: that control is built for trade amounts — an 18px monospace
 * value with its label inside. A header filter needs to be quiet.
 *
 * Every keystroke is reported as it is typed. What that costs is the caller's
 * business: the markets screen filters a book it already holds, while the pool
 * catalog debounces because each change there is a request.
 */
export function SearchInput({ value, onChange, placeholder, ariaLabel = "Search", className }: SearchInputProps) {
  return (
    <label
      className={cn("prism-field flex h-8 items-center gap-2 rounded-md border border-line bg-bg-2 px-2.5", className)}
    >
      <svg aria-hidden viewBox="0 0 16 16" className="size-3.5 shrink-0 text-fg-3">
        <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="min-w-0 flex-1 bg-transparent font-sans text-sm text-fg-0 outline-none placeholder:text-fg-3"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="shrink-0 cursor-pointer text-fg-3 transition-colors duration-[var(--dur-fast)] hover:text-fg-1"
        >
          <svg aria-hidden viewBox="0 0 16 16" className="size-3">
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}
    </label>
  );
}
