"use client";

import { MicroLabel } from "@/components/panel";
import { SolverPill } from "@/components/pill";
import { DataRow, DataTable, EmptyState, SkeletonRows } from "@/components/table";
import { Numeric, Stat } from "@/components/value";
import { FAMILY_PALETTE, type Deployment, type MarketFamily } from "@/config/deployments";
import { cn } from "@/lib/cn";
import { formatPnl, formatRelativeTime, fromWei } from "@/lib/format";
import { PositionType, QuoteCloseType, type QuoteFundingData } from "@symmio/trading-core";
import { useQuotesFunding } from "@symmio/trading-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { AccountCell } from "./account-cell";
import { ActivityGate } from "./activity-gate";
import type { FundingSignFilter } from "./activity-types";
import { DeploymentNotice, DeploymentNotices } from "./subgraph-notice";
import type { ActivityAccountsResult } from "./use-activity-accounts";
import { useMarketNameLookup } from "./use-market-name";
import { useQuoteHistoryRows } from "./use-quote-history-rows";

const COLUMNS =
  "minmax(104px,0.7fr) minmax(104px,0.8fr) minmax(88px,0.8fr) minmax(72px,0.5fr) minmax(54px,0.4fr) minmax(96px,0.8fr) minmax(96px,0.8fr) minmax(104px,0.9fr) minmax(84px,0.6fr)";

/** One position the funding read covers, resolved from its history rows. */
interface FundingPosition {
  key: string;
  quoteId: bigint;
  marketId: number;
  symbol: string | null;
  positionType: PositionType;
  settledAt: number;
  /** The sub-account that owned the position — the VA's parent for a lowcap. */
  account: Address | null;
  deployment: Deployment;
  family: MarketFamily;
}

/** What one deployment's funding read reported back to the merged table. */
interface FundingReport {
  byQuoteId: ReadonlyMap<string, QuoteFundingData>;
  netReceived: bigint;
  missingCount: number;
  isLoading: boolean;
  error: Error | null;
}

export interface FundingTabProps {
  accounts: ActivityAccountsResult;
  sign: FundingSignFilter;
}

/**
 * Settled funding per position, batched per deployment.
 *
 * **Why a dedicated read.** A quote's `accumulatedPaidFunding` is a funding
 * **rate index** — the position's rate multiplied by the epochs elapsed — not a
 * currency amount. The settled fee only falls out of it as
 * `openAmount × (currentFee − accumulatedPaidFunding) / 1e18`, so adding the
 * field up across positions produces a number that means nothing at all.
 * `useQuotesFunding` reads the analytics subgraph's actual paid/received totals
 * for a batch of quote ids in one round-trip and nets them as currency, which is
 * the only form that can be summed.
 *
 * The positions come from the same quote history the first tab reads (one entry
 * per quote, however many partial closes it took), so the two tabs share a cache
 * entry rather than issuing the read twice.
 */
