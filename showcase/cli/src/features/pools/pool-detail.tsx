import type { PoolTransaction, UserTransaction } from "@symmio/trading-core";
import { Box, Text } from "ink";
import { glyph, theme } from "../../config/theme.js";
import { formatDateTime, formatRelative, shortAddress } from "../../lib/format.js";
import { useInventoryTvlHistory } from "../../sdk/use-inventory.js";
import { type PoolDetailSection, usePublicPoolData, useUserPoolData } from "../../sdk/use-pools.js";
import { Segmented, type SegmentOption } from "../../ui/controls.js";
import { Empty, ErrorLine, LoadingLine } from "../../ui/feedback.js";
import { Divider, KeyValue, Panel, Stat } from "../../ui/kit.js";
import { Sparkline } from "../../ui/meter.js";
import { truncate } from "../../ui/pad.js";
import {
  formatPoolAge,
  formatPoolRate,
  formatPoolUsd,
  formatPoolUsdFine,
  poolChartNumber,
  poolErrorMessage,
  poolStatusMeta,
} from "./pool-format.js";
import type { PoolRow } from "./pool-list.js";

const SECTION_OPTIONS: readonly SegmentOption<PoolDetailSection>[] = [
  { key: "overview", label: "Overview" },
  { key: "rewards", label: "Rewards" },
  { key: "activity", label: "Activity" },
  { key: "status", label: "Status" },
];

interface Props {
  market?: PoolRow;
  section: PoolDetailSection;
  onSectionChange: (section: PoolDetailSection) => void;
  mine: boolean;
  inventorySupported: boolean;
  accessToken?: string;
  address?: string;
  revision: number;
  authenticated: boolean;
  width?: number | string;
}

/** Selected pool dossier. Each section activates only the reads it displays. */
export function PoolDetail({
  market,
  section,
  onSectionChange,
  mine,
  inventorySupported,
  accessToken,
  address,
  revision,
  authenticated,
  width,
}: Props) {
  const publicData = usePublicPoolData(market, section, market != null);
  const userData = useUserPoolData({
    market,
    section,
    accessToken,
    address,
    revision,
    enabled: mine && authenticated,
  });
  const inventory = useInventoryTvlHistory(
    market?.contractAddress,
    inventorySupported && section === "overview" && market != null,
  );

  return (
    <Panel
      title={market ? `${market.tokenTicker || market.tokenName} pool` : mine ? "Your pool data" : "Pool detail"}
      width={width}
      flexGrow={1}
    >
      <Box marginBottom={1}>
        <Segmented options={SECTION_OPTIONS} value={section} onChange={onSectionChange} />
      </Box>

      {mine && !authenticated ? (
        <Empty title="Pools sign-in required" hint="Press a to sign an in-memory listing session." />
      ) : section === "overview" ? (
        <OverviewSection
          market={market}
          publicData={publicData}
          userData={userData}
          inventory={inventory}
          inventorySupported={inventorySupported}
          mine={mine}
        />
      ) : section === "rewards" ? (
        <RewardsSection market={market} publicData={publicData} userData={userData} mine={mine} />
      ) : section === "activity" ? (
        <ActivitySection market={market} publicData={publicData} userData={userData} mine={mine} />
      ) : (
        <StatusSection market={market} publicData={publicData} userData={userData} mine={mine} />
      )}
    </Panel>
  );
}

type PublicPoolData = ReturnType<typeof usePublicPoolData>;
type UserPoolData = ReturnType<typeof useUserPoolData>;
type InventoryHistory = ReturnType<typeof useInventoryTvlHistory>;

