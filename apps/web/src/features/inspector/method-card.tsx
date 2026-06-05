import { Badge } from "@symm-frontier/ui/components/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@symm-frontier/ui/components/card";
import { cn } from "@symm-frontier/ui/lib/utils";
import type { ReactNode } from "react";

interface Props {
  testId: string;
  name: string;
  mutability: "view" | "nonpayable";
  description: string;
  children: ReactNode;
  /** Span both columns in the methods grid (for wide table results). */
  wide?: boolean;
}

/**
 * Visual frame for a single AccountLayer method on the Inspector page. A tinted
 * status dot and read/write chip distinguish view methods from writes; the body
 * holds the inputs and the result panel.
 */
export function MethodCard({ testId, name, mutability, description, children, wide = false }: Props) {
  const isWrite = mutability === "nonpayable";

  return (
    <Card
      data-testid={testId}
      className={cn("hover:ring-border transition-all duration-200 hover:shadow-md", wide && "lg:col-span-2")}
    >
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className={cn("size-2 rounded-full", isWrite ? "bg-warning" : "bg-info")} aria-hidden />
          <CardTitle className="font-mono text-[0.95rem] font-medium tracking-tight">{name}</CardTitle>
          <Badge variant={isWrite ? "warning" : "info"} className="ml-auto tracking-wide uppercase">
            {isWrite ? "write" : "read"}
          </Badge>
        </div>
        <CardDescription className="leading-6">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
