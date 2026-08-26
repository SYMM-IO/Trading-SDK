"use client";

import { ResultError, ResultNote } from "@/components/result";
import { ListingMarketStatus, type UserListingMarket } from "@symmio/trading-core";
import { useUserListingMarkets } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { DataTable, type DataTableColumn } from "@symmio/ui/components/data-table";
import { Spinner } from "@symmio/ui/components/spinner";
import { useMemo } from "react";
import { MethodCard } from "../inspector/method-card";
import { useSolverKindActive } from "../solvers/solver-target";
import { formatListingUsd, formatSharePercentage } from "./format-listing-value";
import { useListingAuth } from "./listing-auth-context";

/** Columns for the "Your Pools" table: the token plus the user's position in each pool. */
function userPoolColumns(): DataTableColumn<UserListingMarket>[] {
  return [
    {
      id: "pool",
      header: "Pool",
      widthClassName: "min-w-52",
      cell: (row) => (
        <span className="flex flex-col leading-tight">
          <span className="text-foreground font-medium">{row.tokenTicker}</span>
          <span className="text-muted-foreground/80 truncate text-[0.7rem]" title={row.tokenName}>
            {row.tokenName}
          </span>
        </span>
      ),
    },
    {
      id: "tvl",
      header: "TVL",
      align: "end",
      widthClassName: "min-w-24",
      cell: (row) => formatListingUsd(row.tvl),
      cellClassName: "text-muted-foreground font-mono",
    },
    {
      id: "userDeposit",
      header: "Your deposit",
      align: "end",
      widthClassName: "min-w-28",
      cell: (row) => formatListingUsd(row.userDeposit),
      cellClassName: "text-foreground font-mono",
    },
    {
      id: "userSharePercentage",
      header: "Your share",
      align: "end",
      widthClassName: "min-w-24",
      cell: (row) => formatSharePercentage(row.userSharePercentage),
      cellClassName: "text-foreground font-mono",
    },
    {
      id: "userRevenue",
      header: "Your revenue",
      align: "end",
      widthClassName: "min-w-28",
      cell: (row) => formatListingUsd(row.userRevenue),
      cellClassName: "text-foreground font-mono",
    },
  ];
}

/**
 * "Your Pools" — the listing markets that generated a deposit address for the
 * signed-in wallet, deposited or not, each row enriched with the user's deposit,
 * pool share, and accrued revenue.
 *
 * The bearer token comes from the shared {@link useListingAuth} session, so the
 * user signs in **once** (here or on the sign-in card) and this card reuses it:
 * "Refresh your pools" re-reads with the held token via `refetch()` instead of
 * prompting a new signature. The token gates the read — `useUserListingMarkets`
 * stays idle until it is set — so the card reads nothing before sign-in.
 *
 * Enigma-only: the listing backend lives on HyperEVM, so the sign-in button is
 * gated on Enigma being the active solver, mirroring the listing-auth card.
 */
export function YourPoolsCard() {
  const enigmaActive = useSolverKindActive("enigma");
  const { accessToken, signIn, isSigningIn, error: authError } = useListingAuth();

  const pools = useUserListingMarkets({
    accessToken: accessToken ?? "",
    marketStatus: ListingMarketStatus.LISTED,
    limit: 25,
  });

  const columns = useMemo(() => userPoolColumns(), []);
  const rows = pools.data?.items ?? [];

  return (
    <MethodCard
      testId="method-getUserListingMarkets"
      name="useUserListingMarkets"
      mutability="view"
      description="Your Pools — the listing markets that generated a deposit address for the signed-in wallet, with your deposit, share and revenue. Sign in once, then the table loads. Enigma-only."
      wide
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={!enigmaActive || isSigningIn || (accessToken !== null && pools.isFetching)}
          onClick={() => (accessToken !== null ? void pools.refetch() : signIn())}
          data-testid="your-pools-sign-in"
        >
          {isSigningIn ? (
            <>
              <Spinner className="size-4" /> Signing in...
            </>
          ) : accessToken ? (
            "Refresh your pools"
          ) : (
            "Sign in & load your pools"
          )}
        </Button>
        {accessToken && pools.isFetching && !isSigningIn ? (
          <span className="text-muted-foreground flex items-center gap-2 text-xs" data-testid="your-pools-refreshing">
            <Spinner className="size-4" /> Loading…
          </span>
        ) : null}
      </div>

      {!enigmaActive ? (
        <ResultNote testId="your-pools-gate">Switch to Enigma (HyperEVM) to sign in and load your pools.</ResultNote>
      ) : authError ? (
        <ResultError kind={authError.kind} message={authError.message} testId="your-pools-auth-error" />
      ) : !accessToken ? (
        <ResultNote testId="your-pools-idle">
          Sign in to load the pools that hold a deposit address for your wallet.
        </ResultNote>
      ) : pools.error ? (
        <ResultError kind={pools.error.kind} message={pools.error.message} testId="your-pools-error" />
      ) : rows.length === 0 && !pools.isFetching ? (
        <ResultNote testId="your-pools-empty">No pools with a deposit address for this wallet yet.</ResultNote>
      ) : (
        <DataTable
          testId="your-pools-table"
          columns={columns}
          data={rows}
          getRowId={(row) => `${row.chainId}:${row.contractAddress}`}
          rowAttributes={(row) => ({ "data-contract-address": row.contractAddress })}
          hidePagination
          emptyMessage={
            pools.isFetching ? "Loading your pools…" : "No pools with a deposit address for this wallet yet."
          }
        />
      )}
    </MethodCard>
  );
}
