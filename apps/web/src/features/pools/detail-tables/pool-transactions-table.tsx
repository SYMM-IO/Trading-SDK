"use client";

import { PoolTransactionStatus, PoolTransactionType, type PoolTransaction } from "@symmio/trading-core";
import { Badge } from "@symmio/ui/components/badge";
import { DataTable, type DataTableColumn } from "@symmio/ui/components/data-table";
import { quantity, shortAddress, timestamp, usd } from "./shared";

/** Badge tone per transaction status. */
const STATUS_VARIANT: Record<PoolTransactionStatus, "positive" | "warning" | "destructive" | "outline"> = {
  [PoolTransactionStatus.SUCCESS]: "positive",
  [PoolTransactionStatus.PENDING]: "warning",
  [PoolTransactionStatus.REJECTED]: "destructive",
  [PoolTransactionStatus.REFUND]: "outline",
  [PoolTransactionStatus.CANCELED]: "outline",
};

const COLUMNS: DataTableColumn<PoolTransaction>[] = [
  {
    id: "type",
    header: "Type",
    cell: (row) => (
      <Badge variant={row.type === PoolTransactionType.DEPOSIT ? "positive" : "secondary"}>
        {row.type === PoolTransactionType.DEPOSIT ? "Deposit" : "Withdraw"}
      </Badge>
    ),
  },
  {
    id: "wallet",
    header: "Wallet",
    cell: (row) => (
      <span className="text-muted-foreground font-mono" title={row.walletAddress}>
        {shortAddress(row.walletAddress)}
      </span>
    ),
  },
  {
    id: "tokenAmount",
    header: "Token",
    align: "end",
    cell: (row) => quantity(row.tokenAmount),
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "usdcAmount",
    header: "Value",
    align: "end",
    cell: (row) => usd(row.usdcAmount),
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "status",
    header: "Status",
    cell: (row) => <Badge variant={STATUS_VARIANT[row.status] ?? "outline"}>{row.status}</Badge>,
  },
  {
    id: "time",
    header: "Time",
    align: "end",
    widthClassName: "min-w-36",
    cell: (row) => <span className="text-muted-foreground">{timestamp(row.time)}</span>,
  },
];

interface Props {
  transactions: PoolTransaction[];
  isPending: boolean;
}

/**
 * The pool's deposits and withdrawals — every LP's, not just the connected
 * wallet's, which is why the wallet column is shown at all.
 */
export function PoolTransactionsTable({ transactions, isPending }: Props) {
  return (
    <DataTable
      testId="pool-transactions-table"
      columns={COLUMNS}
      data={transactions}
      getRowId={(row) => row.transactionId}
      defaultPageSize={10}
      emptyMessage={isPending ? "Loading deposits and withdrawals…" : "No deposits or withdrawals on this pool yet."}
    />
  );
}
