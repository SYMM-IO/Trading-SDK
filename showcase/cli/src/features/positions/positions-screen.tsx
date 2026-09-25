import {
  groupQuotes,
  PositionType,
  SubAccountIsolationType,
  type QuoteTpSl,
  type UnifiedQuote,
} from "@symmio/trading-core";
import { Box, Text, useInput, useStdout } from "ink";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { glyph, sideColor, signColor, theme } from "../../config/theme.js";
import { formatError } from "../../lib/error.js";
import { formatPrice, formatSignedPercent, formatSignedUsd, formatUsdString, shortAddress } from "../../lib/format.js";
import { isCrossMarginIsolation } from "../../lib/sub-account.js";
import { useCapabilities } from "../../sdk/use-capabilities.js";
import { hasOrderAction, isActionable, useManagedPositions } from "../../sdk/use-managed-positions.js";
import { useMarketLookup } from "../../sdk/use-markets.js";
import { usePositionFunding } from "../../sdk/use-position-funding.js";
import { useLivePrices } from "../../sdk/use-prices.js";
import { useSigner } from "../../sdk/use-signer.js";
import { useSubAccount } from "../../sdk/use-sub-accounts.js";
import { useQuotesTpSl } from "../../sdk/use-tpsl.js";
import { Empty, LoadingLine } from "../../ui/feedback.js";
import { KeyValue, Panel, Stat } from "../../ui/kit.js";
import { Menu } from "../../ui/menu.js";
import { pad } from "../../ui/pad.js";
import { useAppState } from "../app-state.js";
import { quoteStateMeta } from "./lifecycle.js";
import { computePnl } from "./pnl.js";
import { tpSlSideLabel, tpSlSideView } from "./tpsl.js";

