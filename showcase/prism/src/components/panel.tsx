import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export interface PanelProps {
  children: ReactNode;
  /** DOM id, so a resize handle can name the region it controls. */
  id?: string;
  className?: string;
}

/** A surface at `--bg-1` with a hairline border. The app's only card shape. */
export function Panel({ children, id, className }: PanelProps) {
  return (
    <section id={id} className={cn("rounded-xl border border-line bg-bg-1 shadow-[var(--shadow-card)]", className)}>
      {children}
    </section>
  );
}

export interface PanelHeaderProps {
  title: ReactNode;
  /** Right-aligned controls — filters, switches, live indicators. */
  actions?: ReactNode;
  /** Micro-label above the title. */
  eyebrow?: ReactNode;
  className?: string;
}

/** Panel title row. Bottom hairline only — the system forbids vertical rules. */
export function PanelHeader({ title, actions, eyebrow, className }: PanelHeaderProps) {
  return (
    <header className={cn("flex min-h-[46px] items-center gap-3 border-b border-line-subtle px-4 py-2.5", className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        {eyebrow ? <MicroLabel>{eyebrow}</MicroLabel> : null}
        <h2 className="truncate font-display text-lg font-semibold tracking-[-0.02em] text-fg-0">{title}</h2>
      </div>
      {actions ? <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export interface MicroLabelProps {
  children: ReactNode;
  className?: string;
}

/** 10px uppercase micro-label with mega tracking. Column heads, eyebrows. */
export function MicroLabel({ children, className }: MicroLabelProps) {
  return (
    <span className={cn("text-2xs font-semibold tracking-[0.12em] whitespace-nowrap text-fg-3 uppercase", className)}>
      {children}
    </span>
  );
}
