"use client";

import { Button } from "@/components/button";
import { Combobox, type ComboboxOption } from "@/components/combobox";
import { MicroLabel, Panel, PanelHeader } from "@/components/panel";
import { Pill } from "@/components/pill";
import { Segmented, type SegmentedOption } from "@/components/segmented";
import { DataRow, DataTable, EmptyState, SkeletonRows } from "@/components/table";
import { Numeric } from "@/components/value";
import { shortenAddress } from "@/lib/format";
import { PoolTransactionStatus, PoolTransactionType, type UserTransaction } from "@symmio/trading-core";
import { useUserTransactions } from "@symmio/trading-react";
import Link from "next/link";
import { useMemo, useState, type ReactElement } from "react";
import { TRANSACTION_TYPE_LABELS, transactionStatusDisplay } from "./books/pool-transfers-book";
import { CancelWithdrawAction } from "./cancel-withdraw-action";
import { LifecyclePill } from "./listing-chips";
import { useListingSession } from "./listing-session";
import { ListingSignIn, ListingSignInPrompt } from "./listing-sign-in";
import { depositChainColor, depositChainLabel, listingDateTime, listingRewardAmount } from "./listing-values";
import { POOLS_CHAIN_ID, POOLS_DEPLOYMENT, usePoolsSupported } from "./pools-deployment";

/** The type filter's "no narrowing" value. Segmented values are strings. */
const ANY_TYPE = "any";

/** The status filter's "no narrowing" value. */
const ANY_STATUS = "any";

/** One direction of travel, or both. */
type TypeFilter = PoolTransactionType | typeof ANY_TYPE;

/** One lifecycle stage, or all of them. */
type StatusFilter = PoolTransactionStatus | typeof ANY_STATUS;

/**
 * Column template. Every track carries a `min-content` floor so a long token
 * name cannot shift the money column out from under the eye.
 */
const TRANSFER_COLUMNS =
  "minmax(116px,0.7fr) minmax(184px,1.6fr) minmax(112px,0.8fr) minmax(140px,1fr) minmax(116px,0.8fr) minmax(148px,1fr) minmax(92px,min-content)";

/**
 * Page sizes offered in the footer.
 *
 * The service's own default is 150 rows in one response — a size chosen for a
 * caller that pages in memory. This panel pages against the endpoint instead,
 * so the numbers here are reading sizes rather than a ceiling.
 */
const PAGE_SIZE_OPTIONS: readonly ComboboxOption<string>[] = [10, 25, 50, 100].map((size) => ({
  value: String(size),
  label: `${size} rows`,
}));

/**
 * The secondary Button, worn by a `Link`.
 *
 * A control that navigates has to be a real anchor — `Button` renders a
 * `<button>` and takes no `href`, and `cn` is a plain join rather than
 * tailwind-merge, so a `className` handed to a Button could not repaint one
 * either. The classes are therefore spelled out, matching `Button`’s `sm`
 * secondary dress, the same way `your-pools-panel.tsx` and `market-row.tsx`
 * carry it.
 */
const SECONDARY_LINK =
  "inline-flex h-7 cursor-pointer items-center justify-center rounded-sm border border-line bg-bg-2 px-3 text-sm font-semibold whitespace-nowrap text-fg-0 transition-all duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:border-line-strong hover:bg-bg-3";

/**
 * Every deposit and withdrawal this wallet has made, across every pool.
 *
 * ## Why this reads `getUserTransactions` and not `getPoolTransactions`
 *
 * The pool page's transfers book is the same class of row from the other
 * direction: one pool, every LP. This is one LP, every pool — which is the only
 * shape that answers "where is my money" without knowing which pool to ask
 * first. It is also the authed endpoint, so the rows are provably the caller's
 * rather than filtered down to them by an address the service may or may not
 * have stored as their own, and it is the only one of the two whose type and
 * status filters are applied **server-side**. Nothing below filters `items`:
 * every control on this panel changes the request.
 *
 * ## What the rows do not carry
 *
 * A `UserTransaction` has one `amount` and no USD twin — no `usdcAmount`, no
 * `tokenAmount`, no wallet that made it. The pool-scoped row has all three; this
 * one trades them for the token identity that lets a cross-pool ledger name
 * which pool each row belongs to. So there is no USD column here, and inventing
 * one by pricing the amount would be a number the service never reported.
 */
