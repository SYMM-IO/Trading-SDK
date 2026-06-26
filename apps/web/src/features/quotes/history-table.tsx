"use client";
import { WEI_DECIMALS } from "@/lib/format";
import type { QuoteHistoryRow } from "@symm-frontier/core";
import { PositionType, QuoteCloseEventType } from "@symm-frontier/core";
import { Badge } from "@symm-frontier/ui/components/badge";
import { DataTable, type DataTableColumn } from "@symm-frontier/ui/components/data-table";
import { formatRelativeTimestamp, formatTokenAmount } from "@symm-frontier/utils";
import type { ReactNode } from "react";
import { truncateAddress } from "./quote-provenance-panel";

/** Min width that keeps a fixed-point figure column from crowding its header. */
const NUMERIC_COLUMN_WIDTH = "min-w-24";

/** Format an 18-decimal-wei amount the way the other quote tables read do. */
function formatFixedPoint(raw: bigint): string {
  return formatTokenAmount(raw, WEI_DECIMALS, { maxFractionDigits: 6 });
}

/** Human label for each close/liquidation event type. */
const CLOSE_EVENT_LABELS: Record<QuoteCloseEventType, string> = {
  [QuoteCloseEventType.FillClose]: "Closed",
  [QuoteCloseEventType.ForceClose]: "Force closed",
  [QuoteCloseEventType.EmergencyClose]: "Emergency closed",
  [QuoteCloseEventType.AdlClose]: "ADL closed",
  [QuoteCloseEventType.LiquidatePartyA]: "Liquidated",
  [QuoteCloseEventType.LiquidatePartyB]: "Liquidated",
  [QuoteCloseEventType.LiquidateClearingHouse]: "Liquidated",
};

/** The liquidation event types — they render with a destructive status badge. */
const LIQUIDATION_EVENTS: ReadonlySet<QuoteCloseEventType> = new Set([
  QuoteCloseEventType.LiquidatePartyA,
  QuoteCloseEventType.LiquidatePartyB,
  QuoteCloseEventType.LiquidateClearingHouse,
]);

const COLUMNS: DataTableColumn<QuoteHistoryRow>[] = [
  {
    id: "quoteId",
    header: "Id",
    widthClassName: "min-w-28",
    cell: (row) => (
      <span className="flex flex-col leading-tight">
        <span className="text-foreground font-mono whitespace-nowrap">#{row.quoteId.toString()}</span>
        {row.subAccount ? (
          <span className="text-muted-foreground/80 font-mono text-[0.7rem]" title={row.subAccount}>
            {truncateAddress(row.subAccount)}
          </span>
        ) : null}
      </span>
    ),
    sortAccessor: (row) => Number(row.quoteId),
  },
  {
    id: "market",
    header: "Market",
    cell: (row) => row.symbol ?? String(row.marketId),
    sortAccessor: (row) => row.marketId,
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "side",
    header: "Side",
    cell: (row) => (
      <Badge variant={row.positionType === PositionType.LONG ? "positive" : "destructive"}>
        {PositionType[row.positionType] ?? String(row.positionType)}
      </Badge>
    ),
    sortAccessor: (row) => row.positionType,
  },
  {
    id: "status",
    header: "Status",
    cell: (row) => (
      <Badge variant={LIQUIDATION_EVENTS.has(row.closeEventType) ? "destructive" : "secondary"}>
        {CLOSE_EVENT_LABELS[row.closeEventType] ?? row.closeEventType}
      </Badge>
    ),
    sortAccessor: (row) => row.closeEventType,
  },
  {
    id: "closedAmount",
    header: "Size",
    align: "end",
    widthClassName: NUMERIC_COLUMN_WIDTH,
    cell: (row) => formatFixedPoint(row.closedAmount),
    sortAccessor: (row) => Number(row.closedAmount),
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "openedPrice",
    header: "Open",
    align: "end",
    widthClassName: NUMERIC_COLUMN_WIDTH,
    cell: (row) => formatFixedPoint(row.openedPrice),
    sortAccessor: (row) => Number(row.openedPrice),
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "avgClosedPrice",
    header: "Close",
    align: "end",
    widthClassName: NUMERIC_COLUMN_WIDTH,
    cell: (row) => formatFixedPoint(row.avgClosedPrice),
    sortAccessor: (row) => Number(row.avgClosedPrice),
    cellClassName: "text-muted-foreground font-mono",
  },
  {
    id: "closedAt",
    header: "Closed",
    align: "end",
    cell: (row) => <span className="text-muted-foreground">{formatRelativeTimestamp(BigInt(row.closedAt))}</span>,
    sortAccessor: (row) => row.closedAt,
  },
];

interface Props {
  rows: QuoteHistoryRow[];
  /** Pre-filter total for the pagination "filtered from N" hint. */
  totalCount?: number;
  /** Rows shown per page before pagination kicks in. */
  defaultPageSize?: number;
  /** Render every row without a pagination footer (compact sidebar mode). */
  hidePagination?: boolean;
  /** Search/filter controls rendered above the table. */
  toolbar?: ReactNode;
  /** Prefix for the table's `data-testid` hooks. */
  testId?: string;
  /** Shown in place of rows when `rows` is empty. */
  emptyMessage?: ReactNode;
}

/**
 * Renders one row per {@link QuoteHistoryRow} — a single close/liquidation event
 * with its immutable snapshot applied. Because each row is an event (not a
 * quote), a quote closed across several partial closes shows as several rows,
 * each with that close's own size and price. Sourced from the analytics subgraph
 * via `useQuoteHistory`.
 */
export function HistoryTable({
  rows,
  totalCount,
  defaultPageSize = 10,
  hidePagination = false,
  toolbar,
  testId,
  emptyMessage = "No history for this partyA.",
}: Props) {
  return (
    <DataTable
      testId={testId}
      columns={COLUMNS}
      data={rows}
      totalCount={totalCount ?? rows.length}
      getRowId={(row) => row.eventId}
      rowAttributes={(row) => ({ "data-event-id": row.eventId })}
      initialSort={{ columnId: "closedAt", direction: "desc" }}
      defaultPageSize={defaultPageSize}
      hidePagination={hidePagination}
      toolbar={toolbar}
      emptyMessage={emptyMessage}
    />
  );
}
