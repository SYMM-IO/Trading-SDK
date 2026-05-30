"use client";

import { Badge } from "@symm-frontier/ui/components/badge";
import { ReadMarkets } from "./read-markets";

/**
 * Top-level shell for the Markets Inspector page.
 * Displays tradable markets fetched from the solver.
 */
export function MarketsInspectorShell() {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-3">
        <Badge variant="outline" className="self-start">
          Symmio SDK · Inspector
        </Badge>
        <h1 className="text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">Markets · HyperEVM</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-6">
          Live integration target for the SYMMIO React SDK. Fetch tradable markets (contract symbols) from the solver.
        </p>
      </header>

      <ReadMarkets />
    </section>
  );
}
