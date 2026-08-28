"use client";

import { Button } from "@/components/button";
import { MicroLabel, Panel, PanelHeader } from "@/components/panel";
import { Pill } from "@/components/pill";
import { DataRow, DataTable, EmptyState, SkeletonRows } from "@/components/table";
import { Numeric } from "@/components/value";
import type { UserListingMarket } from "@symmio/trading-core";
import { useUserListingMarkets } from "@symmio/trading-react";
import { useRouter } from "next/navigation";
import { ListingStatusPill } from "./listing-chips";
import { useListingSession } from "./listing-session";
import { ListingSignIn, ListingSignInPrompt } from "./listing-sign-in";
import { depositChainColor, depositChainLabel, listingUsd, poolKey, rateTone, sharePercent } from "./listing-values";
import { POOLS_CHAIN_ID, POOLS_DEPLOYMENT, usePoolsSupported } from "./pools-deployment";

/**
 * Rows read in one page.
 *
 * The endpoint paginates server-side and this panel offers no pager, so the
 * number is the whole list a reader gets — generous enough that an LP with a
 * normal spread of positions never hits it, and the footer says so when they do.
 */
const PAGE_LIMIT = 25;

/**
 * Column template. Every track carries a `min-content` floor so a long token
 * name cannot shift the money columns out from under the eye.
 */
const YOUR_POOL_COLUMNS =
  "minmax(200px,2.2fr) minmax(104px,0.9fr) minmax(132px,1fr) minmax(104px,0.9fr) minmax(118px,1fr) minmax(100px,0.8fr) minmax(118px,1fr)";

/**
 * The pools this wallet is an LP in.
 *
 * The authed twin of the catalog: same rows, same units, plus the three
 * user-scoped figures the public list cannot carry. A row exists here the
 * moment a pool mints this wallet a deposit address — **before** any deposit —
 * so the list is "pools you have opened a door to", not "pools holding your
 * money", and the status column is what tells the two apart.
 *
 * That is also why no `marketStatus` filter is sent. Filtering to listed pools
 * hides exactly the rows an LP is waiting on, and a pool that vanishes from
 * your own list while its deposit address is still live is the worst possible
 * wrong answer.
 */
export function YourPoolsPanel() {
  const router = useRouter();
  const supported = usePoolsSupported();
  const { accessToken, isSignedIn } = useListingSession();

  /* Addressed to the pools chain explicitly, like every read on this surface:
     the listing backend hangs off the chain config, not off the wallet, so this
     answers the same whatever network the wallet is parked on. */
  const markets = useUserListingMarkets({
    accessToken,
    chainId: POOLS_CHAIN_ID,
    limit: PAGE_LIMIT,
    query: { enabled: supported && isSignedIn },
  });

  const rows = markets.data?.items ?? [];
  const total = markets.data?.total ?? rows.length;

  const head = (
    <>
      <MicroLabel>Pool</MicroLabel>
      <MicroLabel>Chain</MicroLabel>
      <MicroLabel>Status</MicroLabel>
      <MicroLabel className="text-right">TVL</MicroLabel>
      <MicroLabel className="text-right">Your deposit</MicroLabel>
      <MicroLabel className="text-right">Your share</MicroLabel>
      <MicroLabel className="text-right">Your revenue</MicroLabel>
    </>
  );

  return (
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
                <Button
                  variant="ghost"
                  size="sm"
                  loading={markets.isFetching}
                  onClick={() => void markets.refetch()}
                  title="Re-read your pools from the listing service"
                >
                  {markets.isFetching ? null : <RefreshIcon />}
                  Refresh
                </Button>
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
          <DataTable columns={YOUR_POOL_COLUMNS} head={head}>
            {markets.error ? (
              /* A failed read is not an empty portfolio — say which one it is. */
              <EmptyState
                title="Couldn’t load your pools"
                body={markets.error.message}
                action={
                  <Button size="sm" variant="secondary" onClick={() => void markets.refetch()}>
                    Retry
                  </Button>
                }
              />
            ) : markets.isLoading ? (
              <SkeletonRows columns={YOUR_POOL_COLUMNS} rows={3} cells={7} />
            ) : rows.length === 0 ? (
              <EmptyState
                title="No pools under this wallet"
                body="A pool appears here as soon as it generates a deposit address for you — funded or not. An empty list means none has, which is not the same as a deposit going missing."
              />
            ) : (
              rows.map((row) => (
                <YourPoolRow
                  key={poolKey(row.chainId, row.contractAddress)}
                  row={row}
                  onOpen={() => router.push(`/pools/${row.chainId}/${encodeURIComponent(row.contractAddress)}`)}
                />
              ))
            )}
          </DataTable>

          {rows.length > 0 ? (
            <div className="flex flex-col gap-1 px-4 py-3">
              <span className="text-xs text-fg-3">
                Showing <span className="tnum">{rows.length.toLocaleString("en-US")}</span> of{" "}
                <span className="tnum">{total.toLocaleString("en-US")}</span> {total === 1 ? "pool" : "pools"}
                {total > rows.length ? " — the service pages the rest." : null}
              </span>
              <p className="max-w-[104ch] text-2xs text-fg-3">
                Deliberately unfiltered by status: a pool still awaiting its first deposit is the one an LP most needs
                to see, so that state reads in the column instead of dropping the row.
              </p>
            </div>
          ) : null}
        </>
      )}
    </Panel>
  );
}

interface RowProps {
  row: UserListingMarket;
  onOpen: () => void;
}

/**
 * One pool this wallet holds a position — or just a deposit address — in.
 *
 * The three user figures are not one unit. `userDeposit` and `userRevenue` are
 * 18-decimal USD like every other money field on this backend, and `null` there
 * means "not reported", never `$0`. `userSharePercentage` is the exception: a
 * plain number that already **is** the percentage, so it never sees the
 * descaler.
 */
function YourPoolRow({ row, onOpen }: RowProps) {
  return (
    <DataRow columns={YOUR_POOL_COLUMNS} onClick={onOpen}>
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
        <Numeric>{listingUsd(row.tvl)}</Numeric>
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
    </DataRow>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 14 14" width="12" height="12" fill="none" aria-hidden>
      <path
        d="M12 7a5 5 0 1 1-1.6-3.66M12 1.5V4.5H9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
