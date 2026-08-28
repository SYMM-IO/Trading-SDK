"use client";

import { Chips } from "@/components/chips";
import { Panel, PanelHeader } from "@/components/panel";
import { Segmented, type SegmentedOption } from "@/components/segmented";
import { EmptyState, Skeleton } from "@/components/table";
import { Numeric, Stat } from "@/components/value";
import { FAMILY_PALETTE } from "@/config/deployments";
import { formatUsd } from "@/lib/format";
import type { ListingDepositChainId } from "@symmio/trading-core";
import { useInventoryTvlHistory, usePoolRewardChart, usePoolTotalReward, useTradeVolume } from "@symmio/trading-react";
import { useMemo, useState, type ReactNode } from "react";
import { ABSENT, listingNumber, listingUsd } from "./listing-values";
import { POOLS_CHAIN_ID, POOLS_DEPLOYMENT, usePoolsSupported } from "./pools-deployment";
import {
  DEFAULT_REWARD_WINDOW_DAYS,
  REWARD_WINDOW_LABELS,
  rewardWindowFromLabel,
  rewardWindowLabel,
  type RewardWindowDays,
} from "./reward-windows";
import { SeriesChart, type SeriesPoint } from "./series-chart";

/** Which of the pool's three series is on screen. */
type ChartView = "tvl" | "volume" | "rewards";

const VIEWS: readonly SegmentedOption<ChartView>[] = [
  { value: "tvl", label: "TVL" },
  { value: "volume", label: "Volume" },
  { value: "rewards", label: "Rewards" },
];

const VIEW_TITLES: Record<ChartView, string> = {
  tvl: "Total value locked",
  volume: "Daily volume",
  rewards: "LP rewards",
};

/**
 * Which service answered, and in what unit.
 *
 * The three views share an x-axis meaning and nothing else: they are three
 * backends, not three cuts of one dataset. Without the attribution a reader
 * takes a gap in one series as a gap in the pool.
 */
const VIEW_CAPTIONS: Record<ChartView, string> = {
  tvl: "Inventory service · custodial value held for this pool, in USD, one point per snapshot.",
  volume: "Enigma solver · notional traded on this pool’s market, in USD, one bar per day.",
  rewards: "Listing backend · rewards paid to liquidity providers, in USD, one bar per day.",
};

/**
 * One hue per series, named here rather than left to the chart's default.
 *
 * TVL takes the app accent: it is the pool's headline figure and should move
 * with the palette. Volume takes the secondary accent so flipping between the
 * two never reads as the same line redrawn. Rewards take the lowcaps family
 * hue — pools exist on that one deployment, and a family color is a fact about
 * the deployment rather than about the current mode, so the reward bars keep
 * their identity wherever the palette goes.
 */
const VIEW_COLORS: Record<ChartView, string> = {
  tvl: "var(--accent)",
  volume: "var(--accent-2)",
  rewards: FAMILY_PALETTE.lowcaps.base,
};

/** Every view draws at one height, so switching them never reflows the page. */
const CHART_HEIGHT = 260;

export interface PoolChartsProps {
  /** The pool's token contract address — base58 on Solana, `0x…` elsewhere. */
  address: string;
  /** The chain the pool's token lives on. Not the SYMMIO chain the reads are addressed to. */
  chainId: ListingDepositChainId;
  /** The pool's solver market id, or `null` when no market has been created for it yet. */
  symbolId: number | null;
}

/**
 * A pool's three time series, behind one switch.
 *
 * They share an x-axis meaning — one figure per day — so they share a frame:
 * stacked as three cards they would turn the pool page into a scroll, and side
 * by side none of them would be wide enough to read. Only the selected view is
 * fetched; the other two stay idle until they are asked for.
 */
