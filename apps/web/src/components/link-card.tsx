import { Card, CardContent, CardHeader, CardTitle } from "@theoldvarorg/ui/components/card";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

export interface LinkCardProps {
  href: string;
  /** Small uppercase kicker in the card's top-right (e.g. "ABI", "Flow"). */
  eyebrow: string;
  title: string;
  description: string;
  /** Glyph shown in the tinted top-left badge. */
  icon: ReactNode;
  /** Call-to-action label in the footer. */
  cta?: string;
  /** Optional trailing footer note (e.g. a method count). */
  meta?: ReactNode;
  /** Stagger index for the entrance animation. */
  index?: number;
}

/**
 * Linked feature card with a tinted icon badge, hover lift, and an accent glow —
 * the navigation tile used on the home page and the Contracts hub.
 */
export function LinkCard({ href, eyebrow, title, description, icon, cta = "Open", meta, index = 0 }: LinkCardProps) {
  return (
    <Link
      href={href}
      className="group animate-enter-up block focus-visible:outline-none"
      style={{ "--enter-delay": `${120 + index * 80}ms` } as CSSProperties}
    >
      <Card className="group-focus-visible:ring-ring group-hover:ring-primary/40 relative h-full transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg group-focus-visible:ring-2">
        <div
          className="bg-primary/15 pointer-events-none absolute -top-16 -right-12 size-40 rounded-full opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-100"
          aria-hidden
        />
        <CardHeader>
          <div className="flex items-center justify-between">
            <span className="bg-primary/10 text-primary ring-primary/15 flex size-11 items-center justify-center rounded-xl ring-1 transition-transform duration-300 group-hover:scale-105">
              {icon}
            </span>
            <span className="text-muted-foreground text-[10px] font-medium tracking-[0.18em] uppercase">{eyebrow}</span>
          </div>
          <CardTitle className="font-display mt-4 text-lg tracking-tight">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm leading-6">{description}</p>
          <div className="mt-5 flex items-center justify-between">
            <span className="text-primary inline-flex items-center gap-1.5 text-sm font-medium">
              {cta}
              <ArrowIcon className="transition-transform duration-300 group-hover:translate-x-1" />
            </span>
            {meta ? <span className="text-muted-foreground font-mono text-xs">{meta}</span> : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className ?? "size-4"} aria-hidden>
      <path
        d="M3 8h10M9 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
