import { Text } from "ink";
import { useMemo } from "react";
import { theme } from "../../config/theme.js";
import { formatPrice } from "../../lib/format.js";
import { isTradable, toMarketMeta, useMarkets, type MarketMeta } from "../../sdk/use-markets.js";
import { useLivePrices } from "../../sdk/use-prices.js";
import { Menu } from "../../ui/menu.js";
import { pad } from "../../ui/pad.js";
import { SearchLine } from "../../ui/search-line.js";
import { Sheet } from "../../ui/sheet.js";
import { useAppState } from "../app-state.js";
import { useMarketFilter } from "../markets/use-market-filter.js";

/** Shared searchable market picker for any screen that owns the active market. */
export function MarketPickerSheet({ active, startSearching = false }: { active: boolean; startSearching?: boolean }) {
  const { data } = useMarkets();
  const { prices } = useLivePrices();
  const { closeOverlay, setMarketId } = useAppState();

  const markets = useMemo<MarketMeta[]>(
    () =>
      (data ?? [])
        .filter(isTradable)
        .map(toMarketMeta)
        .filter((meta): meta is MarketMeta => meta != null),
    [data],
  );

  const { query, searching, filtered, index } = useMarketFilter(markets, {
    active,
    initialSearching: startSearching,
    onEnter: () => closeOverlay(),
  });

  return (
    <Sheet title="Select market" subtitle={`${filtered.length} markets`}>
      <SearchLine query={query} searching={searching} escLabel="close" />
      <Menu
        items={filtered}
        index={index}
        setIndex={(nextIndex) => {
          const market = filtered[nextIndex];
          if (market) setMarketId(market.symbolId);
        }}
        active={false}
        mouseActive={active}
        maxVisible={12}
        emptyLabel="No markets match."
        onSelect={(market) => {
          setMarketId(market.symbolId);
          closeOverlay();
        }}
        renderItem={(market, selectedRow) => {
          const price = prices.get(market.name);
          return (
            <Text>
              <Text color={selectedRow ? theme.text : theme.muted}>{pad(market.symbol, 16)}</Text>
              <Text color={selectedRow ? theme.primaryBright : theme.faint}>
                {pad(price != null ? formatPrice(price, market.pricePrecision) : "—", 16, "right")}
              </Text>
              <Text color={theme.faint}>{pad(`${market.maxLeverage}x`, 7, "right")}</Text>
            </Text>
          );
        }}
      />
    </Sheet>
  );
}
