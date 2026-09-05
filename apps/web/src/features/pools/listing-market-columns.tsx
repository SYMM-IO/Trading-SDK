"use client";

import type { ListingMarket, ListingMarketSortField } from "@symmio/trading-core";
import { Badge } from "@symmio/ui/components/badge";
import type { DataTableColumn } from "@symmio/ui/components/data-table";
import { cn } from "@symmio/ui/lib/utils";
import {
  depositChainLabel,
  formatListingDate,
  formatListingRate,
  formatListingUsd,
  LISTING_STATUS_DISPLAY,
  rateTone,
  truncateContractAddress,
} from "./format-listing-value";

/** Min width that keeps a compact currency figure from crowding its header. */
const NUMERIC_COLUMN_WIDTH = "min-w-24";

/** Cell tint for a signed rate. */
const RATE_TONE_CLASS = {
  positive: "text-positive",
  negative: "text-negative",
  neutral: "text-muted-foreground",
} as const;

/** A sortable header: clicking it changes the **server-side** sort, not the page's order. */
interface SortHeaderProps {
  label: string;
  field: ListingMarketSortField;
  activeField?: ListingMarketSortField;
  direction: "asc" | "desc";
  onSort: (field: ListingMarketSortField) => void;
}

function SortHeader({ label, field, activeField, direction, onSort }: SortHeaderProps) {
  const active = activeField === field;

  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      aria-label={`Sort by ${label}`}
      data-testid={`pools-sort-${field}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-sm transition-colors outline-none",
        "focus-visible:ring-ring/50 focus-visible:ring-2",
        active ? "text-foreground" : "hover:text-foreground",
      )}
    >
      {label}
      <span aria-hidden className={cn("text-[0.65rem]", active ? "opacity-100" : "opacity-0")}>
        {direction === "desc" ? "▼" : "▲"}
      </span>
    </button>
  );
}

/** Inputs the column set needs to render its server-side sort controls. */
export interface ListingMarketColumnsOptions {
  sortBy?: ListingMarketSortField;
  orderBy: "asc" | "desc";
  onSort: (field: ListingMarketSortField) => void;
}

/**
 * Columns for the listing catalog table.
 *
 * Deliberately built without `sortAccessor`: sorting is server-side, so letting
 * the table sort would reorder only the twenty-odd rows of the current page and
 * quietly disagree with the header arrow. Each numeric header is a button that
 * changes the request instead.
 */
export function listingMarketColumns({
  sortBy,
  orderBy,
  onSort,
}: ListingMarketColumnsOptions): DataTableColumn<ListingMarket>[] {
  const sortable = (label: string, field: ListingMarketSortField) => (
    <SortHeader label={label} field={field} activeField={sortBy} direction={orderBy} onSort={onSort} />
  );

  return [
    {
      id: "pool",
      header: "Pool",
      widthClassName: "min-w-52",
      cell: (row) => (
        <span className="flex flex-col leading-tight">
          <span className="text-foreground font-medium">{row.tokenTicker}</span>
          <span className="text-muted-foreground/80 truncate text-[0.7rem]" title={row.tokenName}>
            {row.tokenName}
          </span>
        </span>
      ),
    },
    {
      id: "chain",
      header: "Chain",
      widthClassName: "min-w-32",
      cell: (row) => (
        <span className="flex flex-col leading-tight">
          <span className="text-foreground">{depositChainLabel(row.chainId)}</span>
          <span
            className="text-muted-foreground/80 font-mono text-[0.7rem] whitespace-nowrap"
            title={row.contractAddress}
          >
            {truncateContractAddress(row.contractAddress)}
          </span>
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => {
        const display = LISTING_STATUS_DISPLAY[row.marketStatus];
        return <Badge variant={display?.variant ?? "outline"}>{display?.label ?? row.marketStatus}</Badge>;
      },
    },
    {
      id: "marketCap",
      header: sortable("Mkt. cap", "market_cap"),
      align: "end",
      widthClassName: NUMERIC_COLUMN_WIDTH,
      cell: (row) => formatListingUsd(row.marketCap),
      cellClassName: "text-foreground font-mono",
    },
    {
      id: "tvl",
      header: sortable("TVL", "tvl"),
      align: "end",
      widthClassName: NUMERIC_COLUMN_WIDTH,
      cell: (row) => formatListingUsd(row.tvl),
      cellClassName: "text-foreground font-mono",
    },
    {
      id: "vol24h",
      header: sortable("Vol 24h", "vol24h"),
      align: "end",
      widthClassName: NUMERIC_COLUMN_WIDTH,
      cell: (row) => formatListingUsd(row.vol24h),
      cellClassName: "text-muted-foreground font-mono",
    },
    {
      id: "liquidity",
      header: sortable("Liquidity", "liquidity"),
      align: "end",
      widthClassName: NUMERIC_COLUMN_WIDTH,
      cell: (row) => formatListingUsd(row.liquidity),
      cellClassName: "text-muted-foreground font-mono",
    },
    {
      id: "openInterest",
      header: sortable("Open int.", "open_interest"),
      align: "end",
      widthClassName: NUMERIC_COLUMN_WIDTH,
      cell: (row) => formatListingUsd(row.openInterest),
      cellClassName: "text-muted-foreground font-mono",
    },
    {
      /**
       * The reference UI's "APY" column is the backend's headline `apr` field,
       * not one of the windowed APY series — matched here so the two read the
       * same. The windowed figures live on `aprByWindow` / `tvlDrivenApy` /
       * `priceDrivenApy` for a consumer that wants them.
       */
      id: "apy",
      header: sortable("APY", "apr"),
      align: "end",
      widthClassName: NUMERIC_COLUMN_WIDTH,
      cell: (row) => (
        <span className={cn("font-mono", RATE_TONE_CLASS[rateTone(row.apr)])}>{formatListingRate(row.apr)}</span>
      ),
    },
    {
      id: "leverage",
      header: "Max lev.",
      align: "end",
      cell: (row) => <span className="text-muted-foreground font-mono">{row.maxLeverage}×</span>,
    },
    {
      id: "listingTime",
      header: sortable("Listed", "listing_time"),
      align: "end",
      widthClassName: "min-w-28",
      cell: (row) => <span className="text-muted-foreground">{formatListingDate(row.listingTime)}</span>,
    },
  ];
}
