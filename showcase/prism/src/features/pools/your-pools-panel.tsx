"use client";

import { Button } from "@/components/button";
import { Combobox, type ComboboxOption } from "@/components/combobox";
import { MicroLabel, Panel, PanelHeader } from "@/components/panel";
import { Pill } from "@/components/pill";
import { SearchInput } from "@/components/search-input";
import { Segmented, type SegmentedOption } from "@/components/segmented";
import { DataRow, DataTable, EmptyState, Skeleton, SkeletonRows } from "@/components/table";
import { Numeric } from "@/components/value";
import { cn } from "@/lib/cn";
import {
  getUserProfitQueryOptions,
  ListingMarketStatus,
  type ListingDepositChainId,
  type UserListingMarket,
  type UserPoolProfit,
} from "@symmio/trading-core";
import { useSymmioConfig, useUserListingMarkets } from "@symmio/trading-react";
import { useQueries, type UseQueryOptions } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  CATALOG_SORT_LABELS,
  DEFAULT_CATALOG_SORT,
  nextCatalogSort,
  type CatalogSort,
  type CatalogSortField,
} from "./catalog-sort";
import { ClaimRewardsModal, type ClaimRewardsModalProps } from "./claim-rewards-modal";
import { ListingStatusPill } from "./listing-chips";
import { useListingSession } from "./listing-session";
import { ListingSignIn, ListingSignInPrompt } from "./listing-sign-in";
import {
  ABSENT,
  DEPOSIT_CHAIN_LABELS,
  depositChainColor,
  depositChainLabel,
  LISTING_STATUS_DISPLAY,
  listingDate,
  listingRate,
  listingReward,
  listingUsd,
  poolKey,
  rateTone,
  sharePercent,
} from "./listing-values";
import { POOLS_CHAIN_ID, POOLS_DEPLOYMENT, usePoolsSupported } from "./pools-deployment";
import { useDebouncedValue } from "./use-debounced-value";

/** The chain filter's "no narrowing" value. Combobox values are strings. */
const ANY_CHAIN = "any";

/** The status filter's "no narrowing" value. */
const ANY_STATUS = "any";

/** Status filter: one lifecycle stage, or the whole pipeline. */
type StatusFilter = ListingMarketStatus | typeof ANY_STATUS;

/** What the claim modal needs to address one pool, borrowed from its own props. */
type ClaimTarget = ClaimRewardsModalProps["pool"];

/**
 * Page sizes offered in the footer.
 *
 * The public catalog offers `100` because the service caps `limit` there. This
 * table stops at `50` on purpose: every row on screen costs one extra authed
 * request for its claimable balance (see the fan-out below), so the page size
 * is also the fan-out width. Fifty is already more pools than any LP holds;
 * a hundred would double the request burst to buy a scroll nobody takes.
 */
const PAGE_SIZE_OPTIONS: readonly ComboboxOption<string>[] = [10, 25, 50].map((size) => ({
  value: String(size),
  label: `${size} rows`,
}));

/**
 * Column template.
 *
 * Two groups, left to right: what the pool is, then what it is to you. Every
 * track carries a floor so a long token name cannot shift the money columns out
 * from under the eye, and the trailing action sizes to its own content.
 */
const YOUR_POOL_COLUMNS =
  "minmax(176px,2fr) minmax(104px,min-content) minmax(124px,min-content) minmax(88px,0.9fr) minmax(76px,0.8fr) minmax(84px,0.8fr) minmax(112px,1fr) minmax(84px,0.8fr) minmax(112px,1fr) minmax(116px,1fr) minmax(84px,min-content)";

/**
 * The secondary Button, worn by a `Link`.
 *
 * A control that navigates has to be a real anchor — `Button` renders a
 * `<button>` and takes no `href`, and `cn` is a plain join rather than
 * tailwind-merge, so a `className` handed to a Button could not repaint one
 * either. The classes are therefore spelled out, matching `Button`’s `sm`
 * secondary dress; `market-row.tsx` carries the same string for the same
 * reason. Both places that need it in this file read it from here.
 */
const SECONDARY_LINK =
  "inline-flex h-7 cursor-pointer items-center justify-center rounded-sm border border-line bg-bg-2 px-3 text-sm font-semibold whitespace-nowrap text-fg-0 transition-all duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:border-line-strong hover:bg-bg-3";

