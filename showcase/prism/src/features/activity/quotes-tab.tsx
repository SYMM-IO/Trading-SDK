"use client";

import { MicroLabel } from "@/components/panel";
import { Pill, SolverPill } from "@/components/pill";
import { StatePill } from "@/components/state-pill";
import { DataRow, DataTable, EmptyState, SkeletonRows } from "@/components/table";
import { Numeric } from "@/components/value";
import { FAMILY_PALETTE } from "@/config/deployments";
import { cn } from "@/lib/cn";
import { formatPnl, formatPrice, formatRelativeTime, formatSize, fromWei } from "@/lib/format";
import { PositionType, QuoteCloseEventType, type QuoteCloseType, type QuoteHistoryRow } from "@symmio/trading-core";
import { AccountCell } from "./account-cell";
import { ActivityGate } from "./activity-gate";
import { DeploymentNotices } from "./subgraph-notice";
import type { ActivityAccountsResult } from "./use-activity-accounts";
import { useMarketNameLookup, useMarketPricePrecision } from "./use-market-name";
import { useQuoteHistoryRows } from "./use-quote-history-rows";

const COLUMNS =
  "minmax(104px,0.7fr) minmax(104px,0.8fr) minmax(88px,0.8fr) minmax(54px,0.4fr) minmax(96px,0.8fr) minmax(88px,0.7fr) minmax(88px,0.7fr) minmax(96px,0.8fr) minmax(150px,1fr) minmax(84px,0.6fr)";

/** The three event types that settle a position by liquidation rather than a close. */
const LIQUIDATION_EVENTS: ReadonlySet<QuoteCloseEventType> = new Set([
  QuoteCloseEventType.LiquidatePartyA,
  QuoteCloseEventType.LiquidatePartyB,
  QuoteCloseEventType.LiquidateClearingHouse,
]);

/** Short label per close event. `FillClose` needs none — the state pill says "Closed". */
const EVENT_LABELS: Record<QuoteCloseEventType, string | null> = {
  [QuoteCloseEventType.FillClose]: null,
  [QuoteCloseEventType.ForceClose]: "Force",
  [QuoteCloseEventType.EmergencyClose]: "Emergency",
  [QuoteCloseEventType.AdlClose]: "ADL",
  [QuoteCloseEventType.LiquidatePartyA]: "Party A",
  [QuoteCloseEventType.LiquidatePartyB]: "Party B",
  [QuoteCloseEventType.LiquidateClearingHouse]: "Clearing house",
};

export interface QuotesTabProps {
  accounts: ActivityAccountsResult;
  closeType: QuoteCloseType;
}

/**
 * Closed and liquidated fills from both deployments in one blotter.
 *
 * Every row carries a solver pill because the merged view makes provenance
 * ambiguous otherwise: a lowcap liquidation and a majors close are the same
 * shape, settle on different chains, and would otherwise be indistinguishable.
 */
