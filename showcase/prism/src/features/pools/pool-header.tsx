"use client";

import { CopyAction } from "@/components/detail-list";
import { Panel } from "@/components/panel";
import { PILL_SHAPE, Pill, PillDot, PillLabel } from "@/components/pill";
import { Skeleton } from "@/components/table";
import { Numeric, Stat, type NumericProps } from "@/components/value";
import { cn } from "@/lib/cn";
import { formatLeverage, shortenAddress } from "@/lib/format";
import { ListingMarketStatus, type ListingDepositChainId, type ListingMarketDetail } from "@symmio/trading-core";
import type { ReactNode } from "react";
import {
  ABSENT,
  depositChainColor,
  depositChainLabel,
  listingAmount,
  listingDate,
  listingRate,
  listingStatusStyle,
  listingUsd,
  rateTone,
  sharePercent,
} from "./listing-values";

const DAY_SECONDS = 86_400;

export interface PoolHeaderProps {
  /** The pool's token contract address — base58 on Solana, `0x…` elsewhere. */
  address: string;
  /** The token's deposit chain, which is not the chain the perp settles on. */
  chainId: ListingDepositChainId;
  /** The already-fetched detail. Absent while it loads and after it fails. */
  detail?: ListingMarketDetail;
  isLoading: boolean;
}

/**
 * What this pool is, and what it holds.
 *
 * Identity comes from the route rather than the response — the address and the
 * deposit chain are the pair that names the pool, and they are known before the
 * backend answers, so the strip renders its own shape immediately and fills the
 * figures in. Every number below is the listing backend's, at 18 decimals: the
 * money fields descale to USD and the rate fields descale to a percentage
 * already, which is why they never share a formatter.
 */
