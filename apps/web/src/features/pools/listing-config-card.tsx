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
      description="Listing config — the deposit guidance, listing fee, rate limits, reward share, and supported deposit chains to read before creating a pool. Public, Enigma-only."
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
        <div className="flex flex-col gap-5" data-testid="listing-config">
          {/* The recommended initial deposit gets the most weight: it is the figure the
              user seeds a new pool with. Minimum + fee sit beside it, one scale down. */}
          <div className="border-info/30 bg-info/5 flex flex-col gap-4 rounded-xl border p-4">
            <Stat
              label="Recommended initial deposit"
              value={formatListingUsd(data.recommendedInitialDepositUsdc)}
              hint="Seed a new pool with this to start listing."
            />
            <div className="grid grid-cols-2 gap-4">
              <Stat
                size="sm"
                label="Minimum deposit"
                value={formatListingUsd(data.minimumInitialDepositUsdc)}
                testId="listing-config-minimum"
              />
              <Stat
                size="sm"
                label="Listing fee"
                value={formatListingUsd(data.listingFeeUsdc)}
                testId="listing-config-fee"
              />
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

          <div className="grid grid-cols-3 gap-4">
            <Stat
              size="sm"
              label="Reward share"
              value={`${data.protocolRewardSharePercent}%`}
              hint="Protocol's cut of rewards"
              testId="listing-config-reward-share"
            />
            <Stat
              size="sm"
              label="Config updates"
              value={`${data.rateLimits.marketConfigUpdatesPerDay}/day`}
              hint="Market-config rate limit"
              testId="listing-config-market-config-updates"
            />
            <Stat
              size="sm"
              label="Profit claims"
              value={`${data.rateLimits.profitClaimsPerDay}/day`}
              hint="Claim rate limit"
              testId="listing-config-profit-claims"
            />
          </div>
        </div>
      )}
    </MethodCard>
  );
}
