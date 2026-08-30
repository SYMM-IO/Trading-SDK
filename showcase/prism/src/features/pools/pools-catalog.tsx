"use client";

import { Button } from "@/components/button";
import { Combobox, type ComboboxOption } from "@/components/combobox";
import { MicroLabel, Panel, PanelHeader } from "@/components/panel";
import { SearchInput } from "@/components/search-input";
import { Segmented, type SegmentedOption } from "@/components/segmented";
import { DataTable, EmptyState, SkeletonRows } from "@/components/table";
import { cn } from "@/lib/cn";
import { ListingMarketStatus, type ListingDepositChainId, type ListingMarket } from "@symmio/trading-core";
import { useListingMarkets } from "@symmio/trading-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import {
  CATALOG_SORT_LABELS,
  DEFAULT_CATALOG_SORT,
  nextCatalogSort,
  type CatalogSort,
  type CatalogSortField,
} from "./catalog-sort";
import { DEPOSIT_CHAIN_LABELS, LISTING_STATUS_DISPLAY, poolKey } from "./listing-values";
import { POOL_COLUMNS, PoolRow } from "./pool-row";
import { POOLS_CHAIN_ID, POOLS_DEPLOYMENT, usePoolsSupported } from "./pools-deployment";
import { useDebouncedValue } from "./use-debounced-value";

/** The chain filter's "no narrowing" value. Combobox values are strings. */
const ANY_CHAIN = "any";

/** The status filter's "no narrowing" value. */
const ANY_STATUS = "any";

/** Status filter: one lifecycle stage, or the whole pipeline. */
type StatusFilter = ListingMarketStatus | typeof ANY_STATUS;

/**
 * Page sizes offered in the footer.
 *
 * `100` is the top option because the service caps `limit` there — asking for
 * more silently returns a hundred rows, so the ceiling is the backend's, not a
 * layout preference.
 */
const PAGE_SIZE_OPTIONS: readonly ComboboxOption<string>[] = [10, 25, 50, 100].map((size) => ({
  value: String(size),
  label: `${size} rows`,
}));

export interface PoolsCatalogProps {
  /** Open the listing form — the one place in Prism a market is created. */
  onCreate: () => void;
  /**
   * A quiet affordance for the panel header, rendered before the search box.
   *
   * It is a slot rather than something this panel decides for itself because
   * the catalog is the public, wallet-free half of Pools: giving it a listing
   * session to read would make the one component that needs no auth depend on
   * it. The screen above knows whether there is a wallet worth linking to.
   */
  aside?: ReactNode;
}

/**
 * The pool catalog: every listing the service knows about, at every stage.
 *
 * The whole panel is one server-side query. Search, chain, status, sort and
 * paging each change the **request**, not a client-side view of an already
 * fetched array — the opposite of the Markets screen, which pulls both books
 * once and sorts them in memory. Nothing below filters or reorders `items`, and
 * the count in the filter bar is the service's match total across the catalog
 * rather than the length of the page on screen.
 */
