"use client";

import { MicroLabel, Panel, PanelHeader } from "@/components/panel";
import { Skeleton } from "@/components/table";
import { Numeric } from "@/components/value";
import { FAMILY_PALETTE, type MarketFamily } from "@/config/deployments";
import { useMergedMarkets } from "@/features/markets/use-merged-markets";
import { formatLeverage, formatPercent } from "@/lib/format";
import type { ReactNode } from "react";
import { useMemo } from "react";
import type { ResolvedDeployment } from "./use-resolved-config";

/** What one deployment answered for a single derived fact. */
interface DerivedValue {
  family: MarketFamily;
  label: string;
  /** Shown under the value where the number alone is not the whole story. */
  detail?: string;
  loading?: boolean;
}

interface DerivedFact {
  id: string;
  label: string;
  /** The SDK expression that produced these values. */
  source: string;
  values: DerivedValue[];
}

/** Props for {@link DerivedPanel}. */
export interface DerivedPanelProps {
  resolved: readonly ResolvedDeployment[];
}

/**
 * Everything Prism never configured, with the live value beside it.
 *
 * The arithmetic at the top is the argument: Prism's SYMMIO config is two
 * affiliate addresses, and the panel counts how many resolved values that
 * bought. Market facts (leverage ceilings, fee rates) come from the solvers
 * themselves, which is why they sit in the same list — an integrator does not
 * maintain those either.
 */
