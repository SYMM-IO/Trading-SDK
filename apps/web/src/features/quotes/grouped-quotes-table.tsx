"use client";
import { WEI_DECIMALS } from "@/lib/format";
import type { QuoteGroup } from "@theoldvarorg/core";
import { PositionType, QuoteLifecycle } from "@theoldvarorg/core";
import { Badge } from "@theoldvarorg/ui/components/badge";
import { DataTable, type DataTableColumn } from "@theoldvarorg/ui/components/data-table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@theoldvarorg/ui/components/tooltip";
import { formatTokenAmount } from "@theoldvarorg/utils";
import { useMemo, type ReactNode } from "react";
import { QuoteLifecycleBadge } from "./quote-lifecycle-badge";
import { truncateAddress } from "./quote-provenance-panel";
import { QuotesTable } from "./quotes-table";
import { useMarketNameById } from "./use-market-name-by-id";

/** Em dash placeholder for a metric a group cannot populate yet. */
const EMPTY = "—";

/** Min width that keeps a fixed-point figure column from crowding its header. */
const NUMERIC_COLUMN_WIDTH = "min-w-24";

/** Format an 18-decimal-wei amount the way the flat quotes table reads do. */
function formatFixedPoint(raw: bigint): string {
  return formatTokenAmount(raw, WEI_DECIMALS, { maxFractionDigits: 6 });
}

/** Format an optional wei amount, falling back to {@link EMPTY} when the group hasn't settled it. */
function formatOptionalFixedPoint(raw?: bigint): string {
  return raw === undefined ? EMPTY : formatFixedPoint(raw);
}

/** Format the blended leverage (an 18-decimal fixed-point bigint) as e.g. `10.5×`. */
function formatLeverage(raw?: bigint): string {
  return raw === undefined ? EMPTY : `${formatTokenAmount(raw, WEI_DECIMALS, { maxFractionDigits: 2 })}×`;
}

/** Sum of the partyA-locked margin legs a group displays (CVA + LF), wei. */
function groupMargin(group: QuoteGroup): bigint {
  return group.metrics.lockedValues.cva + group.metrics.lockedValues.lf;
}

/**
 * Priority order for a group's representative lifecycle — the most
 * attention-worthy stage wins, so an in-flight close or a failure shows over a
 * settled `ONCHAIN` sibling.
 */
const LIFECYCLE_PRIORITY: readonly QuoteLifecycle[] = [
  QuoteLifecycle.FAILED,
  QuoteLifecycle.CLOSING,
  QuoteLifecycle.WRITE_ONCHAIN_CLOSE,
  QuoteLifecycle.CLOSE_PRICE_FILLED,
  QuoteLifecycle.OPTIMISTIC_CLOSE,
  QuoteLifecycle.OPTIMISTIC,
  QuoteLifecycle.PRICE_FILLED,
  QuoteLifecycle.WRITE_ONCHAIN,
  QuoteLifecycle.ONCHAIN,
  QuoteLifecycle.CLOSED,
];

/**
 * The single lifecycle stage to surface for a group: the highest-priority stage
 * among its child quotes. A group is an aggregate, so this lets a closing or
 * failing child be visible at the group level (the per-quote stages are still in
 * the expanded child table).
 */
