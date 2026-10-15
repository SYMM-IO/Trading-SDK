"use client";

import { ResultError } from "@/components/result";
import { PoolTransactionStatus, PoolTransactionType, type PoolTransaction } from "@symmio/trading-core";
import { usePoolTransactions } from "@symmio/trading-react";
import { Badge } from "@symmio/ui/components/badge";
import { DataTable, type DataTableColumn } from "@symmio/ui/components/data-table";
import { Pagination } from "@symmio/ui/components/pagination";
import { cn } from "@symmio/ui/lib/utils";
import { useServerPage } from "../use-server-page";
import { quantity, shortAddress, timestamp, usd } from "./shared";

/** Page sizes the footer offers. The backend caps this endpoint at 50 rows a page and rejects more with a `422`. */
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;

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
  /** The pool's token contract address. */
  tokenAddress: string;
}

/**
 * The pool's deposits and withdrawals — every LP's, not just the connected
 * wallet's, which is why the wallet column is shown at all.
 *
 * Paged on the server, unlike the other detail tables: an active pool's history
 * runs to hundreds of rows and the backend serves at most 50 a request, so each
 * page is its own request and the footer counts the backend's `count` — the
 * pool's whole history — not the rows loaded. That is why this table reads its
 * own data rather than taking rows from the card. Key it on `tokenAddress`, so a
 * new pool opens on page 1.
 */
export function PoolTransactionsTable({ tokenAddress }: Props) {
  const pager = useServerPage(10);
  const transactions = usePoolTransactions({
    tokenAddress,
    start: pager.start,
    size: pager.pageSize,
    /** Keep the current page on screen, dimmed, while the next one loads. */
    query: { placeholderData: (previous) => previous },
  });

  if (transactions.error) {
    return (
      <ResultError kind={transactions.error.kind} message={transactions.error.message} testId="pool-detail-error" />
    );
  }

  const total = transactions.data?.count ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <DataTable
        testId="pool-transactions-table"
        columns={COLUMNS}
        data={transactions.data?.items ?? []}
        getRowId={(row) => row.transactionId}
        hidePagination
        className={cn("transition-opacity", transactions.isPlaceholderData && "opacity-50")}
        emptyMessage={
          transactions.isPending ? "Loading deposits and withdrawals…" : "No deposits or withdrawals on this pool yet."
        }
      />
      {total > 0 ? (
        <Pagination
          page={pager.page}
          pageCount={pager.pageCount(total)}
          pageSize={pager.pageSize}
          total={total}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageChange={pager.setPage}
          onPageSizeChange={pager.setPageSize}
          testId="pool-transactions-table-pagination"
        />
      ) : null}
    </div>
  );
}
