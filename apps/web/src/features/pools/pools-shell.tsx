"use client";

import { PageHeader } from "@/components/page-header";
import { MethodGroup } from "../inspector/method-group";
import { useSolverKindActive } from "../solvers/solver-target";
import { CancelWithdrawCard } from "./cancel-withdraw-card";
import { ClaimCard } from "./claim-card";
import { ClaimHistoryCard } from "./claim-history-card";
import { CreatePoolCard } from "./create-pool-card";
import { DepositAddressCard } from "./deposit-address-card";
import { ListingAuthCard } from "./listing-auth-card";
import { ListingAuthProvider } from "./listing-auth-context";
import { ListingConfigCard } from "./listing-config-card";
import { ListingStatusCard } from "./listing-status-card";
import { MarketConfigCard } from "./market-config-card";
import { PoolDetailCard } from "./pool-detail-card";
import { PoolRewardsCard } from "./pool-rewards-card";
import { PoolScopeBar, PoolScopeProvider } from "./pool-scope";
import { PoolTvlHistoryCard } from "./pool-tvl-history-card";
import { PoolVolumeCard } from "./pool-volume-card";
import { PoolsChainNotice } from "./pools-chain-notice";
import { PoolsConsole } from "./pools-console";
import { PoolsOpenInterestCard } from "./pools-open-interest-card";
import { PoolsRevenueCard } from "./pools-revenue-card";
import { PoolsTvlCard } from "./pools-tvl-card";
import { PoolsVolumeCard } from "./pools-volume-card";
import { RefundCard } from "./refund-card";
import { RetryListingCard } from "./retry-listing-card";
import { UserProfitCard } from "./user-profit-card";
import { UserRewardsCard } from "./user-rewards-card";
import { UserTransactionsCard } from "./user-transactions-card";
import { WeeklyLimitCard } from "./weekly-limit-card";
import { WithdrawCard } from "./withdraw-card";
import { YourPoolsCard } from "./your-pools-card";

/**
 * Pools page: the lowcap pool surface, read through the React SDK.
 *
 * A pool looks like one product and is assembled from **three** backends: the
 * inventory service holds custodial TVL, the solver reports volume, open
 * interest and revenue, and the listing backend owns the catalog. One card per
 * read, so which figure came from where stays obvious — and so a discrepancy
 * between two of them reads as what it is rather than as a bug.
 *
 * The page runs top-down from the whole protocol to one wallet: headline
 * aggregates, the catalog, one pool's detail, then the listing session — the
 * public listing reads, the wallet's pools, and its position in one of them.
 * Each section that is about a single pool asks for it once, in a bar at the
 * top, and every card below reads that pick.
 */
export function PoolsShell() {
  const enigmaActive = useSolverKindActive("enigma");

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <PageHeader
        eyebrow="React SDK · Pools"
        title="Pools"
        description="No single service describes a pool: custodial TVL comes from the inventory service, volume, open interest and revenue from the solver, and the catalog from the listing backend. One card per read, so it stays obvious which figure came from where. A dash means the service reported nothing, which is not the same as zero."
      />

      <PoolsChainNotice />

      <MethodGroup label="Protocol aggregates" count={4}>
        <PoolsTvlCard />
        <PoolsVolumeCard />
        <PoolsOpenInterestCard />
        <PoolsRevenueCard />
      </MethodGroup>

      <MethodGroup label="Listing catalog" count={1} columns={1}>
        <PoolsConsole />
      </MethodGroup>

      {/* One pool, four reads across three backends. The bar picks it once. */}
      <PoolScopeProvider>
        <MethodGroup
          label="Pool detail"
          count={4}
          lead={
            <PoolScopeBar idPrefix="pool-detail" hint="Pick a pool — its TVL, volume, rewards and tables load below." />
          }
        >
          <PoolTvlHistoryCard />
          <PoolVolumeCard />
          <PoolRewardsCard />
          <PoolDetailCard />
        </MethodGroup>
      </PoolScopeProvider>

      {/* One shared bearer token for every authed card: sign in once, reuse it
          across cards, re-reads and page reloads instead of re-signing on every read. */}
      <ListingAuthProvider>
        <MethodGroup label="Listing service" count={5}>
          <ListingAuthCard />
          <ListingConfigCard />
          <WeeklyLimitCard />
          <ListingStatusCard />
          <CreatePoolCard />
        </MethodGroup>

        <MethodGroup label="Your pools" count={3}>
          <YourPoolsCard />
          <UserRewardsCard />
          <UserTransactionsCard />
        </MethodGroup>

        {/* The wallet's position in one pool: the bar picks it, the three authed cards read it. */}
        <PoolScopeProvider>
          <MethodGroup
            label="Your position in a pool"
            count={8}
            lead={
              <PoolScopeBar
                idPrefix="position-pool"
                hint="Pick a pool — your balance, deposit address, withdrawal, claim, claim history and (if rejected) refund or retry below are for it."
                enabled={enigmaActive}
              />
            }
          >
            <UserProfitCard />
            <DepositAddressCard />
            <MarketConfigCard />
            <WithdrawCard />
            <CancelWithdrawCard />
            <ClaimCard />
            <ClaimHistoryCard />
            <RefundCard />
            <RetryListingCard />
          </MethodGroup>
        </PoolScopeProvider>
      </ListingAuthProvider>
    </section>
  );
}