function groupLifecycle(group: QuoteGroup): QuoteLifecycle {
  const stages = new Set(group.quotes.map((quote) => quote.lifecycle));
  return LIFECYCLE_PRIORITY.find((stage) => stages.has(stage)) ?? QuoteLifecycle.ONCHAIN;
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
 * Header for an aggregated column: the label plus an info glyph whose tooltip
 * spells out the formula. The trigger is a non-focusable `<span>` (not a
 * `<button>`) because a sortable header already wraps its content in a
 * `<button>`, and a button must not contain another interactive control;
 * `stopPropagation` keeps a click on the glyph from toggling the column sort.
 */
function CalculatedHeader({ label, formula }: { label: string; formula: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="text-muted-foreground/70 hover:text-foreground inline-flex cursor-help"
            onClick={(event) => event.stopPropagation()}
          >
            <InfoIcon />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-64 text-left font-normal normal-case">{formula}</TooltipContent>
      </Tooltip>
    </span>
  );
}

function buildColumns(marketNameById: Map<string, string>): DataTableColumn<QuoteGroup>[] {
  return [
  {
    id: "market",
    header: "Market",
    widthClassName: "min-w-28",
    cell: (group) => {
      const label =
        group.by.symbolId === undefined
          ? EMPTY
          : (marketNameById.get(String(group.by.symbolId)) ?? String(group.by.symbolId));
      return (
        <span className="flex flex-col leading-tight">
          <span className="text-foreground font-mono whitespace-nowrap">{label}</span>
          {group.vaAddress ? (
            <span className="text-muted-foreground/80 font-mono text-[0.7rem]" title={group.vaAddress}>
              {truncateAddress(group.vaAddress)}
            </span>
          ) : null}
        </span>
      );
    },
    sortAccessor: (group) =>
      group.by.symbolId === undefined
        ? undefined
        : (marketNameById.get(String(group.by.symbolId)) ?? String(group.by.symbolId)),
  },
  {
    id: "side",
    header: "Side",
    cell: (group) =>
      group.by.positionType === undefined ? (
        <span className="text-muted-foreground">{EMPTY}</span>
      ) : (
        <Badge variant={group.by.positionType === PositionType.LONG ? "positive" : "destructive"}>
          {PositionType[group.by.positionType] ?? String(group.by.positionType)}
        </Badge>
      ),
    sortAccessor: (group) => group.by.positionType,
  },
  {
    id: "status",
    header: "Status",
    cell: (group) => <QuoteLifecycleBadge lifecycle={groupLifecycle(group)} />,
    sortAccessor: (group) => groupLifecycle(group),
  },
  {
    id: "quotes",
    header: "Quotes",
    align: "end",
    cell: (group) => (
      <span className="inline-flex items-center gap-1">
        <span className="text-foreground font-mono">{group.metrics.quoteCount}</span>
        {group.isAggregate ? (
          <Badge variant="secondary" className="text-[0.65rem]">
            agg
          </Badge>
        ) : null}
      </span>
    ),
    sortAccessor: (group) => group.metrics.quoteCount,
  },
  {
    id: "openQuantity",
    header: (
      <CalculatedHeader
        label="Open qty"
        formula="Open qty = Σ (quantity − closedAmount) across the group's quotes — the live size still on the book."
      />
    ),
    align: "end",
    widthClassName: NUMERIC_COLUMN_WIDTH,
    cell: (group) => formatFixedPoint(group.metrics.openQuantity),
    sortAccessor: (group) => Number(group.metrics.openQuantity),
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "weightedOpenPrice",
    header: (
      <CalculatedHeader
        label="Avg price"
        formula="Weighted avg open price = Σ(openQty × price) ÷ Σ openQty, where price is the opened price (else the requested one). Hidden until every quote in the group has a settled open price."
      />
    ),
    align: "end",
    widthClassName: NUMERIC_COLUMN_WIDTH,
    cell: (group) => formatOptionalFixedPoint(group.metrics.weightedOpenPrice),
    sortAccessor: (group) =>
      group.metrics.weightedOpenPrice === undefined ? undefined : Number(group.metrics.weightedOpenPrice),
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "notional",
    header: (
      <CalculatedHeader
        label="Notional"
        formula="Notional = Σ (openQty × price) across the group — the position's notional value at its open price."
      />
    ),
    align: "end",
    widthClassName: NUMERIC_COLUMN_WIDTH,
    cell: (group) => formatFixedPoint(group.metrics.notional),
    sortAccessor: (group) => Number(group.metrics.notional),
    cellClassName: "text-muted-foreground font-mono",
  },
  {
    id: "margin",
    header: (
      <CalculatedHeader
        label="Margin (cva+lf)"
        formula="Margin = Σ CVA + Σ LF locked across the group's quotes (the partyA collateral at risk, excluding maintenance margin)."
      />
    ),
    align: "end",
    widthClassName: NUMERIC_COLUMN_WIDTH,
    cell: (group) => formatFixedPoint(groupMargin(group)),
    sortAccessor: (group) => Number(groupMargin(group)),
    cellClassName: "text-muted-foreground font-mono",
  },
  {
    id: "leverage",
    header: (
      <CalculatedHeader
        label="Leverage"
        formula="Leverage = notional ÷ Σ (CVA + LF + partyAMM) — the group's blended leverage against its partyA-locked margin."
      />
    ),
    align: "end",
    widthClassName: "min-w-20",
    cell: (group) => formatLeverage(group.metrics.leverage),
    sortAccessor: (group) => (group.metrics.leverage === undefined ? undefined : Number(group.metrics.leverage)),
    cellClassName: "text-foreground font-mono",
  },
  ];
}

interface Props {
  groups: QuoteGroup[];
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
  /** Shown in place of rows when `groups` is empty. */
  emptyMessage?: ReactNode;
}

/**
 * Renders one row per {@link QuoteGroup} — a position folded across its child
 * quotes under the active grouping strategy. Each row shows the aggregated
 * metrics (open size, weighted open price, notional, locked margin, blended
 * leverage) and expands to the flat {@link QuotesTable} of its underlying quotes,
 * so the grouped view and the per-quote view stay one click apart.
 */
export function GroupedQuotesTable({
  groups,
  totalCount,
  defaultPageSize = 10,
  hidePagination = false,
  toolbar,
  testId,
  emptyMessage = "No grouped positions for this partyA.",
}: Props) {
  const marketNameById = useMarketNameById();
  const columns = useMemo(() => buildColumns(marketNameById), [marketNameById]);
  return (
    <DataTable
      testId={testId}
      columns={columns}
      data={groups}
      totalCount={totalCount ?? groups.length}
      getRowId={(group) => group.key}
      rowAttributes={(group) => ({ "data-group-key": group.key })}
      renderExpanded={(group) => (
        <QuotesTable
          testId={testId ? `${testId}-${group.key}-children` : undefined}
          quotes={group.quotes}
          hidePagination
          emptyMessage="No quotes in this group."
        />
      )}
      defaultPageSize={defaultPageSize}
      hidePagination={hidePagination}
      toolbar={toolbar}
      emptyMessage={emptyMessage}
    />
  );
}
