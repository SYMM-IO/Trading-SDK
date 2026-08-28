"use client";

import { MicroLabel, Panel, PanelHeader } from "@/components/panel";
import { Segmented, type SegmentedOption } from "@/components/segmented";
import { EmptyState, Skeleton } from "@/components/table";
import { Numeric, Stat } from "@/components/value";
import { formatUsd, shortenAddress } from "@/lib/format";
import type { UserPoolRewardChart } from "@symmio/trading-core";
import { useUserRewardChart, useUserTotalReward, useWalletAccount } from "@symmio/trading-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useListingSession } from "./listing-session";
import { ListingSignIn, ListingSignInPrompt } from "./listing-sign-in";
import { ABSENT, depositChainColor, depositChainLabel, listingNumber, listingUsd, poolKey } from "./listing-values";
import { POOLS_CHAIN_ID, POOLS_DEPLOYMENT, usePoolsSupported } from "./pools-deployment";
import {
  DEFAULT_REWARD_WINDOW_DAYS,
  REWARD_WINDOW_LABELS,
  rewardWindowFromLabel,
  rewardWindowLabel,
  type RewardWindowDays,
} from "./reward-windows";
import { SeriesChart } from "./series-chart";

/**
 * The window control's cells.
 *
 * A segmented cell is keyed by its value, and the window's own label is already
 * unique, so it serves as both — the shared model owns which windows exist and
 * `rewardWindowFromLabel` reads the click back.
 */
const WINDOW_OPTIONS: readonly SegmentedOption<string>[] = REWARD_WINDOW_LABELS.map((label) => ({
  value: label,
  label,
}));

/**
 * What being an LP has paid this wallet.
 *
 * Two reads that do not line up, and the panel says so rather than blending
 * them: the headline is windowed and aggregate, while the series takes no
 * window and no market at all — the service returns every pool the wallet earns
 * in, and the daily bar is those pools summed. So the segmented control moves
 * the figure and nothing else.
 *
 * Both numbers are **earned**, built from daily snapshots. Claiming does not
 * reduce them; the claimable balance is a different read and lives on each
 * pool’s own page.
 */
