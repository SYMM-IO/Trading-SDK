"use client";

import type { SearchTpSlOrdersReturnType } from "@symmio/trading-core";
import { Badge } from "@symmio/ui/components/badge";
import { DataTable, type DataTableColumn } from "@symmio/ui/components/data-table";
import { formatWithCommas } from "@symmio/utils";
import { positionSideLabel, shortAddress, timestamp } from "./shared";

/** One raw conditional-order row as the handler returns it. */
type LimitOrderRow = SearchTpSlOrdersReturnType["orders"][number];

/**
 * Handler rows carry plain JS numbers, not 18-decimal fixed point — this is a
 * different backend from the subgraph and the listing service, and it does no
 * scaling.
 */
function plain(value: number | null | undefined, decimals: number): string {
  if (value === null || value === undefined) return "—";
  return formatWithCommas(value, { dynamicDecimals: decimals });
}

const COLUMNS: DataTableColumn<LimitOrderRow>[] = [
  {
    id: "id",
    header: "Order",
    widthClassName: "min-w-32",
    cell: (row) => (
      <span className="flex flex-col leading-tight">
        <span className="text-foreground font-mono">{row.coh_quote_id}</span>
        <span className="text-muted-foreground/80 font-mono text-[0.7rem]" title={row.party_a_address}>
          {shortAddress(row.party_a_address)}
        </span>
      </span>
    ),
  },
  {
    id: "side",
    header: "Type",
    cell: (row) => (
      <Badge variant={row.position_type === 0 ? "positive" : "destructive"}>
        {positionSideLabel(row.position_type ?? null)}
      </Badge>
    ),
  },
  {
    id: "quantity",
    header: "Size",
    align: "end",
    cell: (row) => plain(row.quantity, 4),
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "triggerPrice",
    header: "Trigger",
    align: "end",
    cell: (row) => plain(row.conditional_order_price, 6),
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "price",
    header: "Price",
    align: "end",
    cell: (row) => plain(row.price, 6),
    cellClassName: "text-muted-foreground font-mono",
  },
  {
    id: "state",
    header: "State",
    cell: (row) => <Badge variant="secondary">{row.state}</Badge>,
  },
  {
    id: "createTime",
    header: "Opened",
    align: "end",
    widthClassName: "min-w-36",
    cell: (row) => <span className="text-muted-foreground">{timestamp(row.create_time)}</span>,
  },
];

interface Props {
  orders: LimitOrderRow[];
  isPending: boolean;
}

/**
 * The pool's pending trigger-to-open orders, from the TP/SL handler.
 *
 * These are `send_quote` conditional orders — an order that opens a quote when
 * its trigger price is hit — which is a different mechanism from a protocol
 * LIMIT order. That distinction matters: the lowcap solver declares
 * `limitOrder: false`, yet this table can still have rows.
 *
 * Read across every account, so `party_a_address` varies row to row.
 */
export function PoolLimitOrdersTable({ orders, isPending }: Props) {
  return (
    <DataTable
      testId="pool-limit-orders-table"
      columns={COLUMNS}
      data={orders}
      getRowId={(row) => row.coh_quote_id}
      defaultPageSize={10}
      emptyMessage={isPending ? "Loading the pool's orders…" : "No pending trigger-to-open orders on this pool."}
    />
  );
}