export function QuotesTab({ accounts, closeType }: QuotesTabProps) {
  const { rows, states, isLoading } = useQuoteHistoryRows({
    groups: accounts.groups,
    deployments: accounts.deployments,
    closeType,
  });
  const marketName = useMarketNameLookup();
  const pricePrecision = useMarketPricePrecision();

  return (
    <ActivityGate accounts={accounts} columns={COLUMNS} cells={10}>
      <DeploymentNotices states={states} source="analytics" label="quote history" />

      <DataTable
        columns={COLUMNS}
        head={
          <>
            <MicroLabel>Solver</MicroLabel>
            <MicroLabel>Account</MicroLabel>
            <MicroLabel>Market</MicroLabel>
            <MicroLabel>Side</MicroLabel>
            <MicroLabel>Size</MicroLabel>
            <MicroLabel>Open</MicroLabel>
            <MicroLabel>Exit</MicroLabel>
            <MicroLabel>Gross P&amp;L</MicroLabel>
            <MicroLabel>Event</MicroLabel>
            <MicroLabel>Closed</MicroLabel>
          </>
        }
      >
        {isLoading && rows.length === 0 ? <SkeletonRows columns={COLUMNS} cells={10} rows={5} /> : null}

        {rows.map((entry) => {
          const { row } = entry;
          const exit = exitPriceOf(row);
          const size = closedSizeOf(row);
          const long = row.positionType === PositionType.LONG;
          const pnl = grossPnl(row);
          const eventLabel = EVENT_LABELS[row.closeEventType];
          /* `subAccount` is the parent account even for a lowcap quote, whose
             `partyA` is the Virtual Account holding the position; cross-margin
             rows carry no `subAccount` at all and name the account on `partyA`. */
          const owner = row.subAccount ?? row.partyA;

          return (
            <DataRow key={entry.key} columns={COLUMNS} accent={FAMILY_PALETTE[entry.family].base}>
              <SolverPill family={entry.family} />

              <AccountCell name={accounts.nameFor(owner)} address={owner} />

              <span className="truncate font-display text-md font-semibold text-fg-0">
                {marketName(entry.family, row.marketId, row.symbol)}
              </span>

              <span className={cn("text-sm font-semibold", long ? "text-long" : "text-short")}>
                {long ? "LONG" : "SHORT"}
              </span>

              <Numeric size="sm" tone="muted">
                {formatSize(size)}
              </Numeric>

              <Numeric size="sm">
                {formatPrice(fromWei(row.openedPrice), pricePrecision(entry.family, row.marketId))}
              </Numeric>

              <Numeric size="sm">{formatPrice(fromWei(exit), pricePrecision(entry.family, row.marketId))}</Numeric>

              <Numeric size="sm" signed={pnl}>
                {formatPnl(pnl)}
              </Numeric>

              <span className="flex flex-wrap items-center gap-1.5">
                <StatePill status={row.quoteStatus} />
                {eventLabel ? <Pill>{eventLabel}</Pill> : null}
              </span>

              <Numeric size="sm" tone="muted">
                {formatRelativeTime(row.closedAt)}
              </Numeric>
            </DataRow>
          );
        })}
      </DataTable>

      {!isLoading && rows.length === 0 ? (
        <EmptyState
          title="No closed positions"
          body="Closed and liquidated fills land here once a position settles. Open positions live on Portfolio."
        />
      ) : null}

      <p className="px-4 py-3 text-2xs text-fg-3">
        Gross P&amp;L is the price difference on the settled amount. It excludes trading fees and funding — funding has
        its own tab, because it is charged as a rate index rather than a per-fill amount.
      </p>
    </ActivityGate>
  );
}

/** The amount this event settled — a liquidation reports it on its own field. */
function closedSizeOf(row: QuoteHistoryRow): number {
  const liquidated = LIQUIDATION_EVENTS.has(row.closeEventType) && row.liquidateAmount > 0n;
  return fromWei(liquidated ? row.liquidateAmount : row.closedAmount);
}

/** The price this event settled at, preferring the liquidation price when set. */
function exitPriceOf(row: QuoteHistoryRow): bigint {
  const liquidated = LIQUIDATION_EVENTS.has(row.closeEventType) && row.liquidatePrice > 0n;
  return liquidated ? row.liquidatePrice : row.avgClosedPrice;
}

/**
 * Price P&L on the settled amount, signed by direction.
 *
 * Deliberately not called "realized P&L": fees and funding are not in it, and
 * labelling a partial figure as final is exactly the kind of quiet inaccuracy
 * this screen exists to avoid.
 */
function grossPnl(row: QuoteHistoryRow): number {
  const direction = row.positionType === PositionType.LONG ? 1 : -1;
  const move = fromWei(exitPriceOf(row)) - fromWei(row.openedPrice);
  return closedSizeOf(row) * move * direction;
}
