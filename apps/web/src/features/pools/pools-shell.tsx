import { PageHeader } from "@/components/page-header";
import { MethodGroup } from "../inspector/method-group";
import { CreatePoolCard } from "./create-pool-card";
import { DepositAddressCard } from "./deposit-address-card";
import { ListingAuthCard } from "./listing-auth-card";
import { ListingAuthProvider } from "./listing-auth-context";
import { ListingConfigCard } from "./listing-config-card";
import { ListingStatusCard } from "./listing-status-card";
import { PoolsConsole } from "./pools-console";
import { PoolsOpenInterestCard } from "./pools-open-interest-card";
import { PoolsRevenueCard } from "./pools-revenue-card";
import { PoolsTvlCard } from "./pools-tvl-card";
import { PoolsVolumeCard } from "./pools-volume-card";
import { UserProfitCard } from "./user-profit-card";
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
 */
export function PoolsShell() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <PageHeader
        eyebrow="React SDK · Pools"
        title="Pools"
        description="No single service describes a pool. Custodial TVL comes from the inventory service, volume, open interest and revenue from the solver, and the catalogue itself from the listing backend — one card per read, so it stays obvious which figure came from where. Money and rate figures arrive as fixed-point values and stay exact until the moment they are rendered; a dash means the service reported nothing, which is not the same as zero."
      />
      <MethodGroup label="Protocol aggregates" count={4}>
        <PoolsTvlCard />
        <PoolsVolumeCard />
        <PoolsOpenInterestCard />
        <PoolsRevenueCard />
      </MethodGroup>
      {/* One shared bearer token for both cards: sign in once, reuse it across
          refreshes and cards instead of re-signing on every read. */}
      <ListingAuthProvider>
        <MethodGroup label="Listing session" count={9}>
          <ListingConfigCard />
          <WeeklyLimitCard />
          <ListingStatusCard />
          <ListingAuthCard />
          <YourPoolsCard />
          <UserProfitCard />
          <DepositAddressCard />
          <WithdrawCard />
          <CreatePoolCard />
        </MethodGroup>
      </ListingAuthProvider>
      <MethodGroup label="Listing catalog" count={1} fullWidth>
        <PoolsConsole />
      </MethodGroup>
    </section>
  );
}
