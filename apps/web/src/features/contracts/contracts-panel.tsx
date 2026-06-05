import { LinkCard } from "@/components/link-card";
import { PageHeader } from "@/components/page-header";
import { ABI_PAGES, FLOW_PAGES, methodCount, type ContractPage } from "./pages";

/**
 * Contracts hub: the landing page reached from the nav (or its home-page card).
 * Two card sections — one per contract ABI, one per usability flow — each card
 * linking to a page that lists all of that contract's or flow's methods.
 */
export function ContractsPanel() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <PageHeader
        eyebrow="React SDK · Contracts"
        title="Contracts"
        description="Every method the SDK implements, two ways in: by contract ABI, or by the flow it belongs to. Pick a card to run live reads and writes against the HyperEVM deployment."
      />

      <CardSection label="By ABI" hint="All implemented methods of one contract" pages={ABI_PAGES} />
      <CardSection label="By usage" hint="Methods grouped into a flow" pages={FLOW_PAGES} />
    </section>
  );
}

function CardSection({ label, hint, pages }: { label: string; hint: string; pages: readonly ContractPage[] }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <h2 className="text-foreground text-xs font-medium tracking-[0.18em] uppercase">{label}</h2>
        <span className="text-muted-foreground text-xs tracking-normal normal-case">{hint}</span>
        <span className="bg-border/80 h-px flex-1" aria-hidden />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map((page, index) => (
          <LinkCard
            key={page.slug}
            href={`/contracts/${page.slug}`}
            eyebrow={page.eyebrow}
            title={page.title}
            description={page.description}
            icon={page.icon}
            index={index}
            meta={`${methodCount(page)} methods`}
          />
        ))}
      </div>
    </div>
  );
}
