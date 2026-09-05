"use client";

import { PoolPositionSide, toPoolPositions, type ListingMarketDetail, type PoolPosition } from "@symmio/trading-core";
import { Badge } from "@symmio/ui/components/badge";
import { DataTable, type DataTableColumn } from "@symmio/ui/components/data-table";
import { cn } from "@symmio/ui/lib/utils";
import { price, quantity, SIGN_TONE_CLASS, signTone, usd } from "./shared";

const COLUMNS: DataTableColumn<PoolPosition>[] = [
  {
    id: "side",
    header: "Type",
    cell: (row) => (
      <Badge variant={row.side === PoolPositionSide.LONG ? "positive" : "destructive"}>
        {row.side === PoolPositionSide.LONG ? "Longs" : "Shorts"}
      </Badge>
    ),
  },
  {
    id: "size",
    header: "Size",
    align: "end",
    cell: (row) => quantity(row.size),
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "value",
    header: "Position value",
    align: "end",
    cell: (row) => usd(row.value),
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "avgOpenPrice",
    header: "Entry price",
    align: "end",
    cell: (row) => price(row.avgOpenPrice),
    cellClassName: "text-muted-foreground font-mono",
  },
  {
    id: "upnl",
    header: "uPnL",
    align: "end",
    cell: (row) => <span className={cn("font-mono", SIGN_TONE_CLASS[signTone(row.upnl)])}>{usd(row.upnl)}</span>,
  },
];

interface Props {
  detail: ListingMarketDetail | undefined;
  isPending: boolean;
}

/**
 * The pool's inventory, one row per side.
 *
 * Not a list of trades: the listing backend reports one long aggregate and one
 * short aggregate, and `toPoolPositions` folds them into rows — a pure reshape
 * of the detail this page already fetched, so no second request.
 */
export function PoolPositionsTable({ detail, isPending }: Props) {
  const rows = detail ? toPoolPositions(detail) : [];

  return (
    <DataTable
      testId="pool-positions-table"
      columns={COLUMNS}
      data={rows}
      getRowId={(row) => row.side}
      hidePagination
      emptyMessage={isPending ? "Loading the pool's inventory…" : "This pool holds no inventory."}
    />
  );
}
