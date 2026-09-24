import { Badge } from "@symmio/ui/components/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@symmio/ui/components/card";
import { cn } from "@symmio/ui/lib/utils";
import type { ReactNode } from "react";
import { GASLESS_METHODS } from "./gasless-methods";
import { SessionKeyWriteToggle } from "./session-key-write-toggle";

interface Props {
  /** Registry id from {@link GASLESS_METHODS} — also the card's anchor and its read/write lookup key. */
  testId: string;
  /** SDK method or concept the card demonstrates, shown mono as the title. */
  method: string;
  description: string;
  children: ReactNode;
  /** Span both columns in the grid (for wide result tables). */
  wide?: boolean;
  /**
   * The write this card signs, when a session key may sign it instead of the
   * wallet. Renders the card's {@link SessionKeyWriteToggle} beside the chip,
   * keyed by this name; the body must read the same name back (through
   * `useGaslessWriteOption` or `useSessionKeyWriteMode`) for the toggle to mean
   * anything.
   */
  sessionKeyMethod?: string;
}

/**
 * Visual frame for one gasless capability on the Gasless page. Mirrors the Muon
 * page's service card, with a "Gasless" chip marking the relayer integration.
 * The tint follows the card's {@link GASLESS_METHODS} kind — info for a read,
 * amber for a write — so the chip matches its command-palette row and amber keeps
 * meaning "write" everywhere. The body holds the form inputs and the result panel.
 */
export function GaslessCard({ testId, method, description, children, wide = false, sessionKeyMethod }: Props) {
  const isWrite = GASLESS_METHODS.find((entry) => entry.id === testId)?.kind === "write";

  return (
    <Card
      id={testId}
      data-testid={testId}
      className={cn(
        "hover:ring-border scroll-mt-24 transition-all duration-200 hover:shadow-md",
        wide && "col-span-full",
      )}
    >
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className={cn("size-2 rounded-full", isWrite ? "bg-warning" : "bg-info")} aria-hidden />
          <CardTitle className="font-mono text-[0.95rem] font-medium tracking-tight">{method}</CardTitle>
          <div className="ml-auto flex items-center gap-2">
            {sessionKeyMethod ? <SessionKeyWriteToggle method={sessionKeyMethod} /> : null}
            <Badge variant={isWrite ? "warning" : "info"} className="tracking-wide uppercase">
              Gasless
            </Badge>
          </div>
        </div>
        <CardDescription className="leading-6">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
