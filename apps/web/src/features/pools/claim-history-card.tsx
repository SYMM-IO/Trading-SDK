"use client";

import { ResultError, ResultNote } from "@/components/result";
import type { PoolClaim } from "@symmio/trading-core";
import { useClaimHistory } from "@symmio/trading-react";
import { DataTable, type DataTableColumn } from "@symmio/ui/components/data-table";
import { MethodCard } from "../inspector/method-card";
import { useSolverKindActive } from "../solvers/solver-target";
import { shortAddress, timestamp } from "./detail-tables/shared";
import { formatListingRewardAmount } from "./format-listing-value";
import { useListingAuth } from "./listing-auth-context";
import { usePoolScope } from "./pool-scope";
import { SignInNote } from "./sign-in-note";

const COLUMNS: DataTableColumn<PoolClaim>[] = [
  {
    id: "amount",
    header: "Amount (USDC)",
    align: "start",
    cell: (row) => formatListingRewardAmount(row.amount),
    cellClassName: "text-foreground font-mono",
  },
  {
    id: "account",
    header: "Received by",
    cell: (row) => (
      <span className="text-muted-foreground font-mono" title={row.accountAddress}>
        {shortAddress(row.accountAddress)}
      </span>
    ),
  },
  {
    id: "tx",
    header: "Tx",
    cell: (row) =>
      row.transactionHash ? (
        <span className="text-muted-foreground font-mono" title={row.transactionHash}>
          {shortAddress(row.transactionHash)}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
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
 * Claim history — the signed-in user's past pool-reward claims, newest first.
 *
 * Authed and scoped to the caller: {@link useClaimHistory} only returns claims
 * the user owns, using the bearer token from the shared {@link useListingAuth}
 * session. When a pool is picked in the section's shared picker
 * ({@link usePoolScope}) the list narrows to that pool; otherwise it shows the
 * user's claims across every pool.
 *
 * Enigma-only: the listing backend lives on HyperEVM, so the card is gated on
 * Enigma being the active solver, mirroring the other Listing-session cards.
 */
export function ClaimHistoryCard() {
  const enigmaActive = useSolverKindActive("enigma");
  const { accessToken } = useListingAuth();
  const { contractAddress } = usePoolScope();

  const signedIn = accessToken !== null;
  const history = useClaimHistory({
    accessToken: accessToken ?? "",
    tokenContractAddress: contractAddress.length > 0 ? contractAddress : undefined,
    query: { enabled: signedIn },
  });

  return (
    <MethodCard
      testId="method-getClaimHistory"
      name="getClaimHistory"
      mutability="view"
      description="Claim history — your past pool-reward claims, newest first. Sign in once; pick a pool above to narrow it, or leave it to see every pool. Enigma-only."
      wide
    >
      {!enigmaActive ? (
        <ResultNote testId="claim-history-gate">Switch to Enigma (HyperEVM) to read your claim history.</ResultNote>
      ) : !signedIn ? (
        <SignInNote testId="claim-history-idle" buttonTestId="claim-history-sign-in">
          Sign in to read your claim history.
        </SignInNote>
      ) : history.error ? (
        <ResultError kind={history.error.kind} message={history.error.message} testId="claim-history-error" />
      ) : (
        <DataTable
          testId="claim-history-table"
          columns={COLUMNS}
          data={history.data?.items ?? []}
          getRowId={(row) => row.claimRequestId}
          defaultPageSize={10}
          emptyMessage={history.isPending ? "Loading your claims…" : "No claims yet."}
        />
      )}
    </MethodCard>
  );
}
