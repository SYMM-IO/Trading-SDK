import { Badge } from "@symmio/ui/components/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@symmio/ui/components/card";
import { cn } from "@symmio/ui/lib/utils";
import type { ReactNode } from "react";

interface Props {
  testId: string;
  /** The Muon wire method name, shown mono as the card title (e.g. `uPnl_A`). */
  method: string;
  description: string;
  children: ReactNode;
  /** Span both columns in the methods grid (for wide result tables). */
  wide?: boolean;
}

/**
 * Visual frame for a single Muon service on the Muon page. Mirrors the Inspector's
 * MethodCard, with a tinted dot and a "Muon" chip marking it as an off-chain
 * oracle read; the body holds the form inputs and the result panel.
 */
export function MuonServiceCard({ testId, method, description, children, wide = false }: Props) {
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
          <span className="bg-info size-2 rounded-full" aria-hidden />
          <CardTitle className="font-mono text-[0.95rem] font-medium tracking-tight">{method}</CardTitle>
          <Badge variant="info" className="ml-auto tracking-wide uppercase">
            Muon
          </Badge>
        </div>
        <CardDescription className="leading-6">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