export function DerivedPanel({ resolved }: DerivedPanelProps) {
  const markets = useMergedMarkets({ scope: "all" });

  const supplied = resolved.reduce((total, entry) => total + entry.supplied.size, 0);
  const answered = resolved.reduce((total, entry) => total + entry.fields.size, 0);

  const marketStats = useMemo(() => {
    const stats = new Map<MarketFamily, { count: number; maxLeverage: number; fees: number[] }>();
    for (const entry of markets.markets) {
      const current = stats.get(entry.family) ?? { count: 0, maxLeverage: 0, fees: [] };
      current.count += 1;
      current.maxLeverage = Math.max(current.maxLeverage, entry.market.maxLeverage);
      const fee = Number(entry.market.tradingFee);
      if (Number.isFinite(fee) && fee > 0) current.fees.push(fee);
      stats.set(entry.family, current);
    }
    return stats;
  }, [markets.markets]);

  const facts: DerivedFact[] = [
    {
      id: "core",
      label: "SYMMIO core (diamond)",
      source: "chain.addresses.symmioAddress",
      values: resolved.map((entry) => ({
        family: entry.deployment.family,
        label: entry.chain?.addresses.symmioAddress ?? "unresolved",
      })),
    },
    {
      id: "account-layer",
      label: "AccountLayer",
      source: "chain.addresses.accountLayerAddress",
      values: resolved.map((entry) => ({
        family: entry.deployment.family,
        label: entry.chain?.addresses.accountLayerAddress ?? "unresolved",
      })),
    },
    {
      id: "instant-layer",
      label: "InstantLayer",
      source: "chain.addresses.instantLayerAddress",
      values: resolved.map((entry) => ({
        family: entry.deployment.family,
        label: entry.chain?.addresses.instantLayerAddress ?? "unresolved",
      })),
    },
    {
      id: "collateral",
      label: "Collateral token",
      source: "chain.addresses.collateral{Address,Decimals}",
      values: resolved.map((entry) => ({
        family: entry.deployment.family,
        label: entry.chain?.addresses.collateralAddress ?? "unresolved",
        detail: entry.chain ? `${entry.chain.addresses.collateralDecimals} decimals` : undefined,
      })),
    },
    {
      id: "price-provider",
      label: "Price provider per solver",
      source: "solver.priceService ?? chain.priceService",
      values: resolved.map((entry) => {
        const service = entry.solver?.priceService ?? entry.chain?.priceService;
        return {
          family: entry.deployment.family,
          label: service?.type ?? "unresolved",
          detail: service ? hostOf(service.wsUrl) : undefined,
        };
      }),
    },
    {
      id: "notifications",
      label: "Notification transport per solver",
      source: "solver.notifications.protocol",
      values: resolved.map((entry) => ({
        family: entry.deployment.family,
        label: entry.solver?.notifications.protocol ?? "unresolved",
        detail: entry.solver ? hostOf(entry.solver.notifications.url) : undefined,
      })),
    },
    {
      id: "muon",
      label: "Muon gateway set",
      source: "chain.muon.urls",
      values: resolved.map((entry) => ({
        family: entry.deployment.family,
        label: `${entry.chain?.muon.urls.length ?? 0} gateways`,
        detail: entry.chain?.muon.urls[0] ? `${hostOf(entry.chain.muon.urls[0])}, tried in order` : undefined,
      })),
    },
    {
      id: "subgraphs",
      label: "Subgraph endpoints",
      source: "chain.subgraphs",
      values: resolved.map((entry) => ({
        family: entry.deployment.family,
        label: entry.chain ? "analytics + events" : "unresolved",
        detail: entry.chain ? hostOf(entry.chain.subgraphs.analytics) : undefined,
      })),
    },
    {
      id: "leverage",
      label: "Max leverage per market",
      source: "useMarkets(…) → market.maxLeverage",
      values: resolved.map((entry) => {
        const stats = marketStats.get(entry.deployment.family);
        return {
          family: entry.deployment.family,
          label: stats ? `up to ${formatLeverage(stats.maxLeverage)}` : "—",
          detail: stats ? `across ${stats.count.toLocaleString("en-US")} markets` : undefined,
          loading: !stats && markets.isLoading,
        };
      }),
    },
    {
      id: "fees",
      label: "Trading fee rates",
      source: "useMarkets(…) → market.tradingFee",
      values: resolved.map((entry) => {
        const fees = marketStats.get(entry.deployment.family)?.fees ?? [];
        const low = fees.length ? Math.min(...fees) : undefined;
        const high = fees.length ? Math.max(...fees) : undefined;
        return {
          family: entry.deployment.family,
          label:
            low !== undefined && high !== undefined
              ? low === high
                ? formatPercent(low * 100, { decimals: 3 })
                : `${formatPercent(low * 100, { decimals: 3 })} – ${formatPercent(high * 100, { decimals: 3 })}`
              : "—",
          detail: fees.length ? `${fees.length.toLocaleString("en-US")} priced listings` : undefined,
          loading: !fees.length && markets.isLoading,
        };
      }),
    },
  ];

  return (
    <Panel>
      <PanelHeader eyebrow="Nothing below is in Prism's source" title="What the SDK derived on its own" />

      <div className="flex flex-wrap items-end gap-x-8 gap-y-3 border-b border-line-subtle px-4 py-3">
        <Ledger label="Prism supplied" value={supplied} caption="affiliate addresses, one per chain" tone="app" />
        <span aria-hidden className="mb-2 text-lg text-fg-3">
          →
        </span>
        <Ledger
          label="The SDK answered"
          value={answered}
          caption="resolved config values across both chains"
          tone="sdk"
        />
      </div>

      <p className="border-b border-line-subtle px-4 py-2 font-mono text-2xs leading-relaxed text-fg-3">
        chain = config.getChainConfig(chainId) · solver = config.getSolver({"{ chainId, solverId }"})
      </p>

      <div className="px-4 pb-3">
        {facts.map((fact) => (
          <div
            key={fact.id}
            className="grid grid-cols-[minmax(230px,0.9fr)_minmax(0,1.6fr)] items-start gap-x-4 gap-y-1 border-b border-line-subtle py-2.5 last:border-b-0"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-md font-semibold text-fg-0">{fact.label}</span>
              <span className="font-mono text-2xs break-all text-accent/80">{fact.source}</span>
            </div>

            <div className="flex min-w-0 flex-col gap-1.5">
              {fact.values.map((value) => (
                <FactValue key={`${fact.id}:${value.family}`} value={value} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {markets.failures.length > 0 ? (
        <p className="border-t border-line-subtle px-4 py-2.5 text-2xs text-warn">
          {markets.failures.length} deployment(s) failed to return markets, so their leverage and fee rows are blank.
          Every other row is unaffected.
        </p>
      ) : null}
    </Panel>
  );
}

interface FactValueProps {
  value: DerivedValue;
}

/** One deployment's answer, tagged with the family stripe so the pair reads at a glance. */
function FactValue({ value }: FactValueProps) {
  const palette = FAMILY_PALETTE[value.family];

  return (
    <div className="flex min-w-0 items-start gap-2">
      <span aria-hidden className="mt-[6px] size-1.5 shrink-0 rounded-full" style={{ background: palette.base }} />
      <div className="flex min-w-0 flex-col">
        {value.loading ? (
          <Skeleton className="h-3 w-32" />
        ) : (
          <span className="font-mono text-xs font-semibold break-all text-fg-0">{value.label}</span>
        )}
        {value.detail ? <span className="text-2xs text-fg-3">{value.detail}</span> : null}
      </div>
    </div>
  );
}

interface LedgerProps {
  label: string;
  value: number;
  caption: string;
  tone: "app" | "sdk";
}

/** One side of the supplied-versus-resolved arithmetic. */
function Ledger({ label, value, caption, tone }: LedgerProps): ReactNode {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <MicroLabel>{label}</MicroLabel>
      <Numeric size="xl" tone={tone === "app" ? "accent" : "strong"}>
        {value}
      </Numeric>
      <span className="text-2xs text-fg-3">{caption}</span>
    </div>
  );
}

/** Host of a URL, for captions where the full endpoint would drown the value. */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
