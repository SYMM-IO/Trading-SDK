"use client";

import { ResultError, ResultNote } from "@/components/result";
import { Stat } from "@/components/stat";
import { useSolverRevenue } from "@symmio/trading-react";
import { formatCompactCurrency } from "@symmio/utils";
import { MethodCard } from "../inspector/method-card";
import { useSolverKindActive } from "../solvers/solver-target";
import { usePoolScope } from "./pool-scope";

/** Compact dollars, or an em dash while the figure is not yet known. */
function usd(value: number | undefined): string {
  return value === undefined ? "—" : formatCompactCurrency(value, { maxDecimals: 2 });
}

/**
 * One pool's solver revenue, lifetime and over the trailing 24 hours.
 *
 * Per-market by necessity, not by choice: the current solver generation serves
 * revenue through `/revenue/{symbolId}` only — the protocol-wide `/revenue`
 * aggregate this card once read no longer exists. Like volume, the read is
 * keyed by the pool's solver market id, so it exists only once the pool is
 * `LISTED`.
 *
 * The hint line splits each total into its hedger-fee and funding shares, which
 * is the part that explains where the number came from.
 */
export function PoolRevenueCard() {
  const enigmaActive = useSolverKindActive("enigma");
  const { market, hasPool } = usePoolScope();

  const symbolId = market?.symbolId ?? null;
  const enabled = enigmaActive && hasPool && symbolId !== null;

  const lifetime = useSolverRevenue({ symbolId: symbolId ?? 0, query: { enabled } });
  const day = useSolverRevenue({ symbolId: symbolId ?? 0, timeRange: "24h", query: { enabled } });

  const error = lifetime.error ?? day.error;

  return (
    <MethodCard
      testId="pool-revenue"
      name="useSolverRevenue"
      mutability="view"
      description="One pool's solver revenue, split into hedger-fee and funding shares — keyed by the pool's solver market id, so only a listed pool has a figure. Enigma-only."
      size="sm"
    >
      {!enigmaActive ? (
        <ResultNote testId="pool-revenue-gate">Switch to an Enigma solver to read a pool’s revenue.</ResultNote>
      ) : !hasPool ? (
        <ResultNote testId="pool-revenue-idle">Pick a pool above to read its revenue.</ResultNote>
      ) : symbolId === null ? (
        <ResultNote testId="pool-revenue-unlisted">
          This pool is not listed yet, so it has no solver market and no revenue to read.
        </ResultNote>
      ) : error ? (
        <ResultError kind={error.kind} message={error.message} testId="pool-revenue-error" />
      ) : (
        <div className="flex flex-col gap-5">
          <div data-testid="pool-revenue-24h">
            <Stat
              label="Revenue · 24h"
              value={usd(day.data?.totalRevenue)}
              hint={
                day.data
                  ? `${usd(day.data.hedgerFeeRevenue)} fees · ${usd(day.data.fundingRevenue)} funding · ${day.data.recordCount.toLocaleString()} records`
                  : undefined
              }
            />
          </div>
          <div data-testid="pool-revenue-lifetime">
            <Stat
              label="Revenue · lifetime"
              value={usd(lifetime.data?.totalRevenue)}
              hint={
                lifetime.data
                  ? `${usd(lifetime.data.hedgerFeeRevenue)} fees · ${usd(lifetime.data.fundingRevenue)} funding · ${lifetime.data.recordCount.toLocaleString()} records`
                  : undefined
              }
            />
          </div>
        </div>
      )}
    </MethodCard>
  );
}
