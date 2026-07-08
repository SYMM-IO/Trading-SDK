import { Reveal, Stagger, StaggerItem } from "@/components/reveal";
import { SectionHeading } from "@/components/section-heading";
import { libraries } from "@/features/libraries/libraries-data";
import { LibraryCard } from "@/features/libraries/library-card";
import { siteLinks } from "@/lib/site";

/** The library grid — every published package, each linking to its docs. */
export function LibrariesSection() {
  return (
    <section id="libraries" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
      <Reveal>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            eyebrow="Libraries"
            title="Five packages. Pick what you need."
            description="Each is published, typed, and documented on its own. Install the core, add the React layer, reach for signing and utils as you go."
          />
          <a
            href={siteLinks.docs}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground group inline-flex shrink-0 items-center gap-1.5 text-sm font-medium transition-colors"
          >
            All docs
            <svg
              viewBox="0 0 16 16"
              fill="none"
              className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
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
          </a>
        </div>
      </Reveal>

      <Stagger className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {libraries.map((entry) => (
          <StaggerItem key={entry.pkg} className="h-full">
            <LibraryCard entry={entry} />
          </StaggerItem>
        ))}
        <StaggerItem className="h-full">
          <SourceCard />
        </StaggerItem>
      </Stagger>
    </section>
  );
}

/** Sixth tile — fills the grid and points at the monorepo source. */
function SourceCard() {
  return (
    <a
      href={siteLinks.github}
      target="_blank"
      rel="noreferrer"
      className="group border-border/70 hover:border-primary/40 focus-visible:ring-ring bg-primary/5 relative flex h-full flex-col justify-between gap-6 overflow-hidden rounded-2xl border border-dashed p-5 transition-all duration-300 outline-none hover:-translate-y-1 focus-visible:ring-2"
    >
      <div className="flex items-center justify-between">
        <span className="bg-primary/10 text-primary ring-primary/15 flex size-11 items-center justify-center rounded-xl ring-1 transition-transform duration-300 group-hover:scale-105">
          <GitHubIcon />
        </span>
        <span className="text-muted-foreground text-[10px] font-medium tracking-[0.18em] uppercase">Open source</span>
      </div>
      <div>
        <h3 className="text-foreground font-display text-base font-semibold tracking-tight">Read the source</h3>
        <p className="text-muted-foreground mt-1.5 text-sm leading-6">
          Every package lives in one monorepo. Browse the code, the tests, and the design docs on GitHub.
        </p>
      </div>
      <span className="text-primary inline-flex items-center gap-1 text-sm font-medium">
        View repository
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
    </a>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-5" aria-hidden>
      <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.09.68-.22.68-.49 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.34 9.34 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.35 4.79-4.58 5.05.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.59.69.49A10.26 10.26 0 0 0 22 12.25C22 6.58 17.52 2 12 2z" />
    </svg>
  );
}
