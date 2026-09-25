import { OrderType, PositionType, QuoteCloseType, type QuoteHistoryRow } from "@symmio/trading-core";
import { Box, Text, useInput, useStdout } from "ink";
import { useEffect, useState } from "react";
import { glyph, sideColor, signColor, theme } from "../../config/theme.js";
import {
  formatCompact,
  formatDateTime,
  formatDecimal,
  formatPrice,
  formatRelative,
  formatSignedUsdFine,
  formatUsdString,
  shortAddress,
} from "../../lib/format.js";
import { useMarketLookup } from "../../sdk/use-markets.js";
import { HISTORY_PAGE_SIZE, useQuoteHistory } from "../../sdk/use-quote-history.js";
import { useSubAccount } from "../../sdk/use-sub-accounts.js";
import { Empty, LoadingLine } from "../../ui/feedback.js";
import { KeyValue, Panel, Stat } from "../../ui/kit.js";
import { Menu } from "../../ui/menu.js";
import { pad, truncate } from "../../ui/pad.js";
import { CLOSE_TYPE_FILTERS, closeEventMeta } from "./close-event.js";
import { closePriceNumber, closeSizeNumber, isLiquidation, openPriceNumber, realizedPnlOf } from "./history-row.js";

/**
 * `pad` fills to an exact width, so a value that happens to be exactly as wide
 * as its column leaves no gap and runs straight into the next one — a 6-digit
 * size beside a sub-cent price, or an 11-char "Force close" beside a timestamp.
 * These two clip one column short so every cell keeps at least one space of
 * gutter, whatever the content.
 */
function numericCell(text: string, width: number): string {
  return pad(truncate(text, width - 1), width, "right");
}

function textCell(text: string, width: number): string {
  return pad(truncate(text, width - 1), width);
}

/** Sizes abbreviate past a thousand, matching the web; below that they stay exact. */
function sizeLabel(size: number): string {
  return size >= 1000 ? formatCompact(size) : formatDecimal(size, 6);
}