/**
 * The pools this wallet is an LP in.
 *
 * The authed twin of the catalog: same rows, same units, same server-side
 * search / filter / sort / paging — plus the four user-scoped figures the
 * public list cannot carry. A row exists here the moment a pool mints this
 * wallet a deposit address — **before** any deposit — so the list is "pools you
 * have opened a door to", not "pools holding your money", and the status column
 * is what tells the two apart. That is why the status filter opens on *Any*:
 * narrowing to listed pools hides exactly the rows an LP is waiting on.
 *
 * ## Why the claimable column costs a request per row
 *
 * `UserListingMarket` carries `userDeposit`, `userSharePercentage` and
 * `userRevenue`, but **not** `claimableReward` — revenue is what the position
 * has earned over its life, and claimable is what is left unclaimed right now.
 * The only endpoint that answers the second is the per-pool `getUserProfit`,
 * so the column is a fan-out over the page: one query per visible row, run
 * through `useQueries` because a hook cannot be called in a loop. It is bounded
 * by the page size for that reason, and paging is server-side so the bound
 * holds however large the portfolio gets.
 *
 * Without it the Claim button would have to appear on every row and then
 * discover, inside the modal, that there is nothing to claim.
 */
export function YourPoolsPanel() {
  const router = useRouter();
  const config = useSymmioConfig();
  const supported = usePoolsSupported();
  const { accessToken, isSignedIn } = useListingSession();

  const [searchInput, setSearchInput] = useState("");
  const [chain, setChain] = useState<string>(ANY_CHAIN);
  const [status, setStatus] = useState<StatusFilter>(ANY_STATUS);
  const [sort, setSort] = useState<CatalogSort>(DEFAULT_CATALOG_SORT);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [claimTarget, setClaimTarget] = useState<ClaimTarget | null>(null);

  /* Trimmed before the debounce so a trailing space is not its own request. */
  const search = useDebouncedValue(searchInput.trim());
  const offset = (page - 1) * pageSize;
  const enabled = supported && isSignedIn;

  /* Addressed to the pools chain explicitly, like every read on this surface:
     the listing backend hangs off the chain config, not off the wallet, so this
     answers the same whatever network the wallet is parked on. `placeholderData`
     keeps the page on screen while the next one loads, so a keystroke, a sort or
     a page turn never blanks the table. */
  const markets = useUserListingMarkets({
    accessToken,
    search: search.length > 0 ? search : undefined,
    chainIds: chain === ANY_CHAIN ? undefined : [Number(chain) as ListingDepositChainId],
    marketStatus: status === ANY_STATUS ? undefined : status,
    sortBy: sort.field,
    orderBy: sort.direction,
    limit: pageSize,
    offset,
    chainId: POOLS_CHAIN_ID,
    query: { enabled, placeholderData: (previous) => previous },
  });

  const items = markets.data?.items ?? [];
  const total = markets.data?.total ?? 0;

  /* One claimable read per visible row, index-parallel with `items`.
     `getUserProfitQueryOptions` is the core factory behind `useUserProfit`, and
     unlike the hook it does **not** self-gate on a non-empty token — the hook
     adds that. So the gate is written out here; without it a signed-out render
     would fire a burst of unauthenticated requests. */
  const profits = useQueries({
    queries: items.map(
      (row) =>
        getUserProfitQueryOptions(config, {
          accessToken,
          tokenContractAddress: row.contractAddress,
          chainId: POOLS_CHAIN_ID,
          query: { enabled: enabled && accessToken.length > 0 },
        }) as UseQueryOptions<UserPoolProfit, Error, UserPoolProfit, readonly unknown[]>,
    ),
  });

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const hasNext = offset + items.length < total;
  const hasRows = items.length > 0;
  const isNarrowed = search.length > 0 || chain !== ANY_CHAIN || status !== ANY_STATUS;

  /* A fetch with a page already on screen is a refresh, not a load: it earns a
     word in the count line, never the skeletons. */
  const isRefreshing = markets.isFetching && !markets.isPending;

  const chainOptions = useMemo<ComboboxOption<string>[]>(() => {
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

  const state = markets.error && !hasRows ? "error" : markets.isPending ? "loading" : !hasRows ? "empty" : "rows";

  const countLabel = markets.error
    ? "Your pools unavailable"
    : markets.data
      ? `${total.toLocaleString("en-US")} ${total === 1 ? "pool" : "pools"} match`
      : "Reading your pools…";

  /* Page two and beyond can land past the end of a list that shrank under a
     refetch, and the footer that would page back is hidden along with the rows —
     so the empty state has to carry the way out itself. */
  const isPastEnd = page > 1;

  const emptyTitle = isPastEnd
    ? "Nothing on this page."
    : isNarrowed
      ? "Nothing matches those filters."
      : "No pools under this wallet.";

  const emptyBody = isPastEnd
    ? `Fewer pools match now than when page ${page} was opened.`
    : isNarrowed
      ? "The service does the matching, so this is your whole list answering — not a page that happens to be empty. Clear the search or widen the chain and status filters."
      : "A pool appears here as soon as it generates a deposit address for you — funded or not. An empty list means none has, which is not the same as a deposit going missing.";

  const firstRow = (offset + 1).toLocaleString("en-US");
  const lastRow = (offset + items.length).toLocaleString("en-US");
  const rangeLabel = `${firstRow}–${lastRow} of ${total.toLocaleString("en-US")}`;

  const head = (
    <>
      <MicroLabel>Pool</MicroLabel>
      <MicroLabel>Chain</MicroLabel>
      <MicroLabel>Status</MicroLabel>
      <SortHeader field="tvl" sort={sort} onSort={handleSort} />
      <SortHeader field="apr" sort={sort} onSort={handleSort} />
      <SortHeader field="listing_time" sort={sort} onSort={handleSort} />
      {/* The four "your" columns are computed per caller and are not among the
          service's sort keys, so they stay plain heads rather than controls that
          would send an unknown `sort_by` and come back unsorted. */}
      <MicroLabel className="text-right">Your deposit</MicroLabel>
      <MicroLabel className="text-right">Your share</MicroLabel>
      <MicroLabel className="text-right">Your revenue</MicroLabel>
      <MicroLabel className="text-right">Claimable</MicroLabel>
      <MicroLabel className="text-right">Action</MicroLabel>
    </>
  );

  return (
    <>
      <Panel>
        <PanelHeader
          eyebrow="Listing service"
          title="Your pools"
          actions={
            /* No sign-in control on a chain with no listing backend: the SIWE
               exchange is addressed to the pools chain like every other read
               here, so offering it would only mint a LISTING_NOT_CONFIGURED. */
            supported ? (
              <>
                {isSignedIn ? (
                  <SearchInput
                    value={searchInput}
                    onChange={handleSearch}
                    placeholder="Search ticker, name or contract address"
                    ariaLabel="Search your pools"
                    className="w-[268px]"
                  />
                ) : null}
                <ListingSignIn />
              </>
            ) : null
          }
        />

        {!supported ? (
          <EmptyState
            title="No listing backend on this chain"
            body={`${POOLS_DEPLOYMENT.chainName} carries no listing block in the SDK’s chain registry, so there is no LP position to read. This panel stays idle rather than erroring.`}
          />
        ) : !isSignedIn ? (
          <ListingSignInPrompt>
            The listing backend identifies an LP by signature, not by address. Until you sign it cannot tell which pools
            are yours, so nothing personal loads.
          </ListingSignInPrompt>
        ) : (
          <>
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

            {/* The rows below are a real answer the service gave; this says the
                NEXT request did not land. Two different facts, so two different
                places — replacing the table with the error would delete a good
                page to report a failed refetch. */}
            {markets.error && hasRows ? (
              <p className="border-b border-line-subtle bg-warn-bg px-4 py-2 text-2xs text-fg-1">
                Showing the last page that loaded — the listing service did not answer the latest request.{" "}
                <span className="font-mono text-fg-2">{markets.error.message}</span>
              </p>
            ) : null}

            <DataTable columns={YOUR_POOL_COLUMNS} head={head}>
              {state === "error" ? (
                <EmptyState
                  title="Couldn’t load your pools"
                  body={markets.error?.message}
                  action={
                    <Button size="sm" variant="secondary" onClick={() => void markets.refetch()}>
                      Retry
                    </Button>
                  }
                />
              ) : null}

              {state === "loading" ? <SkeletonRows columns={YOUR_POOL_COLUMNS} rows={4} cells={11} /> : null}

              {/* The way out belongs to the empty state itself. With no rows
                  the table holds no other control, and a wallet that has never
                  deposited cannot reach a position from here without the
                  catalog — the one screen that lists pools it could open one
                  in. Secondary and not primary: while signed in, the view’s
                  single primary is whatever the reader came to do, and this is
                  an exit rather than that. A narrowed list is left without an
                  action on purpose, the way the catalog leaves its own: the
                  filters that emptied it are still on screen above, so the
                  remedy the body names is already in reach. */}
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
                      <Link href="/pools" className={SECONDARY_LINK}>
                        Browse the catalog
                      </Link>
                    )
                  }
                />
              ) : null}

              {state === "rows"
                ? items.map((row, index) => {
                    const profit = profits[index];
                    return (
                      <YourPoolRow
                        key={poolKey(row.chainId, row.contractAddress)}
                        row={row}
                        claimable={profit?.data?.claimableReward}
                        isClaimableLoading={profit?.isPending ?? false}
                        onOpen={() => router.push(`/pools/${row.chainId}/${encodeURIComponent(row.contractAddress)}`)}
                        onClaim={() =>
                          setClaimTarget({
                            tokenContractAddress: row.contractAddress,
                            depositChain: row.chainId,
                            tokenTicker: row.tokenTicker,
                            claimableReward: profit?.data?.claimableReward,
                          })
                        }
                      />
                    );
                  })
                : null}
            </DataTable>

            {state === "rows" ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                {/* The total is the service's, not `items.length`: the page on
                    screen is one window onto it. */}
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
          </>
        )}
      </Panel>

      {/* Mounted only while a pool is picked, so the modal never has to hold a
          placeholder position it would otherwise read a claimable balance for. */}
      {claimTarget ? <ClaimRewardsModal open onClose={() => setClaimTarget(null)} pool={claimTarget} /> : null}
    </>
  );
}

