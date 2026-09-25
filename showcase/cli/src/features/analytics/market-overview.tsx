import { Box, Text } from "ink";
import { signColor, theme } from "../../config/theme.js";
import { formatCompactUsd, formatPercent, formatPrice, formatSignedPercent } from "../../lib/format.js";
import type { MarketAnalyticsResult } from "../../sdk/use-market-analytics.js";
import { useNotionalCap } from "../../sdk/use-market-data.js";
import type { MarketMeta } from "../../sdk/use-markets.js";
import { KeyValue, Panel, Stat } from "../../ui/kit.js";

interface Props {
  market: MarketMeta;
  markPrice?: string;
  probeNotional: number;
  analytics: MarketAnalyticsResult;
  compact: boolean;
}

function fundingTimeLabel(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "schedule unavailable";
  const targetMs = value < 1e12 ? value * 1000 : value;
  const remaining = Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
  if (remaining <= 0) return "settling now";
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  return hours > 0 ? `in ${hours}h ${minutes}m` : `in ${minutes}m`;
}

function estimateLabel(estimate: MarketAnalyticsResult["longEstimate"], precision: number): string {
  if (estimate.isLoading && !estimate.estimatedPrice) return "loading…";
  if (estimate.error != null) return "unavailable";
  if (!estimate.estimatedPrice) return "—";
  const impact = estimate.impactPercent == null ? "" : ` · ${formatSignedPercent(estimate.impactPercent, 3)} PI`;
  return `${formatPrice(estimate.estimatedPrice, precision)}${impact}`;
}

function estimateColor(supported: boolean, estimate: MarketAnalyticsResult["longEstimate"], sideColor: string): string {
  if (!supported || (estimate.isLoading && !estimate.estimatedPrice)) return theme.faint;
  if (estimate.error != null) return theme.negative;
  return sideColor;
}

/** Solver-native funding, volume/cap, and read-only fill probes. */
export function MarketOverview({ market, markPrice, probeNotional, analytics, compact }: Props) {
  const capQuery = useNotionalCap(market.symbolId);
  const rawCap = capQuery.data;
  const cap = rawCap?.kind === "enigma" && rawCap.error != null ? undefined : rawCap;
  const openInterest = cap ? (cap.kind === "enigma" ? cap.openInterest : cap.used) : undefined;
  const available = cap?.kind === "enigma" ? Math.max(cap.availableToLong, cap.availableToShort) : undefined;
  const stats = analytics.marketStats;
  const funding = analytics.funding;

  return (
    <Panel
      title={`${market.symbol} · solver analytics`}
      right={<Text color={theme.faint}>read only</Text>}
      flexGrow={1}
    >
      <Box marginBottom={1} flexWrap="wrap" columnGap={compact ? 3 : 5}>
        <Stat
          label="Mark"
          value={markPrice != null ? formatPrice(markPrice, market.pricePrecision) : "—"}
          color={theme.primaryBright}
          minWidth={compact ? 15 : 18}
        />
        <Stat
          label="24h volume"
          value={
            stats
              ? formatCompactUsd(stats.volume24h)
              : analytics.marketStatsLoading
                ? "loading…"
                : analytics.marketStatsError
                  ? "unavailable"
                  : "not published"
          }
          minWidth={compact ? 15 : 18}
        />
        <Stat
          label="Open interest"
          value={openInterest == null ? (capQuery.isLoading ? "loading…" : "—") : formatCompactUsd(openInterest)}
          minWidth={compact ? 15 : 18}
        />
        <Stat label="Max leverage" value={`${market.maxLeverage}x`} />
      </Box>

      <Box flexDirection={compact ? "column" : "row"} columnGap={5}>
        <Box flexDirection="column" flexGrow={1}>
          <KeyValue
            label="24h change"
            value={stats?.change24h == null ? "not published" : formatSignedPercent(stats.change24h)}
            color={stats?.change24h == null ? theme.faint : signColor(stats.change24h)}
            dim={stats?.change24h == null}
          />
          <KeyValue
            label="Capacity"
            value={
              cap == null
                ? capQuery.isLoading
                  ? "loading…"
                  : "unavailable"
                : `${formatCompactUsd(cap.used)} / ${formatCompactUsd(cap.totalCap)}`
            }
          />
          {available != null && <KeyValue label="Best side available" value={formatCompactUsd(available)} />}
          <KeyValue label="Trading fee" value={formatPercent(Number(market.market.tradingFee) * 100, 4)} />
        </Box>

        <Box flexDirection="column" flexGrow={1}>
          <KeyValue
            label="Funding long / epoch"
            value={
              funding
                ? formatSignedPercent(funding.nextFundingRateLong * 100, 4)
                : analytics.fundingLoading
                  ? "loading…"
                  : "unavailable"
            }
            color={funding ? signColor(funding.nextFundingRateLong) : undefined}
          />
          <KeyValue
            label="Funding short / epoch"
            value={
              funding
                ? formatSignedPercent(funding.nextFundingRateShort * 100, 4)
                : analytics.fundingLoading
                  ? "loading…"
                  : "unavailable"
            }
            color={funding ? signColor(funding.nextFundingRateShort) : undefined}
          />
          <KeyValue
            label="Next funding"
            value={funding ? fundingTimeLabel(funding.nextFundingTime) : analytics.fundingError ? "unavailable" : "—"}
            dim={!funding}
          />
          <KeyValue
            label={`Long fill · ${formatCompactUsd(probeNotional)}`}
            value={
              analytics.estimateSupported
                ? estimateLabel(analytics.longEstimate, market.pricePrecision)
                : "solver unsupported"
            }
            color={estimateColor(analytics.estimateSupported, analytics.longEstimate, theme.positive)}
          />
          <KeyValue
            label={`Short fill · ${formatCompactUsd(probeNotional)}`}
            value={
              analytics.estimateSupported
                ? estimateLabel(analytics.shortEstimate, market.pricePrecision)
                : "solver unsupported"
            }
            color={estimateColor(analytics.estimateSupported, analytics.shortEstimate, theme.negative)}
          />
        </Box>
      </Box>

      {analytics.estimateSupported && (
        <Text color={theme.faint}>
          Fill probe uses {analytics.probeQuantity || "—"} {market.market.asset} with a ±1% request bound.
        </Text>
      )}
    </Panel>
  );
}
