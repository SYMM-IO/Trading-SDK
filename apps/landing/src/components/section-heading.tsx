import { cn } from "@symmio/ui/lib/utils";
import type { ReactNode } from "react";

interface Props {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  className?: string;
}

/** Consistent section header — an uppercase eyebrow, a display title, and optional lede. */
export function SectionHeading({ eyebrow, title, description, align = "left", className }: Props) {
  return (
    <div className={cn("flex flex-col gap-4", align === "center" && "items-center text-center", className)}>
      <span className="text-primary inline-flex items-center gap-2 text-xs font-semibold tracking-[0.18em] uppercase">
        <span className="bg-primary/70 size-1.5 rounded-full" aria-hidden />
        {eyebrow}
      </span>
      <h2 className="font-display text-foreground max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "text-muted-foreground max-w-2xl text-base leading-7 text-pretty",
            align === "center" && "mx-auto",
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
