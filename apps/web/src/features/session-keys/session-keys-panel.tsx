import { PageHeader } from "@/components/page-header";
import { WalletPanel } from "../inspector/wallet-panel";
import { LocalSessionKeyCard } from "./local-session-key-card";

export function SessionKeysPanel() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <PageHeader
        eyebrow="Local signing"
        title="Session Keys"
        description="Create and manage a browser-local signing key for fast delegated flows. This is application state, separate from contract method inspection and solver API reads."
      />

      <WalletPanel />

      <LocalSessionKeyCard />
    </section>
  );
}
