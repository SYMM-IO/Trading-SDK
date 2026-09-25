import { ListingMarketStatus } from "@symmio/trading-core";
import { useQueryClient } from "@tanstack/react-query";
import { Box, Text, useInput, useStdout } from "ink";
import { useEffect, useState } from "react";
import { glyph, theme } from "../../config/theme.js";
import { formatDateTime, shortAddress } from "../../lib/format.js";
import { useInventoryTvl, useSupportsInventoryService } from "../../sdk/use-inventory.js";
import {
  POOLS_PAGE_SIZE,
  type PoolDetailSection,
  useListingCatalog,
  useListingOverview,
  useListingSession,
  useSupportsListingService,
  useUserListingCatalog,
} from "../../sdk/use-pools.js";
import { Empty, ErrorLine, LoadingLine, SuccessLine } from "../../ui/feedback.js";
import { KeyValue, Panel, Stat } from "../../ui/kit.js";
import { PoolDetail } from "./pool-detail.js";
import { formatPoolUsd, poolErrorMessage } from "./pool-format.js";
import { PoolList, type PoolRow } from "./pool-list.js";

type PoolView = "catalog" | "mine";

const DETAIL_SECTIONS: readonly PoolDetailSection[] = ["overview", "rewards", "activity", "status"];

const STATUS_FILTERS: readonly { label: string; value?: ListingMarketStatus }[] = [
  { label: "All" },
  { label: "Listed", value: ListingMarketStatus.LISTED },
  { label: "Await deposit", value: ListingMarketStatus.WAITING_FOR_DEPOSIT },
  { label: "Review", value: ListingMarketStatus.UNDER_REVIEW },
  { label: "Rejected", value: ListingMarketStatus.REJECTED },
  { label: "Delisted", value: ListingMarketStatus.DELISTED },
];

/** Permissionless Pools catalog, custodial TVL, and authenticated LP portfolio. */
export function PoolsScreen({ active }: { active: boolean }) {
  const { stdout } = useStdout();
  const queryClient = useQueryClient();
  const listingSupported = useSupportsListingService();
  const inventorySupported = useSupportsInventoryService();
  const session = useListingSession();
  const [view, setView] = useState<PoolView>("catalog");
  const [section, setSection] = useState<PoolDetailSection>("overview");
  const [statusIndex, setStatusIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [index, setIndex] = useState(0);

  const statusFilter = STATUS_FILTERS[statusIndex] ?? STATUS_FILTERS[0]!;
  const overview = useListingOverview(listingSupported);
  const inventoryTvl = useInventoryTvl(inventorySupported);
  const catalog = useListingCatalog({
    page,
    status: statusFilter.value,
    enabled: listingSupported && view === "catalog",
  });
  const userCatalog = useUserListingCatalog({
    page,
    status: statusFilter.value,
    accessToken: session.accessToken,
    address: session.address,
    revision: session.revision,
    enabled: listingSupported && view === "mine" && session.isAuthenticated,
  });

  const activeQuery = view === "catalog" ? catalog : userCatalog;
  const rows: readonly PoolRow[] = activeQuery.data?.items ?? [];
  const total = activeQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / POOLS_PAGE_SIZE));
  const selected = rows[index];
  const width = stdout?.columns && stdout.columns > 0 ? stdout.columns : 100;
  const wide = width >= 118;

  useEffect(() => {
    if (rows.length === 0) setIndex(0);
    else if (index >= rows.length) setIndex(rows.length - 1);
  }, [index, rows.length]);

  useInput(
    (input) => {
      if (input === "v") {
        setView((current) => (current === "catalog" ? "mine" : "catalog"));
        setPage(1);
        setIndex(0);
      } else if (input === "s") {
        setStatusIndex((current) => (current + 1) % STATUS_FILTERS.length);
        setPage(1);
        setIndex(0);
      } else if (input === "d") {
        setSection((current) => {
          const currentIndex = DETAIL_SECTIONS.indexOf(current);
          return DETAIL_SECTIONS[(currentIndex + 1) % DETAIL_SECTIONS.length]!;
        });
      } else if (input === "n" && page < pageCount) {
        setPage((current) => current + 1);
        setIndex(0);
      } else if (input === "p" && page > 1) {
        setPage((current) => current - 1);
        setIndex(0);
      } else if (input === "r") {
        void queryClient.invalidateQueries({ queryKey: ["pools"] });
        void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      } else if (input === "a" && listingSupported && !session.isSigningIn) {
        session.signIn();
      } else if (input === "o" && session.isAuthenticated) {
        session.signOut();
      }
    },
    { isActive: active },
  );

  if (!listingSupported) {
    return (
      <Panel title="Pools" focused={active} flexGrow={1}>
        <Empty
          title="Pools are not available on this deployment"
          hint="The active chain has no listing service. Press x to switch to an Enigma deployment."
        />
      </Panel>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <PoolsSummary overview={overview} inventoryTvl={inventoryTvl} total={total} view={view} session={session} />

      <Box flexDirection={wide ? "row" : "column"} gap={1} flexGrow={1}>
        <Panel
          title={`${view === "catalog" ? "Pool catalog" : "Your pools"} · ${statusFilter.label} · ${page}/${pageCount}`}
          focused={active}
          width={wide ? 66 : undefined}
          right={
            activeQuery.isFetching ? <LoadingLine /> : <Text color={theme.faint}>{total.toLocaleString()} total</Text>
          }
        >
          {view === "mine" && !session.isAuthenticated ? (
            <Empty
              title={session.canSign ? "Sign in to view your pools" : "Signing wallet required"}
              hint={
                session.canSign
                  ? "Press a to sign a SIWE message. The session stays in memory only."
                  : "Press w to connect a wallet that can sign."
              }
            />
          ) : activeQuery.isLoading ? (
            <LoadingLine label={view === "catalog" ? "Loading pool catalog…" : "Loading your pools…"} />
          ) : activeQuery.error ? (
            <Empty title="Could not load pools" hint={poolErrorMessage(activeQuery.error)} tone={theme.negative} />
          ) : (
            <PoolList
              rows={rows}
              index={index}
              setIndex={setIndex}
              active={active}
              mine={view === "mine"}
              maxVisible={wide ? 11 : 6}
            />
          )}

          <Box flexDirection="column" marginTop={1}>
            {session.error && <ErrorLine message={poolErrorMessage(session.error)} />}
            {session.isAuthenticated && (
              <SuccessLine message={`Listing session active for ${shortAddress(session.address ?? "")}`} />
            )}
          </Box>
        </Panel>

        <PoolDetail
          market={selected}
          section={section}
          onSectionChange={setSection}
          mine={view === "mine"}
          inventorySupported={inventorySupported}
          accessToken={session.accessToken}
          address={session.address}
          revision={session.revision}
          authenticated={session.isAuthenticated}
        />
      </Box>
    </Box>
  );
}

