import type { CandleResolution } from "@symmio/trading-core";
import { Box, Text, useInput, useStdout } from "ink";
import { useEffect, useMemo, useRef, useState } from "react";
import { glyph, theme } from "../../config/theme.js";
import { formatCompactUsd } from "../../lib/format.js";
import { useMarketAnalytics } from "../../sdk/use-market-analytics.js";
import { isTradable, toMarketMeta, useMarkets, type MarketMeta } from "../../sdk/use-markets.js";
import { useLivePrices } from "../../sdk/use-prices.js";
import { Empty, ErrorLine, LoadingLine } from "../../ui/feedback.js";
import { Panel } from "../../ui/kit.js";
import { useAppState } from "../app-state.js";
import { CandlesPanel } from "./candles-panel.js";
import { DepthPanel } from "./depth-panel.js";
import { MarketOverview } from "./market-overview.js";

const RESOLUTIONS: readonly CandleResolution[] = ["1m", "5m", "15m", "1h", "4h", "1d"];
const PROBE_NOTIONALS = [100, 1_000, 10_000] as const;

interface Props {
  active: boolean;
}

/** Read-only market intelligence: solver stats plus reference OHLCV and depth. */
export function AnalyticsScreen({ active }: Props) {
  const { stdout } = useStdout();
  const marketQuery = useMarkets();
  const { marketId, setMarketId, openOverlay } = useAppState();
  const [resolutionIndex, setResolutionIndex] = useState(1);
  const [probeIndex, setProbeIndex] = useState(1);
  const [refreshToken, setRefreshToken] = useState(0);
  const markets = useMemo<MarketMeta[]>(
    () => (marketQuery.data ?? []).filter(isTradable).map(toMarketMeta),
    [marketQuery.data],
  );
  const marketIndex = Math.max(
    0,
    markets.findIndex((market) => market.symbolId === marketId),
  );
  const selected = markets[marketIndex];
  const resolution = RESOLUTIONS[resolutionIndex] ?? RESOLUTIONS[0]!;
  const probeNotional = PROBE_NOTIONALS[probeIndex] ?? PROBE_NOTIONALS[0]!;
  const width = stdout?.columns && stdout.columns > 0 ? stdout.columns : 100;
  const height = stdout?.rows && stdout.rows > 0 ? stdout.rows : 40;
  const wide = width >= 118;
  const compact = !wide;
  const depthRows = wide
    ? Math.max(4, Math.min(9, Math.floor((height - 21) / 2)))
    : Math.max(2, Math.min(4, Math.floor((height - 31) / 2)));
  const chartWidth = wide ? Math.max(24, Math.min(64, width - 68)) : Math.max(24, Math.min(68, width - 10));

  useEffect(() => {
    if (selected && selected.symbolId !== marketId) setMarketId(selected.symbolId);
  }, [marketId, selected, setMarketId]);

  useInput(
    (input, key) => {
      const previousMarket = key.leftArrow || input === "h";
      const nextMarket = key.rightArrow || input === "l";
      if (input === "/") {
        openOverlay({ kind: "market-picker", startSearching: true });
      } else if (markets.length > 0 && (previousMarket || nextMarket)) {
        const delta = previousMarket ? -1 : 1;
        const index = (marketIndex + delta + markets.length) % markets.length;
        setMarketId(markets[index]!.symbolId);
      } else if (input === "[") {
        setResolutionIndex((current) => (current - 1 + RESOLUTIONS.length) % RESOLUTIONS.length);
      } else if (input === "]") {
        setResolutionIndex((current) => (current + 1) % RESOLUTIONS.length);
      } else if (input === "s") {
        setProbeIndex((current) => (current + 1) % PROBE_NOTIONALS.length);
      } else if (input === "r") {
        setRefreshToken((current) => current + 1);
      }
    },
    { isActive: active },
  );

  if (marketQuery.isLoading) {
    return (
      <Panel title="Analytics" focused={active} flexGrow={1}>
        <LoadingLine label="Loading markets…" />
      </Panel>
    );
  }
  if (marketQuery.error != null) {
    return (
      <Panel title="Analytics" focused={active} flexGrow={1}>
        <ErrorLine message="The market catalog is unavailable." />
      </Panel>
    );
  }
  if (!selected) {
    return (
      <Panel title="Analytics" focused={active} flexGrow={1}>
        <Empty title="No tradable market" hint="Switch deployment or retry the catalog." />
      </Panel>
    );
  }

  return (
    <AnalyticsView
      active={active}
      market={selected}
      resolution={resolution}
      probeNotional={probeNotional}
      refreshToken={refreshToken}
      wide={wide}
      compact={compact}
      depthRows={depthRows}
      chartWidth={chartWidth}
    />
  );
}

function AnalyticsView({
  active,
  market,
  resolution,
  probeNotional,
  refreshToken,
  wide,
  compact,
  depthRows,
  chartWidth,
}: {
  active: boolean;
  market: MarketMeta;
  resolution: CandleResolution;
  probeNotional: number;
  refreshToken: number;
  wide: boolean;
  compact: boolean;
  depthRows: number;
  chartWidth: number;
}) {
  const { prices } = useLivePrices();
  const markPrice = prices.get(market.name);
  const analytics = useMarketAnalytics({
    market: market.market,
    markPrice,
    resolution,
    probeNotional,
    depthRows,
  });
  const refresh = analytics.refresh;
  const handledRefreshToken = useRef(0);

  useEffect(() => {
    if (refreshToken > handledRefreshToken.current) {
      handledRefreshToken.current = refreshToken;
      refresh();
    }
  }, [refresh, refreshToken]);

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color={active ? theme.primaryBright : theme.text}>
          {glyph.brand} Analytics {glyph.dot} {market.symbol}
        </Text>
        <Text color={theme.faint}>
          ← → market {glyph.dot} / search {glyph.dot} [ ] {resolution} {glyph.dot} s probe{" "}
          {formatCompactUsd(probeNotional)} {glyph.dot} r refresh
        </Text>
      </Box>

      {wide ? (
        <Box flexDirection="row" gap={1} flexGrow={1}>
          <Box flexDirection="column" flexGrow={1} gap={1}>
            <MarketOverview
              market={market}
              markPrice={markPrice}
              probeNotional={probeNotional}
              analytics={analytics}
              compact={compact}
            />
            <CandlesPanel market={market} resolution={resolution} chartWidth={chartWidth} analytics={analytics} />
          </Box>
          <DepthPanel market={market} analytics={analytics} compact={compact} width={55} />
        </Box>
      ) : (
        <Box flexDirection="column" gap={1} flexGrow={1}>
          <MarketOverview
            market={market}
            markPrice={markPrice}
            probeNotional={probeNotional}
            analytics={analytics}
            compact
          />
          <CandlesPanel market={market} resolution={resolution} chartWidth={chartWidth} analytics={analytics} />
          <DepthPanel market={market} analytics={analytics} compact />
        </Box>
      )}
    </Box>
  );
}
