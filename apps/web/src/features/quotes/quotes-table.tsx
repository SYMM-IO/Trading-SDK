"use client";
import { OrderType, PositionType, type UnifiedQuote } from "@symmio/trading-core";
import { useQuoteTpSl, useQuoteUpnlAndPnl } from "@symmio/trading-react";
import { Badge } from "@symmio/ui/components/badge";
import { DataTable, type DataTableColumn } from "@symmio/ui/components/data-table";
import { cn } from "@symmio/ui/lib/utils";
import { formatRelativeTimestamp } from "@symmio/utils";
import { useMemo, type ReactNode } from "react";
import { QuoteDetailPanel } from "./quote-detail-panel";
import {
  EMPTY,
  formatFixedPoint,
  formatLeverageLabel,
  formatSigned,
  quoteCreatedSeconds,
  quoteIdLabel,
  quoteIdSort,
  signedToneClassName,
  truncateAddress,
} from "./quote-format";
import { quoteState, stateDotClassName } from "./quote-state";
import { useMarketDisplay, type MarketDisplayLookup } from "./use-market-display";

/**
 * Floor for a fixed-point figure column.
 *
 * The table only renders at `@5xl` and above, so twelve columns have room
 * without the 28-unit floors the fifteen-column version needed — those summed to
 * a 1,500px minimum, which is what forced a sideways scrollbar into a 464px
 * sidebar.
 */
const NUMERIC_COLUMN_WIDTH = "min-w-24";

/**
 * Mark price and unrealized P&L for one row.
 *
 * Both come from the same hook, and the price stream behind it is keyed by market
 * rather than by quote, so a table of rows in the same market shares one
 * subscription.
 */
function useQuoteMark(quote: UnifiedQuote) {
  const { upnl, upnlPercent, markPrice, leverage, isLoading } = useQuoteUpnlAndPnl({ quote });
  return { upnl, upnlPercent, markPrice, leverage, priced: !isLoading && markPrice !== null };
}

/**
 * Entry over mark, or the price a resting order is waiting at.
 *
 * Four tracks — entry, mark, requested price, margin — did not fit the widths
 * this table actually gets. Two of them were the same fact told twice: a filled
 * quote's requested price is history, and an unfilled one has no entry or mark at
 * all. Stacking the pair that applies keeps both facts and gives back a column.
 */
function PriceCell({ quote, precision }: { quote: UnifiedQuote; precision: number }) {
  const { markPrice, priced } = useQuoteMark(quote);
  const filled = quote.openedPrice !== undefined && quote.openedPrice > 0n;
  return (
    <span className="inline-flex flex-col items-end leading-tight">
      <span className="text-foreground">
        {formatFixedPoint(filled ? (quote.openedPrice ?? 0n) : quote.requestedOpenPrice, precision)}
      </span>
      <span className="text-muted-foreground text-[0.7rem]">
        {filled ? (priced ? `mark ${Number(markPrice).toFixed(precision)}` : EMPTY) : "requested"}
      </span>
    </span>
  );
}

function UnrealizedCell({ quote }: { quote: UnifiedQuote }) {
  const { upnl, upnlPercent, priced } = useQuoteMark(quote);
  if (!priced) return <span className="text-muted-foreground">{EMPTY}</span>;
  const percent = formatSigned(upnlPercent, 2);
  return (
    <span className={cn("inline-flex flex-col items-end leading-tight", signedToneClassName(upnl))}>
      <span>{formatSigned(upnl)}</span>
      {percent === EMPTY ? null : <span className="text-[0.7rem] opacity-80">{percent}%</span>}
    </span>
  );
}

function LeverageCell({ quote }: { quote: UnifiedQuote }) {
  const { leverage } = useQuoteMark(quote);
  return <>{formatLeverageLabel(leverage)}</>;
}

/**
 * Compact TP/SL summary rendered inside the id column. Reads the shared TP/SL
 * store via {@link useQuoteTpSl} so the `confirming` overlay ("Processing…")
 * shows immediately after a mutation posts. Prices live in the detail panel —
 * this only flags which side is armed.
 */
function TpSlIndicator({ quote }: { quote: UnifiedQuote }) {
  const quoteId = quote.quoteId ?? (quote.tempQuoteId !== undefined ? BigInt(quote.tempQuoteId) : undefined);
  const tpsl = useQuoteTpSl({
    quoteId: quoteId ?? 0n,
    account: quote.partyA,
    query: { enabled: quoteId !== undefined && quoteId !== 0n },
  });
  const data = tpsl.data;
  if (!data) return null;
  const hasTp = Boolean(data.tp) || data.tpState === "confirming";
  const hasSl = Boolean(data.sl) || data.slState === "confirming";
  if (!hasTp && !hasSl) return null;
  return (
    <span className="mt-0.5 flex items-center gap-1 font-mono text-[0.65rem] font-semibold">
      {hasTp ? <span className="text-positive">TP</span> : null}
      {hasSl ? <span className="text-info">SL</span> : null}
    </span>
  );
}

/** State dot plus label — the on-chain status when anchored, the lifecycle stage when not. */
function StateCell({ quote }: { quote: UnifiedQuote }) {
  const state = quoteState(quote);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={cn("size-1.5 shrink-0 rounded-full", stateDotClassName(state.tone))} aria-hidden />
      <span className={state.tone === "muted" ? "text-muted-foreground" : "text-foreground"}>{state.label}</span>
    </span>
  );
}

