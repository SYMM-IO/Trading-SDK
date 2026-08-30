"use client";

import { Button } from "@/components/button";
import { Combobox, type ComboboxOption } from "@/components/combobox";
import { MicroLabel, Panel, PanelHeader } from "@/components/panel";
import { DataRow, DataTable, EmptyState, SkeletonRows } from "@/components/table";
import { Numeric } from "@/components/value";
import { useFundingAccounts } from "@/features/accounts/account-provider";
import { shortenAddress } from "@/lib/format";
import type { ListingDepositChainId } from "@symmio/trading-core";
import { useClaimHistory } from "@symmio/trading-react";
import { useEffect, useMemo, useState } from "react";
import { useListingSession } from "./listing-session";
import { ListingSignInPrompt } from "./listing-sign-in";
import { ABSENT, depositChainColor, depositChainLabel, listingDateTime, listingRewardAmount } from "./listing-values";
import { POOLS_CHAIN_ID, POOLS_DEPLOYMENT, usePoolsSupported } from "./pools-deployment";

/**
 * The claim table: when, who was paid, how much, the transfer, the claim id.
 *
 * There is no pool column, and its absence is the service's rather than a
 * choice — `PoolClaim` carries no market: the backend drops the internal
 * `market_id` on the way out, so a row cannot say which pool it came from. The
 * scope line above the table names the pool instead, because that is the only
 * place the information exists.
 */
const CLAIM_COLUMNS = "minmax(152px,1fr) minmax(180px,1.3fr) minmax(136px,0.9fr) minmax(148px,1fr) minmax(132px,0.9fr)";

/**
 * Page sizes offered in the footer.
 *
 * The endpoint's own default is `150`, which is not a page — it is "probably
 * everything". These are real windows onto `count`, and the request changes
 * when one is picked.
 */
const PAGE_SIZE_OPTIONS: readonly ComboboxOption<string>[] = [10, 25, 50, 100].map((size) => ({
  value: String(size),
  label: `${size} rows`,
}));

export interface ClaimHistoryPanelProps {
  /**
   * Narrow to one pool by its token contract address.
   *
   * Omit for every claim this wallet has ever made, across every pool — which
   * is what the portfolio-level surface wants and what a pool page does not.
   */
  tokenContractAddress?: string;
  /**
   * The narrowed pool's deposit chain, for naming it in the scope line.
   *
   * The read does not take it: `getClaimHistory` is scoped by token address
   * alone. It is here because a token address on its own does not identify a
   * pool — two chains can carry the same address — so a table that says it is
   * showing one pool has to say which chain's.
   */
  depositChain?: ListingDepositChainId;
  className?: string;
}

/**
 * Every reward this wallet has claimed, newest first.
 *
 * Authed and scoped to the caller by the backend itself: the filters narrow
 * *within* the signed-in wallet's own claims and cannot widen past them, so
 * there is no cross-account leak to defend against in the query — only in the
 * cache, which `listing-session.tsx` handles by purging `getClaimHistory` on a
 * wallet change.
 *
 * ## Why the pager is real
 *
 * This endpoint pages on the path — `/{start}/{size}` — and answers with
 * `{ count, items }` where `count` is the total across **all** pages. A card
 * that asks for the default 150 rows and pages them in the browser reports
 * `items.length` as the total and silently loses claim 151. So `start` and
 * `size` are component state here, every control resets to the first page, and
 * the count line is the service's total rather than the length of what is on
 * screen.
 */