/** Closed / liquidated trade history for the active sub-account, with a detail panel. */
export function HistoryScreen({ active }: { active: boolean }) {
  const { stdout } = useStdout();
  const { byId } = useMarketLookup();
  const { subAccount } = useSubAccount();
  const [filterIndex, setFilterIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [index, setIndex] = useState(0);
  const wide = (stdout?.columns ?? 120) >= 118;

  const filter = CLOSE_TYPE_FILTERS[filterIndex] ?? CLOSE_TYPE_FILTERS[0]!;
  const history = useQuoteHistory({ page, closeType: filter.value });
  const rows = history.rows;

  /** A new account or filter re-bases the list — go back to the first page. */
  useEffect(() => {
    setPage(1);
    setIndex(0);
  }, [subAccount, filterIndex]);

  useEffect(() => {
    if (index >= rows.length && rows.length > 0) setIndex(rows.length - 1);
  }, [rows.length, index]);

  const selected = rows[index];

  useInput(
    (input) => {
      if (input === "f") setFilterIndex((current) => (current + 1) % CLOSE_TYPE_FILTERS.length);
      else if (input === "r") history.refetch();
      else if (input === "n" && history.hasNextPage) {
        setPage((current) => current + 1);
        setIndex(0);
      } else if (input === "p" && page > 1) {
        setPage((current) => Math.max(1, current - 1));
        setIndex(0);
      }
    },
    { isActive: active },
  );

  const marketName = (row: QuoteHistoryRow) => byId.get(String(row.marketId))?.symbol ?? `#${row.marketId}`;
  const precisionOf = (row: QuoteHistoryRow) => byId.get(String(row.marketId))?.pricePrecision;

  const title = `History${filter.value === QuoteCloseType.All ? "" : ` · ${filter.label}`}${page > 1 ? ` · page ${page}` : ""}`;

  return (
    <Box flexDirection={wide ? "row" : "column"} gap={1} flexGrow={1}>
      <Panel
        title={title}
        focused={active}
        flexGrow={1}
        right={
          history.error != null ? (
            <Text color={theme.negative}>{glyph.cross} history unavailable</Text>
          ) : history.isFetching ? (
            <LoadingLine />
          ) : wide ? (
            <Text color={theme.faint}>f filter · n/p page · r refresh</Text>
          ) : undefined
        }
      >
        {!subAccount ? (
          <Empty
            title="No sub-account selected"
            hint="Connect a wallet and select a sub-account to see its trade history."
          />
        ) : history.isLoading ? (
          <LoadingLine label="Loading history…" />
        ) : history.error != null && rows.length === 0 ? (
          <Empty title="Could not load history" hint={(history.error as Error).message} tone={theme.negative} />
        ) : rows.length === 0 ? (
          <Empty
            title={page > 1 ? "No more history" : "No closed trades yet"}
            hint={
              page > 1
                ? "Press p to go back a page."
                : filter.value === QuoteCloseType.All
                  ? "Closed and liquidated positions appear here."
                  : `No ${filter.label.toLowerCase()} trades — press f to change the filter.`
            }
          />
        ) : (
          <Box flexDirection="column">
            <Box marginLeft={2}>
              <Text color={theme.faint}>
                {pad("Market", 10)}
                {pad("Side", 6)}
                {pad("Size", wide ? 13 : 11, "right")}
                {wide && pad("Open", 12, "right")}
                {wide && pad("Close", 12, "right")}
                {pad("Realized", 12, "right")}
                {wide && "  "}
                {wide && pad("Status", 12)}
                {pad("Closed", 9)}
              </Text>
            </Box>
            <Menu
              items={rows}
              index={index}
              setIndex={setIndex}
              active={active}
              maxVisible={HISTORY_PAGE_SIZE}
              renderItem={(row, selectedRow) => {
                const isLong = row.positionType === PositionType.LONG;
                const stage = closeEventMeta(row.closeEventType);
                const pnl = realizedPnlOf(row);
                const precision = precisionOf(row);
                return (
                  <Text>
                    <Text color={selectedRow ? theme.text : theme.muted}>{textCell(marketName(row), 10)}</Text>
                    <Text color={sideColor(isLong)}>{pad(isLong ? "LONG" : "SHORT", 6)}</Text>
                    <Text color={theme.muted}>{numericCell(sizeLabel(closeSizeNumber(row)), wide ? 13 : 11)}</Text>
                    {wide && (
                      <Text color={theme.muted}>{numericCell(formatPrice(openPriceNumber(row), precision), 12)}</Text>
                    )}
                    {wide && (
                      <Text color={theme.text}>{numericCell(formatPrice(closePriceNumber(row), precision), 12)}</Text>
                    )}
                    <Text color={signColor(pnl)}>{numericCell(formatSignedUsdFine(pnl), 12)}</Text>
                    {wide && <Text>{"  "}</Text>}
                    {wide && <Text color={stage.color}>{textCell(stage.label, 12)}</Text>}
                    <Text color={theme.faint}>{pad(formatRelative(row.closedAt), 9)}</Text>
                  </Text>
                );
              }}
            />
            <Box marginTop={1}>
              <Text color={theme.faint}>
                {page > 1 ? `${glyph.arrow} p prev  ` : ""}
                {history.hasNextPage ? `n next ${glyph.arrow}` : "end of history"}
              </Text>
            </Box>
          </Box>
        )}
      </Panel>
      <HistoryDetail
        row={selected}
        name={selected ? marketName(selected) : undefined}
        pricePrecision={selected ? precisionOf(selected) : undefined}
        wide={wide}
      />
    </Box>
  );
}

function HistoryDetail({
  row,
  name,
  pricePrecision,
  wide,
}: {
  row?: QuoteHistoryRow;
  name?: string;
  pricePrecision?: number;
  wide: boolean;
}) {
  if (!row) {
    return (
      <Panel title="Detail" width={wide ? 40 : undefined}>
        <Text color={theme.faint}>Select a trade.</Text>
      </Panel>
    );
  }

  const isLong = row.positionType === PositionType.LONG;
  const stage = closeEventMeta(row.closeEventType);
  const pnl = realizedPnlOf(row);
  const size = closeSizeNumber(row);
  const notional = size * closePriceNumber(row);
  const liquidated = isLiquidation(row);

  return (
    <Panel title={`${name} ${isLong ? "LONG" : "SHORT"}`} width={wide ? 40 : undefined}>
      <Box marginBottom={1}>
        <Stat label="Realized PnL" value={formatSignedUsdFine(pnl)} color={signColor(pnl)} minWidth={18} />
        <Stat label="Status" value={stage.label} color={stage.color} />
      </Box>
      <Box flexDirection="column">
        <KeyValue label="Size" value={`${sizeLabel(size)} ${(name ?? "").replace("USDT", "")}`} />
        <KeyValue label="Open price" value={formatPrice(openPriceNumber(row), pricePrecision)} />
        <KeyValue
          label={liquidated ? "Liq. price" : "Close price"}
          value={formatPrice(closePriceNumber(row), pricePrecision)}
        />
        <KeyValue label="Notional" value={formatUsdString(notional)} />
        <KeyValue label="Quote id" value={`#${row.quoteId}`} />
        <KeyValue label="Order type" value={row.orderType === OrderType.LIMIT ? "Limit" : "Market"} />
        <KeyValue label="Closed" value={formatDateTime(row.closedAt)} />
        {row.partyB != null && <KeyValue label="Solver" value={shortAddress(row.partyB)} dim />}
        <KeyValue label="Virtual acct" value={shortAddress(row.partyA)} dim />
        {row.transaction != null && <KeyValue label="Tx" value={shortAddress(row.transaction)} dim />}
      </Box>
      <Box marginTop={1}>
        <Text color={theme.faint}>
          One row per close event — a partial close shows only that fill&apos;s size and price.
        </Text>
      </Box>
    </Panel>
  );
}