export function UserTransfersPanel(): ReactElement {
  const supported = usePoolsSupported();
  const { accessToken, isSignedIn } = useListingSession();

  const [type, setType] = useState<TypeFilter>(ANY_TYPE);
  const [status, setStatus] = useState<StatusFilter>(ANY_STATUS);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const start = (page - 1) * pageSize;

  const transactions = useUserTransactions({
    accessToken,
    transactionType: type === ANY_TYPE ? undefined : type,
    transactionStatus: status === ANY_STATUS ? undefined : status,
    start,
    size: pageSize,
    /* Addressed to the pools chain by id whatever chain the wallet sits on, and
       gated explicitly: unlike `useUserProfit` and its siblings this hook does
       **not** self-gate on the bearer token, so mounted signed-out it would fire
       an unauthenticated request and take a 401 back — which the session then
       reads as a dead token. The `supported` half is the other gate: ungated,
       the hook throws LISTING_NOT_CONFIGURED instead of staying idle.
       `placeholderData` keeps the current page rendered while the next one
       loads, so a filter or a page turn never blanks the table. */
    chainId: POOLS_CHAIN_ID,
    query: { enabled: supported && isSignedIn, placeholderData: (previous) => previous },
  });

  const rows = transactions.data?.items ?? [];

  /* The service's total across every page, which is what a pager divides —
     `items.length` is one window onto it and would page to exactly one page. */
  const total = transactions.data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const hasNext = start + rows.length < total;
  const hasRows = rows.length > 0;
  const isNarrowed = type !== ANY_TYPE || status !== ANY_STATUS;

  /* A fetch with rows already on screen is a refresh, not a load: it earns a
     word in the count line, never the skeletons. */
  const isRefreshing = transactions.isFetching && !transactions.isPending;

  const typeOptions = useMemo<SegmentedOption<TypeFilter>[]>(
    () => [
      { value: ANY_TYPE, label: "All" },
      { value: PoolTransactionType.DEPOSIT, label: "Deposits" },
      { value: PoolTransactionType.WITHDRAW, label: "Withdrawals" },
    ],
    [],
  );

  /* Derived from the enum rather than hand-listed, so a status the surface can
     itself produce always has a cell. Cancelling a withdrawal on this very
     panel writes `canceled`, and a hand-written list that forgot it would leave
     the reader unable to filter to the row they had just acted on. */
  const statusOptions = useMemo<SegmentedOption<StatusFilter>[]>(
    () => [
      { value: ANY_STATUS, label: "All" },
      ...Object.values(PoolTransactionStatus).map((value) => ({
        value,
        label: transactionStatusDisplay(value).label,
      })),
    ],
    [],
  );

  /* Every control resets to the first page: a page-4 window into deposits is
     not a page-4 window into withdrawals, and keeping the number would land the
     reader past the end of a shorter list. */
  function handleType(value: TypeFilter) {
    setType(value);
    setPage(1);
  }

  function handleStatus(value: StatusFilter) {
    setStatus(value);
    setPage(1);
  }

  function handlePageSize(value: string) {
    setPageSize(Number(value));
    setPage(1);
  }

  const countLabel = transactions.error
    ? "Transfers unavailable"
    : transactions.data
      ? `${total.toLocaleString("en-US")} ${total === 1 ? "transfer" : "transfers"}`
      : "Reading your transfers…";

  /* Page two and beyond can land past the end of a list that shrank under a
     refetch — a settled withdrawal changes status, a filter drops it — and the
     footer that would page back is hidden along with the rows, so the empty
     state has to carry the way out itself. */
  const isPastEnd = page > 1;

  const emptyTitle = isPastEnd
    ? "Nothing on this page."
    : isNarrowed
      ? "Nothing matches those filters."
      : "No transfers under this wallet.";

  /* Three empty tables, three different facts, so three different messages and
     three different ways out. Signed out never reaches here at all — that case
     is the sign-in prompt above, which carries its own control, because the
     service answers nothing about a wallet that has not signed. Of the two that
     do reach here, a narrowed list is the reader's own filters answering and the
     controls that would widen them are still on screen above the table; a whole
     history that is empty has no control anywhere on this panel, which is what
     the action below repairs. Collapsing the three into one message would send
     the reader after the wrong remedy: signing in does nothing for a filter that
     matched nothing, and browsing the catalog does nothing for a history the
     service has simply not been asked for yet. */
  const emptyBody = isPastEnd
    ? `Fewer transfers match now than when page ${page} was opened.`
    : isNarrowed
      ? "The service does the matching, so this is your whole history answering — not a page that happens to be empty. Widen the type or status filter to see the rest."
      : "Every deposit you make into a pool and every withdrawal you queue out of one lands here, refunded deposits included. Nothing has been recorded against this wallet yet, which is not the same as a deposit going missing. A transfer starts inside a pool, so the catalog is where the first one comes from.";

  const firstRow = (start + 1).toLocaleString("en-US");
  const lastRow = (start + rows.length).toLocaleString("en-US");
  const rangeLabel = `${firstRow}–${lastRow} of ${total.toLocaleString("en-US")}`;

  const head = (
    <>
      <MicroLabel>Type</MicroLabel>
      <MicroLabel>Pool</MicroLabel>
      <MicroLabel>Chain</MicroLabel>
      <MicroLabel className="text-right">Amount</MicroLabel>
      <MicroLabel>Status</MicroLabel>
      <MicroLabel className="text-right">When</MicroLabel>
      {/* The action column has no name: it holds one control on a handful of
          rows, and heading it "Cancel" would read as a column of them. */}
      <span />
    </>
  );

  const state = !supported
    ? "unsupported"
    : transactions.error && !hasRows
      ? "error"
      : transactions.isPending
        ? "loading"
        : !hasRows
          ? "empty"
          : "rows";

  return (
    <>
      <Panel>
        <PanelHeader
          eyebrow="Listing service"
          title="Your transfers"
          actions={
            /* No sign-in control on a chain with no listing backend: the SIWE
               exchange is addressed to the pools chain like every other read
               here, so offering it would only mint a LISTING_NOT_CONFIGURED. */
            supported ? <ListingSignIn /> : null
          }
        />

        {!supported ? (
          <EmptyState
            title="No listing backend on this chain"
            body={`${POOLS_DEPLOYMENT.chainName} carries no listing block in the SDK’s chain registry, so there is no transfer history to read. This panel stays idle rather than erroring.`}
          />
        ) : !isSignedIn ? (
          <ListingSignInPrompt>
            The listing backend identifies an LP by signature, not by address. Until you sign it will not say which
            deposits and withdrawals are yours — this endpoint returns nothing else.
          </ListingSignInPrompt>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-subtle px-4 py-2.5">
              <Segmented<TypeFilter> options={typeOptions} value={type} onChange={handleType} size="sm" />
              <Segmented<StatusFilter> options={statusOptions} value={status} onChange={handleStatus} size="sm" />
              <p className="ml-auto text-2xs text-fg-3">
                <span className="tnum">{countLabel}</span>
                {isRefreshing ? <span className="pl-1.5">· refreshing</span> : null}
              </p>
            </div>

            {/* The rows below are a real answer the service gave; this says the
                NEXT request did not land. Two different facts, so two different
                places — replacing the table with the error would delete the
                good page. */}
            {transactions.error && hasRows ? (
              <p className="border-b border-line-subtle bg-warn-bg px-4 py-2 text-2xs text-fg-1">
                Showing the last page that loaded — the listing service did not answer the latest request.{" "}
                <span className="font-mono text-fg-2">{transactions.error.message}</span>
              </p>
            ) : null}

            <DataTable columns={TRANSFER_COLUMNS} head={head}>
              {state === "error" ? (
                <EmptyState
                  title="Couldn’t load your transfers"
                  body={transactions.error?.message}
                  action={
                    <Button size="sm" variant="secondary" onClick={() => void transactions.refetch()}>
                      Retry
                    </Button>
                  }
                />
              ) : null}

              {state === "loading" ? <SkeletonRows columns={TRANSFER_COLUMNS} cells={7} rows={5} /> : null}

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

              {state === "rows" ? rows.map((row) => <TransferRow key={row.transactionId} row={row} />) : null}
            </DataTable>

            {state === "rows" ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                <span className="text-xs text-fg-3">
                  Showing <span className="tnum">{rangeLabel}</span> {total === 1 ? "transfer" : "transfers"}
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

      <p className="max-w-[104ch] px-1 text-2xs text-fg-3">
        Type, status and paging are the service’s, not this table’s — every control above changes the request, so the
        count is your whole history matching rather than the rows on screen. Each row reports a single{" "}
        <span className="font-mono">amount</span> in its own denomination: this endpoint carries no USD twin the way a
        pool’s own book does, so nothing here is priced. A withdrawal stays cancellable only while it is pending; once
        the backend settles it the control goes and the shares are gone from the pool.
      </p>
    </>
  );
}

interface RowProps {
  row: UserTransaction;
}

/**
 * One deposit or withdrawal, on whichever pool it belongs to.
 *
 * ## Why the pool is a link and the row is not a button
 *
 * Every other table in Prism makes the whole row the navigation target. This
 * one cannot: some of these rows carry a Cancel control whose confirm sheet
 * renders through a **portal**, and a portal keeps its place in the React tree
 * however far it moves in the DOM — so every click inside that sheet would
 * bubble into the row handler and walk the reader off to the pool page mid
 * confirmation. Stopping propagation around the control would patch it; making
 * the one cell that means "the pool" the link removes the collision instead,
 * and it is the more honest target anyway — the row is a transfer, not a pool.
 */
function TransferRow({ row }: RowProps) {
  const display = transactionStatusDisplay(row.status);

  /* The one row state this panel can act on. Both halves matter: a settled
     withdrawal is no longer cancellable and the service rejects it, and a
     deposit was never in a queue to begin with. */
  const isCancellable = row.type === PoolTransactionType.WITHDRAW && row.status === PoolTransactionStatus.PENDING;

  /* The service reports a ticker, a name and an address per row and any of the
     first two can come back empty. The second line falls through to the address
     rather than repeating whatever the first line settled on: a pool named
     twice looks like a rendering fault, and the address is the one identifier
     that is always there. */
  const title = row.tokenTicker || row.tokenName || shortenAddress(row.tokenAddress);
  const subtitle = row.tokenTicker && row.tokenName ? row.tokenName : shortenAddress(row.tokenAddress);

  return (
    <DataRow columns={TRANSFER_COLUMNS} accent={depositChainColor(row.chainId)}>
      <span className="text-sm text-fg-1">{TRANSACTION_TYPE_LABELS[row.type]}</span>

      <div className="flex min-w-0 flex-col">
        <Link
          href={`/pools/${row.chainId}/${encodeURIComponent(row.tokenAddress)}`}
          className="truncate font-display text-md font-semibold tracking-[-0.02em] text-fg-0 transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:text-accent"
        >
          {title}
        </Link>
        <span title={row.tokenAddress} className="truncate text-2xs text-fg-3">
          {subtitle}
        </span>
      </div>

      <div className="min-w-0">
        {/* The chain a row's **token** lives on — Solana, BSC, Base — not
            HyperEVM, where the perp against its pool settles. */}
        <Pill dot color={depositChainColor(row.chainId)}>
          {depositChainLabel(row.chainId)}
        </Pill>
      </div>

      <div className="truncate text-right">
        {/* Not `listingAmount`: that compacts, and a `12K` in a ledger of your
            own money is not a figure anyone can reconcile against a wallet.
            `listingRewardAmount` is the file's exact, comma-grouped, unitless
            formatter — named for where four decimals were first needed, not for
            the only place they are right. */}
        <Numeric size="sm" tone="strong">
          {listingRewardAmount(row.amount)}
        </Numeric>
      </div>

      <LifecyclePill {...display} />

      <div className="text-right">
        <Numeric size="sm" tone="muted">
          {listingDateTime(row.time)}
        </Numeric>
      </div>

      <div className="flex justify-end">
        {isCancellable ? <CancelWithdrawAction withdrawId={row.transactionId} /> : null}
      </div>
    </DataRow>
  );
}