function OverviewSection({
  market,
  publicData,
  userData,
  inventory,
  inventorySupported,
  mine,
}: {
  market?: PoolRow;
  publicData: PublicPoolData;
  userData: UserPoolData;
  inventory: InventoryHistory;
  inventorySupported: boolean;
  mine: boolean;
}) {
  if (!market) {
    return (
      <Empty title="No pool selected" hint={mine ? "This account has no pool rows on the current page." : undefined} />
    );
  }

  const detail = publicData.detail.data;
  const status = poolStatusMeta(market.marketStatus);
  const history = inventory.data ?? [];

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Stat label="TVL" value={formatPoolUsd(detail?.tvl ?? market.tvl)} color={theme.primaryBright} minWidth={16} />
        <Stat label="Liquidity" value={formatPoolUsd(market.liquidity)} minWidth={16} />
        <Stat label="APR" value={formatPoolRate(market.apr)} color={market.apr != null ? theme.positive : undefined} />
      </Box>
      <Box flexDirection="column">
        <KeyValue label="Status" value={status.label} color={status.color} />
        <KeyValue label="Open interest" value={formatPoolUsd(market.openInterest)} />
        <KeyValue label="24h volume" value={formatPoolUsd(market.vol24h)} />
        <KeyValue label="Market cap" value={formatPoolUsd(market.marketCap)} />
        <KeyValue label="Max leverage" value={`${detail?.maxLeverage ?? market.maxLeverage}x`} />
        <KeyValue label="Pool address" value={shortAddress(market.contractAddress, 8, 6)} dim />
      </Box>

      {publicData.detail.isLoading ? (
        <Box marginTop={1}>
          <LoadingLine label="Loading pool inventory…" />
        </Box>
      ) : publicData.detail.error ? (
        <Box marginTop={1}>
          <ErrorLine message={poolErrorMessage(publicData.detail.error)} />
        </Box>
      ) : detail ? (
        <Box flexDirection="column" marginTop={1}>
          <Divider width={40} />
          <KeyValue label="Active LPs" value={String(detail.activeLps)} />
          <KeyValue label="Pool age" value={formatPoolAge(detail.age)} />
          <KeyValue label="USDC held" value={formatPoolUsd(detail.totalUsdcInPool)} />
          <KeyValue
            label={`${detail.tokenTicker ?? "Token"} held`}
            value={formatPoolUsdFine(detail.totalTokenInPool)}
          />
          <KeyValue label="Buyback ratio" value={`${detail.buybackRatio}%`} />
          {detail.longPosition && (
            <KeyValue
              label="Long book"
              value={`${formatPoolUsd(detail.longPosition.value)} · uPnL ${formatPoolUsdFine(detail.longPosition.upnl)}`}
              color={detail.longPosition.upnl >= 0n ? theme.positive : theme.negative}
            />
          )}
          {detail.shortPosition && (
            <KeyValue
              label="Short book"
              value={`${formatPoolUsd(detail.shortPosition.value)} · uPnL ${formatPoolUsdFine(detail.shortPosition.upnl)}`}
              color={detail.shortPosition.upnl >= 0n ? theme.positive : theme.negative}
            />
          )}
        </Box>
      ) : null}

      {inventorySupported && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.muted}>Custodial TVL history</Text>
          {inventory.isLoading ? (
            <LoadingLine label="Loading snapshots…" />
          ) : inventory.error ? (
            <Text color={theme.faint}>History is not available on this inventory deployment.</Text>
          ) : history.length < 2 ? (
            <Text color={theme.faint}>No TVL series yet.</Text>
          ) : (
            <Box>
              <Sparkline data={history.map((point) => poolChartNumber(point.tvl))} width={28} />
              <Text color={theme.faint}> {history.length} snapshots</Text>
            </Box>
          )}
        </Box>
      )}

      {mine && (
        <Box flexDirection="column" marginTop={1}>
          <Divider width={40} />
          <Text color={theme.muted}>Your LP position</Text>
          {userData.profit.isLoading ? (
            <LoadingLine label="Loading your position…" />
          ) : userData.profit.error ? (
            <ErrorLine message={poolErrorMessage(userData.profit.error)} />
          ) : userData.profit.data ? (
            <>
              <KeyValue label="Balance" value={formatPoolUsdFine(userData.profit.data.userBalanceInUsdc)} />
              <KeyValue label="LP available" value={formatPoolUsdFine(userData.profit.data.availableLpAmount)} />
              <KeyValue
                label="LP pending withdraw"
                value={formatPoolUsdFine(userData.profit.data.pendingWithdrawLpAmount)}
              />
            </>
          ) : null}
        </Box>
      )}
    </Box>
  );
}

