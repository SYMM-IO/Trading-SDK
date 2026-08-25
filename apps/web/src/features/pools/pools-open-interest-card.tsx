"use client";

import { ResultError } from "@/components/result";
import { Stat } from "@/components/stat";
import { useNotionalCapAll } from "@symmio/trading-react";
import { formatCompactCurrency } from "@symmio/utils";
import { MethodCard } from "../inspector/method-card";

/** Compact dollars, or an em dash while the figure is not yet known. */
function usd(value: number | undefined): string {
  return value === undefined ? "—" : formatCompactCurrency(value, { maxDecimals: 2 });
}

/**
 * Open interest across every market, from the solver's notional-cap list.
 *
 * `totalUsed` is notional already open; `totalOpenInterest` is what the solver
 * will still take. The solver reports both in plain dollars — no decimal
 * scaling, unlike the listing and inventory backends on this page.
 */
export function PoolsOpenInterestCard() {
  const { data, error } = useNotionalCapAll();

  return (
    <MethodCard
      testId="pools-open-interest"
      name="useNotionalCapAll"
      mutability="view"
      description="Open and still-available notional across every market the solver quotes."
    >
      {error ? (
        <ResultError kind={error.kind} message={error.message} testId="pools-open-interest-error" />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          <div data-testid="pools-open-interest-used">
            <Stat
              label="Open interest"
              value={usd(data?.totalUsed)}
              hint={data ? `${data.count.toLocaleString()} markets` : undefined}
            />
          </div>
          <div data-testid="pools-open-interest-available">
            <Stat label="Available" value={usd(data?.totalOpenInterest)} hint="Notional the solver will still take" />
          </div>
        </div>
      )}
    </MethodCard>
  );
}
