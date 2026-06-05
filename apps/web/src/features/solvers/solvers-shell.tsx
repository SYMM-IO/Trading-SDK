import { PageHeader } from "@/components/page-header";
import { ReadMarkets } from "../inspector/read-markets";

/**
 * Solvers page. The solver is an off-chain API (not a contract), so it sits
 * outside the Contracts hub. Renders its reads full-width.
 */
export function SolversShell() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <PageHeader
        eyebrow="React SDK · Solvers"
        title="Solvers · HyperEVM"
        description="The solver is an off-chain service, not a contract. Fetch tradable markets (contract symbols) — symbols, leverage, fees, and state — straight from the chain's solver."
      />

      <ReadMarkets />
    </section>
  );
}
