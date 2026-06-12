import { PageHeader } from "@/components/page-header";
import type { ComponentType } from "react";
import { MethodGroup } from "../inspector/method-group";
import { MuonDeallocateUpnlSigCard } from "./muon-deallocate-upnl-sig-card";
import { MuonPartyAOverviewCard } from "./muon-party-a-overview-card";
import { MuonPriceCard } from "./muon-price-card";
import { MuonPriceRangeCard } from "./muon-price-range-card";
import { MUON_GROUPS, MUON_METHODS } from "./muon-registry";
import { MuonSettleUpnlCard } from "./muon-settle-upnl-card";
import { MuonUpnlACard } from "./muon-upnl-a-card";
import { MuonUpnlAWithSymbolPriceCard } from "./muon-upnl-a-with-symbol-price-card";
import { MuonUpnlBCard } from "./muon-upnl-b-card";
import { MuonUpnlCard } from "./muon-upnl-card";
import { MuonUpnlWithSymbolPriceCard } from "./muon-upnl-with-symbol-price-card";

/** The card component for each {@link MUON_METHODS} entry, keyed by its registry id. */
const CARDS: Record<string, ComponentType> = {
  "muon-uPnl_A": MuonUpnlACard,
  "muon-deallocate-upnl-sig": MuonDeallocateUpnlSigCard,
  "muon-partyA_overview": MuonPartyAOverviewCard,
  "muon-uPnl_A_withSymbolPrice": MuonUpnlAWithSymbolPriceCard,
  "muon-uPnl_B": MuonUpnlBCard,
  "muon-uPnl": MuonUpnlCard,
  "muon-uPnlWithSymbolPrice": MuonUpnlWithSymbolPriceCard,
  "muon-price": MuonPriceCard,
  "muon-settle_upnl": MuonSettleUpnlCard,
  "muon-priceRange": MuonPriceRangeCard,
};

/**
 * Muon page: a card per documented `symmio` Muon service, grouped by the party
 * shape of its request. Each card fetches a fresh attestation on demand from the
 * connected chain's configured oracle gateways and renders the normalized result.
 * Sections and order come from {@link MUON_METHODS} so the page and the search
 * index stay in sync.
 */
export function MuonShell() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <PageHeader
        eyebrow="React SDK · Muon"
        title="Muon Oracle API"
        description="Fetch the SYMMIO Muon attestations — uPnL, price, and settlement signatures — that the protocol's writes require. Each service queries the connected chain's oracle gateways; chain and SYMMIO address are resolved from config."
      />

      {MUON_GROUPS.map((group) => {
        const methods = MUON_METHODS.filter((method) => method.group === group.id);
        return (
          <MethodGroup key={group.id} label={group.label} count={methods.length}>
            {methods.map((method) => {
              const Card = CARDS[method.id];
              return Card ? <Card key={method.id} /> : null;
            })}
          </MethodGroup>
        );
      })}
    </section>
  );
}
