"use client";

import { ResultError, ResultNote } from "@/components/result";
import { Stat } from "@/components/stat";
import { useWeeklyListingLimit } from "@symmio/trading-react";
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
        <div className="flex flex-col gap-4" data-testid="weekly-limit">
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Remaining" value={String(weekly.data.remaining)} />
            <Stat label="Used" value={String(used)} />
            <Stat label="Weekly limit" value={String(weekly.data.limit)} />
          </div>
          <div className="flex flex-col gap-1" data-testid="weekly-limit-reset">
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Resets</span>
            <span className="text-foreground font-mono text-sm tabular-nums">{formatResetAt(weekly.data.resetAt)}</span>
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
