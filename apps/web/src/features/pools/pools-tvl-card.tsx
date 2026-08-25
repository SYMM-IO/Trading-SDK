"use client";

import { ResultError } from "@/components/result";
import { Stat } from "@/components/stat";
import { INVENTORY_VALUE_DECIMALS } from "@symmio/trading-core";
import { useInventoryTvl } from "@symmio/trading-react";
import { formatCompactCurrency } from "@symmio/utils";
import { formatUnits } from "@symmio/utils/decimal";
import { MethodCard } from "../inspector/method-card";

/**
 * System-wide custodial TVL from the inventory service.
 *
 * Its own card because it comes from a different vendor than everything else on
 * this page, and because it is *not* the sum of the catalogue's per-pool `tvl`:
 * the catalogue covers listed markets, this covers the whole custodial system.
 */
export function PoolsTvlCard() {
  const { data, isPending, error } = useInventoryTvl();

  return (
    <MethodCard
      testId="pools-tvl"
      name="useInventoryTvl"
      mutability="view"
      description="System-wide custodial TVL from the inventory service — the whole custodial system, not just listed markets."
    >
      {error ? (
        <ResultError kind={error.kind} message={error.message} testId="pools-tvl-error" />
      ) : (
        <div data-testid="pools-tvl-value">
          <Stat
            label="Total value locked"
            value={
              isPending || data === undefined
                ? "—"
                : formatCompactCurrency(formatUnits(data, INVENTORY_VALUE_DECIMALS), { maxDecimals: 2 })
            }
          />
        </div>
      )}
    </MethodCard>
  );
}