export function FundingTab({ accounts, sign }: FundingTabProps) {
  const history = useQuoteHistoryRows({
    groups: accounts.groups,
    deployments: accounts.deployments,
    closeType: QuoteCloseType.All,
  });
  const marketName = useMarketNameLookup();
  const [reports, setReports] = useState<Partial<Record<MarketFamily, FundingReport>>>({});

  const report = useCallback((family: MarketFamily, next: FundingReport) => {
    setReports((current) => (sameReport(current[family], next) ? current : { ...current, [family]: next }));
  }, []);

  /** Newest row wins: a quote closed in three partials is still one position. */
  const positions = useMemo(() => {
    const byQuote = new Map<string, FundingPosition>();

    for (const entry of history.rows) {
      const key = `${entry.family}:${entry.row.quoteId}`;
      if (byQuote.has(key)) continue;
      byQuote.set(key, {
        key,
        quoteId: entry.row.quoteId,
        marketId: entry.row.marketId,
        symbol: entry.row.symbol,
        positionType: entry.row.positionType,
        settledAt: entry.row.closedAt,
        account: entry.row.subAccount ?? entry.row.partyA,
        deployment: entry.deployment,
        family: entry.family,
      });
    }

    return [...byQuote.values()];
  }, [history.rows]);

  const positionsByFamily = useMemo(() => {
    const grouped = new Map<MarketFamily, FundingPosition[]>();
    for (const position of positions) {
      const bucket = grouped.get(position.family);
      if (bucket) bucket.push(position);
      else grouped.set(position.family, [position]);
    }
    return grouped;
  }, [positions]);

  const rows = useMemo(
    () =>
      positions
        .map((position) => {
          const report = reports[position.family];
          return {
            position,
            funding: report?.byQuoteId.get(position.quoteId.toString()) ?? null,
            /** No report yet, or one still in flight — the row is unknown, not unindexed. */
            pending: report?.isLoading ?? true,
          };
        })
        .filter(({ funding }) => {
          if (sign === "all") return true;
          if (!funding) return false;
          return sign === "earned" ? funding.netReceived > 0n : funding.netReceived < 0n;
        }),
    [positions, reports, sign],
  );

  const netTotal = useMemo(() => rows.reduce((total, entry) => total + (entry.funding?.netReceived ?? 0n), 0n), [rows]);

  const missingTotal = accounts.deployments.reduce(
    (total, deployment) => total + (reports[deployment.family]?.missingCount ?? 0),
    0,
  );
  const isLoading =
    history.isLoading || accounts.deployments.some((deployment) => reports[deployment.family]?.isLoading ?? false);

  return (
    <ActivityGate accounts={accounts} columns={COLUMNS} cells={9}>
      {accounts.deployments.map((deployment) => (
        <DeploymentFunding
          key={deployment.family}
          deployment={deployment}
          positions={positionsByFamily.get(deployment.family) ?? EMPTY_POSITIONS}
          onReport={report}
        />
      ))}

      <DeploymentNotices states={history.states} source="analytics" label="quote history" />

      {accounts.deployments.map((deployment) => {
        const error = reports[deployment.family]?.error;
        if (!error) return null;
        return (
          <DeploymentNotice
            key={`${deployment.family}:funding-error`}
            deployment={deployment}
            tone="error"
            title={`${deployment.label} funding read failed`}
          >
            {error.message}
          </DeploymentNotice>
        );
      })}

      <div className="flex flex-wrap items-center gap-6 border-b border-line-subtle px-4 py-3">
        <Stat
          label="Net funding"
          value={
            <Numeric size="lg" signed={fromWei(netTotal)}>
              {formatPnl(fromWei(netTotal))}
            </Numeric>
          }
          sub="Received − paid across the rows below"
        />
        <Stat
          label="Positions"
          value={
            <Numeric size="lg" tone="strong">
              {rows.length}
            </Numeric>
          }
          sub={missingTotal > 0 ? `${missingTotal} not indexed yet` : "All resolved"}
        />
      </div>

      <DataTable
        columns={COLUMNS}
        head={
          <>
            <MicroLabel>Solver</MicroLabel>
            <MicroLabel>Account</MicroLabel>
            <MicroLabel>Market</MicroLabel>
            <MicroLabel>Quote</MicroLabel>
            <MicroLabel>Side</MicroLabel>
            <MicroLabel>Paid</MicroLabel>
            <MicroLabel>Received</MicroLabel>
            <MicroLabel>Net</MicroLabel>
            <MicroLabel>Settled</MicroLabel>
          </>
        }
      >
        {isLoading && rows.length === 0 ? <SkeletonRows columns={COLUMNS} cells={9} rows={5} /> : null}

        {rows.map(({ position, funding, pending }) => {
          const long = position.positionType === PositionType.LONG;
          const net = funding ? fromWei(funding.netReceived) : undefined;

          return (
            <DataRow key={position.key} columns={COLUMNS} accent={FAMILY_PALETTE[position.family].base}>
              <SolverPill family={position.family} />

              <AccountCell name={accounts.nameFor(position.account)} address={position.account} />

              <span className="truncate font-display text-md font-semibold text-fg-0">
                {marketName(position.family, position.marketId, position.symbol)}
              </span>

              <Numeric size="sm" tone="muted">
                {`#${position.quoteId}`}
              </Numeric>

              <span className={cn("text-sm font-semibold", long ? "text-long" : "text-short")}>
                {long ? "LONG" : "SHORT"}
              </span>

              <Numeric size="sm" tone="muted">
                {funding ? formatPnl(-fromWei(funding.paid)) : "—"}
              </Numeric>

              <Numeric size="sm" tone="muted">
                {funding ? formatPnl(fromWei(funding.received)) : "—"}
              </Numeric>

              <Numeric size="sm" signed={net}>
                {net !== undefined ? formatPnl(net) : pending ? "…" : "not indexed"}
              </Numeric>

              <Numeric size="sm" tone="muted">
                {formatRelativeTime(position.settledAt)}
              </Numeric>
            </DataRow>
          );
        })}
      </DataTable>

      {!isLoading && rows.length === 0 ? (
        <EmptyState
          title="No settled funding"
          body="Funding is charged per epoch against a position. Rows appear once the analytics subgraph has indexed a charge for a quote this account owned."
        />
      ) : null}
    </ActivityGate>
  );
}

