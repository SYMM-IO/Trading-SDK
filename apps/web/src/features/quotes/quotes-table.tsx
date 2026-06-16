"use client";
import { WEI_DECIMALS } from "@/lib/format";
import type { UnifiedQuote } from "@symm-frontier/core";
import { OrderType, PositionType, QuoteStatus } from "@symm-frontier/core";
import { Badge } from "@symm-frontier/ui/components/badge";
import { DataTable, type DataTableColumn } from "@symm-frontier/ui/components/data-table";
import { formatRelativeTimestamp, formatTokenAmount } from "@symm-frontier/utils";
import type { ReactNode } from "react";
import { QuoteLifecycleBadge } from "./quote-lifecycle-badge";
import { QuoteProvenancePanel, truncateAddress } from "./quote-provenance-panel";

/** Em dash placeholder for a field a source has not populated yet. */
const EMPTY = "—";

/** Min width that keeps a fixed-point figure column from crowding its header. */
const NUMERIC_COLUMN_WIDTH = "min-w-28";

/** Format an 18-decimal-wei amount the way the inspector quote reads do. */
function formatFixedPoint(raw: bigint): string {
  return formatTokenAmount(raw, WEI_DECIMALS, { maxFractionDigits: 6 });
}

/** Format an optional wei amount, falling back to {@link EMPTY} when absent. */
function formatOptionalFixedPoint(raw?: bigint): string {
  return raw === undefined ? EMPTY : formatFixedPoint(raw);
}

/** Primary identifier shown for a row: the on-chain quote id, or the temp id with an origin hint. */
function rowIdLabel(quote: UnifiedQuote): string {
  if (quote.quoteId !== undefined) return `#${quote.quoteId.toString()}`;
  if (quote.tempQuoteId !== undefined) return `temp #${quote.tempQuoteId}`;
  return quote.key;
}

/** Sort key for the id column — on-chain ids sort above temp ids, both numerically ascending. */
function rowIdSort(quote: UnifiedQuote): number {
  if (quote.quoteId !== undefined) return Number(quote.quoteId);
  if (quote.tempQuoteId !== undefined) return Number(quote.tempQuoteId);
  return 0;
}

/** Best-known creation timestamp (seconds) for sorting/displaying the created column. */
function createdSeconds(quote: UnifiedQuote): bigint | undefined {
  return quote.createTimestamp ?? quote.statusModifyTimestamp;
}

