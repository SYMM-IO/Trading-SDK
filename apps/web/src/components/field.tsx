import { Label } from "@symm-frontier/ui/components/label";
import { cn } from "@symm-frontier/ui/lib/utils";
import type { CSSProperties, ReactNode } from "react";

interface Props {
  /** Label content — accepts a node so it can include an inline info tooltip. */
  label: ReactNode;
  /** `id` of the control this label points at. */
  htmlFor?: string;
  /** Helper text rendered below the control. */
  hint?: ReactNode;
  /** Optional control aligned to the end of the label row (e.g. "Reset"). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Inline styles for the root (e.g. a stagger `--enter-delay`). */
  style?: CSSProperties;
}

/** Label + control + hint, with consistent spacing across every form field. */
export function Field({ label, htmlFor, hint, action, children, className, style }: Props) {
  return (
    <div className={cn("flex flex-col gap-2", className)} style={style}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={htmlFor}>{label}</Label>
        {action}
      </div>
      {children}
      {hint ? <p className="text-muted-foreground text-xs leading-5">{hint}</p> : null}
    </div>
  );
}
