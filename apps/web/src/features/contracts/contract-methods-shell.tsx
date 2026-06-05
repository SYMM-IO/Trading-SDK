"use client";

import { PageHeader } from "@/components/page-header";
import Link from "next/link";
import { MethodGroup } from "../inspector/method-group";
import { WalletPanel } from "../inspector/wallet-panel";
import { entriesForPage, getContractPage } from "./pages";

interface Props {
  slug: string;
}

/**
 * Renders a single Contracts sub-page: the methods belonging to one ABI or flow,
 * split into Reads and Writes. A wallet panel appears only when the page has
 * write methods (a connected wallet to act with). Contents are derived from the
 * shared method registry via the page's slug.
 */
export function ContractMethodsShell({ slug }: Props) {
  const page = getContractPage(slug);
  if (!page) return null;

  const entries = entriesForPage(page);
  const reads = entries.filter((entry) => entry.kind === "read");
  const writes = entries.filter((entry) => entry.kind === "write");

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <Link
        href="/contracts"
        className="text-muted-foreground hover:text-foreground animate-enter-up inline-flex w-fit items-center gap-1.5 text-sm transition-colors"
      >
        <BackIcon />
        Contracts
      </Link>

      <PageHeader eyebrow={`Contracts · ${page.eyebrow}`} title={page.title} description={page.description} />

      {writes.length > 0 ? <WalletPanel /> : null}

      {reads.length > 0 ? (
        <MethodGroup label="Reads" count={reads.length}>
          {reads.map((entry) => (
            <entry.Component key={entry.id} />
          ))}
        </MethodGroup>
      ) : null}

      {writes.length > 0 ? (
        <MethodGroup label="Writes" count={writes.length}>
          {writes.map((entry) => (
            <entry.Component key={entry.id} />
          ))}
        </MethodGroup>
      ) : null}
    </section>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-3.5" aria-hidden>
      <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
