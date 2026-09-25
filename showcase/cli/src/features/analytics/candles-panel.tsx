import type { CandleResolution } from "@symmio/trading-core";
import { Box, Text } from "ink";
import { signColor, theme } from "../../config/theme.js";
import { formatError } from "../../lib/error.js";
import { formatCompact, formatPrice, formatSignedPercent } from "../../lib/format.js";
import type { MarketAnalyticsResult } from "../../sdk/use-market-analytics.js";
import type { MarketMeta } from "../../sdk/use-markets.js";
import { Empty, ErrorLine, LoadingLine } from "../../ui/feedback.js";
import { KeyValue, Panel, StatusDot } from "../../ui/kit.js";
import { Sparkline } from "../../ui/meter.js";

interface Props {
  market: MarketMeta;
  resolution: CandleResolution;
  chartWidth: number;
  analytics: MarketAnalyticsResult;
}

/** OHLCV history and live close trend from the reference venue. */
export function CandlesPanel({ market, resolution, chartWidth, analytics }: Props) {
  const candles = analytics.candles;
  const latest = candles.at(-1);
  const first = candles[0];
  const high = candles.length > 0 ? Math.max(...candles.map((candle) => candle.high)) : undefined;
  const low = candles.length > 0 ? Math.min(...candles.map((candle) => candle.low)) : undefined;
  const change = first && latest && first.open !== 0 ? ((latest.close - first.open) / first.open) * 100 : undefined;
  const statusColor = analytics.candleStatus === "open" ? theme.positive : theme.warning;

  return (
    <Panel
      title={`Candles · ${resolution}`}
      right={<StatusDot color={statusColor} label={analytics.candleStatus} />}
      flexGrow={1}
    >
      {analytics.reference.isLoading ? (
        <LoadingLine label="Checking reference listing…" />
      ) : analytics.reference.error != null ? (
        <ErrorLine message={formatError(analytics.reference.error)} />
      ) : !analytics.reference.supported ? (
        <Empty title="No reference-exchange candles" hint="This market is not listed on Binance USD-M." />
      ) : analytics.candlesLoading && candles.length === 0 ? (
        <LoadingLine label="Loading OHLCV history…" />
      ) : analytics.candlesError != null && candles.length === 0 ? (
        <ErrorLine message={formatError(analytics.candlesError)} />
      ) : latest ? (
        <>
          <Box marginBottom={1}>
            <Sparkline data={candles.map((candle) => candle.close)} width={chartWidth} />
          </Box>
          <Box flexDirection="column">
            <KeyValue label="Open" value={formatPrice(latest.open, market.pricePrecision)} />
            <KeyValue label="High" value={formatPrice(latest.high, market.pricePrecision)} color={theme.positive} />
            <KeyValue label="Low" value={formatPrice(latest.low, market.pricePrecision)} color={theme.negative} />
            <KeyValue label="Close" value={formatPrice(latest.close, market.pricePrecision)} />
            <KeyValue label="Volume · base" value={formatCompact(latest.volume)} dim />
            <KeyValue
              label={`${candles.length}-bar range`}
              value={
                high == null || low == null
                  ? "—"
                  : `${formatPrice(low, market.pricePrecision)} – ${formatPrice(high, market.pricePrecision)}`
              }
            />
            <KeyValue
              label="Window change"
              value={change == null ? "—" : formatSignedPercent(change)}
              color={change == null ? theme.muted : signColor(change)}
            />
          </Box>
          <Text color={theme.faint}>Binance USD-M reference prices · not the solver execution price.</Text>
        </>
      ) : (
        <Empty title="No candles in this range" hint="Try a broader resolution." />
      )}
    </Panel>
  );
}
