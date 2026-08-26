"use client";

import { ResultError, ResultNote } from "@/components/result";
import { Stat } from "@/components/stat";
import { useListingConfig } from "@symmio/trading-react";
import { Badge } from "@symmio/ui/components/badge";
import { MethodCard } from "../inspector/method-card";
import { useSolverKindActive } from "../solvers/solver-target";
import { formatListingUsd } from "./format-listing-value";

/**
 * Listing config — the public client configuration a user must see **before**
 * creating a pool: the recommended and minimum initial deposits, the listing
 * fee, the protocol reward share, the per-day rate limits, and the deposit
 * chains new listings may use.
 *
 * Emphasized on the page because it drives the create-pool form: the
 * recommended initial deposit is the figure the user seeds the pool with, and
 * `supportedDepositChains` is the source of truth for the create-pool chain
 * picker — so those two are given visual weight over the rest.
 *
 * Public read (`useListingConfig`, no token), but Enigma-only like the rest of
 * Pools — the listing backend lives on HyperEVM — so it carries the same Enigma
 * gate note as the other Listing-session cards.
 */
export function ListingConfigCard() {
  const enigmaActive = useSolverKindActive("enigma");
  const { data, isPending, error } = useListingConfig();

  return (
    <MethodCard
      testId="method-getListingConfig"
      name="getListingConfig"
      mutability="view"
      description="Listing config — the public deposit guidance, listing fee, rate limits, reward share, and supported deposit chains a user must see before creating a pool. Public read, Enigma-only."
      wide
    >
      {!enigmaActive ? (
        <ResultNote testId="listing-config-gate">Switch to Enigma (HyperEVM) to load the listing config.</ResultNote>
      ) : error ? (
        <ResultError kind={error.kind} message={error.message} testId="listing-config-error" />
      ) : isPending || data === undefined ? (
        <ResultNote testId="listing-config-loading" loading>
          Loading listing config…
        </ResultNote>
      ) : (
        <div className="flex flex-col gap-6" data-testid="listing-config">
          {/* The recommended initial deposit gets the most weight: it is the figure the
              user seeds a new pool with. Minimum + fee sit beside it, one scale down. */}
          <div className="border-info/30 bg-info/5 flex flex-col gap-4 rounded-xl border p-4">
            <Stat
              label="Recommended initial deposit"
              value={formatListingUsd(data.recommendedInitialDepositUsdc)}
              hint="Seed a new pool with this to start listing."
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1" data-testid="listing-config-minimum">
                <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Minimum initial deposit
                </span>
                <span className="text-foreground text-2xl font-semibold tabular-nums">
                  {formatListingUsd(data.minimumInitialDepositUsdc)}
                </span>
              </div>
              <div className="flex flex-col gap-1" data-testid="listing-config-fee">
                <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Listing fee</span>
                <span className="text-foreground text-2xl font-semibold tabular-nums">
                  {formatListingUsd(data.listingFeeUsdc)}
                </span>
              </div>
            </div>
          </div>

          {/* The deposit chains the create-pool picker offers — highlighted because the
              form derives its options from exactly this list. */}
          <div className="flex flex-col gap-2" data-testid="listing-config-chains">
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Supported deposit chains
            </span>
            <div className="flex flex-wrap gap-1.5">
              {data.supportedDepositChains.length === 0 ? (
                <span className="text-muted-foreground text-sm">—</span>
              ) : (
                data.supportedDepositChains.map((chain) => (
                  <Badge key={chain.chainId} variant="info" data-testid={`listing-config-chain-${chain.chainId}`}>
                    {chain.chainName} ({chain.chainId})
                  </Badge>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1" data-testid="listing-config-reward-share">
              <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Protocol reward share
              </span>
              <span className="text-foreground font-mono text-lg tabular-nums">{data.protocolRewardSharePercent}%</span>
            </div>
            <div className="flex flex-col gap-1" data-testid="listing-config-market-config-updates">
              <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Market-config updates
              </span>
              <span className="text-foreground font-mono text-lg tabular-nums">
                {data.rateLimits.marketConfigUpdatesPerDay}/day
              </span>
            </div>
            <div className="flex flex-col gap-1" data-testid="listing-config-profit-claims">
              <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Profit claims</span>
              <span className="text-foreground font-mono text-lg tabular-nums">
                {data.rateLimits.profitClaimsPerDay}/day
              </span>
            </div>
          </div>
        </div>
      )}
    </MethodCard>
  );
}
