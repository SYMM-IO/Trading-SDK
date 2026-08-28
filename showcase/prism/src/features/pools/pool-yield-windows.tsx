"use client";

import { MicroLabel, Panel, PanelHeader } from "@/components/panel";
import { DataRow, DataTable, EmptyState, SkeletonRows } from "@/components/table";
import { InfoTip } from "@/components/tooltip";
import { Numeric } from "@/components/value";
import type { ListingApyWindows, ListingMarketDetail } from "@symmio/trading-core";
import { listingRate, listingUsd, rateTone } from "./listing-values";

/** Series name, then one track per trailing window. Every track has a floor. */
const COLUMNS = "minmax(212px,1.7fr) repeat(5, minmax(94px,1fr))";

/** The trailing windows every series reports, shortest first. */
const WINDOWS: readonly { key: keyof ListingApyWindows; label: string }[] = [
  { key: "h1", label: "1H" },
  { key: "h6", label: "6H" },
  { key: "h24", label: "24H" },
  { key: "d30", label: "30D" },
  { key: "lifetime", label: "Lifetime" },
];

/** The five detail fields that carry a full set of windows. */
type YieldSeriesKey = "apy" | "tvlDrivenApy" | "priceDrivenApy" | "rewards" | "solverRevenue";

interface YieldSeries {
  key: YieldSeriesKey;
  label: string;
  /**
   * `rate` rows descale to a percentage already (`1e18` = `1%`); `money` rows
   * descale to USD. Same 18-decimal wire scale, two different questions.
   */
  kind: "rate" | "money";
  /** The row's unit caption — the money rows are cumulative, not annualised. */
  unit: string;
  /** What the row actually measures, behind its information dot. */
  tip: string;
}

const YIELD_SERIES: readonly YieldSeries[] = [
  {
    key: "apy",
    label: "Headline APY",
    kind: "rate",
    unit: "annualised percentage",
    tip: "The pool's published yield — the figure the catalog sorts and filters on. It is derived on its own, not assembled from the two rows below it.",
  },
  {
    key: "tvlDrivenApy",
    label: "TVL-driven APY",
    kind: "rate",
    unit: "annualised percentage",
    tip: "The share of the yield attributed to the pool's own balance growing: fees, funding and solver revenue landing on LP shares. It answers whether the pool is earning, and says nothing about the token.",
  },
  {
    key: "priceDrivenApy",
    label: "Price-driven APY",
    kind: "rate",
    unit: "annualised percentage",
    tip: "The share attributed to the pool token's price. An LP earns this by holding the token while the pool does nothing at all — and gives it back the same way.",
  },
  {
    key: "rewards",
    label: "LP rewards",
    kind: "money",
    unit: "USD accrued in the window",
    tip: "Rewards credited to LPs over the window, in dollars. A cumulative amount, not a rate: the 30D column is money earned across those 30 days, not that month annualised.",
  },
  {
    key: "solverRevenue",
    label: "Solver revenue",
    kind: "money",
    unit: "USD accrued in the window",
    tip: "What the solver took over the same window, in dollars. It is the counterpart to LP rewards rather than a deduction from them — both are paid out of the pool's trading.",
  },
];

export interface PoolYieldWindowsProps {
  /** The already-fetched detail. Absent while it loads and after it fails. */
  detail?: ListingMarketDetail;
  isLoading: boolean;
}

/**
 * The same pool, measured five ways over five windows.
 *
 * The detail response carries all of this and most front ends show one cell of
 * it — the headline APY — which is the cell most likely to be misread. Laid out
 * as a grid, the three rate rows stop looking like one number with rounding
 * differences and start looking like what they are: three separate derivations
 * that regularly point in opposite directions for the same pool.
 */
export function PoolYieldWindows({ detail, isLoading }: PoolYieldWindowsProps) {
  return (
    <Panel>
      <PanelHeader eyebrow="Listing backend" title="Yield windows" />

      <DataTable
        columns={COLUMNS}
        head={
          <>
            <MicroLabel>Series</MicroLabel>
            {WINDOWS.map((column) => (
              <MicroLabel key={column.key} className="text-right">
                {column.label}
              </MicroLabel>
            ))}
          </>
        }
      >
        {isLoading && !detail ? <SkeletonRows columns={COLUMNS} rows={5} cells={6} /> : null}

        {!isLoading && !detail ? (
          <EmptyState
            title="No yield windows for this pool"
            body="The listing backend reports APY, its two decompositions, LP rewards and solver revenue per window once it has answered for this pool."
          />
        ) : null}

        {detail
          ? YIELD_SERIES.map((series) => (
              <DataRow key={series.key} columns={COLUMNS}>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-md font-semibold text-fg-0">{series.label}</span>
                    <span className="shrink-0 text-fg-3">
                      <InfoTip title={series.label} width={280}>
                        {series.tip}
                      </InfoTip>
                    </span>
                  </span>
                  <span className="text-2xs text-fg-3">{series.unit}</span>
                </div>

                {WINDOWS.map((column) => (
                  <WindowCell key={column.key} kind={series.kind} value={detail[series.key][column.key]} />
                ))}
              </DataRow>
            ))
          : null}
      </DataTable>

      <p className="max-w-[104ch] px-4 py-3 text-2xs text-fg-3">
        The headline and the two decompositions routinely disagree for the same pool over the same window — one pool can
        read <span className="tnum text-long">+48%</span> headline against{" "}
        <span className="tnum text-short">−0.76%</span> TVL-driven — because they answer different questions and the
        backend derives each one separately. None of them is the sum of the others, so the row label is part of the
        number.
      </p>
    </Panel>
  );
}

interface WindowCellProps {
  kind: YieldSeries["kind"];
  value: bigint | null;
}

/**
 * One window's figure.
 *
 * A rate is toned by direction; a dollar amount is not — money accrued has no
 * side, and coloring it green would borrow the meaning this design system
 * reserves for LONG. `null` stays a dash in both cases: the backend reporting
 * nothing is not the same claim as it reporting zero.
 */
function WindowCell({ kind, value }: WindowCellProps) {
  return (
    <div className="text-right">
      {kind === "rate" ? (
        <Numeric size="sm" tone={rateTone(value)}>
          {listingRate(value)}
        </Numeric>
      ) : (
        <Numeric size="sm" tone={value === null ? "muted" : "default"}>
          {listingUsd(value)}
        </Numeric>
      )}
    </div>
  );
}
