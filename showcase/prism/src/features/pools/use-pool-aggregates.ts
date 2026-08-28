"use client";

import type { SolverRevenue } from "@symmio/trading-core";
import { useInventoryTvl, useMarketInfo, useNotionalCapAll, useSolverRevenue } from "@symmio/trading-react";
import { listingNumber } from "./listing-values";
import { POOLS_CHAIN_ID, POOLS_DEPLOYMENT, usePoolsSupported } from "./pools-deployment";

/**
 * How long the slow aggregates stay fresh.
 *
 * TVL, traded value and revenue all move on windows measured in hours, so they
 * are cached rather than polled. The one genuinely live figure on this strip is
 * the notional-cap read, which keeps the SDK's own 15s poll.
 */
const AGGREGATE_STALE_MS = 60_000;

/**
 * One backend's contribution to the strip: its figures, its loading state, and
 * its own failure.
 *
 * Deliberately not flattened into a single `isLoading` / `error` pair for the
 * whole strip. Four unrelated services answer here, and the inventory service
 * going down must dim exactly one column rather than blank the row that also
 * carries the solver's volume.
 */
export interface AggregateSource<T> {
  /** The figures, once the read resolves. Absent while loading or after a failure. */
  data?: T;
  /** True only while this backend's first response is in flight. */
  isLoading: boolean;
  /** This backend's failure message. The other three columns keep their numbers. */
  error?: string;
}

/** Traded value across the whole book, as the solver aggregates it. */
export interface VolumeFigures {
  /** Σ 24-hour traded value across every market, in dollars. */
  value24h: number;
  /** Σ traded value since the deployment listed, in dollars. */
  lifetime: number;
  /** Markets behind the totals. */
  markets: number;
}

/**
 * The solver's notional totals, named for what each one measures.
 *
 * The two the endpoint reports are easy to read as each other's complement and
 * are not: `used` is gross notional across both sides, `net` is the long-short
 * difference. Neither is remaining capacity, so that one is derived here.
 */
export interface OpenInterestFigures {
  /** Σ `used` — notional open across both sides, in dollars. */
  used: number;
  /** Σ `availableToLong` — notional the solver will still take long, in dollars. */
  availableLong: number;
  /** Σ `availableToShort` — notional the solver will still take short, in dollars. */
  availableShort: number;
  /** Markets the solver returned a cap row for. */
  markets: number;
}

/**
 * Protocol revenue for the trailing day, plus the lifetime total.
 *
 * Every field is optional because a window with no rows is not a window that
 * earned nothing, and the two must not render as the same `$0.00`.
 */
export interface RevenueFigures {
  /** Trailing-24h total in dollars, absent when that window has no rows. */
  day?: number;
  /** The 24h total's hedger-fee share, in dollars. */
  hedgerFee?: number;
  /** The 24h total's funding share, in dollars. */
  funding?: number;
  /** Revenue since listing in dollars, absent when that window has no rows. */
  lifetime?: number;
}

/** Everything the protocol aggregate strip renders, one entry per backend. */
export interface PoolAggregates {
  /** False when the pools chain carries no listing backend; every read stays idle. */
  supported: boolean;
  /** System-wide custodial TVL in dollars, from the inventory service. */
  custody: AggregateSource<number>;
  /** Traded value, from the solver's market-info aggregate. */
  volume: AggregateSource<VolumeFigures>;
  /** Notional open and the headroom left on each side, from the solver's caps. */
  openInterest: AggregateSource<OpenInterestFigures>;
  /** Hedger-fee and funding revenue, from the solver's revenue endpoint. */
  revenue: AggregateSource<RevenueFigures>;
}

/**
 * The four protocol-wide figures above the pool catalog, read from four
 * unrelated backends.
 *
 * None of them is a sum of the catalog below: custodial TVL comes from the
 * inventory service and covers the whole custodial system, while volume, open
 * interest and revenue come from three separate solver endpoints. Where two of
 * these numbers disagree that is a fact about the deployment, not arithmetic to
 * reconcile.
 *
 * Every read is addressed to {@link POOLS_CHAIN_ID} explicitly so the strip is
 * the same whichever chain the wallet sits on, and every read is gated on
 * `supported` — ungated, each throws its own `*_NOT_CONFIGURED` at request time
 * on a chain that carries no such service.
 *
 * @returns One {@link AggregateSource} per backend, each carrying its own
 *   loading and failure state so one outage costs one column.
 */
