import type { ReactNode } from "react";

interface Props {
  /** Small uppercase kicker above the title (e.g. "Inspector"). */
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  /** Optional controls aligned to the end of the title row (desktop). */
  actions?: ReactNode;
}

/**
 * Standard page lead-in: an accented eyebrow, a display-font title, and a
 * supporting line. Animates up on mount; pair with staggered content below.
 */
export function PageHeader({ eyebrow, title, description, actions }: Props) {
  return (
    <header className="animate-enter-up flex flex-col gap-4">
      {eyebrow ? (
        <span className="text-muted-foreground inline-flex items-center gap-2 text-xs font-medium tracking-[0.18em] uppercase">
          <span className="bg-primary size-1.5 rounded-full" aria-hidden />
          {eyebrow}
        </span>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2.5">
          <h1 className="font-display text-foreground text-pretty text-3xl font-semibold tracking-tight sm:text-[2.5rem] sm:leading-[1.05]">
            {title}
          </h1>
          {description ? (
            <p className="text-muted-foreground max-w-2xl text-sm leading-6 text-pretty">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