export function PoolsCatalog({ onCreate, aside }: PoolsCatalogProps) {
  const router = useRouter();
  const supported = usePoolsSupported();

  const [searchInput, setSearchInput] = useState("");
  const [chain, setChain] = useState<string>(ANY_CHAIN);
  const [status, setStatus] = useState<StatusFilter>(ANY_STATUS);
  const [sort, setSort] = useState<CatalogSort>(DEFAULT_CATALOG_SORT);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  /* Trimmed before the debounce so a trailing space is not its own request. */
  const search = useDebouncedValue(searchInput.trim());
  const offset = (page - 1) * pageSize;

  const markets = useListingMarkets({
    search: search.length > 0 ? search : undefined,
    chainIds: chain === ANY_CHAIN ? undefined : [Number(chain) as ListingDepositChainId],
    marketStatus: status === ANY_STATUS ? undefined : status,
    sortBy: sort.field,
    orderBy: sort.direction,
    limit: pageSize,
    offset,
    /* Addressed to the pools chain by id, whatever chain the wallet sits on,
       and gated on the registry actually carrying a listing backend for it —
       ungated, the hook throws LISTING_NOT_CONFIGURED instead of staying idle.
       `placeholderData` keeps the previous page rendered while the next one
       loads, so a keystroke or a sort never blanks the table. */
    chainId: POOLS_CHAIN_ID,
    query: { enabled: supported, placeholderData: (previous) => previous },
  });

  const items = markets.data?.items ?? [];
  const total = markets.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const hasNext = offset + items.length < total;
  const isNarrowed = search.length > 0 || chain !== ANY_CHAIN || status !== ANY_STATUS;

  /* A fetch with a page already on screen is a refresh, not a load: it earns a
     word in the count line, never the skeletons. */
  const isRefreshing = markets.isFetching && !markets.isPending;

  const chainOptions = useMemo<ComboboxOption<string>[]>(() => {
    /* No tone dot on these rows: a flat Combobox option is text only, and the
       chain's color is already carried by each row's accent stripe. */
    const chains = Object.entries(DEPOSIT_CHAIN_LABELS)
      .map(([id, label]) => ({ value: id, label, keywords: id }))
      .sort((left, right) => left.label.localeCompare(right.label));
    return [{ value: ANY_CHAIN, label: "Any chain" }, ...chains];
  }, []);

  const statusOptions = useMemo<SegmentedOption<StatusFilter>[]>(
    () => [
      { value: ANY_STATUS, label: "Any status" },
      ...Object.values(ListingMarketStatus).map((value) => ({ value, label: LISTING_STATUS_DISPLAY[value].label })),
    ],
    [],
  );

  /* Every control resets to the first page, and both writes happen here in
     render scope rather than inside a `setState` updater: the flipped direction
     is derived from the sort React has already rendered, so the two writes
     describe one click and nothing re-derives the flip a second time. */
  function handleSearch(value: string) {
    setSearchInput(value);
    setPage(1);
  }

  function handleChain(value: string) {
    setChain(value);
    setPage(1);
  }

  function handleStatus(value: StatusFilter) {
    setStatus(value);
    setPage(1);
  }

  function handleSort(field: CatalogSortField) {
    setSort(nextCatalogSort(sort, field));
    setPage(1);
  }

  function handlePageSize(value: string) {
    setPageSize(Number(value));
    setPage(1);
  }

  function handleOpen(row: ListingMarket) {
    router.push(`/pools/${row.chainId}/${encodeURIComponent(row.contractAddress)}`);
  }

  /* A failed *background* refetch keeps the page that is already on screen:
     `placeholderData` means those rows are a real answer the service gave, and
     replacing them with an error would throw away good data to report that the
     next request did not land. The error still gets said — above the rows. */
  const hasRows = items.length > 0;

  const state = !supported
    ? "unsupported"
    : markets.error && !hasRows
      ? "error"
      : markets.isPending
        ? "loading"
        : !hasRows
          ? "empty"
          : "rows";

  const countLabel = markets.error
    ? "Catalog unavailable"
    : markets.data
      ? `${total.toLocaleString("en-US")} ${total === 1 ? "pool" : "pools"} match`
      : "Reading the catalog…";

  /* Page two and beyond can land past the end of a catalog that shrank under a
     refetch, and the footer that would page back is hidden along with the rows —
     so the empty state has to carry the way out itself. */
  const isPastEnd = page > 1;

  const emptyTitle = isPastEnd
    ? "Nothing on this page."
    : isNarrowed
      ? "Nothing matches those filters."
      : "No pools listed yet.";

  const emptyBody = isPastEnd
    ? `Fewer pools match now than when page ${page} was opened.`
    : isNarrowed
      ? "The service does the matching, so this is the whole catalog answering — not a page that happens to be empty. Clear the search or widen the chain and status filters."
      : `Nothing has been listed on ${POOLS_DEPLOYMENT.chainName} yet. A lowcap market starts here: somebody lists a token, funds its pool, and the solver quotes against it.`;

  const firstRow = (offset + 1).toLocaleString("en-US");
  const lastRow = (offset + items.length).toLocaleString("en-US");
  const rangeLabel = `${firstRow}–${lastRow} of ${total.toLocaleString("en-US")}`;

  const head = (
    <>
      <MicroLabel>Pool</MicroLabel>
      <MicroLabel>Chain</MicroLabel>
      <MicroLabel>Status</MicroLabel>
      <SortHeader field="tvl" sort={sort} onSort={handleSort} />
      <SortHeader field="vol24h" sort={sort} onSort={handleSort} />
      <SortHeader field="liquidity" sort={sort} onSort={handleSort} />
      <SortHeader field="market_cap" sort={sort} onSort={handleSort} />
      <SortHeader field="open_interest" sort={sort} onSort={handleSort} />
      <SortHeader field="apr" sort={sort} onSort={handleSort} />
      {/* Max leverage is not one of the service's sort keys, so it stays a plain
          head rather than a control that would send an unknown `sort_by`. */}
      <MicroLabel className="text-right">Max lev.</MicroLabel>
      <SortHeader field="listing_time" sort={sort} onSort={handleSort} />
    </>
  );

  return (
    <Panel>
      <PanelHeader
        eyebrow="Listing catalog"
        title="Pools"
        actions={
          <>
            {aside}
            <SearchInput
              value={searchInput}
              onChange={handleSearch}
              placeholder="Search ticker, name or contract address"
              ariaLabel="Search pools"
              className="w-[268px]"
            />
            <Button variant="primary" size="sm" onClick={onCreate}>
              List a token
            </Button>
          </>
        }
      />

      {supported ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-subtle px-4 py-2.5">
          <Combobox<string>
            label="Deposit chain"
            value={chain}
            onChange={handleChain}
            options={chainOptions}
            searchable
            searchPlaceholder="Filter chains…"
            size="sm"
            menuWidth={200}
          />
          <Segmented<StatusFilter> options={statusOptions} value={status} onChange={handleStatus} size="sm" />
          <p className="ml-auto text-2xs text-fg-3">
            <span className="tnum">{countLabel}</span>
            {isRefreshing ? <span className="pl-1.5">· refreshing</span> : null}
          </p>
        </div>
      ) : null}

      {/* The rows below are a real answer the service gave; this says the NEXT
          request did not land. Two different facts, so two different places —
          replacing the table with the error would delete the good page. */}
      {markets.error && hasRows ? (
        <p className="border-b border-line-subtle bg-warn-bg px-4 py-2 text-2xs text-fg-1">
          Showing the last page that loaded — the catalog did not answer the latest request.{" "}
          <span className="font-mono text-fg-2">{markets.error.message}</span>
        </p>
      ) : null}

      <DataTable columns={POOL_COLUMNS} head={head}>
        {state === "unsupported" ? (
          <EmptyState
            title="No pool catalog on this chain"
            body={`The SDK registry in this build carries no listing service for ${POOLS_DEPLOYMENT.chainName}, so there is no catalog to page through. This does not follow the wallet — every read here is addressed to that chain by id.`}
          />
        ) : null}

        {state === "error" ? <EmptyState title="The catalog did not answer" body={markets.error?.message} /> : null}

        {state === "loading" ? <SkeletonRows columns={POOL_COLUMNS} cells={11} rows={5} /> : null}

        {state === "empty" ? (
          <EmptyState
            title={emptyTitle}
            body={emptyBody}
            action={
              isPastEnd ? (
                <Button variant="secondary" size="sm" onClick={() => setPage(1)}>
                  Back to the first page
                </Button>
              ) : isNarrowed ? null : (
                <Button variant="primary" size="sm" onClick={onCreate}>
                  List a token
                </Button>
              )
            }
          />
        ) : null}

        {state === "rows"
          ? items.map((row) => (
              <PoolRow key={poolKey(row.chainId, row.contractAddress)} row={row} onOpen={handleOpen} />
            ))
          : null}
      </DataTable>

      {state === "rows" ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          {/* The total is the service's, not `items.length`: the page on screen
              is one window onto it. */}
          <span className="text-xs text-fg-3">
            Showing <span className="tnum">{rangeLabel}</span> {total === 1 ? "pool" : "pools"}
          </span>
          <Combobox<string>
            label="Rows per page"
            value={String(pageSize)}
            onChange={handlePageSize}
            options={PAGE_SIZE_OPTIONS}
            size="sm"
            menuWidth={140}
          />
          <div className="ml-auto flex items-center gap-2">
            <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <span className="tnum text-2xs text-fg-3">
              Page {page} of {pageCount}
            </span>
            <Button variant="secondary" size="sm" disabled={!hasNext} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

interface SortHeaderProps {
  field: CatalogSortField;
  sort: CatalogSort;
  onSort: (field: CatalogSortField) => void;
}

/**
 * A column head that changes the request.
 *
 * Every sortable column in this table is a figure, so they are all right
 * aligned. The caret shows only on the active column: the others are sortable
 * but not sorted, and a row of carets would say nothing about which key the
 * service actually ordered by.
 */
function SortHeader({ field, sort, onSort }: SortHeaderProps) {
  const active = sort.field === field;

  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={cn(
        "inline-flex cursor-pointer items-center justify-end gap-1 bg-transparent whitespace-nowrap",
        "transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)]",
        active ? "text-fg-1" : "text-fg-3 hover:text-fg-1",
      )}
    >
      <span className="text-2xs font-semibold tracking-[0.12em] uppercase">{CATALOG_SORT_LABELS[field]}</span>
      {active ? <Caret direction={sort.direction} /> : null}
    </button>
  );
}

/** Sort caret. Points the way the service ordered the page. */
function Caret({ direction }: { direction: CatalogSort["direction"] }) {
  return (
    <svg aria-hidden viewBox="0 0 8 5" className={cn("size-2 shrink-0", direction === "asc" ? "rotate-180" : null)}>
      <path d="M0 0h8L4 5z" fill="currentColor" />
    </svg>
  );
}
