"use client";

import { ResultError, ResultNote } from "@/components/result";
import { ListingMarketStatus, type UserListingMarket } from "@symmio/trading-core";
import { useUserListingMarkets } from "@symmio/trading-react";
import { Badge } from "@symmio/ui/components/badge";
import { Button } from "@symmio/ui/components/button";
import { DataTable, type DataTableColumn } from "@symmio/ui/components/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@symmio/ui/components/select";
import { Spinner } from "@symmio/ui/components/spinner";
import { useMemo, useState } from "react";
import { MethodCard } from "../inspector/method-card";
import { useSolverKindActive } from "../solvers/solver-target";
import { formatListingUsd, formatSharePercentage, LISTING_STATUS_DISPLAY } from "./format-listing-value";
import { useListingAuth } from "./listing-auth-context";
import { SignInNote } from "./sign-in-note";

/** Sentinel for the "all statuses" option — Radix Select cannot hold an empty value. */
const ANY = "any";

/** Status filter options, from the shared status display map. */
const STATUS_OPTIONS = Object.entries(LISTING_STATUS_DISPLAY).map(([value, display]) => ({
  value,
  label: display.label,
}));

/** Columns for the "Your Pools" table: the token, its lifecycle status, plus the user's position in each pool. */
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
      id: "status",
      header: "Status",
      cell: (row) => {
        const display = LISTING_STATUS_DISPLAY[row.marketStatus];
        return <Badge variant={display?.variant ?? "outline"}>{display?.label ?? row.marketStatus}</Badge>;
      },
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
 * "Your Pools" — every listing market that generated a deposit address for the
 * signed-in wallet, **whatever its lifecycle status** (live, awaiting deposit,
 * under review, rejected, delisted), each row enriched with the user's deposit,
 * pool share, and accrued revenue.
 *
 * Defaults to all statuses; the status filter at the top narrows the read — pick
 * **Rejected** to find markets you can refund or retry. The bearer token comes
 * from the shared {@link useListingAuth} session, so the user signs in **once**
 * and this card reuses it: "Refresh" re-reads with the held token via `refetch()`
 * instead of prompting a new signature.
 *
 * Enigma-only: the listing backend lives on HyperEVM, so the card is gated on
 * Enigma being the active solver, mirroring the listing-auth card.
 */
export function YourPoolsCard() {
  const enigmaActive = useSolverKindActive("enigma");
  const { accessToken, error: authError } = useListingAuth();
  const [status, setStatus] = useState<string>(ANY);

  const pools = useUserListingMarkets({
    accessToken: accessToken ?? "",
    marketStatus: status === ANY ? undefined : (status as ListingMarketStatus),
    limit: 25,
  });

  const columns = useMemo(() => userPoolColumns(), []);
  const rows = pools.data?.items ?? [];

  return (
    <MethodCard
      testId="method-getUserListingMarkets"
      name="useUserListingMarkets"
      mutability="view"
      description="Your Pools — every listing market that generated a deposit address for the signed-in wallet, of any status, with your deposit, share and revenue. Filter by status (e.g. Rejected) at the top. Sign in once, then the table loads. Enigma-only."
      wide
    >
      {!enigmaActive ? (
        <ResultNote testId="your-pools-gate">Switch to Enigma (HyperEVM) to sign in and load your pools.</ResultNote>
      ) : authError ? (
        <ResultError kind={authError.kind} message={authError.message} testId="your-pools-auth-error" />
      ) : !accessToken ? (
        <SignInNote testId="your-pools-idle" buttonTestId="your-pools-sign-in">
          Sign in to load the pools that hold a deposit address for your wallet.
        </SignInNote>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="sm:w-44" aria-label="Filter by status" data-testid="your-pools-status-filter">
                <SelectValue placeholder="Any status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any status</SelectItem>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <RefreshButton fetching={pools.isFetching} onRefresh={() => void pools.refetch()} />
            {pools.isFetching ? (
              <span
                className="text-muted-foreground flex items-center gap-2 text-xs"
                data-testid="your-pools-refreshing"
              >
                <Spinner className="size-4" /> Loading…
              </span>
            ) : null}
          </div>

          {pools.error ? (
            <ResultError kind={pools.error.kind} message={pools.error.message} testId="your-pools-error" />
          ) : rows.length === 0 && !pools.isFetching ? (
            <ResultNote testId="your-pools-empty">
              {status === ANY
                ? "No pools with a deposit address for this wallet yet."
                : `No ${LISTING_STATUS_DISPLAY[status as ListingMarketStatus]?.label ?? status} pools for this wallet.`}
            </ResultNote>
          ) : (
            <DataTable
              testId="your-pools-table"
              columns={columns}
              data={rows}
              getRowId={(row) => `${row.chainId}:${row.contractAddress}`}
              rowAttributes={(row) => ({ "data-contract-address": row.contractAddress })}
              hidePagination
              maxVisibleRows={5}
              emptyMessage="Loading your pools…"
            />
          )}
        </div>
      )}
    </MethodCard>
  );
}

/** Re-read with the held token — no new signature. */
function RefreshButton({ fetching, onRefresh }: { fetching: boolean; onRefresh: () => void }) {
  return (
    <Button
      type="button"
      size="xs"
      variant="outline"
      disabled={fetching}
      onClick={onRefresh}
      data-testid="your-pools-refresh"
    >
      Refresh
    </Button>
  );
}
