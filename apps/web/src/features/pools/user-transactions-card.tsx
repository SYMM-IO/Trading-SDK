"use client";

import { ResultError, ResultNote } from "@/components/result";
import { PoolTransactionStatus, PoolTransactionType, type UserTransaction } from "@symmio/trading-core";
import { useUserTransactions } from "@symmio/trading-react";
import { Badge } from "@symmio/ui/components/badge";
import { DataTable, type DataTableColumn } from "@symmio/ui/components/data-table";
import { MethodCard } from "../inspector/method-card";
import { useSolverKindActive } from "../solvers/solver-target";
import { quantity, shortAddress, timestamp } from "./detail-tables/shared";
import { useListingAuth } from "./listing-auth-context";
import { SignInNote } from "./sign-in-note";

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
 * Enigma-only: the listing backend lives on HyperEVM, so the card is gated on
 * Enigma being the active solver, mirroring the other Listing-session cards.
 */
export function UserTransactionsCard() {
  const enigmaActive = useSolverKindActive("enigma");
  const { accessToken } = useListingAuth();

  const signedIn = accessToken !== null;
  const history = useUserTransactions({
    accessToken: accessToken ?? "",
    query: { enabled: signedIn },
  });

  return (
    <MethodCard
      testId="method-getUserTransactions"
      name="getUserTransactions"
      mutability="view"
      description="Your transactions — every pool deposit and withdrawal you've made, across all pools, newest first. Sign in once. Enigma-only."
      wide
    >
      {!enigmaActive ? (
        <ResultNote testId="user-transactions-gate">Switch to Enigma (HyperEVM) to read your transactions.</ResultNote>
      ) : !signedIn ? (
        <SignInNote testId="user-transactions-idle" buttonTestId="user-transactions-sign-in">
          Sign in to read your transactions.
        </SignInNote>
      ) : history.error ? (
        <ResultError kind={history.error.kind} message={history.error.message} testId="user-transactions-error" />
      ) : (
        <DataTable
          testId="user-transactions-table"
          columns={COLUMNS}
          data={history.data?.items ?? []}
          getRowId={(row) => row.transactionId}
          defaultPageSize={10}
          emptyMessage={history.isPending ? "Loading your transactions…" : "No transactions yet."}
        />
      )}
    </MethodCard>
  );
}
