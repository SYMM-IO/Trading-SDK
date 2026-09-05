"use client";

import { ResultError, ResultNote } from "@/components/result";
import { ListingDepositChainId, ListingMarketStatus, type ListingMarketSortField } from "@symmio/trading-core";
import { useListingMarkets, useSupportsListingService } from "@symmio/trading-react";
import { DataTable } from "@symmio/ui/components/data-table";
import { Pagination } from "@symmio/ui/components/pagination";
import { SearchInput } from "@symmio/ui/components/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@symmio/ui/components/select";
import { useCallback, useMemo, useState } from "react";
import { MethodCard } from "../inspector/method-card";
import { DEPOSIT_CHAIN_LABELS, LISTING_STATUS_DISPLAY } from "./format-listing-value";
import { listingMarketColumns } from "./listing-market-columns";
import { useDebouncedValue } from "./use-debounced-value";

/** Page sizes the catalog offers. The service caps `limit` at 100. */
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100] as const;

/** Sentinel for the "no filter" option — Radix Select cannot hold an empty value. */
const ANY = "any";

const CHAIN_OPTIONS = Object.entries(DEPOSIT_CHAIN_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const STATUS_OPTIONS = Object.entries(LISTING_STATUS_DISPLAY).map(([value, display]) => ({
  value,
  label: display.label,
}));

/**
 * The listing catalog end to end: `useListingMarkets` drives one table whose
 * search, chain and status filters, sorting, and pagination are **all**
 * server-side.
 *
 * That is the point worth showing. Every control below changes the request, not
 * a client-side view of an already-fetched array — so the row count in the
 * footer is the true match count across the whole catalog, not the length of
 * whatever page happens to be loaded.
 */
export function PoolsConsole() {
  const [search, setSearch] = useState("");
  const [chainId, setChainId] = useState<string>(ANY);
  const [status, setStatus] = useState<string>(ANY);
  const [sortBy, setSortBy] = useState<ListingMarketSortField | undefined>("tvl");
  const [orderBy, setOrderBy] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(5);

  const debouncedSearch = useDebouncedValue(search);

  /**
   * The listing backend is chain-level, so a chain without one has no catalogue
   * at all. Gate the query rather than letting it resolve and throw
   * `LISTING_NOT_CONFIGURED` on every render.
   */
  const supported = useSupportsListingService();

  const { data, isPending, isFetching, error } = useListingMarkets({
    search: debouncedSearch === "" ? undefined : debouncedSearch,
    chainIds: chainId === ANY ? undefined : [Number(chainId) as ListingDepositChainId],
    marketStatus: status === ANY ? undefined : (status as ListingMarketStatus),
    sortBy,
    orderBy,
    limit: pageSize,
    offset: (page - 1) * pageSize,
    query: { enabled: supported, placeholderData: (previous) => previous },
  });

  /**
   * Toggling the active column flips direction; a new column starts descending.
   *
   * Both `set` calls sit at the top level of the handler rather than inside a
   * state updater — an updater must stay pure, and StrictMode's double-invoke
   * would otherwise flip the direction twice.
   */
  const handleSort = useCallback(
    (field: ListingMarketSortField) => {
      setOrderBy(field === sortBy && orderBy === "desc" ? "asc" : "desc");
      setSortBy(field);
      setPage(1);
    },
    [sortBy, orderBy],
  );

  /** Any control that changes the result set must send the reader back to page 1. */
  function resetTo<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value);
      setPage(1);
    };
  }

  const columns = useMemo(
    () => listingMarketColumns({ sortBy, orderBy, onSort: handleSort }),
    [sortBy, orderBy, handleSort],
  );

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <MethodCard
      testId="pools-catalog"
      name="useListingMarkets"
      mutability="view"
      description="Search, filter, sort and page the permissionless-listing catalog. Every control is server-side."
      wide
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput
            value={search}
            onChange={(event) => resetTo(setSearch)(event.target.value)}
            placeholder="Ticker, name or contract address"
            aria-label="Search pools"
            data-testid="pools-search"
            containerClassName="sm:max-w-xs"
          />
          <Select value={chainId} onValueChange={resetTo(setChainId)}>
            <SelectTrigger className="sm:w-40" aria-label="Filter by chain" data-testid="pools-chain-filter">
              <SelectValue placeholder="Any chain" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any chain</SelectItem>
              {CHAIN_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={resetTo(setStatus)}>
            <SelectTrigger className="sm:w-44" aria-label="Filter by status" data-testid="pools-status-filter">
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
          <span
            className="text-muted-foreground ml-auto text-xs tabular-nums"
            aria-live="polite"
            data-testid="pools-total"
          >
            {!supported ? "Unavailable" : isPending ? "Loading…" : `${total.toLocaleString()} pools`}
            {!isPending && isFetching ? " · refreshing" : ""}
          </span>
        </div>

        {!supported ? (
          <ResultNote testId="pools-unsupported">
            The connected chain&rsquo;s solver does not use the listing backend, so it has no pool catalogue.
          </ResultNote>
        ) : error ? (
          <ResultError kind={error.kind} message={error.message} testId="pools-error" />
        ) : (
          <>
            <DataTable
              testId="pools-table"
              columns={columns}
              data={rows}
              getRowId={(row) => `${row.chainId}:${row.contractAddress}`}
              rowAttributes={(row) => ({ "data-contract-address": row.contractAddress })}
              hidePagination
              emptyMessage={isPending ? "Loading the catalog…" : "No pools match these filters."}
            />
            <Pagination
              page={page}
              pageCount={pageCount}
              pageSize={pageSize}
              total={total}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onPageChange={setPage}
              onPageSizeChange={resetTo(setPageSize)}
              testId="pools"
            />
          </>
        )}
      </div>
    </MethodCard>
  );
}
