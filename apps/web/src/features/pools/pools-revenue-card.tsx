"use client";

import { ResultError } from "@/components/result";
import { Stat } from "@/components/stat";
import { useSolverRevenue } from "@symmio/trading-react";
import { formatCompactCurrency } from "@symmio/utils";
import { MethodCard } from "../inspector/method-card";

/** Compact dollars, or an em dash while the figure is not yet known. */
function usd(value: number | undefined): string {
  return value === undefined ? "—" : formatCompactCurrency(value, { maxDecimals: 2 });
}

/**
 * Protocol-wide solver revenue, lifetime and over the trailing 24 hours.
 *
 * Deliberately **not** scoped to a market. The reference UI's overview reads
 * `revenue/1` — a hardcoded market id — so its "Lifetime Revenue" under-reports
 * the protocol; passing no `symbolId` here asks for the real total.
 *
 * The hint line splits the total into its hedger-fee and funding shares, which
 * is the part that explains where the number came from.
 */
export function PoolsRevenueCard() {
  const lifetime = useSolverRevenue();
  const day = useSolverRevenue({ timeRange: "24h" });

  const error = lifetime.error ?? day.error;

  return (
    <MethodCard
      testId="pools-revenue"
      name="useSolverRevenue"
      mutability="view"
      description="Protocol-wide solver revenue, split into hedger-fee and funding shares. Pass a symbolId to narrow it to one market."
      size="sm"
    >
      {error ? (
        <ResultError kind={error.kind} message={error.message} testId="pools-revenue-error" />
      ) : (
        <div className="flex flex-col gap-5">
          <div data-testid="pools-revenue-24h">
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
          <div data-testid="pools-revenue-lifetime">
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
