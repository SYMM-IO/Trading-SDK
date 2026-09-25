import { Box, Text } from "ink";
import { useEffect, useMemo } from "react";
import { glyph, theme } from "../../config/theme.js";
import { formatCompactUsd, formatPercent, formatPrice } from "../../lib/format.js";
import { useNotionalCap } from "../../sdk/use-market-data.js";
import { isTradable, toMarketMeta, useMarkets, type MarketMeta } from "../../sdk/use-markets.js";
import { usePriceHistory } from "../../sdk/use-price-history.js";
import { useLivePrices } from "../../sdk/use-prices.js";
import { LoadingLine } from "../../ui/feedback.js";
import { KeyValue, Panel, Stat } from "../../ui/kit.js";
import { Menu } from "../../ui/menu.js";
import { Meter, Sparkline } from "../../ui/meter.js";
import { pad } from "../../ui/pad.js";
import { SearchLine } from "../../ui/search-line.js";
import { useAppState } from "../app-state.js";
import { useMarketFilter } from "./use-market-filter.js";

/** Markets browser: a searchable live catalog on the left, a detail dossier on the right. */
export function MarketsScreen({ active }: { active: boolean }) {
  const { data, isLoading } = useMarkets();
  const { prices } = useLivePrices();
  const { marketId, setMarketId, setTab } = useAppState();

  const markets = useMemo<MarketMeta[]>(() => {
    return (data ?? []).filter(isTradable).map(toMarketMeta);
  }, [data]);

  useEffect(() => {
    if (marketId == null && markets.length > 0) setMarketId(markets[0]!.symbolId);
  }, [marketId, markets, setMarketId]);

  const { query, searching, filtered, index, selected } = useMarketFilter(markets, {
    active,
    onEnter: () => setTab("trade"),
  });

  return (
    <Box flexDirection="row" gap={1} flexGrow={1}>
      <Panel
        title={`Markets (${query ? `${filtered.length}/${markets.length}` : markets.length})`}
        focused={active}
        width={44}
      >
        <SearchLine query={query} searching={searching} />
        {isLoading ? (
          <LoadingLine label="Loading markets…" />
        ) : (
          <Menu
            items={filtered}
            index={index}
            setIndex={(nextIndex) => {
              const market = filtered[nextIndex];
              if (market) setMarketId(market.symbolId);
            }}
            active={false}
            mouseActive={active}
            maxVisible={13}
            emptyLabel={query ? "No markets match." : "No tradable markets."}
            renderItem={(market, selectedRow) => {
              const price = prices.get(market.name);
              return (
                <Text>
                  <Text color={selectedRow ? theme.text : theme.muted}>{pad(market.symbol, 14)}</Text>
                  <Text color={selectedRow ? theme.primaryBright : theme.faint}>
                    {pad(price != null ? formatPrice(price, market.pricePrecision) : "—", 14, "right")}
                  </Text>
                  <Text color={theme.faint}>{pad(`${market.maxLeverage}x`, 7, "right")}</Text>
                </Text>
              );
            }}
          />
        )}
      </Panel>
      <MarketDetail market={selected} price={selected ? prices.get(selected.name) : undefined} />
    </Box>
  );
}

function MarketDetail({ market, price }: { market?: MarketMeta; price?: string }) {
  const history = usePriceHistory(market?.name);
  const cap = useNotionalCap(market?.symbolId);

  if (!market) {
    return (
      <Panel title="Detail" flexGrow={1}>
        <Text color={theme.faint}>Select a market.</Text>
      </Panel>
    );
  }

  const capData = cap.data;
  const totalCapacity = capData?.totalCap ?? 0;
  const usedAmount = capData?.used ?? 0;
  const used = totalCapacity > 0 ? usedAmount / totalCapacity : 0;
  const hasCapData = capData != null && !(capData.kind === "enigma" && capData.error != null);

  return (
    <Panel title={market.symbol} flexGrow={1} right={<Text color={theme.faint}>press t to trade</Text>}>
      <Box marginBottom={1}>
        <Stat
          label="Mark price"
          value={price != null ? formatPrice(price, market.pricePrecision) : "—"}
          color={theme.primaryBright}
          minWidth={18}
        />
        <Stat label="Max leverage" value={`${market.maxLeverage}x`} minWidth={16} />
        <Stat label="Symbol id" value={String(market.symbolId)} />
      </Box>

      <Box marginBottom={1}>
        <Text color={theme.muted}>Trend </Text>
        <Sparkline data={history} width={30} />
      </Box>

      <Box flexDirection="column">
        <KeyValue label="Price precision" value={String(market.pricePrecision)} />
        <KeyValue label="Quantity precision" value={String(market.quantityPrecision)} />
        {market.market.minAcceptableQuoteValue != null && (
          <KeyValue label="Min quote value" value={`$${market.market.minAcceptableQuoteValue}`} />
        )}
        {market.market.tradingFee != null && (
          <KeyValue label="Trading fee" value={formatPercent(Number(market.market.tradingFee) * 100)} />
        )}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color={theme.muted}>Open interest {glyph.dot} capacity</Text>
        {cap.isLoading ? (
          <LoadingLine label="Loading cap…" />
        ) : hasCapData && totalCapacity > 0 ? (
          <Box>
            <Meter value={used} width={24} color={used > 0.85 ? theme.warning : theme.primary} />
            <Text color={theme.faint}>
              {" "}
              {formatCompactUsd(usedAmount)} / {formatCompactUsd(totalCapacity)}
            </Text>
          </Box>
        ) : (
          <Text color={theme.faint}>Cap data unavailable for this market.</Text>
        )}
      </Box>
    </Panel>
  );
}