/** Live positions list with a per-position detail panel and inline actions. */
export function PositionsScreen({ active }: { active: boolean }) {
  const { stdout } = useStdout();
  const managed = useManagedPositions();
  const { byId } = useMarketLookup();
  const { prices } = useLivePrices();
  const { address } = useSigner();
  const capabilities = useCapabilities();
  const { subAccountDetail } = useSubAccount();
  const { openOverlay } = useAppState();
  const [index, setIndex] = useState(0);

  const positions = managed.positions;
  const tpslByQuote = useQuotesTpSl(positions);
  const supportsPositionMargin = !isCrossMarginIsolation(subAccountDetail?.isolationType);
  const wide = (stdout?.columns ?? 120) >= 118;
  const groups =
    capabilities.groupClose && subAccountDetail?.isolationType === SubAccountIsolationType.MARKET_DIRECTION
      ? groupQuotes(positions.filter(isActionable), SubAccountIsolationType.MARKET_DIRECTION)
      : [];

  useEffect(() => {
    if (index >= positions.length && positions.length > 0) setIndex(positions.length - 1);
  }, [positions.length, index]);

  const selected = positions[index];

  useInput(
    (input) => {
      if (input === "r") {
        managed.refetch();
        return;
      }
      if (!managed.actionsEnabled) return;
      if (input === "C" && positions.some(isActionable)) {
        openOverlay({ kind: "close-all", quotes: positions.filter(isActionable) });
        return;
      }
      if (!selected) return;
      if (input === "a" && hasOrderAction(selected)) openOverlay({ kind: "order-actions", quote: selected });
      else if (!isActionable(selected)) return;
      else if (input === "c") openOverlay({ kind: "close", quote: selected });
      else if (input === "g") {
        const group = groups.find((candidate) => candidate.quotes.some((quote) => quote.key === selected.key));
        if (group?.isAggregate) openOverlay({ kind: "group-close", group });
      } else if (input === "m" && supportsPositionMargin) openOverlay({ kind: "margin", quote: selected });
      else if (input === "t" && capabilities.tpSl) openOverlay({ kind: "tpsl", quote: selected });
    },
    { isActive: active },
  );

  const marketName = (quote: UnifiedQuote) => byId.get(String(quote.symbolId))?.symbol ?? `#${quote.symbolId}`;
  const priceFor = (quote: UnifiedQuote) => {
    const meta = byId.get(String(quote.symbolId));
    const raw = meta ? prices.get(meta.name) : undefined;
    return raw != null ? Number(raw) : null;
  };

  if (!address && positions.length === 0) {
    return (
      <Panel title="Positions" focused={active} flexGrow={1}>
        <Empty title="No wallet connected" hint="Press w to connect a wallet, then your positions appear here." />
      </Panel>
    );
  }

  return (
    <Box flexDirection={wide ? "row" : "column"} gap={1} flexGrow={1}>
      <Panel
        title={`Positions (${positions.length})`}
        focused={active}
        flexGrow={1}
        right={
          managed.error != null ? (
            <Text color={theme.negative}>{glyph.cross} stale — actions paused · r retry</Text>
          ) : managed.isStale ? (
            <Text color={theme.warning}>{glyph.dot} refreshing — actions paused</Text>
          ) : managed.isFetching ? (
            <LoadingLine />
          ) : wide ? (
            <Text color={theme.faint}>
              c close · C close all{supportsPositionMargin ? " · m margin" : ""}
              {capabilities.groupClose ? " · g group" : ""}
              {capabilities.tpSl ? " · t tp/sl" : ""} · a manage
            </Text>
          ) : undefined
        }
      >
        {managed.isStale && positions.length > 0 && (
          <Box marginBottom={1}>
            <Text color={managed.error != null ? theme.negative : theme.warning}>
              {managed.error != null
                ? `${glyph.cross} Position reads failed: ${formatError(managed.error)}. `
                : `${glyph.dot} Refreshing required position reads. `}
              Rows below are last-known; lifecycle actions are paused.
            </Text>
          </Box>
        )}
        {managed.isLoading ? (
          <LoadingLine label="Loading positions…" />
        ) : managed.error != null && !managed.hasSnapshot ? (
          <Empty title="Could not load positions" hint={formatError(managed.error)} tone={theme.negative} />
        ) : managed.isStale && positions.length === 0 ? (
          <Empty
            title="Position status unavailable"
            hint={
              managed.error != null ? `${formatError(managed.error)} · press r to retry` : "Refreshing required reads…"
            }
            tone={managed.error != null ? theme.negative : theme.warning}
          />
        ) : positions.length === 0 ? (
          <Empty title="No open positions" hint="Press 2 to open the trade ticket." />
        ) : (
          <Box flexDirection="column">
            <Box marginLeft={2}>
              <Text color={theme.faint}>
                {pad("Market", 10)}
                {pad("Side", 6)}
                {pad("Size", wide ? 11 : 10, "right")}
                {wide && pad("Entry", 12, "right")}
                {wide && pad("Mark", 12, "right")}
                {pad("uPnL", wide ? 13 : 12, "right")}
                {wide && "  "}
                {wide && pad("TP/SL", 8)}
                {pad("State", 10)}
              </Text>
            </Box>
            <Menu
              items={positions}
              index={index}
              setIndex={setIndex}
              active={active}
              maxVisible={14}
              onSelect={(quote) =>
                managed.actionsEnabled && isActionable(quote) && openOverlay({ kind: "close", quote })
              }
              renderItem={(quote, selectedRow) => {
                const isLong = quote.positionType === PositionType.LONG;
                const pnl = computePnl(quote, priceFor(quote));
                const meta = byId.get(String(quote.symbolId));
                const stage = quoteStateMeta(quote);
                return (
                  <Text>
                    <Text color={selectedRow ? theme.text : theme.muted}>{pad(marketName(quote), 10)}</Text>
                    <Text color={sideColor(isLong)}>{pad(isLong ? "LONG" : "SHORT", 6)}</Text>
                    <Text color={theme.muted}>{pad(pnl.quantity.toString(), wide ? 11 : 10, "right")}</Text>
                    {wide && (
                      <Text color={theme.muted}>
                        {pad(formatPrice(pnl.entryPrice, meta?.pricePrecision), 12, "right")}
                      </Text>
                    )}
                    {wide && (
                      <Text color={theme.text}>
                        {pad(
                          priceFor(quote) != null ? formatPrice(priceFor(quote) as number, meta?.pricePrecision) : "—",
                          12,
                          "right",
                        )}
                      </Text>
                    )}
                    <Text color={signColor(pnl.uPnlUsd)}>
                      {pad(formatSignedUsd(pnl.uPnlUsd), wide ? 13 : 12, "right")}
                    </Text>
                    {wide && <Text>{"  "}</Text>}
                    {wide && <TpSlFlags snapshot={tpslByQuote.get(quote.key)} />}
                    <Text color={stage.color}>{pad(stage.label, 10)}</Text>
                  </Text>
                );
              }}
            />
          </Box>
        )}
      </Panel>
      <PositionDetail
        quote={selected}
        price={selected ? priceFor(selected) : null}
        pricePrecision={selected ? byId.get(String(selected.symbolId))?.pricePrecision : undefined}
        name={selected ? marketName(selected) : undefined}
        tpsl={selected ? tpslByQuote.get(selected.key) : undefined}
        supportsMargin={supportsPositionMargin}
        supportsTpSl={capabilities.tpSl}
        actionsEnabled={managed.actionsEnabled}
        wide={wide}
      />
    </Box>
  );
}

/**
 * The list's TP/SL cell. Values need room the row does not have, so it only
 * flags which sides are armed — the detail panel carries the trigger prices.
 */