const COLUMNS: DataTableColumn<UnifiedQuote>[] = [
  {
    id: "id",
    header: "Id",
    widthClassName: "min-w-36",
    cell: (quote) => (
      <span className="flex flex-col leading-tight">
        <span className="text-foreground font-mono whitespace-nowrap">{rowIdLabel(quote)}</span>
        <span className="text-muted-foreground text-[0.7rem] tracking-wide uppercase">{quote.origin}</span>
        {quote.vaAddress ? (
          <span className="text-muted-foreground/80 font-mono text-[0.7rem]" title={quote.vaAddress}>
            {truncateAddress(quote.vaAddress)}
          </span>
        ) : null}
      </span>
    ),
    sortAccessor: rowIdSort,
  },
  {
    id: "lifecycle",
    header: "Lifecycle",
    cell: (quote) => <QuoteLifecycleBadge lifecycle={quote.lifecycle} />,
    sortAccessor: (quote) => quote.lifecycle,
  },
  {
    id: "symbolId",
    header: "Market",
    cell: (quote) => String(quote.symbolId),
    sortAccessor: (quote) => Number(quote.symbolId),
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "positionType",
    header: "Side",
    cell: (quote) => (
      <Badge variant={quote.positionType === PositionType.LONG ? "positive" : "destructive"}>
        {PositionType[quote.positionType] ?? String(quote.positionType)}
      </Badge>
    ),
    sortAccessor: (quote) => quote.positionType,
  },
  {
    id: "orderType",
    header: "Type",
    cell: (quote) => <Badge variant="secondary">{OrderType[quote.orderType] ?? String(quote.orderType)}</Badge>,
    sortAccessor: (quote) => quote.orderType,
  },
  {
    id: "quoteStatus",
    header: "Status",
    cell: (quote) =>
      quote.quoteStatus === undefined ? (
        <span className="text-muted-foreground">{EMPTY}</span>
      ) : (
        <Badge variant="secondary">{QuoteStatus[quote.quoteStatus] ?? String(quote.quoteStatus)}</Badge>
      ),
    sortAccessor: (quote) => quote.quoteStatus,
  },
  {
    id: "requestedOpenPrice",
    header: "Req. price",
    align: "end",
    widthClassName: NUMERIC_COLUMN_WIDTH,
    cell: (quote) => formatFixedPoint(quote.requestedOpenPrice),
    sortAccessor: (quote) => Number(quote.requestedOpenPrice),
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "openedPrice",
    header: "Open price",
    align: "end",
    widthClassName: NUMERIC_COLUMN_WIDTH,
    cell: (quote) => formatOptionalFixedPoint(quote.openedPrice),
    sortAccessor: (quote) => (quote.openedPrice === undefined ? undefined : Number(quote.openedPrice)),
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "closedPrice",
    header: "Close price",
    align: "end",
    widthClassName: NUMERIC_COLUMN_WIDTH,
    cell: (quote) => formatOptionalFixedPoint(quote.closedPrice),
    sortAccessor: (quote) => (quote.closedPrice === undefined ? undefined : Number(quote.closedPrice)),
    cellClassName: "text-muted-foreground font-mono",
  },
  {
    id: "quantity",
    header: "Quantity",
    align: "end",
    widthClassName: NUMERIC_COLUMN_WIDTH,
    cell: (quote) => formatFixedPoint(quote.quantity),
    sortAccessor: (quote) => Number(quote.quantity),
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "quantityToClose",
    header: "To close",
    align: "end",
    widthClassName: NUMERIC_COLUMN_WIDTH,
    cell: (quote) => formatOptionalFixedPoint(quote.quantityToClose),
    sortAccessor: (quote) => (quote.quantityToClose === undefined ? undefined : Number(quote.quantityToClose)),
    cellClassName: "text-muted-foreground font-mono",
  },
  {
    id: "margin",
    header: "Margin (cva+lf)",
    align: "end",
    widthClassName: NUMERIC_COLUMN_WIDTH,
    cell: (quote) => formatFixedPoint(quote.lockedValues.cva + quote.lockedValues.lf),
    sortAccessor: (quote) => Number(quote.lockedValues.cva + quote.lockedValues.lf),
    cellClassName: "text-muted-foreground font-mono",
  },
  {
    id: "created",
    header: "Created",
    align: "end",
    cell: (quote) => {
      const seconds = createdSeconds(quote);
      return (
        <span className="text-muted-foreground">
          {seconds === undefined ? EMPTY : formatRelativeTimestamp(seconds)}
        </span>
      );
    },
    sortAccessor: (quote) => {
      const seconds = createdSeconds(quote);
      return seconds === undefined ? undefined : Number(seconds);
    },
  },
];

interface Props {
  quotes: UnifiedQuote[];
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
  /** Shown in place of rows when `quotes` is empty. */
  emptyMessage?: ReactNode;
}

/**
 * Renders one row per {@link UnifiedQuote}. Every column reads from the unified
 * shape, so an on-chain position, a pending instant-open, and a pending
 * instant-close render through the exact same row regardless of origin — the
 * origin only surfaces as a hint under the id and the lifecycle badge.
 */
export function QuotesTable({
  quotes,
  totalCount,
  defaultPageSize = 10,
  hidePagination = false,
  toolbar,
  testId,
  emptyMessage = "No quotes for this partyA.",
}: Props) {
  return (
    <DataTable
      testId={testId}
      columns={COLUMNS}
      data={quotes}
      totalCount={totalCount ?? quotes.length}
      getRowId={(quote) => quote.key}
      rowAttributes={(quote) => ({ "data-quote-key": quote.key, "data-quote-origin": quote.origin })}
      renderExpanded={(quote) => <QuoteProvenancePanel quote={quote} />}
      initialSort={{ columnId: "created", direction: "desc" }}
      defaultPageSize={defaultPageSize}
      hidePagination={hidePagination}
      toolbar={toolbar}
      emptyMessage={emptyMessage}
    />
  );
}