function RewardsSection({
  market,
  publicData,
  userData,
  mine,
}: {
  market?: PoolRow;
  publicData: PublicPoolData;
  userData: UserPoolData;
  mine: boolean;
}) {
  const chart = publicData.rewardChart.data ?? [];
  const userChart = market
    ? userData.rewardChart.data?.find(
        (entry) =>
          entry.marketAddress.toLowerCase() === market.contractAddress.toLowerCase() &&
          entry.marketChainId === market.chainId,
      )
    : undefined;
  const recentUserReward = userChart?.rewards.slice(-30).reduce((total, point) => total + point.reward, 0n);

  if (!market && !mine) return <Empty title="No pool selected" />;

  return (
    <Box flexDirection="column">
      {market && (
        <>
          <Box marginBottom={1} flexWrap="wrap">
            <Stat
              label="Pool rewards · 30d"
              value={publicData.rewardTotal.data == null ? "—" : formatPoolUsdFine(publicData.rewardTotal.data)}
              color={theme.primaryBright}
              minWidth={22}
            />
            <Stat label="Rewards · 24h" value={formatPoolUsdFine(market.reward24h)} minWidth={18} />
            <Stat label="APR" value={formatPoolRate(market.apr)} color={theme.positive} />
          </Box>
          <KeyValue label="TVL-driven APY · 30d" value={formatPoolRate(market.tvlDrivenApy.d30)} />
          <KeyValue label="Price-driven APY · 30d" value={formatPoolRate(market.priceDrivenApy.d30)} />
          <Box marginTop={1}>
            <Text color={theme.muted}>Daily pool rewards </Text>
            {publicData.rewardChart.isLoading ? (
              <LoadingLine />
            ) : chart.length < 2 ? (
              <Text color={theme.faint}>no series yet</Text>
            ) : (
              <>
                <Sparkline
                  data={chart.map((point) => poolChartNumber(point.reward))}
                  width={26}
                  color={theme.primary}
                />
                <Text color={theme.faint}> {chart.length}d</Text>
              </>
            )}
          </Box>
          {(publicData.rewardTotal.error || publicData.rewardChart.error) && (
            <Box marginTop={1}>
              <ErrorLine message={poolErrorMessage(publicData.rewardTotal.error ?? publicData.rewardChart.error)} />
            </Box>
          )}
        </>
      )}

      {mine && (
        <Box flexDirection="column" marginTop={1}>
          {market && <Divider width={40} />}
          <Text color={theme.muted}>Your earned rewards</Text>
          {userData.rewardTotal.isLoading ? (
            <LoadingLine label="Loading your rewards…" />
          ) : userData.rewardTotal.error ? (
            <ErrorLine message={poolErrorMessage(userData.rewardTotal.error)} />
          ) : (
            <>
              <KeyValue label="All pools · 30d" value={formatPoolUsdFine(userData.rewardTotal.data)} />
              {market && <KeyValue label="Selected pool · chart" value={formatPoolUsdFine(recentUserReward)} />}
              {userData.profit.data && (
                <>
                  <KeyValue
                    label="Claimable now"
                    value={formatPoolUsdFine(userData.profit.data.claimableReward)}
                    color={userData.profit.data.claimableReward > 0n ? theme.positive : undefined}
                  />
                  <KeyValue label="Already claimed" value={formatPoolUsdFine(userData.profit.data.claimedReward)} />
                </>
              )}
              {userChart && userChart.rewards.length > 1 && (
                <Box>
                  <Text color={theme.muted}>Your daily series </Text>
                  <Sparkline
                    data={userChart.rewards.map((point) => poolChartNumber(point.reward))}
                    width={24}
                    color={theme.positive}
                  />
                </Box>
              )}
            </>
          )}
        </Box>
      )}
    </Box>
  );
}

function ActivitySection({
  market,
  publicData,
  userData,
  mine,
}: {
  market?: PoolRow;
  publicData: PublicPoolData;
  userData: UserPoolData;
  mine: boolean;
}) {
  const publicTransactions = publicData.transactions.data?.items ?? [];
  const userTransactions = userData.transactions.data?.items ?? [];

  if (!market && !mine) return <Empty title="No pool selected" />;

  return (
    <Box flexDirection="column">
      {market && (
        <>
          <Box marginBottom={1} flexWrap="wrap">
            <Stat label="Pool transfers" value={String(publicData.transactions.data?.count ?? "—")} minWidth={18} />
            <Stat
              label="Open quotes · sample"
              value={String(publicData.openQuotes.data?.quotes.length ?? "—")}
              minWidth={22}
            />
            <Stat label="Closes · sample" value={String(publicData.tradeHistory.data?.rows.length ?? "—")} />
          </Box>
          <Text color={theme.muted}>Latest pool deposits & withdrawals</Text>
          {publicData.transactions.isLoading ? (
            <LoadingLine label="Loading activity…" />
          ) : publicData.transactions.error ? (
            <ErrorLine message={poolErrorMessage(publicData.transactions.error)} />
          ) : publicTransactions.length === 0 ? (
            <Text color={theme.faint}>No pool transfers yet.</Text>
          ) : (
            publicTransactions
              .slice(0, 3)
              .map((transaction) => <PoolTransactionLine key={transaction.transactionId} transaction={transaction} />)
          )}
          {(publicData.openQuotes.error || publicData.tradeHistory.error) && (
            <Text color={theme.faint}>Analytics activity is temporarily unavailable.</Text>
          )}
        </>
      )}

      {mine && (
        <Box flexDirection="column" marginTop={1}>
          {market && <Divider width={40} />}
          <Text color={theme.muted}>Your deposits & withdrawals</Text>
          {userData.transactions.isLoading ? (
            <LoadingLine label="Loading your activity…" />
          ) : userData.transactions.error ? (
            <ErrorLine message={poolErrorMessage(userData.transactions.error)} />
          ) : userTransactions.length === 0 ? (
            <Text color={theme.faint}>No matching transfers.</Text>
          ) : (
            userTransactions
              .slice(0, 3)
              .map((transaction) => <UserTransactionLine key={transaction.transactionId} transaction={transaction} />)
          )}
          <KeyValue
            label={market ? "Claims for this pool" : "Reward claims"}
            value={String(userData.claims.data?.count ?? "—")}
          />
          {userData.claims.error && <ErrorLine message={poolErrorMessage(userData.claims.error)} />}
        </Box>
      )}
    </Box>
  );
}

