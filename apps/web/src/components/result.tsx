import { Badge } from "@symm-frontier/ui/components/badge";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import type { ReactNode } from "react";

/**
 * Low-emphasis result line — idle prompts and empty/loading states. Pass
 * `loading` to prefix a spinner.
 */
export function ResultNote({
  children,
  testId,
  loading = false,
}: {
  children: ReactNode;
  testId?: string;
  loading?: boolean;
}) {
  return (
    <div data-testid={testId} className="text-muted-foreground flex items-center gap-2 text-sm">
      {loading ? <Spinner className="size-4" /> : null}
      <span>{children}</span>
    </div>
  );
}

/** Typed-error panel — shows the SDK error `kind` as a chip and the message. */
export function ResultError({ kind, message, testId }: { kind?: ReactNode; message: ReactNode; testId?: string }) {
  return (
    <div
      data-testid={testId}
      role="alert"
      className="border-destructive/30 bg-destructive/10 text-destructive rounded-xl border px-3 py-2.5 text-sm"
    >
      {kind ? (
        <Badge variant="destructive" className="mr-2 font-mono">
          {kind}
        </Badge>
      ) : null}
      <span className="text-foreground/90">{message}</span>
    </div>
  );
}

/** Success panel — confirmed writes / positive outcomes. */
export function ResultSuccess({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <div
      data-testid={testId}
      className="border-positive/30 bg-positive/10 text-positive flex flex-col gap-1 rounded-xl border px-3 py-2.5 text-sm"
    >
      {children}
    </div>
  );
}