function buildColumns(marketOf: MarketDisplayLookup): DataTableColumn<UnifiedQuote>[] {
  return [
    {
      id: "id",
      header: "Id",
      widthClassName: "min-w-28",
      cell: (quote) => (
        <span className="flex flex-col leading-tight">
          <span className="text-foreground font-mono whitespace-nowrap">{quoteIdLabel(quote)}</span>
          {quote.vaAddress ? (
            <span className="text-muted-foreground/80 font-mono text-[0.7rem]" title={quote.vaAddress}>
              {truncateAddress(quote.vaAddress)}
            </span>
          ) : null}
          <TpSlIndicator quote={quote} />
        </span>
      ),
      sortAccessor: quoteIdSort,
    },
    {
      id: "symbolId",
      header: "Market",
      widthClassName: "min-w-32",
      cell: (quote) => (
        <span className="flex flex-col leading-tight">
          <span className="font-display text-foreground font-semibold">{marketOf(quote.symbolId).name}</span>
          <span className="text-muted-foreground text-[0.7rem]">
            {OrderType[quote.orderType] ?? String(quote.orderType)}
          </span>
        </span>
      ),
      sortAccessor: (quote) => marketOf(quote.symbolId).name,
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
      id: "state",
      header: "State",
      widthClassName: "min-w-24",
      cell: (quote) => <StateCell quote={quote} />,
      sortAccessor: (quote) => quoteState(quote).label,
    },
    {
      id: "openQuantity",
      header: "Size",
      align: "end",
      widthClassName: NUMERIC_COLUMN_WIDTH,
      cell: (quote) => formatFixedPoint(quote.openQuantity, marketOf(quote.symbolId).quantityPrecision),
      sortAccessor: (quote) => Number(quote.openQuantity),
      cellClassName: "text-foreground font-mono",
    },
    {
      id: "price",
      header: "Entry",
      align: "end",
      widthClassName: NUMERIC_COLUMN_WIDTH,
      cell: (quote) => <PriceCell quote={quote} precision={marketOf(quote.symbolId).pricePrecision} />,
      sortAccessor: (quote) => Number(quote.openedPrice ?? quote.requestedOpenPrice),
      cellClassName: "font-mono",
    },
    {
      id: "unrealized",
      header: "Unrealized",
      align: "end",
      widthClassName: NUMERIC_COLUMN_WIDTH,
      cell: (quote) => <UnrealizedCell quote={quote} />,
      cellClassName: "font-mono",
    },
    {
      id: "leverage",
      header: "Lev",
      align: "end",
      cell: (quote) => <LeverageCell quote={quote} />,
      cellClassName: "text-foreground font-mono",
    },
    {
      id: "created",
      header: "Age",
      align: "end",
      cell: (quote) => {
        const seconds = quoteCreatedSeconds(quote);
        return (
          <span className="text-muted-foreground whitespace-nowrap">
            {seconds === undefined ? EMPTY : formatRelativeTimestamp(seconds)}
          </span>
        );
      },
      sortAccessor: (quote) => {
        const seconds = quoteCreatedSeconds(quote);
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
  /** Render every row without a pagination footer. */
  hidePagination?: boolean;
  /** Cap the visible rows and pin the header above the scroll. */
  maxVisibleRows?: number;
  /** Search/filter controls rendered above the table. */
  toolbar?: ReactNode;
  /** Prefix for the table's `data-testid` hooks. */
  testId?: string;
  /** Shown in place of rows when `quotes` is empty. */
  emptyMessage?: ReactNode;
}

/**
 * One row per {@link UnifiedQuote}, for a container wide enough to hold columns.
 *
 * Every column reads from the unified shape, so an on-chain position, a pending
 * instant-open and a pending instant-close render through the same row whatever
 * their origin — origin surfaces as the VA under the id and as the state cell.
 *
 * Render it through {@link QuotesSurface} rather than directly: the table is only
 * the right shape at `@5xl` and above, and the surface is what decides that.
 */
export function QuotesTable({
  quotes,
  totalCount,
  defaultPageSize = 10,
  hidePagination = false,
  maxVisibleRows,
  toolbar,
  testId,
  emptyMessage = "No quotes for this partyA.",
}: Props) {
  const marketOf = useMarketDisplay();
  const columns = useMemo(() => buildColumns(marketOf), [marketOf]);
  return (
    <DataTable
      testId={testId}
      columns={columns}
      data={quotes}
      totalCount={totalCount ?? quotes.length}
      getRowId={(quote) => quote.key}
      rowAttributes={(quote) => ({ "data-quote-key": quote.key, "data-quote-origin": quote.origin })}
      renderExpanded={(quote) => <QuoteDetailPanel quote={quote} market={marketOf(quote.symbolId)} variant="inline" />}
      initialSort={{ columnId: "created", direction: "desc" }}
      defaultPageSize={defaultPageSize}
      hidePagination={hidePagination}
      maxVisibleRows={maxVisibleRows}
      toolbar={toolbar}
      emptyMessage={emptyMessage}
    />
  );
}
