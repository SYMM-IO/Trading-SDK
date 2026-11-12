import { Badge } from "@symmio/ui/components/badge";
import { Spinner } from "@symmio/ui/components/spinner";
import Link from "next/link";
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
export function ResultError({
  kind,
  message,
  testId,
  code,
  timelockAccount,
}: {
  kind?: ReactNode;
  message: ReactNode;
  testId?: string;
  code?: string | number;
  timelockAccount?: string;
}) {
  const policyError = code === 3711 || code === "3711" || code === "INSTANT_OPEN_TIMELOCK_POLICY_REQUIRED";
  const timelockError =
    policyError ||
    code === "TIMELOCK_REQUIRED" ||
    code === "TIMELOCK_POLICY_NOT_READY" ||
    code === "3702" ||
    code === 3702;
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
      {timelockError ? (
        <p className="text-foreground/90 mt-2">
          {policyError
            ? "Trading protection needs to be configured. "
            : "Review the timelock policy and authorization. "}
          <Link
            className="underline"
            href={
              timelockAccount
                ? `/contracts/timelock?account=${encodeURIComponent(timelockAccount)}`
                : "/contracts/timelock"
            }
          >
            Open timelock settings
          </Link>
        </p>
      ) : null}
    </div>
  );
}

/**
 * Warning panel — a condition the user should act on before continuing, but
 * not a failure: nothing is broken yet.
 */
export function ResultWarning({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <div
      data-testid={testId}
      role="status"
      className="border-warning/30 bg-warning/10 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm"
    >
      <Badge variant="warning" className="mt-0.5 shrink-0 font-mono">
        warning
      </Badge>
      <span className="text-foreground/90">{children}</span>
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
