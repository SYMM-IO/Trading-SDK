"use client";

import type { PoolQuote } from "@symmio/trading-core";
import { Badge } from "@symmio/ui/components/badge";
import { DataTable, type DataTableColumn } from "@symmio/ui/components/data-table";
import { positionSideLabel, price, quantity, shortAddress, timestamp } from "./shared";

const COLUMNS: DataTableColumn<PoolQuote>[] = [
  {
    id: "quoteId",
    header: "Quote",
    widthClassName: "min-w-28",
    cell: (row) => (
      <span className="flex flex-col leading-tight">
        <span className="text-foreground font-mono">#{row.quoteId.toString()}</span>
        <span className="text-muted-foreground/80 font-mono text-[0.7rem]" title={row.partyA}>
          {shortAddress(row.partyA)}
        </span>
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
    id: "quantity",
    header: "Size",
    align: "end",
    cell: (row) => quantity(row.quantity),
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "requestedOpenPrice",
    header: "Requested",
    align: "end",
    cell: (row) => price(row.requestedOpenPrice),
    cellClassName: "text-muted-foreground font-mono",
  },
  {
    id: "openedPrice",
    header: "Opened",
    align: "end",
    cell: (row) => price(row.openedPrice),
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "closedAmount",
    header: "Closed",
    align: "end",
    cell: (row) => quantity(row.closedAmount),
    cellClassName: "text-muted-foreground font-mono",
  },
  {
    id: "timestamp",
    header: "Updated",
    align: "end",
    widthClassName: "min-w-36",
    cell: (row) => <span className="text-muted-foreground">{timestamp(row.timestamp)}</span>,
  },
];

interface Props {
  quotes: PoolQuote[];
  isPending: boolean;
  emptyMessage: string;
  testId: string;
}

/**
 * A pool's quote book from the subgraph.
 *
 * Pool-wide, not account-scoped — `partyA` differs row to row, which is why it
 * is shown under the quote id rather than assumed to be the connected wallet.
 */
export function PoolQuotesTable({ quotes, isPending, emptyMessage, testId }: Props) {
  return (
    <DataTable
      testId={testId}
      columns={COLUMNS}
      data={quotes}
      getRowId={(row) => row.id}
      defaultPageSize={10}
      emptyMessage={isPending ? "Loading the pool's book…" : emptyMessage}
    />
  );
}