type ListingOverview = ReturnType<typeof useListingOverview>;
type InventoryTvl = ReturnType<typeof useInventoryTvl>;
type ListingSession = ReturnType<typeof useListingSession>;

function PoolsSummary({
  overview,
  inventoryTvl,
  total,
  view,
  session,
}: {
  overview: ListingOverview;
  inventoryTvl: InventoryTvl;
  total: number;
  view: PoolView;
  session: ListingSession;
}) {
  const config = overview.listingConfig.data;
  const limit = overview.weeklyLimit.data;
  const error = overview.listingConfig.error ?? overview.weeklyLimit.error ?? inventoryTvl.error;

  return (
    <Panel
      title="Pools overview"
      right={
        <Text color={session.isAuthenticated ? theme.positive : theme.faint}>
          {session.isAuthenticated
            ? `${glyph.check} signed in`
            : view === "mine"
              ? "press a to sign in"
              : "public reads"}
        </Text>
      }
    >
      <Box flexWrap="wrap">
        <Stat
          label="Custodial TVL"
          value={inventoryTvl.data == null ? "—" : formatPoolUsd(inventoryTvl.data)}
          color={theme.primaryBright}
          minWidth={20}
        />
        <Stat label={view === "mine" ? "Your pools" : "Matching pools"} value={String(total)} minWidth={18} />
        <Stat label="Listing fee" value={formatPoolUsd(config?.listingFeeUsdc)} minWidth={18} />
        <Stat
          label="Weekly capacity"
          value={limit ? `${limit.remaining}/${limit.limit}` : "—"}
          color={limit?.remaining === 0 ? theme.warning : undefined}
          minWidth={18}
        />
        <Stat label="Deposit chains" value={config ? String(config.supportedDepositChains.length) : "—"} />
      </Box>
      {config && (
        <Box flexDirection="column" marginTop={1}>
          <KeyValue label="Recommended initial deposit" value={formatPoolUsd(config.recommendedInitialDepositUsdc)} />
          <KeyValue label="Minimum initial deposit" value={formatPoolUsd(config.minimumInitialDepositUsdc)} />
          <KeyValue label="Protocol reward share" value={`${config.protocolRewardSharePercent}%`} />
          {limit && <KeyValue label="Weekly reset" value={formatDateTime(limit.resetAt)} dim />}
        </Box>
      )}
      {error && (
        <Box marginTop={1}>
          <ErrorLine message={poolErrorMessage(error)} />
        </Box>
      )}
    </Panel>
  );
}