function TpSlFlags({ snapshot }: { snapshot?: QuoteTpSl }) {
  const tp = tpSlSideView("tp", snapshot);
  const sl = tpSlSideView("sl", snapshot);
  if (!tp.active && !sl.active) return <Text color={theme.faint}>{pad("—", 8)}</Text>;
  return (
    <Text>
      <Text color={tp.color}>{pad(tp.active ? "TP" : "", 3)}</Text>
      <Text color={sl.color}>{pad(sl.active ? "SL" : "", 5)}</Text>
    </Text>
  );
}

function PositionDetail({
  quote,
  price,
  pricePrecision,
  name,
  tpsl,
  supportsMargin,
  supportsTpSl,
  actionsEnabled,
  wide,
}: {
  quote?: UnifiedQuote;
  price: number | null;
  pricePrecision?: number;
  name?: string;
  tpsl?: QuoteTpSl;
  supportsMargin: boolean;
  supportsTpSl: boolean;
  actionsEnabled: boolean;
  wide: boolean;
}) {
  const funding = usePositionFunding(quote && isActionable(quote) ? quote.quoteId : undefined);

  if (!quote) {
    return (
      <Panel title="Detail" width={wide ? 40 : undefined}>
        <Text color={theme.faint}>Select a position.</Text>
      </Panel>
    );
  }
  const isLong = quote.positionType === PositionType.LONG;
  const pnl = computePnl(quote, price);
  const stage = quoteStateMeta(quote);
  const actionable = isActionable(quote);
  const tp = tpSlSideView("tp", tpsl, pricePrecision);
  const sl = tpSlSideView("sl", tpsl, pricePrecision);

  return (
    <Panel title={`${name} ${isLong ? "LONG" : "SHORT"}`} width={wide ? 40 : undefined}>
      <Box marginBottom={1}>
        <Stat
          label="uPnL"
          value={formatSignedUsd(pnl.uPnlUsd)}
          color={signColor(pnl.uPnlUsd)}
          hint={formatSignedPercent(pnl.uPnlPct)}
          minWidth={18}
        />
        <Stat label="State" value={stage.label} color={stage.color} />
      </Box>
      <Box flexDirection="column">
        <KeyValue label="Size" value={`${pnl.quantity} ${(name ?? "").replace("USDT", "")}`} />
        <KeyValue label="Entry" value={formatPrice(pnl.entryPrice, pricePrecision)} />
        <KeyValue label="Mark" value={price != null ? formatPrice(price, pricePrecision) : "—"} />
        <KeyValue label="Notional" value={formatUsdString(pnl.notionalUsd)} />
        <KeyValue label="Margin" value={formatUsdString(pnl.marginUsd)} />
        <KeyValue label="Leverage" value={`${pnl.leverage.toFixed(1)}x`} />
        <KeyValue
          label="Settled funding"
          value={funding.settled != null ? formatSignedUsd(Number(formatUnits(funding.settled, 18))) : "—"}
          color={funding.settled != null ? signColor(Number(funding.settled)) : undefined}
        />
        <KeyValue
          label="Pending funding"
          value={funding.pending != null ? formatSignedUsd(Number(formatUnits(funding.pending, 18))) : "—"}
          color={funding.pending != null ? signColor(Number(funding.pending)) : undefined}
        />
        <KeyValue label="Take profit" value={tpSlSideLabel(tp)} color={tp.color} />
        <KeyValue label="Stop loss" value={tpSlSideLabel(sl)} color={sl.color} />
        <KeyValue label="Quote id" value={quote.quoteId != null ? `#${quote.quoteId}` : `temp ${quote.tempQuoteId}`} />
        {quote.vaAddress != null && <KeyValue label="Virtual acct" value={shortAddress(quote.vaAddress)} dim />}
      </Box>
      <Box marginTop={1}>
        {!actionsEnabled ? (
          <Text color={theme.warning}>
            Lifecycle actions paused until required reads recover. <Text color={theme.primaryBright}>r</Text> retry
          </Text>
        ) : actionable ? (
          <Text color={theme.faint}>
            <Text color={theme.primaryBright}>c</Text> close
            {supportsMargin && (
              <Text>
                {` ${glyph.dot} `}
                <Text color={theme.primaryBright}>m</Text> margin
              </Text>
            )}
            {supportsTpSl && (
              <Text>
                {` ${glyph.dot} `}
                <Text color={theme.primaryBright}>t</Text> tp/sl
              </Text>
            )}
          </Text>
        ) : (
          <Text color={theme.faint}>
            {hasOrderAction(quote) ? (
              <>
                <Text color={theme.primaryBright}>a</Text> manage pending order
              </>
            ) : (
              "Actions unlock once the position is fully on-chain."
            )}
          </Text>
        )}
      </Box>
    </Panel>
  );
}