export function PoolHeader({ address, chainId, detail, isLoading }: PoolHeaderProps) {
  /* The backend reports `tokenTicker` as nullable, so the name is the fallback
     headline rather than an empty slot — and it then stops repeating itself
     beside the headline it just became. */
  const ticker = detail?.tokenTicker ?? null;
  const headline = ticker ?? detail?.tokenName ?? shortenAddress(address, 4, 4);
  const subtitle = ticker ? detail?.tokenName : undefined;
  const status = detail ? listingStatusStyle(detail.marketStatus) : undefined;

  /* A delisted pool keeps its cached balances but reports `tvl` as 0 by design,
     so the tile below can read $0.00 while the pool visibly still holds USDC
     and tokens. That is the backend's answer, not a stale read — the caption
     says so rather than letting the two figures look like a contradiction. */
  const delisted = detail?.marketStatus === ListingMarketStatus.DELISTED;

  return (
    <Panel className="flex flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 pt-4 pb-3">
        {isLoading && !detail ? (
          <Skeleton className="h-7 w-28" />
        ) : (
          <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-fg-0">{headline}</h1>
        )}

        {subtitle ? <span className="truncate text-md text-fg-2">{subtitle}</span> : null}

        {/* Composed rather than `ChainPill`, which keys off a `MarketFamily`: a
            deposit chain is not one of Prism's two deployments — Solana has no
            solver at all — so only the brand dot carries over. */}
        <span className={cn(PILL_SHAPE, "border-line bg-bg-2 text-fg-2")}>
          <PillDot color={depositChainColor(chainId)} />
          <PillLabel>{depositChainLabel(chainId)}</PillLabel>
        </span>

        {status ? (
          <Pill dot color={status.color}>
            {status.label}
          </Pill>
        ) : null}

        <span className="ml-auto flex items-center gap-1.5">
          <span className="tnum font-mono text-2xs text-fg-3">{shortenAddress(address, 6, 6)}</span>
          <CopyAction value={address} label="Contract address" />
        </span>

        {detail?.symbolId === null ? (
          /* No `border` override: matching the fill to the border made this the
             one chip on the strip with no edge at all. It takes the same
             hairline as the chain and status chips beside it. */
          <Pill color="var(--warn-500)" background="var(--warn-bg)">
            No solver market yet
          </Pill>
        ) : detail ? (
          <span className="tnum font-mono text-2xs text-fg-3">#{detail.symbolId}</span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-start gap-x-8 gap-y-4 border-t border-line-subtle px-5 py-4">
        <HeaderStat
          label="TVL"
          isLoading={isLoading}
          value={listingUsd(detail?.tvl)}
          sub={delisted ? "pinned to zero once delisted" : undefined}
        />
        <HeaderStat label="USDC in pool" isLoading={isLoading} value={listingUsd(detail?.totalUsdcInPool)} />
        <HeaderStat
          label="Tokens in pool"
          isLoading={isLoading}
          value={listingAmount(detail?.totalTokenInPool)}
          sub={ticker ?? undefined}
        />
        <HeaderStat
          label="APY"
          isLoading={isLoading}
          value={listingRate(detail?.apy.lifetime)}
          tone={rateTone(detail?.apy.lifetime)}
          sub="lifetime"
        />
        <HeaderStat label="Rewards" isLoading={isLoading} value={listingUsd(detail?.rewards.lifetime)} sub="lifetime" />
        <HeaderStat
          label="Solver revenue"
          isLoading={isLoading}
          value={listingUsd(detail?.solverRevenue.lifetime)}
          sub="lifetime"
        />
        {/* Plain numbers, not 18-decimal figures: LP count, leverage and the
            buy-back share arrive already human-scaled, so descaling them would
            turn 50% into 5e-17. */}
        <HeaderStat
          label="Active LPs"
          isLoading={isLoading}
          value={detail === undefined ? ABSENT : detail.activeLps.toLocaleString("en-US")}
        />
        <HeaderStat label="Max leverage" isLoading={isLoading} value={formatLeverage(detail?.maxLeverage)} />
        <HeaderStat label="Buy-back ratio" isLoading={isLoading} value={sharePercent(detail?.buybackRatio)} />
        <HeaderStat label="Maintenance fees" isLoading={isLoading} value={listingUsd(detail?.maintenanceFees)} />
        <HeaderStat label="Listed" isLoading={isLoading} value={listingDate(detail?.listingTime)} />
        <HeaderStat label="Age" isLoading={isLoading} value={formatAge(detail)} />
      </div>
    </Panel>
  );
}

interface HeaderStatProps {
  label: string;
  /** Already formatted by the listing-values helpers — never a raw `bigint`. */
  value: string;
  tone?: NumericProps["tone"];
  sub?: ReactNode;
  isLoading: boolean;
}

/**
 * One tile in the header strip.
 *
 * A figure the service did not report arrives here as the dash the helpers
 * produce, and drops to the muted tone — the tile stays in place so the strip's
 * shape does not change with the response, but a dash must never read with the
 * confidence of a number.
 */
function HeaderStat({ label, value, tone = "strong", sub, isLoading }: HeaderStatProps) {
  return (
    <Stat
      label={label}
      value={
        isLoading ? (
          <Skeleton className="h-5 w-20" />
        ) : (
          <Numeric size="md" tone={value === ABSENT ? "muted" : tone}>
            {value}
          </Numeric>
        )
      }
      sub={isLoading ? undefined : sub}
    />
  );
}

/**
 * A pool's age, in one coarse unit.
 *
 * Derived from `listingTime` rather than read from `age`, which the SDK types
 * as an elapsed-seconds figure but the live service answers with the listing
 * timestamp itself — the two fields come back byte-identical (1776084720 for
 * both on SYMM), and reading it as a duration renders a four-month-old pool as
 * 56 years old. Deriving it also keeps the tile consistent with the "Listed"
 * tile beside it, which reads the same field.
 *
 * Pools live for months, so the full breakdown is noise: the tile answers
 * whether this pool is days or quarters old, and the exact listing moment is
 * one tile to its left.
 */
function formatAge(detail: ListingMarketDetail | undefined): string {
  const listedAt = detail?.listingTime ?? null;
  if (listedAt === null || !Number.isFinite(listedAt) || listedAt <= 0) return ABSENT;

  const seconds = Math.floor(Date.now() / 1000) - listedAt;
  if (seconds < 0) return ABSENT;

  const days = Math.floor(seconds / DAY_SECONDS);
  if (days >= 365) {
    const years = Math.floor(days / 365);
    const remainder = days % 365;
    return remainder === 0 ? `${years}y` : `${years}y ${remainder}d`;
  }
  if (days >= 1) return `${days}d`;

  const hours = Math.floor(seconds / 3600);
  if (hours >= 1) return `${hours}h`;
  return `${Math.floor(seconds / 60)}m`;
}
