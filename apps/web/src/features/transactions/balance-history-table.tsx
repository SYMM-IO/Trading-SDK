"use client";

import { txExplorerUrl } from "@/lib/explorer";
import { formatUsd } from "@/lib/format";
import { BalanceChangeType, type BalanceHistoryRow } from "@symmio/trading-core";
import { Badge } from "@symmio/ui/components/badge";
import { DataTable, type DataTableColumn } from "@symmio/ui/components/data-table";
import type { ReactNode } from "react";

/** Human label for each movement type. A bridge withdraw reads as a withdraw. */
const TYPE_LABELS: Record<BalanceChangeType, string> = {
  [BalanceChangeType.Deposit]: "Deposit",
  [BalanceChangeType.Withdraw]: "Withdraw",
  [BalanceChangeType.Bridge]: "Withdraw (bridge)",
};

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

/** Build the column set; `decimals` scales the raw collateral amount for display. */
function buildColumns(decimals: number): DataTableColumn<BalanceHistoryRow>[] {
  return [
    {
      id: "type",
      header: "Action",
      cell: (row) => (
        <span className="flex flex-col items-start gap-0.5 leading-tight">
          <Badge
            variant={
              row.isInternalTransfer ? "outline" : row.type === BalanceChangeType.Deposit ? "positive" : "secondary"
            }
          >
            {TYPE_LABELS[row.type]}
          </Badge>
          {row.isInternalTransfer ? (
            <span className="text-muted-foreground/80 text-[0.7rem]">
              internal{row.marginTransferType ? ` · ${row.marginTransferType.toLowerCase().replace("_", " ")}` : ""}
            </span>
          ) : null}
        </span>
      ),
      sortAccessor: (row) => row.type,
    },
    {
      id: "amount",
      header: "Amount",
      align: "end",
      widthClassName: "min-w-24",
      cell: (row) => formatUsd(row.amount, decimals),
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
}

interface Props {
  rows: BalanceHistoryRow[];
  /** Collateral decimals used to scale the raw `amount` for display. */
  decimals: number;
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
 * Renders one row per {@link BalanceHistoryRow} — a settled deposit or withdraw
 * on a sub-account, sourced from the analytics subgraph via `useBalanceHistory`.
 * Amounts are scaled from raw collateral units by `decimals`. Pass
 * `hidePagination` when the parent drives server-side paging.
 */
export function BalanceHistoryTable({
  rows,
  decimals,
  defaultPageSize = 10,
  hidePagination = false,
  testId,
  emptyMessage,
}: Props) {
  return (
    <DataTable
      testId={testId}
      columns={buildColumns(decimals)}
      data={rows}
      totalCount={rows.length}
      getRowId={(row) => row.id}
      rowAttributes={(row) => ({ "data-tx-id": row.id })}
      initialSort={{ columnId: "timestamp", direction: "desc" }}
      defaultPageSize={defaultPageSize}
      hidePagination={hidePagination}
      emptyMessage={emptyMessage ?? "No deposits or withdrawals for this subaccount."}
    />
  );
}
