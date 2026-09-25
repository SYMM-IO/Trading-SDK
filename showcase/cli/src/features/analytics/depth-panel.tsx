import type { OrderbookDepthLevel } from "@symmio/trading-core";
import { Box, Text } from "ink";
import { theme } from "../../config/theme.js";
import { formatError } from "../../lib/error.js";
import { formatCompactUsd, formatDecimal, formatPrice, formatSignedPercent } from "../../lib/format.js";
import type { MarketAnalyticsResult } from "../../sdk/use-market-analytics.js";
import type { MarketMeta } from "../../sdk/use-markets.js";
import { Empty, ErrorLine, LoadingLine } from "../../ui/feedback.js";
import { KeyValue, Panel, StatusDot } from "../../ui/kit.js";
import { pad } from "../../ui/pad.js";

interface Props {
  market: MarketMeta;
  analytics: MarketAnalyticsResult;
  compact: boolean;
  width?: number;
}

function depthBar(total: number, maxTotal: number, width: number): string {
  const ratio = maxTotal > 0 ? Math.max(0, Math.min(1, total / maxTotal)) : 0;
  const filled = Math.round(ratio * width);
  return `${"█".repeat(filled)}${"░".repeat(Math.max(0, width - filled))}`;
}

function DepthRow({
  side,
  level,
  pricePrecision,
  sizePrecision,
  maxTotal,
  compact,
}: {
  side: "ask" | "bid";
  level: OrderbookDepthLevel;
  pricePrecision: number;
  sizePrecision: number;
  maxTotal: number;
  compact: boolean;
}) {
  const tone = side === "bid" ? theme.positive : theme.negative;
  const priceWidth = compact ? 13 : 15;
  const sizeWidth = compact ? 10 : 12;
  return (
    <Text color={tone}>
      {pad(side === "bid" ? "BID" : "ASK", 4)}
      {pad(formatPrice(level.price, pricePrecision), priceWidth, "right")}
      {pad(formatDecimal(level.size, sizePrecision), sizeWidth, "right")}{" "}
      {depthBar(level.total, maxTotal, compact ? 6 : 9)}
    </Text>
  );
}

/** Synchronized reference book with cumulative rows and ±1% depth. */
export function DepthPanel({ market, analytics, compact, width }: Props) {
  const book = analytics.orderbook;
  const symbol = analytics.reference.symbol;
  const pricePrecision = symbol?.pricePrecision ?? market.pricePrecision;
  const sizePrecision = Math.min(symbol?.sizePrecision ?? market.quantityPrecision, 6);
  const statusLabel = analytics.isResyncing
    ? `resync · ${analytics.resyncReason ?? "snapshot"}`
    : analytics.orderbookStatus;
  const statusColor = analytics.orderbookStatus === "open" && !analytics.isResyncing ? theme.positive : theme.warning;

  return (
    <Panel
      title="Reference depth"
      right={<StatusDot color={statusColor} label={statusLabel} />}
      width={width}
      flexGrow={width == null ? 1 : undefined}
    >
      {analytics.reference.isLoading ? (
        <LoadingLine label="Checking reference listing…" />
      ) : analytics.reference.error != null ? (
        <ErrorLine message={formatError(analytics.reference.error)} />
      ) : !analytics.reference.supported ? (
        <Empty title="No reference orderbook" hint="This market is not listed on Binance USD-M." />
      ) : analytics.orderbookLoading ? (
        <LoadingLine label="Synchronizing orderbook…" />
      ) : analytics.orderbookError != null && book.bids.length === 0 && book.asks.length === 0 ? (
        <ErrorLine message={formatError(analytics.orderbookError)} />
      ) : book.bids.length > 0 || book.asks.length > 0 ? (
        <Box flexDirection="column">
          <Text color={theme.faint}>
            {pad("SIDE", 4)}
            {pad("PRICE", compact ? 13 : 15, "right")}
            {pad(`SIZE ${symbol?.baseAsset ?? market.market.asset}`, compact ? 10 : 12, "right")} DEPTH
          </Text>
          {[...book.asks].reverse().map((level) => (
            <DepthRow
              key={`ask-${level.price}`}
              side="ask"
              level={level}
              pricePrecision={pricePrecision}
              sizePrecision={sizePrecision}
              maxTotal={book.maxTotal}
              compact={compact}
            />
          ))}
          <Box marginY={1} flexDirection="column">
            <KeyValue
              label="Spread"
              value={
                book.spread
                  ? `${formatPrice(book.spread.spread, pricePrecision)} · ${book.spread.spreadBps.toFixed(2)} bps`
                  : "—"
              }
              color={theme.info}
            />
          </Box>
          {book.bids.map((level) => (
            <DepthRow
              key={`bid-${level.price}`}
              side="bid"
              level={level}
              pricePrecision={pricePrecision}
              sizePrecision={sizePrecision}
              maxTotal={book.maxTotal}
              compact={compact}
            />
          ))}
          <Box marginTop={1} flexDirection="column">
            <KeyValue label="Bid depth · ±1%" value={book.depth ? formatCompactUsd(book.depth.bidQuote) : "—"} />
            <KeyValue label="Ask depth · ±1%" value={book.depth ? formatCompactUsd(book.depth.askQuote) : "—"} />
            <KeyValue
              label="Depth imbalance"
              value={book.depth ? formatSignedPercent(book.depth.imbalance * 100) : "—"}
              color={book.depth && book.depth.imbalance >= 0 ? theme.positive : theme.negative}
            />
          </Box>
          <Text color={theme.faint}>Reference liquidity only · SYMMIO execution is solver-quoted.</Text>
        </Box>
      ) : (
        <Empty title="Orderbook is empty" hint="The reference stream has no levels yet." />
      )}
    </Panel>
  );
}
