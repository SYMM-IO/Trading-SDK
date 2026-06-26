import { CopyButton } from "@theoldvarorg/ui/components/copy-button";
import { cn } from "@theoldvarorg/ui/lib/utils";
import type * as React from "react";
import type { ReactNode } from "react";

/** A definition list with hairline separators between rows. */
export function DataList({ children, className, ...props }: React.ComponentProps<"dl">) {
  return (
    <dl className={cn("divide-border/60 divide-y", className)} {...props}>
      {children}
    </dl>
  );
}

interface DataRowProps {
  label: ReactNode;
  value?: ReactNode;
  /** Render the value in mono (addresses, hashes, figures). */
  mono?: boolean;
  /** When set, append a copy button that copies this string. */
  copyValue?: string;
  className?: string;
}

/** One label/value pair inside a {@link DataList}. */
export function DataRow({ label, value, mono = false, copyValue, className }: DataRowProps) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-2.5", className)}>
      <dt className="text-muted-foreground shrink-0 text-xs font-medium tracking-wide uppercase">{label}</dt>
      <dd className={cn("flex min-w-0 items-center justify-end gap-1.5 text-right text-sm", mono && "font-mono")}>
        <span className="text-foreground truncate">{value ?? <span className="text-muted-foreground">—</span>}</span>
        {copyValue ? <CopyButton value={copyValue} className="size-5" /> : null}
      </dd>
    </div>
  );
}