interface RowProps {
  row: UserListingMarket;
  /** This pool's unclaimed reward, or `undefined` while its own read is in flight or failed. */
  claimable: bigint | undefined;
  isClaimableLoading: boolean;
  onOpen: () => void;
  onClaim: () => void;
}

/**
 * One pool this wallet holds a position — or just a deposit address — in.
 *
 * The user figures are not one unit. `userDeposit` and `userRevenue` are
 * 18-decimal USD like every other money field on this backend, and `null` there
 * means "not reported", never `$0`. `userSharePercentage` is the exception: a
 * plain number that already **is** the percentage, so it never sees the
 * descaler. `claimable` is 18-decimal USD again but comes from a different
 * endpoint, which is why it can be absent while the rest of the row is whole.
 */
function YourPoolRow({ row, claimable, isClaimableLoading, onOpen, onClaim }: RowProps) {
  const hasClaim = claimable !== undefined && claimable > 0n;

  return (
    <DataRow columns={YOUR_POOL_COLUMNS} accent={depositChainColor(row.chainId)} onClick={onOpen}>
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-display text-md font-semibold tracking-[-0.02em] text-fg-0">
          {row.tokenTicker}
        </span>
        <span className="truncate text-2xs text-fg-3">{row.tokenName}</span>
      </div>

      <div className="min-w-0">
        {/* The pool's chain is where its **token** and deposits live — Solana,
            BSC, Base — not HyperEVM, where the perp against it settles. */}
        <Pill dot color={depositChainColor(row.chainId)}>
          {depositChainLabel(row.chainId)}
        </Pill>
      </div>

      <div className="min-w-0">
        <ListingStatusPill status={row.marketStatus} dot />
      </div>

      <div className="text-right">
        <Numeric tone={row.tvl === null ? "muted" : "default"}>{listingUsd(row.tvl)}</Numeric>
      </div>

      {/* The headline `apr`, which the catalog presents as APY. Descaled it is
          already the percentage — multiplying by 100 renders −0.76% as −75.78%. */}
      <div className="text-right">
        <Numeric tone={rateTone(row.apr)}>{listingRate(row.apr)}</Numeric>
      </div>

      <div className="text-right">
        <Numeric tone={row.listingTime === null ? "muted" : "default"} size="sm">
          {listingDate(row.listingTime)}
        </Numeric>
      </div>

      <div className="text-right">
        <Numeric tone={row.userDeposit === null ? "muted" : "strong"}>{listingUsd(row.userDeposit)}</Numeric>
      </div>

      <div className="text-right">
        <Numeric tone="muted">{sharePercent(row.userSharePercentage)}</Numeric>
      </div>

      <div className="text-right">
        <Numeric tone={rateTone(row.userRevenue)}>{listingUsd(row.userRevenue)}</Numeric>
      </div>

      {/* Four decimals, not two: a few days of yield on a small deposit is
          fractions of a dollar, and a two-decimal `$0.00` beside a live Claim
          button would contradict the button. */}
      <div className="text-right">
        {isClaimableLoading ? (
          <Skeleton className="ml-auto h-3.5 w-16" />
        ) : (
          <Numeric tone={hasClaim ? "long" : "muted"}>
            {claimable === undefined ? ABSENT : listingReward(claimable)}
          </Numeric>
        )}
      </div>

      {/* The whole row already opens the pool; this cell is the deliberate
          action. `stopPropagation` keeps a Claim click from also navigating
          away from the modal it just opened. */}
      <div className="flex justify-end">
        {hasClaim ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={(event) => {
              event.stopPropagation();
              onClaim();
            }}
          >
            Claim
          </Button>
        ) : (
          <Link
            href={`/pools/${row.chainId}/${encodeURIComponent(row.contractAddress)}`}
            onClick={(event) => event.stopPropagation()}
            className={SECONDARY_LINK}
          >
            Open
          </Link>
        )}
      </div>
    </DataRow>
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
 * A local twin of the catalog's, because the catalog's is private to its panel
 * and the two tables answer to different endpoints — `search-user` accepts the
 * same `sort_by` keys as `search`, but nothing guarantees they stay in step, and
 * the shared piece that does matter (which keys exist, and how a click flips
 * one) already lives in `catalog-sort.ts`.
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
