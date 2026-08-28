"use client";

import { ResultError, ResultNote } from "@/components/result";
import { Stat } from "@/components/stat";
import { useWeeklyListingLimit } from "@symmio/trading-react";
import { cn } from "@symmio/ui/lib/utils";
import { MethodCard } from "../inspector/method-card";
import { useSolverKindActive } from "../solvers/solver-target";
import { formatResetAt } from "./format-listing-value";

/**
 * Weekly listing limit — how many new pools can still be listed across the
 * protocol this week. The create-pool flow blocks at `remaining === 0`; this
 * card surfaces the numbers so the user knows where things stand before they
 * start.
 *
 * Public read (`useWeeklyListingLimit`, no token) — the cap is protocol-global,
 * not per-user — but Enigma-only like the rest of Pools, so it carries the same
 * Enigma gate note as the other Listing cards.
 */
export function WeeklyLimitCard() {
  const enigmaActive = useSolverKindActive("enigma");
  const weekly = useWeeklyListingLimit();

  const used = weekly.data ? Math.max(0, weekly.data.limit - weekly.data.remaining) : 0;
  const reached = weekly.data ? weekly.data.remaining <= 0 : false;
  /** Share of the week's cap already spent, for the meter. A zero cap reads as full. */
  const usedShare = weekly.data ? (weekly.data.limit > 0 ? Math.min(1, used / weekly.data.limit) : 1) : 0;

  return (
    <MethodCard
      testId="method-getWeeklyListingLimit"
      name="getWeeklyListingLimit"
      mutability="view"
      description="Weekly listing limit — the new pools that can still be listed this week across the protocol. The create-pool flow blocks at 0. Public, Enigma-only."
    >
      {!enigmaActive ? (
        <ResultNote testId="weekly-limit-gate">
          Switch to Enigma (HyperEVM) to read the weekly listing limit.
        </ResultNote>
      ) : weekly.error ? (
        <ResultError kind={weekly.error.kind} message={weekly.error.message} testId="weekly-limit-error" />
      ) : weekly.isPending || weekly.data === undefined ? (
        <ResultNote testId="weekly-limit-loading" loading>
          Loading the weekly limit…
        </ResultNote>
      ) : (
        <div className="flex flex-col gap-5" data-testid="weekly-limit">
          <div className="border-info/30 bg-info/5 flex flex-col gap-4 rounded-xl border p-4">
            <Stat
              label="Remaining this week"
              value={String(weekly.data.remaining)}
              hint={`of ${weekly.data.limit} listings · ${used} used`}
            />
            {/* The meter is the same figure as a proportion — how close the week is to its cap. */}
            <div
              className="bg-muted/70 h-1.5 w-full overflow-hidden rounded-full"
              role="meter"
              aria-label="Weekly listings used"
              aria-valuemin={0}
              aria-valuemax={weekly.data.limit}
              aria-valuenow={used}
            >
              <div
                className={cn("h-full rounded-full transition-[width]", reached ? "bg-warning" : "bg-info")}
                style={{ width: `${usedShare * 100}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Stat size="sm" label="Used" value={String(used)} />
            <Stat size="sm" label="Weekly limit" value={String(weekly.data.limit)} />
            <Stat
              size="sm"
              label="Resets"
              value={<span className="text-sm">{formatResetAt(weekly.data.resetAt)}</span>}
              hint="UTC"
              testId="weekly-limit-reset"
              className="col-span-full"
            />
          </div>

          {reached ? (
            <ResultNote testId="weekly-limit-reached">
              The weekly listing limit is reached — no more pools can be listed until it resets.
            </ResultNote>
          ) : null}
        </div>
      )}
    </MethodCard>
  );
}
