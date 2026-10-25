"use client";

import { PageHeader } from "@/components/page-header";
import { ResultWarning } from "@/components/result";
import { useSymmioChainId, useSymmioConfig } from "@symmio/trading-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { MethodGroup } from "../inspector/method-group";
import { initialDraft, withRequiredFields, type DeploymentAddresses, type FormDraft } from "./form-draft";
import { ReadCard } from "./read-card";
import { READ_CATALOG, READ_GROUPS, type ReadId } from "./read-catalog";
import { fromSearch } from "./url-state";

/** The read a link opened, and the form it carried. */
interface Restored {
  readId: ReadId;
  draft?: FormDraft;
  /** Bumped on every restore, so the card it names remounts on the restored form. */
  nonce: number;
}

/**
 * Restores a read's card from `?read=…&q=…` once, on load; the link's `#hash`
 * lands on the card. Its own Suspense boundary keeps `useSearchParams` from
 * opting the rest of the page out of static rendering.
 */
function RestoreFromUrl({ onLoad }: { onLoad: (state: NonNullable<ReturnType<typeof fromSearch>>) => void }) {
  const search = useSearchParams();
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const state = fromSearch(new URLSearchParams(search.toString()));
    if (state) onLoad(state);
  }, [search, onLoad]);

  return null;
}

/**
 * A test bench for the SDK's subgraph reads, one card per read in the SDK docs'
 * groups: add or remove a read's filters and params, run it through its React
 * hook, and inspect the rows. Every request goes through `@symmio/trading-react`,
 * so what a card shows is what an integrator calling the same hook gets.
 */
export function SubgraphPage() {
  const config = useSymmioConfig();
  const chainId = useSymmioChainId();
  const [restored, setRestored] = useState<Restored | null>(null);

  let chainConfig: ReturnType<typeof config.getChainConfig> | null;
  try {
    chainConfig = config.getChainConfig(chainId);
  } catch {
    chainConfig = null;
  }
  const deployment: DeploymentAddresses | undefined = chainConfig
    ? { symmio: chainConfig.addresses.symmioAddress, "account-layer": chainConfig.addresses.accountLayerAddress }
    : undefined;

  const loadFromUrl = useCallback((state: NonNullable<ReturnType<typeof fromSearch>>) => {
    setRestored((previous) => ({ readId: state.read.id, draft: state.draft, nonce: (previous?.nonce ?? 0) + 1 }));
  }, []);

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <Suspense fallback={null}>
        <RestoreFromUrl onLoad={loadFromUrl} />
      </Suspense>

      <PageHeader
        eyebrow="Protocol · Subgraph"
        title="Subgraph reads"
        description="Run any SDK subgraph read through its React hook: add or remove filters and params, then inspect the rows. A removed field is not sent, so the SDK default applies."
      />

      {chainConfig ? (
        READ_GROUPS.map((group) => {
          const reads = READ_CATALOG.filter((read) => read.group === group);
          return (
            <MethodGroup key={group} label={group} count={reads.length} columns={1}>
              {reads.map((read) => {
                const fromLink = restored?.readId === read.id ? restored : undefined;
                const startingDraft = initialDraft(read, deployment);
                return (
                  <ReadCard
                    key={fromLink ? `${read.id}:${fromLink.nonce}` : read.id}
                    read={read}
                    initial={withRequiredFields(read, fromLink?.draft ?? startingDraft)}
                    resetTo={startingDraft}
                    runOnMount={fromLink?.draft !== undefined}
                    chainId={chainConfig.chainId}
                    endpoint={chainConfig.subgraphs[read.subgraph]}
                    deployment={deployment}
                    collateralDecimals={chainConfig.addresses.collateralDecimals}
                  />
                );
              })}
            </MethodGroup>
          );
        })
      ) : (
        <ResultWarning testId="subgraph-unsupported-chain">
          Chain {chainId} is not a supported SYMMIO chain, so it has no subgraphs to query.
        </ResultWarning>
      )}
    </section>
  );
}
