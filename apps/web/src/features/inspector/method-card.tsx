import { Badge } from "@symm-frontier/ui/components/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@symm-frontier/ui/components/card";
import type { ReactNode } from "react";

interface Props {
  testId: string;
  name: string;
  mutability: "view" | "nonpayable";
  description: string;
  children: ReactNode;
}

/**
 * Visual frame for a single AccountLayer method on the Inspector page.
 * Mirrors Explorer's `MethodRow` + form pairing: header (name + mut pill +
 * blurb), body (inputs + result panel).
 */
export function MethodCard({ testId, name, mutability, description, children }: Props) {
  return (
    <Card data-testid={testId}>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle className="font-mono text-base">{name}</CardTitle>
          <Badge variant={mutability === "view" ? "secondary" : "default"}>{mutability}</Badge>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