function StatusSection({
  market,
  publicData,
  userData,
  mine,
}: {
  market?: PoolRow;
  publicData: PublicPoolData;
  userData: UserPoolData;
  mine: boolean;
}) {
  if (!market) return <Empty title="No pool selected" />;

  const status = publicData.status.data;
  const detail = publicData.detail.data;
  const meta = poolStatusMeta(status?.marketStatus ?? market.marketStatus);

  return (
    <Box flexDirection="column">
      <Box marginBottom={1} flexWrap="wrap">
        <Stat label="Lifecycle" value={meta.label} color={meta.color} minWidth={20} />
        <Stat
          label="Symbol id"
          value={market.symbolId == null ? "not assigned" : String(market.symbolId)}
          minWidth={18}
        />
        <Stat label="Deposit chain" value={String(market.chainId)} />
      </Box>
      {publicData.status.isLoading ? (
        <LoadingLine label="Loading pipeline status…" />
      ) : publicData.status.error ? (
        <ErrorLine message={poolErrorMessage(publicData.status.error)} />
      ) : status ? (
        <Box flexDirection="column">
          <KeyValue label="Current step" value={status.currentStep ?? "—"} />
          <KeyValue label="Retries" value={`${status.retryCount}/${status.retryLimit}`} />
          <KeyValue label="Pipeline" value={truncate(status.steps.join(` ${glyph.arrow} `), 48)} dim />
          {status.errorDetail && (
            <KeyValue
              label={`Error ${status.errorCode ?? ""}`.trim()}
              value={status.errorDetail}
              color={theme.negative}
            />
          )}
        </Box>
      ) : null}

      {detail && (
        <Box flexDirection="column" marginTop={1}>
          <Divider width={40} />
          <Text color={theme.muted}>Pool configuration in force</Text>
          <KeyValue label="Max leverage" value={`${detail.maxLeverage}x`} />
          <KeyValue label="Buyback ratio" value={`${detail.buybackRatio}%`} />
          <KeyValue
            label="Listed"
            value={detail.listingTime == null ? "not yet" : formatDateTime(detail.listingTime)}
          />
        </Box>
      )}

      {mine && (
        <Box flexDirection="column" marginTop={1}>
          <Divider width={40} />
          <Text color={theme.muted}>Your configuration opinion</Text>
          {userData.marketConfig.isLoading ? (
            <LoadingLine label="Loading your settings…" />
          ) : userData.marketConfig.error ? (
            <ErrorLine message={poolErrorMessage(userData.marketConfig.error)} />
          ) : userData.marketConfig.data ? (
            <>
              <KeyValue
                label="Max leverage"
                value={
                  userData.marketConfig.data.userMaxLeverage == null
                    ? "not set"
                    : `${userData.marketConfig.data.userMaxLeverage}x`
                }
              />
              <KeyValue
                label="Buyback ratio"
                value={
                  userData.marketConfig.data.userBuybackRatio == null
                    ? "not set"
                    : `${userData.marketConfig.data.userBuybackRatio}%`
                }
              />
            </>
          ) : null}
        </Box>
      )}
    </Box>
  );
}

function PoolTransactionLine({ transaction }: { transaction: PoolTransaction }) {
  return (
    <Text>
      <Text color={transaction.type === "deposit" ? theme.positive : theme.info}>
        {transaction.type === "deposit" ? glyph.down : glyph.up} {transaction.type.padEnd(8)}
      </Text>
      <Text color={theme.text}> {formatPoolUsdFine(transaction.amount).padStart(12)}</Text>
      <Text color={transaction.status === "success" ? theme.positive : theme.warning}>
        {` ${transaction.status}`.padEnd(11)}
      </Text>
      <Text color={theme.faint}> {formatRelative(transaction.time)}</Text>
    </Text>
  );
}

function UserTransactionLine({ transaction }: { transaction: UserTransaction }) {
  return (
    <Text>
      <Text color={transaction.type === "deposit" ? theme.positive : theme.info}>
        {transaction.type === "deposit" ? glyph.down : glyph.up} {transaction.type.padEnd(8)}
      </Text>
      <Text color={theme.text}> {formatPoolUsdFine(transaction.amount).padStart(12)}</Text>
      <Text color={theme.muted}> {transaction.tokenTicker.padEnd(8)}</Text>
      <Text color={theme.faint}> {transaction.time == null ? "—" : formatRelative(transaction.time)}</Text>
    </Text>
  );
}
