"use client";

import { DetailRow, DetailSection } from "@/components/detail-list";
import { Numeric } from "@/components/value";
import type { Deployment } from "@/config/deployments";
import { formatPercent, formatUsd, fromWei } from "@/lib/format";
import { NextFunding } from "./position-details-modal";
import type { GroupFunding } from "./use-group-funding";

/** What each non-numeric settled state should say, in the sheet's own voice. */
const SETTLED_NOTE: Record<Exclude<GroupFunding["settledState"], "known">, string> = {
  "off-chain": "not on-chain yet",
  loading: "…",
  error: "read failed",
  "not-indexed": "not indexed yet",
  "no-indexer": "no indexer",
};

export interface GroupFundingSectionProps {
  funding: GroupFunding;
  /** Σ platform fees across the group's children, wei. */
  fees: { openFee: bigint; closeFee: bigint };
  /** `true` when any child has a closed portion, which is what gives the close fee a subject. */
  hasClosed: boolean;
  isLong: boolean;
  deployment: Deployment;
}

/**
 * What holding this group has cost — settled, upcoming, and in fees.
 *
 * The per-quote twin of this section renders the same four figures for one
 * position, and the reasoning behind the *shape* is the same: settled funding
 * and the next epoch's estimate sit together because they are the same quantity
 * at two points in time, and they are deliberately rendered differently. The
 * settled figure comes from the indexer with a documented income-positive sign;
 * the sign of the solver's published next-epoch rate is contradicted by the
 * contract it settles against, so the estimate is a magnitude with the direction
 * spelled out in words — true under either convention, where a signed dollar
 * figure would be exactly backwards under one of them.
 *
 * What a group adds is **completeness**. The total is a sum over the children
 * the indexer answered for, and a group's newest leg is routinely a few blocks
 * ahead of the subgraph. Suppressing the whole figure until every leg lands
 * would blank a real number for the legs that did; presenting it silently would
 * report a partial bill as the position's whole cost. So it is shown, and said
 * to be partial, with the count that makes it checkable.
 */
export function GroupFundingSection({ funding, fees, hasClosed, isLong, deployment }: GroupFundingSectionProps) {
  const side = isLong ? "Long" : "Short";
  const state = funding.settledState;
  const isPartial = state === "known" && !funding.isComplete;

  return (
    <DetailSection
      title="Funding & fees"
      note={state === "known" ? `${funding.resolvedCount} of ${funding.expectedCount} legs indexed` : undefined}
    >
      <DetailRow
        label="Net funding"
        tip={{
          title: "Net funding",
          body: "Funding received minus funding paid over the life of every quote in this group, as settled on-chain and indexed by the analytics subgraph. Positive means the group has earned funding. It covers charges already made — funding accrued since the last one is indexed nowhere.",
        }}
        value={
          state === "known" ? (
            <Numeric size="sm" signed={fromWei(funding.netSettled)}>
              {formatUsd(fromWei(funding.netSettled), { exact: true, signed: true, maxDecimals: 4 })}
            </Numeric>
          ) : (
            <Numeric size="sm" tone="muted">
              {SETTLED_NOTE[state]}
            </Numeric>
          )
        }
        sub={
          state === "known" && funding.netSettled !== 0n
            ? `${formatUsd(fromWei(funding.received), { exact: true, maxDecimals: 4 })} in · ${formatUsd(fromWei(funding.paid), { exact: true, maxDecimals: 4 })} out`
            : state === "no-indexer"
              ? `${deployment.chainName} has no analytics subgraph yet`
              : undefined
        }
      />

      {/* The one thing a partial sum must never do is read as a total. */}
      {isPartial ? (
        <p className="pb-1 text-2xs leading-relaxed text-warn">
          {`${funding.expectedCount - funding.resolvedCount} of this group's quotes are not indexed yet, so the figure above covers only the rest of them.`}
        </p>
      ) : null}

      <DetailRow
        label="Upcoming funding"
        tip={{
          title: "Upcoming funding",
          body: "An estimate for the epoch now running: the solver's next-epoch rate for this side, applied to the group's whole open notional at the current mark. Each quote is charged separately at the same rate, so the group's bill is their sum. It moves with the price until it settles.",
        }}
        value={
          funding.upcoming === undefined ? (
            <Numeric size="sm" tone="muted">
              —
            </Numeric>
          ) : (
            <Numeric size="sm" tone={funding.isUpcomingIncome ? "long" : "short"}>
              {formatUsd(funding.upcoming, { exact: true, maxDecimals: 4 })}
            </Numeric>
          )
        }
        sub={
          funding.upcoming === undefined ? (
            <NextFunding at={funding.nextFundingTime} epochSeconds={funding.epochSeconds} />
          ) : (
            <>
              {side} {funding.isUpcomingIncome ? "receives" : "pays"} ·{" "}
              <NextFunding at={funding.nextFundingTime} epochSeconds={funding.epochSeconds} />
            </>
          )
        }
        isLoading={funding.isUpcomingLoading}
      />

      {funding.rate !== undefined ? (
        <DetailRow
          label="Funding rate"
          value={<Numeric size="sm">{formatPercent(funding.rate * 100, { decimals: 4 })}</Numeric>}
          sub={funding.epochSeconds ? `per ${Math.round(funding.epochSeconds / 3600)}h epoch` : "per epoch"}
        />
      ) : null}

      <DetailRow
        label="Platform fee"
        tip={{
          title: "Platform fee",
          body: "Every quote's open fee, computed on its own size at the price it opened at, at the market's own open-fee rate. An estimate: the contract charges a limit order on its requested price and a market order on the market price at fill.",
        }}
        value={<Numeric size="sm">{formatUsd(fromWei(fees.openFee), { exact: true, maxDecimals: 4 })}</Numeric>}
        sub="on open, est. · all legs"
      />

      {hasClosed ? (
        <DetailRow
          label="Close fee"
          value={<Numeric size="sm">{formatUsd(fromWei(fees.closeFee), { exact: true, maxDecimals: 4 })}</Numeric>}
          sub="on the closed portions"
        />
      ) : null}
    </DetailSection>
  );
}
