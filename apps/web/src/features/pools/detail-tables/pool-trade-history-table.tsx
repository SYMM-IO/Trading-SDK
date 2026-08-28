"use client";

import { QuoteCloseEventType, type QuoteHistoryRow } from "@symmio/trading-core";
import { Badge } from "@symmio/ui/components/badge";
import { DataTable, type DataTableColumn } from "@symmio/ui/components/data-table";
import { positionSideLabel, price, quantity, shortAddress, timestamp } from "./shared";

/** Human label per close/liquidation event type. */
const CLOSE_EVENT_LABELS: Record<QuoteCloseEventType, string> = {
  [QuoteCloseEventType.FillClose]: "Closed",
  [QuoteCloseEventType.ForceClose]: "Force closed",
  [QuoteCloseEventType.EmergencyClose]: "Emergency closed",
  [QuoteCloseEventType.AdlClose]: "ADL closed",
  [QuoteCloseEventType.LiquidatePartyA]: "Liquidated",
  [QuoteCloseEventType.LiquidatePartyB]: "Liquidated",
  [QuoteCloseEventType.LiquidateClearingHouse]: "Liquidated",
};

/** The event types that read as a liquidation rather than an ordinary close. */
const LIQUIDATIONS: ReadonlySet<QuoteCloseEventType> = new Set([
  QuoteCloseEventType.LiquidatePartyA,
  QuoteCloseEventType.LiquidatePartyB,
  QuoteCloseEventType.LiquidateClearingHouse,
]);

const COLUMNS: DataTableColumn<QuoteHistoryRow>[] = [
  {
    id: "quoteId",
    header: "Quote",
    widthClassName: "min-w-28",
    cell: (row) => (
      <span className="flex flex-col leading-tight">
        <span className="text-foreground font-mono">#{row.quoteId.toString()}</span>
        {row.subAccount ? (
          <span className="text-muted-foreground/80 font-mono text-[0.7rem]" title={row.subAccount}>
            {shortAddress(row.subAccount)}
          </span>
        ) : null}
      </span>
    ),
  },
  {
    id: "side",
    header: "Type",
    cell: (row) => (
      <Badge variant={row.positionType === 0 ? "positive" : "destructive"}>{positionSideLabel(row.positionType)}</Badge>
    ),
  },
  {
    id: "event",
    header: "Event",
    cell: (row) => (
      <Badge variant={LIQUIDATIONS.has(row.closeEventType) ? "destructive" : "secondary"}>
        {CLOSE_EVENT_LABELS[row.closeEventType] ?? row.closeEventType}
      </Badge>
    ),
  },
  {
    id: "closedAmount",
    header: "Size",
    align: "end",
    cell: (row) => quantity(row.closedAmount),
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "openedPrice",
    header: "Open",
    align: "end",
    cell: (row) => price(row.openedPrice),
    cellClassName: "text-muted-foreground font-mono",
  },
  {
    id: "avgClosedPrice",
    header: "Close",
    align: "end",
    cell: (row) => price(row.avgClosedPrice),
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "closedAt",
    header: "Closed",
    align: "end",
    widthClassName: "min-w-36",
    cell: (row) => <span className="text-muted-foreground">{timestamp(row.closedAt)}</span>,
  },
];

interface Props {
  rows: QuoteHistoryRow[];
  isPending: boolean;
}

/**
 * The pool's realized history — one row per close or liquidation **event**, not
 * per quote.
 *
 * A quote closed in three partial closes shows as three rows, each carrying that
 * close's own size and price from its frozen snapshot. Summing the rows is
 * therefore correct; reading one row as "the quote" is not.
 */
export function PoolTradeHistoryTable({ rows, isPending }: Props) {
  return (
    <DataTable
      testId="pool-trade-history-table"
      columns={COLUMNS}
      data={rows}
      getRowId={(row) => row.eventId}
      defaultPageSize={10}
      emptyMessage={isPending ? "Loading the pool's history…" : "No closed trades on this pool yet."}
    />
  );
}
