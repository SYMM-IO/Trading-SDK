import { PageHeader } from "@/components/page-header";
import { MethodGroup } from "../inspector/method-group";
import { ReadMarkets } from "../inspector/read-markets";
import { EnigmaInstantCloseCard } from "./enigma-instant-close-card";
import { EnigmaInstantOpenCard } from "./enigma-instant-open-card";
import { ReadInstantOpensCard } from "./read-instant-opens-card";
import { ReadLockedParams } from "./read-locked-params";

/**
 * Solvers page. The solver is an off-chain API (not a contract), so it sits
 * outside the Contracts hub. Renders solver reads and writes in the same
 * collapsible method groups as contract pages.
 */
export function SolversShell() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <PageHeader
        eyebrow="React SDK · Solvers"
        title="Solvers · HyperEVM"
        description="The solver is an off-chain service, not a contract. Fetch tradable markets (contract symbols) — symbols, leverage, fees, and state — straight from the chain's solver."
      />

      <MethodGroup label="Reads" count={3} fullWidth>
        <ReadLockedParams />
        <ReadMarkets />
        <ReadInstantOpensCard />
      </MethodGroup>

      <MethodGroup label="Writes" count={2} fullWidth>
        <EnigmaInstantOpenCard />
        <EnigmaInstantCloseCard />
      </MethodGroup>
    </section>
  );
}