export function YourRewardsPanel() {
  const supported = usePoolsSupported();
  const { accessToken, isSignedIn } = useListingSession();
  const { address } = useWalletAccount();
  const [days, setDays] = useState<RewardWindowDays>(DEFAULT_REWARD_WINDOW_DAYS);

  /* `userAddress` is required even though the bearer token already identifies
     the session, so the wallet gates the query alongside the token. */
  const total = useUserTotalReward({
    accessToken,
    userAddress: address ?? "",
    days,
    chainId: POOLS_CHAIN_ID,
    query: { enabled: supported && isSignedIn && Boolean(address) },
  });

  const chart = useUserRewardChart({
    accessToken,
    chainId: POOLS_CHAIN_ID,
    query: { enabled: supported && isSignedIn },
  });

  /**
   * One bar per day, every pool folded in.
   *
   * The summing is load-bearing. Two pools routinely report the same reward
   * day, and `SeriesChart` de-duplicates its points by timestamp — feeding it
   * the raw per-pool points would silently plot whichever one arrived last and
   * under-report the day. Added as `bigint` and descaled once, so no cent is
   * rounded on the way in.
   */
  const series = useMemo(() => {
    const byDay = new Map<number, bigint>();
    for (const pool of chart.data ?? []) {
      for (const point of pool.rewards) {
        byDay.set(point.timestamp, (byDay.get(point.timestamp) ?? 0n) + point.reward);
      }
    }
    return [...byDay.entries()].map(([time, sum]) => ({ time, value: listingNumber(sum) ?? 0 }));
  }, [chart.data]);

  /* Sorted with a bigint comparator, never `Number(a - b)`: a subtraction of
     two 18-decimal figures overflows a float long before the dollars do. */
  const byPool = useMemo(() => {
    return (chart.data ?? [])
      .map((pool) => ({ pool, earned: pool.rewards.reduce((sum, point) => sum + point.reward, 0n) }))
      .sort((left, right) => (right.earned > left.earned ? 1 : right.earned < left.earned ? -1 : 0));
  }, [chart.data]);

  function handleWindow(label: string) {
    const picked = rewardWindowFromLabel(label);
    if (picked) setDays(picked);
  }

  /* Two independent reads, so two independent failures. Folding them into one
     slot means a broken headline blanks a perfectly good chart — and the panel
     would report "couldn't load your rewards" while holding every one of them. */
  const bothFailed = total.error !== null && chart.error !== null;

  return (
    <Panel>
      <PanelHeader
        eyebrow="Listing service"
        title="Your rewards"
        actions={
          /* Nothing to sign into on a chain with no listing backend — the SIWE
             exchange is addressed to the pools chain like every read here, so
             the control would only mint a LISTING_NOT_CONFIGURED. */
          supported ? (
            <>
              {isSignedIn ? (
                <Segmented options={WINDOW_OPTIONS} value={rewardWindowLabel(days)} onChange={handleWindow} size="sm" />
              ) : null}
              <ListingSignIn />
            </>
          ) : null
        }
      />

      {!supported ? (
        <EmptyState
          title="No listing backend on this chain"
          body={`${POOLS_DEPLOYMENT.chainName} carries no listing block in the SDK’s chain registry, so there are no LP rewards to read. This panel stays idle rather than erroring.`}
        />
      ) : !isSignedIn ? (
        <ListingSignInPrompt>
          Rewards are per-LP, and the listing backend only knows an LP by signature. Sign in and it reports what your
          deposits have earned, day by day.
        </ListingSignInPrompt>
      ) : bothFailed ? (
        <EmptyState title="Couldn’t load your rewards" body={chart.error?.message} />
      ) : (
        <div className="flex flex-col gap-4 px-4 py-4">
          <div className="flex flex-col gap-1.5">
            <Stat
              label={`Earned · last ${days} days`}
              value={
                total.isLoading ? (
                  <Skeleton className="h-6 w-32" />
                ) : total.error ? (
                  <Numeric size="2xl" tone="muted">
                    {ABSENT}
                  </Numeric>
                ) : (
                  <Numeric size="2xl" tone="strong">
                    {listingUsd(total.data, { exact: true })}
                  </Numeric>
                )
              }
              sub={
                total.error ? (
                  <span className="text-warn">
                    The windowed total did not answer — the daily series below still did.
                  </span>
                ) : (
                  "Every pool you provide liquidity to, aggregated by the service"
                )
              }
            />
            <p className="max-w-[92ch] text-2xs text-fg-3">
              Earned, not claimable: the figure is summed from the daily snapshots the service keeps, so claiming a
              pool’s rewards never lowers it. The claimable balance is a separate read and lives on each pool’s page. A
              zero here is the service’s own — this endpoint reports an absent total as <span className="tnum">0</span>,
              so it cannot be told apart from a genuinely unrewarded window.
            </p>
          </div>

          {chart.error ? (
            <EmptyState title="The reward series did not answer" body={chart.error.message} />
          ) : !chart.isLoading && series.length === 0 ? (
            <EmptyState
              title="No rewards yet"
              body="Rewards land a day after your first deposit — the service snapshots them daily, so a pool funded today shows its first bar tomorrow."
            />
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <SeriesChart
                  kind="histogram"
                  points={series}
                  height={220}
                  isLoading={chart.isLoading}
                  emptyTitle="No rewards yet"
                  emptyBody="Rewards land a day after your first deposit."
                  formatValue={(value) => formatUsd(value)}
                />
                <p className="text-2xs text-fg-3">
                  Daily reward, every pool summed. The window above moves only the headline — this series is everything
                  the service holds, because the chart endpoint takes no window and no market.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2.5">
                  <MicroLabel>By pool</MicroLabel>
                  <span aria-hidden className="h-px min-w-4 flex-1 bg-line-subtle" />
                  <span className="text-2xs whitespace-nowrap text-fg-3">Full series, not the {days}-day window</span>
                </div>
                <div className="flex flex-col">
                  {byPool.map(({ pool, earned }) => (
                    <PoolRewardRow key={poolKey(pool.marketChainId, pool.marketAddress)} pool={pool} earned={earned} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </Panel>
  );
}

interface RowProps {
  pool: UserPoolRewardChart;
  /** This pool’s whole series summed, 18-decimal USD. */
  earned: bigint;
}

/**
 * One pool’s contribution to the rewards above.
 *
 * Addressed by `(marketAddress, marketChainId)` — the chain is the token’s own
 * deposit chain, not the chain the perp settles on, and the same address can be
 * listed from more than one, so neither half of the pair is optional.
 */
function PoolRewardRow({ pool, earned }: RowProps) {
  return (
    <Link
      href={`/pools/${pool.marketChainId}/${encodeURIComponent(pool.marketAddress)}`}
      className="flex items-center gap-2.5 rounded-md border border-transparent px-2 py-1.5 transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:border-line hover:bg-bg-2"
    >
      <span
        aria-hidden
        className="size-[6px] shrink-0 rounded-full"
        style={{ background: depositChainColor(pool.marketChainId) }}
      />
      <span className="truncate font-mono text-sm text-fg-1">{shortenAddress(pool.marketAddress)}</span>
      <span className="shrink-0 text-2xs text-fg-3">{depositChainLabel(pool.marketChainId)}</span>
      <Numeric className="ml-auto" size="sm">
        {listingUsd(earned, { exact: true })}
      </Numeric>
    </Link>
  );
}
