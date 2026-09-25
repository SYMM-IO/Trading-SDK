"use client";

import { Panel, PanelHeader } from "@/components/panel";
import { EmptyState, Skeleton } from "@/components/table";
import { Numeric, Stat } from "@/components/value";
import { formatUsd } from "@/lib/format";
import { useSolverRevenue } from "@symmio/trading-react";
import { POOLS_CHAIN_ID, POOLS_DEPLOYMENT, usePoolsSupported } from "./pools-deployment";

interface Props {
  /** Solver market id assigned after the pool is listed. */
  symbolId: number | null;
}

/** One listed pool's hedger-fee and funding revenue. */
export function MarketRevenuePanel({ symbolId }: Props) {
  const supported = usePoolsSupported();
  const enabled = supported && symbolId !== null;

  const day = useSolverRevenue({
    symbolId: symbolId ?? 0,
    chainId: POOLS_CHAIN_ID,
    solverId: POOLS_DEPLOYMENT.solverId,
    timeRange: "24h",
    query: { enabled, staleTime: 60_000 },
  });
  const lifetime = useSolverRevenue({
    symbolId: symbolId ?? 0,
    chainId: POOLS_CHAIN_ID,
    solverId: POOLS_DEPLOYMENT.solverId,
    query: { enabled, staleTime: 60_000 },
  });

  const error = day.error ?? lifetime.error;

  return (
    <Panel>
      <PanelHeader
        eyebrow="Solver economics"
        title="Market revenue"
        actions={symbolId === null ? null : <span className="font-mono text-2xs text-fg-3">symbol #{symbolId}</span>}
      />

      <div className="p-4">
        {symbolId === null ? (
          <EmptyState
            title="Revenue starts after listing"
            body="This pool does not have a solver market id yet. Revenue will appear after its market is listed."
          />
        ) : error ? (
          <EmptyState title="Revenue unavailable" body={error.message} />
        ) : day.isLoading || lifetime.isLoading ? (
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-12" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
            <RevenueStat label="24h total" value={day.data?.totalRevenue} records={day.data?.recordCount} />
            <RevenueStat label="Hedger fees · 24h" value={day.data?.hedgerFeeRevenue} />
            <RevenueStat label="Funding · 24h" value={day.data?.fundingRevenue} />
            <RevenueStat label="Lifetime" value={lifetime.data?.totalRevenue} records={lifetime.data?.recordCount} />
          </div>
        )}
      </div>
    </Panel>
  );
}

interface RevenueStatProps {
  label: string;
  value?: number;
  records?: number;
}

function RevenueStat({ label, value, records }: RevenueStatProps) {
  const hasRows = records === undefined || records > 0;

  return (
    <Stat
      label={label}
      value={
        <Numeric size="lg" tone={value === undefined || !hasRows ? "muted" : "strong"}>
          {value === undefined || !hasRows ? "—" : formatUsd(value)}
        </Numeric>
      }
      sub={
        records === undefined
          ? undefined
          : records === 0
            ? "No rows in this window"
            : `${records.toLocaleString()} records`
      }
    />
  );
}
