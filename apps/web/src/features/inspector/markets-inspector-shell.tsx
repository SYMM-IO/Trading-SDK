"use client";

import { PageHeader } from "@/components/page-header";
import { ReadMarkets } from "./read-markets";

/**
 * Top-level shell for the Markets Inspector page.
 * Displays tradable markets fetched from the solver.
 */
export function MarketsInspectorShell() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <PageHeader
        eyebrow="Inspector · Markets"
        title="Markets · HyperEVM"
        description="Live integration target for the SYMMIO React SDK. Fetch tradable markets (contract symbols) from the solver, then filter, sort, and search across them."
      />

      <ReadMarkets />
    </section>
  );
}
