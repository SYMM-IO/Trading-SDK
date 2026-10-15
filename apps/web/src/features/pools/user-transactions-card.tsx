"use client";

import { ResultError, ResultNote } from "@/components/result";
import { PoolTransactionStatus, PoolTransactionType, type UserTransaction } from "@symmio/trading-core";
import { useUserTransactions } from "@symmio/trading-react";
import { Badge } from "@symmio/ui/components/badge";
import { DataTable, type DataTableColumn } from "@symmio/ui/components/data-table";
import { Pagination } from "@symmio/ui/components/pagination";
import { cn } from "@symmio/ui/lib/utils";
import { MethodCard } from "../inspector/method-card";
import { useSolverKindActive } from "../solvers/solver-target";
import { quantity, shortAddress, timestamp } from "./detail-tables/shared";
import { useListingAuth } from "./listing-auth-context";
import { SignInNote } from "./sign-in-note";
import { useServerPage } from "./use-server-page";

/** Badge tone per transaction status. */
const STATUS_VARIANT: Record<PoolTransactionStatus, "positive" | "warning" | "destructive" | "outline"> = {
  [PoolTransactionStatus.SUCCESS]: "positive",
  [PoolTransactionStatus.PENDING]: "warning",
  [PoolTransactionStatus.REJECTED]: "destructive",
  [PoolTransactionStatus.REFUND]: "outline",
  [PoolTransactionStatus.CANCELED]: "outline",
};

const COLUMNS: DataTableColumn<UserTransaction>[] = [
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
    id: "token",
    header: "Token",
    cell: (row) => (
      <span className="flex flex-col">
        <span className="text-foreground">{row.tokenTicker || row.tokenName || "—"}</span>
        <span className="text-muted-foreground font-mono text-xs" title={row.tokenAddress}>
          {shortAddress(row.tokenAddress)}
        </span>
      </span>
    ),
  },
  {
    id: "amount",
    header: "Amount",
    align: "start",
    cell: (row) => quantity(row.amount),
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

/**
 * Your transactions — the signed-in user's pool deposits and withdrawals across
 * **every** pool, newest first.
 *
 * Authed and scoped to the caller: {@link useUserTransactions} only returns the
 * user's own transactions, using the bearer token from the shared
 * {@link useListingAuth} session. Pool-independent — it is not tied to the
 * section's pool picker; every row carries its own token identity.
 *
 * Enigma-only: the listing backend lives on Arbitrum, so the card is gated on
 * Enigma being the active solver, mirroring the other Listing-session cards.
 */
export function UserTransactionsCard() {
  const enigmaActive = useSolverKindActive("enigma");
  const { accessToken } = useListingAuth();

  return (
    <MethodCard
      testId="method-getUserTransactions"
      name="getUserTransactions"
      mutability="view"
      description="Your transactions — every pool deposit and withdrawal you've made, across all pools, newest first. Sign in once. Enigma-only."
      wide
    >
      {!enigmaActive ? (
        <ResultNote testId="user-transactions-gate">Switch to Enigma (Arbitrum) to read your transactions.</ResultNote>
      ) : accessToken === null ? (
        <SignInNote testId="user-transactions-idle" buttonTestId="user-transactions-sign-in">
          Sign in to read your transactions.
        </SignInNote>
      ) : (
        <UserTransactionsTable key={accessToken} accessToken={accessToken} />
      )}
    </MethodCard>
  );
}

interface Props {
  /** The listing session's bearer token. */
  accessToken: string;
}

/**
 * The signed-in user's transactions, paged on the server: each page is its own
 * request, and the footer counts the backend's `count` — every transaction the
 * user has — not the rows loaded. The backend caps a page at 150 rows, above
 * every size the footer offers. Keyed on the session, so a new sign-in opens on
 * page 1.
 */
function UserTransactionsTable({ accessToken }: Props) {
  const pager = useServerPage(10);
  const history = useUserTransactions({
    accessToken,
    start: pager.start,
    size: pager.pageSize,
    /** Keep the current page on screen, dimmed, while the next one loads. */
    query: { placeholderData: (previous) => previous },
  });

  if (history.error) {
    return <ResultError kind={history.error.kind} message={history.error.message} testId="user-transactions-error" />;
  }

  const total = history.data?.count ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <DataTable
        testId="user-transactions-table"
        columns={COLUMNS}
        data={history.data?.items ?? []}
        getRowId={(row) => row.transactionId}
        hidePagination
        className={cn("transition-opacity", history.isPlaceholderData && "opacity-50")}
        emptyMessage={history.isPending ? "Loading your transactions…" : "No transactions yet."}
      />
      {total > 0 ? (
        <Pagination
          page={pager.page}
          pageCount={pager.pageCount(total)}
          pageSize={pager.pageSize}
          total={total}
          onPageChange={pager.setPage}
          onPageSizeChange={pager.setPageSize}
          testId="user-transactions-table-pagination"
        />
      ) : null}
    </div>
  );
}
