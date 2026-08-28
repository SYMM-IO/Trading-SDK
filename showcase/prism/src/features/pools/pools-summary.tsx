"use client";

import { MicroLabel, Panel } from "@/components/panel";
import { Skeleton } from "@/components/table";
import { Numeric } from "@/components/value";
import { formatUsd } from "@/lib/format";
import type { ReactNode } from "react";
import { ABSENT } from "./listing-values";
import { POOLS_DEPLOYMENT } from "./pools-deployment";
import { usePoolAggregates, type RevenueFigures } from "./use-pool-aggregates";

/**
 * What the pool system holds, trades and earns — four figures, four backends.
 *
 * The strip is an audit of the same claim the catalog below makes, from outside
 * it: none of these numbers is a column sum. Custodial TVL is the inventory
 * service's view of the whole system, volume and open interest and revenue come
 * from three separate solver endpoints, and the catalog is the listing backend.
 * They are shown side by side precisely because they can disagree.
 *
 * A backend that fails costs one column — an em dash and a caption naming who
 * did not answer — never the strip.
 */
export function PoolsSummary() {
  const { supported, custody, volume, openInterest, revenue } = usePoolAggregates();

  /* On a chain with no pools backend every read is idle, and the scope notice
     directly above already says why. Four dashes would only repeat it. */
  if (!supported) return null;

  const solver = POOLS_DEPLOYMENT.solverName;
  const dayRevenue = revenue.data?.day;

  return (
    <Panel className="flex flex-wrap items-stretch gap-x-10 gap-y-5 px-5 py-4">
      <AggregateStat
        label="Custodial TVL"
        value={custody.data === undefined ? undefined : formatUsd(custody.data)}
        isLoading={custody.isLoading}
        source="Inventory service"
        error={custody.error}
        caption="inventory service · all custody, not the catalog’s sum"
      />

      <AggregateStat
        label="24h volume"
        value={volume.data ? formatUsd(volume.data.value24h) : undefined}
        isLoading={volume.isLoading}
        source={`${solver} market-info`}
        error={volume.error}
        caption={
          volume.data ? (
            <>
              {solver} market-info · <span className="tnum">{formatUsd(volume.data.lifetime)}</span> lifetime over{" "}
              <span className="tnum">{volume.data.markets}</span> markets
            </>
          ) : (
            `${solver} publishes no book-wide totals`
          )
        }
      />

      <AggregateStat
        label="Open interest"
        value={openInterest.data ? formatUsd(openInterest.data.used) : undefined}
        isLoading={openInterest.isLoading}
        source={`${solver} notional caps`}
        error={openInterest.error}
        caption={
          openInterest.data ? (
            <>
              both sides, across <span className="tnum">{openInterest.data.markets}</span> markets ·{" "}
              <span className="tnum">{formatUsd(openInterest.data.availableLong)}</span> long /{" "}
              <span className="tnum">{formatUsd(openInterest.data.availableShort)}</span> short still accepted
            </>
          ) : (
            `${solver} reported no caps`
          )
        }
      />

      <AggregateStat
        label="Revenue · 24h"
        value={dayRevenue === undefined ? undefined : formatUsd(dayRevenue)}
        isLoading={revenue.isLoading}
        source={`${solver} revenue`}
        error={revenue.error}
        caption={revenueCaption(revenue.data)}
      />
    </Panel>
  );
}

interface Props {
  label: string;
  /** The formatted headline. Absent renders as {@link ABSENT}, never as zero. */
  value?: string;
  isLoading: boolean;
  /** What the figure is and which backend answered it. */
  caption: ReactNode;
  /** The backend's name, used only to say who went down. */
  source: string;
  /** That backend's failure message, when this column's read is down. */
  error?: string;
}

/**
 * One column of the strip, following the screen's state ladder: loading, then
 * failed, then the figure.
 *
 * The caption is skeletoned along with the value rather than shown early —
 * every caption but the first is derived from the response, so rendering it
 * before the read lands would state something the backend has not said yet.
 */
function AggregateStat({ label, value, isLoading, caption, source, error }: Props) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <MicroLabel>{label}</MicroLabel>

      {isLoading ? (
        <Skeleton className="h-6 w-24" />
      ) : (
        <Numeric size="2xl" tone={value === undefined ? "muted" : "strong"}>
          {value ?? ABSENT}
        </Numeric>
      )}

      {isLoading ? (
        <Skeleton className="mt-0.5 h-2.5 w-32" />
      ) : error ? (
        <span className="max-w-[34ch] text-2xs text-warn">
          {source} did not answer — {error}
        </span>
      ) : (
        <span className="max-w-[34ch] text-2xs text-fg-3">{caption}</span>
      )}
    </div>
  );
}

/**
 * The split under the 24h revenue figure.
 *
 * A window the solver has no rows for is not a window that earned nothing, so
 * the empty case says which it is instead of printing a fee and a funding share
 * of zero. The lifetime tail is dropped on the same rule.
 */
function revenueCaption(figures: RevenueFigures | undefined): ReactNode {
  if (!figures) return `${POOLS_DEPLOYMENT.solverName} reported no revenue`;

  return (
    <>
      {figures.day === undefined ? (
        "no rows in the last 24h"
      ) : (
        <>
          <span className="tnum">{formatUsd(figures.hedgerFee)}</span> hedger fees ·{" "}
          <span className="tnum">{formatUsd(figures.funding)}</span> funding
        </>
      )}
      {figures.lifetime === undefined ? null : (
        <>
          {" · "}
          <span className="tnum">{formatUsd(figures.lifetime)}</span> lifetime
        </>
      )}
    </>
  );
}
