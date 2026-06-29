"use client";

import { txExplorerUrl } from "@/lib/explorer";
import { formatUsd, WEI_DECIMALS } from "@/lib/format";
import type { TransferRow } from "@symm-frontier/core";
import { Badge } from "@symm-frontier/ui/components/badge";
import { DataTable, type DataTableColumn } from "@symm-frontier/ui/components/data-table";
import { shortenAddress } from "@symm-frontier/utils";
import type { ReactNode } from "react";

/** Truncate a 32-byte tx hash for display (`shortenAddress` is 20-byte only). */
function shortenHash(hash: string): string {
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

/** Format a unix-seconds timestamp as a local `YYYY-MM-DD HH:mm` string. */
function formatTimestamp(seconds: number): string {
  const date = new Date(seconds * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const COLUMNS: DataTableColumn<TransferRow>[] = [
  {
    id: "direction",
    header: "Action",
    cell: (row) => (
      <Badge variant={row.direction === "outgoing" ? "secondary" : "positive"}>
        {row.direction === "outgoing" ? "Sent" : "Received"}
      </Badge>
    ),
    sortAccessor: (row) => row.direction,
  },
  {
    id: "parties",
    header: "From → To",
    cell: (row) => (
      <span className="font-mono text-xs whitespace-nowrap">
        <span title={row.from}>{shortenAddress(row.from)}</span>
        <span className="text-muted-foreground"> → </span>
        <span title={row.to}>{shortenAddress(row.to)}</span>
      </span>
    ),
  },
  {
    id: "amount",
    header: "Amount",
    align: "end",
    widthClassName: "min-w-24",
    cell: (row) => formatUsd(row.amount, WEI_DECIMALS),
    sortAccessor: (row) => Number(row.amount),
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "timestamp",
    header: "Date",
    align: "end",
    cell: (row) => <span className="text-muted-foreground whitespace-nowrap">{formatTimestamp(row.timestamp)}</span>,
    sortAccessor: (row) => row.timestamp,
  },
  {
    id: "transaction",
    header: "Tx",
    align: "end",
    cell: (row) => {
      const href = txExplorerUrl(row.transaction);
      const label = shortenHash(row.transaction);
      return href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-primary font-mono hover:underline"
          aria-label="View transaction on block explorer"
        >
          {label}
        </a>
      ) : (
        <span className="text-muted-foreground font-mono">{label}</span>
      );
    },
  },
];

interface Props {
  rows: TransferRow[];
  /** Rows shown per page before pagination kicks in. */
  defaultPageSize?: number;
  /** Render every row without a client-side pagination footer (when the parent owns paging). */
  hidePagination?: boolean;
  /** Prefix for the table's `data-testid` hooks. */
  testId?: string;
  /** Shown in place of rows when `rows` is empty. */
  emptyMessage?: ReactNode;
}

/**
 * Renders one row per {@link TransferRow} — an internal transfer (margin move
 * between SYMMIO accounts) with its `from → to` endpoints, sourced from the
 * events subgraph via `useTransferHistory`. Amounts are 18-decimal. Pass
 * `hidePagination` when the parent drives server-side paging.
 */
export function TransfersTable({ rows, defaultPageSize = 10, hidePagination = false, testId, emptyMessage }: Props) {
  return (
    <DataTable
      testId={testId}
      columns={COLUMNS}
      data={rows}
      totalCount={rows.length}
      getRowId={(row) => row.id}
      rowAttributes={(row) => ({ "data-tx-id": row.id })}
      initialSort={{ columnId: "timestamp", direction: "desc" }}
      defaultPageSize={defaultPageSize}
      hidePagination={hidePagination}
      emptyMessage={emptyMessage ?? "No transfers for this subaccount."}
    />
  );
}
