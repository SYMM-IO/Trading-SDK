import { PageHeader } from "@/components/page-header";
import type { ComponentType } from "react";
import { GaslessAllowanceCard } from "./gasless-allowance-card";
import { GaslessDepositCard } from "./gasless-deposit-card";
import { GASLESS_METHODS } from "./gasless-methods";
import { GaslessRequestCard } from "./gasless-request-card";
import { GaslessServiceCard } from "./gasless-service-card";

/** The card component for each {@link GASLESS_METHODS} entry, keyed by its registry id. */
const CARDS: Record<string, ComponentType> = {
  "gasless-service": GaslessServiceCard,
  "gasless-allowance": GaslessAllowanceCard,
  "gasless-request": GaslessRequestCard,
  "gasless-deposit": GaslessDepositCard,
};

/**
 * Gasless page: the GaslessQ relayer integration end to end — availability,
 * request-status polling, operational-fee allowance, and deposit onboarding.
 * The transparent execution mode itself needs no page: any relayable write on
 * the Contracts page relays once the chain's gasless block sets
 * `execution.mode: "gasless"` (or a call passes `gasless: true`).
 *
 * Card order comes from {@link GASLESS_METHODS} so the page and the search index
 * stay in sync.
 */
export function GaslessShell() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <PageHeader
        eyebrow="React SDK · Gasless"
        title="Gasless relayer"
        description="Account actions with no native gas: the user signs an EIP-712 operation, the GaslessQ relayer broadcasts it and pays the gas, and the GaslessLayer charges the fee from SYMMIO collateral atomically."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {GASLESS_METHODS.map((method) => {
          const Card = CARDS[method.id];
          return Card ? <Card key={method.id} /> : null;
        })}
      </div>
    </section>
  );
}