export function usePoolAggregates(): PoolAggregates {
  const supported = usePoolsSupported();

  /* `supported` is the *listing* backend's gate and the inventory service has
     its own (`INVENTORY_NOT_CONFIGURED`), with no react-side `useSupports…` to
     ask first. A chain that carries a catalog but no inventory therefore shows
     up as this column's error caption rather than as a second boolean. */
  const tvl = useInventoryTvl({
    chainId: POOLS_CHAIN_ID,
    query: { enabled: supported, staleTime: AGGREGATE_STALE_MS },
  });

  const marketInfo = useMarketInfo({
    chainId: POOLS_CHAIN_ID,
    solverId: POOLS_DEPLOYMENT.solverId,
    query: { enabled: supported, staleTime: AGGREGATE_STALE_MS },
  });

  /* Left on the SDK's default 15s poll: caps move as positions open and close,
     and this is the only figure on the strip that is meaningfully live. */
  const caps = useNotionalCapAll({
    chainId: POOLS_CHAIN_ID,
    solverId: POOLS_DEPLOYMENT.solverId,
    query: { enabled: supported },
  });

  /* Two mounts of the same read rather than one: the endpoint answers for a
     single window at a time, and the strip shows the day against the lifetime.
     Omitting `timeRange` is what asks for lifetime — it is the solver's own
     default, not a missing parameter. */
  const revenueDay = useSolverRevenue({
    chainId: POOLS_CHAIN_ID,
    solverId: POOLS_DEPLOYMENT.solverId,
    timeRange: "24h",
    query: { enabled: supported, staleTime: AGGREGATE_STALE_MS },
  });

  const revenueLifetime = useSolverRevenue({
    chainId: POOLS_CHAIN_ID,
    solverId: POOLS_DEPLOYMENT.solverId,
    query: { enabled: supported, staleTime: AGGREGATE_STALE_MS },
  });

  /* Narrowed on `kind`, not cast: `/get_market_info` is one endpoint with two
     shapes and only the enigma shape carries book-wide totals. A rasa solver
     publishes per-market rows and no aggregate at all, so there is genuinely
     nothing to show rather than a zero to print. */
  const info = marketInfo.data;
  const volume =
    info?.kind === "enigma"
      ? { value24h: info.totalValue24h, lifetime: info.totalLifetimeValue, markets: info.markets.length }
      : undefined;

  /* `used` is the notional currently open across both sides — the figure a book
     reports as open interest — and it is the only aggregate here that means
     what its name suggests. The endpoint's `totalOpenInterest` is NOT the
     complement of it: on the live deployment SYMM reads used $120K against
     openInterest $457K, which tracks `availableToLong + used`, so it behaves
     like a ceiling rather than an exposure. Headroom therefore comes from the
     per-side `availableToLong` / `availableToShort` rows, summed here, and not
     from `totalCap` — every market reports that as `0` today, which would make
     a `totalCap − used` figure read as "no capacity left" on a solver that is
     still quoting. */
  const openInterest = caps.data
    ? {
        used: caps.data.totalUsed,
        availableLong: caps.data.symbols.reduce((total, market) => total + market.availableToLong, 0),
        availableShort: caps.data.symbols.reduce((total, market) => total + market.availableToShort, 0),
        markets: caps.data.count,
      }
    : undefined;

  const day = reportedRevenue(revenueDay.data);
  const lifetime = reportedRevenue(revenueLifetime.data);
  const revenue =
    revenueDay.data || revenueLifetime.data
      ? {
          day: day?.totalRevenue,
          hedgerFee: day?.hedgerFeeRevenue,
          funding: day?.fundingRevenue,
          lifetime: lifetime?.totalRevenue,
        }
      : undefined;

  return {
    supported,
    custody: {
      /* Descaled through the listing helper on purpose. The inventory service
         scales TVL at `INVENTORY_VALUE_DECIMALS` and the listing backend at
         `LISTING_VALUE_DECIMALS`; both are declared 18 in the shipped SDK —
         checked, not assumed — so one descale serves both. It also keeps "not
         reported" as `undefined` instead of collapsing it to `$0`. */
      data: listingNumber(tvl.data),
      isLoading: tvl.isLoading,
      error: tvl.error?.message,
    },
    volume: { data: volume, isLoading: marketInfo.isLoading, error: marketInfo.error?.message },
    openInterest: { data: openInterest, isLoading: caps.isLoading, error: caps.error?.message },
    revenue: {
      data: revenue,
      isLoading: revenueDay.isLoading || revenueLifetime.isLoading,
      /* Reported only when neither window answered. The column renders its
         error caption in place of the split, so a live 24h figure under "the
         solver did not answer" would contradict the number above it — one
         window failing is a missing tail, not a failed column. */
      error: revenue ? undefined : (revenueDay.error?.message ?? revenueLifetime.error?.message),
    },
  };
}

/**
 * The window's totals, or `undefined` when the solver reported no rows for it.
 *
 * `recordCount === 0` means "there is no data for this window", not "this window
 * earned nothing". Both would render as `$0.00` and only one of them is true, so
 * the empty window loses its totals here and the caption says which it is.
 */
function reportedRevenue(revenue: SolverRevenue | undefined): SolverRevenue | undefined {
  return revenue && revenue.recordCount > 0 ? revenue : undefined;
}
