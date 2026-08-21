"use client";

import { MicroLabel } from "@/components/panel";
import { Numeric } from "@/components/value";
import { FAMILY_PALETTE, type MarketFamily } from "@/config/deployments";
import { formatPercent, formatUsd } from "@/lib/format";

export interface AllocationSlice {
  family: MarketFamily;
  label: string;
  /** Equity settled on this family, in display units. */
  value: number;
}

export interface AllocationBarProps {
  slices: readonly AllocationSlice[];
  className?: string;
}

/**
 * How the portfolio's equity splits across market families.
 *
 * Each segment carries its family's own color — cyan for majors, magenta for
 * lowcaps — because a market's identity is a fact about the market and does not
 * follow the palette mode. The bar is the fastest read of the thing this screen
 * is really about: two separate pools of money that happen to be shown together.
 */
export function AllocationBar({ slices, className }: AllocationBarProps) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const funded = slices.filter((slice) => slice.value > 0);

  return (
    <div className={className}>
      <div className="flex items-baseline gap-3">
        <MicroLabel>Allocation</MicroLabel>
        <span className="ml-auto text-2xs text-fg-3">
          {total > 0 ? "Equity by settlement group" : "No equity to split yet"}
        </span>
      </div>

      <div className="mt-2 flex h-2.5 w-full gap-[3px] overflow-hidden rounded-full bg-bg-0">
        {funded.length === 0 ? (
          <span aria-hidden className="h-full w-full rounded-full bg-bg-3" />
        ) : (
          funded.map((slice) => {
            const palette = FAMILY_PALETTE[slice.family];
            return (
              <span
                key={slice.family}
                aria-hidden
                className="h-full rounded-full"
                style={{
                  width: `${(slice.value / total) * 100}%`,
                  background: `linear-gradient(90deg, ${palette.base}, ${palette.base} 60%, ${palette.border})`,
                  transition: "width var(--dur-slow) var(--ease-out)",
                }}
              />
            );
          })
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-x-6 gap-y-2">
        {slices.map((slice) => (
          <div key={slice.family} className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-[7px] shrink-0 rounded-full"
              style={{ background: FAMILY_PALETTE[slice.family].base }}
            />
            <span className="text-sm whitespace-nowrap text-fg-2">{slice.label}</span>
            <Numeric size="sm" tone="strong">
              {formatUsd(slice.value, { exact: true })}
            </Numeric>
            <Numeric size="sm" tone="muted">
              {formatPercent(total > 0 ? (slice.value / total) * 100 : 0, { decimals: 1 })}
            </Numeric>
          </div>
        ))}
      </div>
    </div>
  );
}