/**
 * Whether a fresh report says anything new.
 *
 * The child rebuilds its report object on every render — its inputs are arrays
 * that the fan-out recreates — so an identity check would write state forever.
 * The funding rows themselves come straight from the query cache and are
 * structurally shared, which makes an identity check on them sound.
 */
function sameReport(previous: FundingReport | undefined, next: FundingReport): boolean {
  if (!previous) return false;
  if (
    previous.netReceived !== next.netReceived ||
    previous.missingCount !== next.missingCount ||
    previous.isLoading !== next.isLoading ||
    previous.error !== next.error ||
    previous.byQuoteId.size !== next.byQuoteId.size
  ) {
    return false;
  }

  for (const [quoteId, funding] of next.byQuoteId) {
    if (previous.byQuoteId.get(quoteId) !== funding) return false;
  }

  return true;
}

/** Stable empty list so a deployment with no positions never remounts its read. */
const EMPTY_POSITIONS: readonly FundingPosition[] = [];

interface DeploymentFundingProps {
  deployment: Deployment;
  positions: readonly FundingPosition[];
  onReport: (family: MarketFamily, report: FundingReport) => void;
}

/**
 * One deployment's batched funding read. Renders nothing.
 *
 * `useQuotesFunding` reads a single chain and a hook cannot be called in a loop,
 * so — exactly as the price feeds do — each deployment gets a subscriber
 * component and the merged table reads their reports.
 */
function DeploymentFunding({ deployment, positions, onReport }: DeploymentFundingProps) {
  const { rows, netReceived, missingQuoteIds, isLoading, error } = useQuotesFunding({
    chainId: deployment.chainId,
    quotes: positions,
  });

  /** Keyed by quote id rather than index, so the merge never depends on array alignment. */
  const report = useMemo<FundingReport>(() => {
    const byQuoteId = new Map<string, QuoteFundingData>();
    positions.forEach((position, index) => {
      const funding = rows[index];
      if (funding) byQuoteId.set(position.quoteId.toString(), funding);
    });

    return {
      byQuoteId,
      netReceived,
      missingCount: missingQuoteIds.length,
      isLoading,
      error,
    };
  }, [positions, rows, netReceived, missingQuoteIds, isLoading, error]);

  useEffect(() => {
    onReport(deployment.family, report);
  }, [deployment.family, report, onReport]);

  return null;
}