export function ClaimHistoryPanel({ tokenContractAddress, depositChain, className }: ClaimHistoryPanelProps) {
  const supported = usePoolsSupported();
  const session = useListingSession();
  const { accounts } = useFundingAccounts();

  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const start = (page - 1) * pageSize;
  const isNarrowed = tokenContractAddress !== undefined && tokenContractAddress.length > 0;

  /* Moving the rail to another pool is a filter change, and a filter change
     resets the page — otherwise a reader who was on page three of a busy pool
     lands on an empty page three of a quiet one and reads it as "no claims". */
  useEffect(() => {
    setPage(1);
  }, [tokenContractAddress]);

  const history = useClaimHistory({
    accessToken: session.accessToken,
    tokenContractAddress: isNarrowed ? tokenContractAddress : undefined,
    start,
    size: pageSize,
    /* Addressed to the pools chain by id whatever chain the wallet sits on, and
       gated twice. `useClaimHistory` is one of the few authed pools reads that
       does **not** self-gate on the token, so without `enabled` it fires an
       unauthenticated request the moment the panel mounts and answers 401 —
       which the session's revoke listener would then read as a dead token.
       `placeholderData` keeps the current page rendered while the next one
       loads, so paging never blanks the table. */
    chainId: POOLS_CHAIN_ID,
    query: {
      enabled: supported && session.isSignedIn,
      placeholderData: (previous) => previous,
    },
  });

  /** Sub-account names, so a payout destination reads as an account and not a hash. */
  const accountNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const account of accounts) names.set(account.address.toLowerCase(), account.name);
    return names;
  }, [accounts]);

  const rows = history.data?.items ?? [];
  const total = history.data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const hasNext = start + rows.length < total;
  const hasRows = rows.length > 0;

  /* A fetch with a page already on screen is a refresh, not a load: it earns a
     word in the count line, never the skeletons. */
  const isRefreshing = history.isFetching && !history.isPending;

  function handlePageSize(value: string) {
    setPageSize(Number(value));
    setPage(1);
  }

  const state = !supported
    ? "unsupported"
    : !session.isSignedIn
      ? "signed-out"
      : history.error && !hasRows
        ? "error"
        : history.isPending
          ? "loading"
          : !hasRows
            ? "empty"
            : "rows";

  const countLabel = history.error
    ? "History unavailable"
    : history.data
      ? `${total.toLocaleString("en-US")} ${total === 1 ? "claim" : "claims"}`
      : "Reading your claims…";

  /* Page two and beyond can land past the end of a history that shrank under a
     refetch, and the footer that would page back is hidden along with the rows —
     so the empty state has to carry the way out itself. */
  const isPastEnd = page > 1;

  const firstRow = (start + 1).toLocaleString("en-US");
  const lastRow = (start + rows.length).toLocaleString("en-US");
  const rangeLabel = `${firstRow}–${lastRow} of ${total.toLocaleString("en-US")}`;

  return (
    <Panel className={className}>
      <PanelHeader eyebrow="Rewards" title="Claim history" />

      {state === "rows" || state === "loading" || state === "empty" || state === "error" ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-subtle px-4 py-2.5">
          {isNarrowed ? (
            <span className="flex items-center gap-1.5 text-2xs text-fg-2">
              {depositChain === undefined ? null : (
                <span
                  aria-hidden
                  className="size-[6px] shrink-0 rounded-full"
                  style={{ background: depositChainColor(depositChain) }}
                />
              )}
              This pool only
              {depositChain === undefined ? null : (
                <span className="text-fg-3">· {depositChainLabel(depositChain)}</span>
              )}
            </span>
          ) : (
            <span className="text-2xs text-fg-2">Every pool you have claimed from</span>
          )}
          <p className="ml-auto text-2xs text-fg-3">
            <span className="tnum">{countLabel}</span>
            {isRefreshing ? <span className="pl-1.5">· refreshing</span> : null}
          </p>
        </div>
      ) : null}

      {/* The rows below are a real answer the service gave; this says the NEXT
          request did not land. Two different facts, so two different places —
          replacing the table with the error would delete the good page. */}
      {history.error && hasRows ? (
        <p className="border-b border-line-subtle bg-warn-bg px-4 py-2 text-2xs text-fg-1">
          Showing the last page that loaded — the listing service did not answer the latest request.{" "}
          <span className="font-mono text-fg-2">{history.error.message}</span>
        </p>
      ) : null}

      {state === "signed-out" ? (
        <ListingSignInPrompt>
          Your claims are the listing service&rsquo;s own record of money it paid you, so it answers only for the wallet
          that signed. One signature reads the whole history, across every pool.
        </ListingSignInPrompt>
      ) : (
        <>
          <DataTable
            columns={CLAIM_COLUMNS}
            head={
              <>
                <MicroLabel>When</MicroLabel>
                <MicroLabel>Paid into</MicroLabel>
                <MicroLabel className="text-right">Amount</MicroLabel>
                <MicroLabel>Transfer</MicroLabel>
                <MicroLabel>Claim id</MicroLabel>
              </>
            }
          >
            {state === "unsupported" ? (
              <EmptyState
                title="No listing service on this chain"
                body={`The SDK registry in this build carries no listing backend for ${POOLS_DEPLOYMENT.chainName}, so there is no claim history to read. This does not follow the wallet — the read is addressed to that chain by id.`}
              />
            ) : null}

            {state === "error" ? (
              <EmptyState title="Your claim history did not load" body={history.error?.message} />
            ) : null}

            {state === "loading" ? <SkeletonRows columns={CLAIM_COLUMNS} cells={5} rows={4} /> : null}

            {state === "empty" ? (
              <EmptyState
                title={isPastEnd ? "Nothing on this page." : "No claims yet."}
                body={
                  isPastEnd
                    ? `Fewer claims are recorded now than when page ${page} was opened.`
                    : isNarrowed
                      ? "You have never claimed from this pool. Rewards accrue against the LP shares you hold and sit as a claimable balance until you take them."
                      : "You have never claimed a pool reward. Rewards accrue against the LP shares you hold in any pool and sit as a claimable balance until you take them."
                }
                action={
                  isPastEnd ? (
                    <Button variant="secondary" size="sm" onClick={() => setPage(1)}>
                      Back to the first page
                    </Button>
                  ) : undefined
                }
              />
            ) : null}

            {state === "rows"
              ? rows.map((row) => (
                  <DataRow key={row.claimRequestId} columns={CLAIM_COLUMNS}>
                    <Numeric size="sm" tone="muted">
                      {listingDateTime(row.time)}
                    </Numeric>

                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-sm text-fg-1">
                        {accountNames.get(row.accountAddress.toLowerCase()) ?? "Sub-account"}
                      </span>
                      <span title={row.accountAddress} className="tnum truncate text-2xs text-fg-3">
                        {shortenAddress(row.accountAddress)}
                      </span>
                    </div>

                    <div className="truncate text-right">
                      <Numeric size="sm" tone="strong">
                        {listingRewardAmount(row.amount)}
                      </Numeric>
                      <span className="ml-1 text-2xs text-fg-3">USDC</span>
                    </div>

                    {/* A missing hash is a normal answer, not a failure: the USDC
                        moved either way, and the service simply has no on-chain
                        reference for the transfer. */}
                    {row.transactionHash ? (
                      <span title={row.transactionHash} className="tnum truncate text-sm text-fg-2">
                        {shortenAddress(row.transactionHash)}
                      </span>
                    ) : (
                      <span className="text-sm text-fg-3">{ABSENT}</span>
                    )}

                    <span title={row.claimRequestId} className="tnum truncate text-sm text-fg-3">
                      {shortenAddress(row.claimRequestId)}
                    </span>
                  </DataRow>
                ))
              : null}
          </DataTable>

          {state === "rows" ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
              {/* The total is the service's, not `rows.length`: the page on
                  screen is one window onto it. */}
              <span className="text-xs text-fg-3">
                Showing <span className="tnum">{rangeLabel}</span> {total === 1 ? "claim" : "claims"}
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
  );
}
