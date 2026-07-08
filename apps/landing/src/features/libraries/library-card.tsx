import type { LibraryEntry } from "@/features/libraries/libraries-data";
import { cn } from "@symmio/ui/lib/utils";

/**
 * One package tile — tinted icon badge, mono package name, description, and a
 * keyword footer. The whole card links to that package's docs. Hover lifts the
 * card and blooms an accent glow, matching the console's `LinkCard`. A
 * {@link LibraryEntry.featured} card swaps its static edge for the animated
 * `card-live-border` sweep so the foundational package reads first.
 */
export function LibraryCard({ entry }: { entry: LibraryEntry }) {
  return (
    <a
      href={entry.href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "group focus-visible:ring-ring relative flex h-full flex-col overflow-hidden rounded-2xl border p-5 shadow-sm backdrop-blur-sm transition-all duration-300 outline-none hover:-translate-y-1 hover:shadow-lg focus-visible:ring-2",
        entry.featured
          ? "card-live-border bg-card/70 border-transparent"
          : "border-border/70 bg-card/60 hover:border-primary/40",
      )}
    >
      <div
        className="bg-primary/15 pointer-events-none absolute -top-14 -right-10 size-36 rounded-full opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-100"
        aria-hidden
      />

      <div className="relative flex items-center justify-between">
        <span className="bg-primary/10 text-primary ring-primary/15 flex size-11 items-center justify-center rounded-xl ring-1 transition-transform duration-300 group-hover:scale-105">
          {entry.icon}
        </span>
        <span className="text-muted-foreground text-[10px] font-medium tracking-[0.18em] uppercase">{entry.role}</span>
      </div>

      <h3 className="text-foreground mt-4 font-mono text-sm font-medium tracking-tight">{entry.pkg}</h3>
      <p className="text-muted-foreground mt-2 flex-1 text-sm leading-6">{entry.description}</p>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {entry.tags.map((tag) => (
            <span
              key={tag}
              className="border-border/60 bg-muted/40 text-muted-foreground rounded-md border px-1.5 py-0.5 font-mono text-[10px]"
            >
              {tag}
            </span>
          ))}
        </div>
        <span className="text-primary inline-flex shrink-0 items-center gap-1 text-xs font-medium">
          Docs
          <svg
            viewBox="0 0 16 16"
            fill="none"
            className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
            aria-hidden
          >
            <path
              d="M3 8h10M9 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </a>
  );
}
