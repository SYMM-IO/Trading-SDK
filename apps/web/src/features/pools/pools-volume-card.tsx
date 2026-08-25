"use client";

import { ResultError, ResultNote } from "@/components/result";
import { Stat } from "@/components/stat";
import { useMarketInfo } from "@symmio/trading-react";
import { formatCompactCurrency } from "@symmio/utils";
import { MethodCard } from "../inspector/method-card";

/** Compact dollars, or an em dash while the figure is not yet known. */
function usd(value: number | undefined): string {
  return value === undefined ? "—" : formatCompactCurrency(value, { maxDecimals: 2 });
}

/**
 * Traded volume across every market, from the solver's market-info read.
 *
 * The aggregate totals are Enigma-only — a rasa-kind solver returns per-market
 * price and change with no totals at all — so this narrows on `data.kind` rather
 * than assuming the fields exist.
 */
export function PoolsVolumeCard() {
  const { data, error } = useMarketInfo();
  const totals = data?.kind === "enigma" ? data : undefined;

  return (
    <MethodCard
      testId="pools-volume"
      name="useMarketInfo"
      mutability="view"
      description="Traded value across every market, over 24 hours and since launch. Aggregate totals are Enigma-only."
    >
      {error ? (
        <ResultError kind={error.kind} message={error.message} testId="pools-volume-error" />
      ) : data && totals === undefined ? (
        <ResultNote testId="pools-volume-unsupported">
          This chain&rsquo;s solver reports per-market figures only — it exposes no aggregate volume totals.
        </ResultNote>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          <div data-testid="pools-volume-24h">
            <Stat
              label="Volume · 24h"
              value={usd(totals?.totalValue24h)}
              hint={totals ? `${totals.markets.length.toLocaleString()} markets` : undefined}
            />
          </div>
          <div data-testid="pools-volume-lifetime">
            <Stat label="Volume · lifetime" value={usd(totals?.totalLifetimeValue)} />
          </div>
        </div>
      )}
    </MethodCard>
  );
}
