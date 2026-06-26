"use client";
import { WEI_DECIMALS } from "@/lib/format";
import type { UnifiedQuote } from "@theoldvarorg/core";
import { OrderType, PositionType, QuoteStatus } from "@theoldvarorg/core";
import { Badge } from "@theoldvarorg/ui/components/badge";
import { DataTable, type DataTableColumn } from "@theoldvarorg/ui/components/data-table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@theoldvarorg/ui/components/tooltip";
import { formatRelativeTimestamp, formatTokenAmount } from "@theoldvarorg/utils";
import { useMemo, type ReactNode } from "react";
import { QuoteLifecycleBadge } from "./quote-lifecycle-badge";
import { QuoteProvenancePanel, truncateAddress } from "./quote-provenance-panel";
import { useMarketNameById } from "./use-market-name-by-id";

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

/** Inline "info" glyph (apps/web uses inline SVG, never lucide). */
function InfoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

/**
 * Header for the open-quantity column: the label plus an info glyph whose tooltip
 * spells out the derivation. The trigger is a non-focusable `<span>` (not a
 * `<button>`) because a sortable header already wraps its content in a `<button>`,
 * and a button must not contain another interactive control.
 */
function OpenQuantityHeader() {
  return (
    <span className="inline-flex items-center gap-1">
      Open qty
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="text-muted-foreground/70 hover:text-foreground inline-flex cursor-help"
            onClick={(event) => event.stopPropagation()}
          >
            <InfoIcon />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-64 text-left font-normal normal-case">
          Open qty = quantity − closedAmount. A position keeps its original quantity for life; partial closes accrue
          separately, so this is the live size still on the book.
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

function buildColumns(marketNameById: Map<string, string>): DataTableColumn<UnifiedQuote>[] {
  return [
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
      cell: (quote) => marketNameById.get(String(quote.symbolId)) ?? String(quote.symbolId),
      sortAccessor: (quote) => marketNameById.get(String(quote.symbolId)) ?? String(quote.symbolId),
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
      cell: (quote) => formatOptionalFixedPoint(quote.avgClosedPrice),
      sortAccessor: (quote) => (quote.avgClosedPrice === undefined ? undefined : Number(quote.avgClosedPrice)),
      cellClassName: "text-muted-foreground font-mono",
    },
    {
      id: "quantity",
      header: "Quantity",
      align: "end",
      widthClassName: NUMERIC_COLUMN_WIDTH,
      cell: (quote) => formatFixedPoint(quote.quantity),
      sortAccessor: (quote) => Number(quote.quantity),
      cellClassName: "text-muted-foreground font-mono",
    },
    {
      id: "openQuantity",
      header: <OpenQuantityHeader />,
      align: "end",
      widthClassName: NUMERIC_COLUMN_WIDTH,
      cell: (quote) => formatFixedPoint(quote.openQuantity),
      sortAccessor: (quote) => Number(quote.openQuantity),
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
}

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
  const marketNameById = useMarketNameById();
  const columns = useMemo(() => buildColumns(marketNameById), [marketNameById]);
  return (
    <DataTable
      testId={testId}
      columns={columns}
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