export function PoolCharts({ address, chainId, symbolId }: PoolChartsProps) {
  const supported = usePoolsSupported();
  const [view, setView] = useState<ChartView>("tvl");
  const [rewardDays, setRewardDays] = useState<RewardWindowDays>(DEFAULT_REWARD_WINDOW_DAYS);

  const tvl = useInventoryTvlHistory({
    symbolAddress: address,
    chainId: POOLS_CHAIN_ID,
    query: { enabled: supported && view === "tvl" },
  });

  /* `/trade-volume/{symbol_id}` is an Enigma-only endpoint, and the solver is
     named explicitly rather than left to the chain default so this read does
     not change meaning if the chain ever gains a second solver. `symbolId ?? 0`
     is never actually fetched — `0` is the SDK's "no market" sentinel and the
     view is gated on a real id anyway. */
  const volume = useTradeVolume({
    symbolId: symbolId ?? 0,
    chainId: POOLS_CHAIN_ID,
    solverId: "enigma",
    query: { enabled: supported && symbolId !== null && view === "volume" },
  });

  /* Two chain ids, and they are not interchangeable: `marketChainId` is the
     chain the pool's **token** lives on (Solana, BSC, Base…), `chainId` is the
     SYMMIO chain whose listing backend is being asked. Passing the same value
     for both is accepted and answers with an empty series — a silent blank
     chart rather than an error. */
  const rewards = usePoolRewardChart({
    marketAddress: address,
    marketChainId: chainId,
    chainId: POOLS_CHAIN_ID,
    query: { enabled: supported && view === "rewards" },
  });

  /* The window drives the headline total and **only** the headline total. The
     daily series above is unwindowed — it always plots every snapshot the
     service holds — so picking 7D narrows the number and leaves the bars alone.
     That is the service's shape, not an oversight, and the caption says so on
     screen because a window control that moves one figure and not the chart
     beneath it is otherwise read as broken. */
  const totalReward = usePoolTotalReward({
    marketAddress: address,
    marketChainId: chainId,
    days: rewardDays,
    chainId: POOLS_CHAIN_ID,
    query: { enabled: supported && view === "rewards" },
  });

  /* Money at 18 decimals, the scale the inventory service and the listing
     backend share — `1e18` is `$1`, never a percentage. */
  const tvlPoints = useMemo<SeriesPoint[]>(
    () => (tvl.data ?? []).map((point) => ({ time: point.timestamp, value: listingNumber(point.tvl) ?? 0 })),
    [tvl.data],
  );

  /* Both wire fields are strings on purpose, and neither is fixed-point: the
     day is an ISO 8601 stamp and the volume a plain decimal. The solver sends
     an empty timestamp when it omits the bucket, which `Date.parse` answers
     with `NaN` — dropped here, because plotting it would put a bar at the
     epoch and stretch the axis across 56 years. */
  const volumePoints = useMemo<SeriesPoint[]>(
    () =>
      (volume.data ?? []).flatMap((row) => {
        const millis = Date.parse(row.timestamp);
        if (!Number.isFinite(millis)) return [];
        return [{ time: Math.floor(millis / 1000), value: Number(row.volume) }];
      }),
    [volume.data],
  );

  const rewardPoints = useMemo<SeriesPoint[]>(
    () => (rewards.data ?? []).map((point) => ({ time: point.timestamp, value: listingNumber(point.reward) ?? 0 })),
    [rewards.data],
  );

  if (!supported) {
    return (
      <Panel>
        <PanelHeader eyebrow="Time series" title="Pool charts" />
        <EmptyState
          title="No listing backend on this chain"
          body={`${POOLS_DEPLOYMENT.chainName} carries no listing block in the SDK’s chain registry, so there is nothing to plot. Reads stay idle rather than erroring per chart.`}
        />
      </Panel>
    );
  }

  const handleWindow = (label: string) => {
    const picked = rewardWindowFromLabel(label);
    if (picked) setRewardDays(picked);
  };

  return (
    <Panel>
      <PanelHeader
        eyebrow="Time series"
        title={VIEW_TITLES[view]}
        actions={<Segmented options={VIEWS} value={view} onChange={setView} size="sm" />}
      />

      <div className="flex flex-col gap-3 p-4">
        {view === "tvl" ? (
          /* The `tvl-history` route is not deployed on every environment, and
             the missing one answers `404`. That is "no chart here", not a
             broken page, so it lands in the same empty state as a pool with no
             snapshots — carrying the message, but never a failure color. */
          tvl.error ? (
            <ChartFrame>
              <EmptyState title="No TVL series for this pool" body={tvl.error.message} />
            </ChartFrame>
          ) : (
            <SeriesChart
              kind="area"
              points={tvlPoints}
              color={VIEW_COLORS.tvl}
              height={CHART_HEIGHT}
              isLoading={tvl.isPending}
              emptyTitle="No TVL snapshots yet"
              emptyBody="The inventory service has not recorded a balance for this pool. It appears once the pool holds collateral."
              formatValue={formatUsd}
            />
          )
        ) : null}

        {view === "volume" ? (
          symbolId === null ? (
            <ChartFrame>
              <EmptyState
                title="No solver market yet"
                body="This pool has no symbol id, so there is no Enigma market to report volume for. Its deposits and withdrawals are real — only trading has not started."
              />
            </ChartFrame>
          ) : volume.error ? (
            <ChartFrame>
              <EmptyState title="Volume did not load" body={volume.error.message} />
            </ChartFrame>
          ) : (
            <SeriesChart
              kind="histogram"
              points={volumePoints}
              color={VIEW_COLORS.volume}
              height={CHART_HEIGHT}
              isLoading={volume.isPending}
              emptyTitle="No trades yet"
              emptyBody="Enigma reports no daily volume for this market. The first fill starts the series."
              formatValue={formatUsd}
            />
          )
        ) : null}

        {view === "rewards" ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <Stat
                label={`Rewards paid · last ${rewardDays} days`}
                value={
                  totalReward.isPending ? (
                    <Skeleton className="h-5 w-28" />
                  ) : totalReward.error ? (
                    <Numeric size="lg" tone="muted">
                      {ABSENT}
                    </Numeric>
                  ) : (
                    <Numeric size="lg" tone="strong">
                      {listingUsd(totalReward.data)}
                    </Numeric>
                  )
                }
                /* A dash on its own is indistinguishable from a pool that
                   earned nothing, and this endpoint answers an absent total
                   with 0 rather than null — so a failure has to say so. */
                sub={
                  totalReward.error ? (
                    <span className="text-warn">The windowed total did not answer — the bars below still did.</span>
                  ) : (
                    "The window totals this figure only — the bars below are every snapshot the service holds."
                  )
                }
              />
              <Chips
                className="w-[168px] shrink-0"
                options={REWARD_WINDOW_LABELS}
                value={rewardWindowLabel(rewardDays)}
                onChange={handleWindow}
              />
            </div>

            {rewards.error ? (
              <ChartFrame>
                <EmptyState title="Rewards did not load" body={rewards.error.message} />
              </ChartFrame>
            ) : (
              <SeriesChart
                kind="histogram"
                points={rewardPoints}
                color={VIEW_COLORS.rewards}
                height={CHART_HEIGHT}
                isLoading={rewards.isPending}
                emptyTitle="No rewards paid yet"
                emptyBody="Liquidity providers in this pool have not been paid a reward day. Bars appear once the first distribution lands."
                formatValue={formatUsd}
              />
            )}
          </>
        ) : null}

        <p className="text-2xs text-fg-3">{VIEW_CAPTIONS[view]}</p>
      </div>
    </Panel>
  );
}

interface FrameProps {
  children: ReactNode;
}

/** Holds an empty state at the chart's own height, so a view switch never jumps. */
function ChartFrame({ children }: FrameProps) {
  return (
    <div className="flex items-center justify-center" style={{ height: CHART_HEIGHT }}>
      {children}
    </div>
  );
}
