import {
  calculateTradeParams,
  PositionType,
  validateInstantOpenAgainstMarket,
  type QuoteConstraintViolation,
} from "@symmio/trading-core";
import { Box, Text, useInput, useStdout } from "ink";
import { useEffect, useMemo, useState } from "react";
import { glyph, sideColor, theme } from "../../config/theme.js";
import { formatError } from "../../lib/error.js";
import { formatPrice, formatSignedUsd, formatUsdString } from "../../lib/format.js";
import { parsePositiveNumber } from "../../lib/parse-amount.js";
import { useInstantOpen, useLimitOpen } from "../../sdk/mutations.js";
import { useAvailableInstantOpenMargin } from "../../sdk/use-available-instant-open-margin.js";
import { useCapabilities } from "../../sdk/use-capabilities.js";
import { useLockedParams, useNotionalCap } from "../../sdk/use-market-data.js";
import { isTradable, toMarketMeta, useMarkets, type MarketMeta } from "../../sdk/use-markets.js";
import { usePriceHistory } from "../../sdk/use-price-history.js";
import { useLivePrices } from "../../sdk/use-prices.js";
import { Field, Segmented, StepperRow } from "../../ui/controls.js";
import { ErrorLine } from "../../ui/feedback.js";
import { KeyValue, Panel, Stat } from "../../ui/kit.js";
import { Sparkline } from "../../ui/meter.js";
import { useRunGate } from "../app-actions.js";
import { useAppState } from "../app-state.js";
import { useFormNav } from "../form-nav.js";
import { useGate } from "../gate.js";

const ROWS = { MARKET: 0, SIDE: 1, ORDER: 2, MARGIN: 3, LEVERAGE: 4, PRICE: 5, SUBMIT: 6 } as const;
const SIDE_OPTIONS = [
  { key: "long", label: "LONG", color: theme.positive },
  { key: "short", label: "SHORT", color: theme.negative },
] as const;
const ORDER_OPTIONS = [
  { key: "market", label: "MARKET", color: theme.info },
  { key: "limit", label: "LIMIT", color: theme.primaryBright },
] as const;

function violationLabel(violation: QuoteConstraintViolation): string {
  return violation.kind.replaceAll("_", " ").toLowerCase();
}

/** The order ticket — instant market open with a live preview and validation. */
export function TradeScreen({ active }: { active: boolean }) {
  const { stdout } = useStdout();
  const { data } = useMarkets();
  const { prices } = useLivePrices();
  const { marketId, setMarketId, openOverlay } = useAppState();
  const gate = useGate();
  const runGate = useRunGate();
  const capabilities = useCapabilities();
  const open = useInstantOpen();
  const limitOpen = useLimitOpen();

  const [side, setSide] = useState<"long" | "short">("long");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [margin, setMargin] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [leverage, setLeverage] = useState(2);
  const [slippage, setSlippage] = useState(1);
  const wide = (stdout?.columns ?? 120) >= 100;

  const markets = useMemo<MarketMeta[]>(
    () =>
      (data ?? [])
        .filter(isTradable)
        .map(toMarketMeta)
        .filter((meta): meta is MarketMeta => meta != null),
    [data],
  );

  const marketIndex = Math.max(
    0,
    markets.findIndex((market) => market.symbolId === marketId),
  );
  const market = markets[marketIndex];

  const positionType = side === "long" ? PositionType.LONG : PositionType.SHORT;
  const markPrice = market ? prices.get(market.name) : undefined;
  const maxLeverage = market?.maxLeverage ?? 100;
  const leverageNum = leverage;
  const slippageNum = slippage;

  const locked = useLockedParams(market?.name, Math.round(leverageNum));
  const cap = useNotionalCap(market?.symbolId);
  const spendable = useAvailableInstantOpenMargin({
    symbolId: market?.symbolId,
    leverage: leverageNum,
    positionType,
    slippage: orderType === "limit" ? 0 : slippageNum,
  });
  const history = usePriceHistory(market?.name);

  const { row } = useFormNav(
    7,
    active,
    (current) => current === ROWS.MARGIN || (orderType === "limit" && current === ROWS.PRICE),
  );

  useInput(
    (input, key) => {
      const dec = key.leftArrow || input === "h";
      const inc = key.rightArrow || input === "l";
      if (row === ROWS.MARKET) {
        if (key.return) openOverlay({ kind: "market-picker" });
        else if (markets.length > 0 && inc) setMarketId(markets[(marketIndex + 1) % markets.length]!.symbolId);
        else if (markets.length > 0 && dec)
          setMarketId(markets[(marketIndex - 1 + markets.length) % markets.length]!.symbolId);
      } else if (row === ROWS.SIDE) {
        if (dec || inc) setSide((current) => (current === "long" ? "short" : "long"));
      } else if (row === ROWS.ORDER && capabilities.limitOrder && (dec || inc)) {
        setOrderType((current) => (current === "market" ? "limit" : "market"));
      } else if (row === ROWS.LEVERAGE) {
        if (inc) setLeverage((current) => Math.min(maxLeverage, current + 1));
        else if (dec) setLeverage((current) => Math.max(1, current - 1));
      } else if (row === ROWS.PRICE && orderType === "market") {
        if (inc) setSlippage((current) => Math.min(50, Math.round((current + 0.5) * 10) / 10));
        else if (dec) setSlippage((current) => Math.max(0.1, Math.round((current - 0.5) * 10) / 10));
      } else if (row === ROWS.SUBMIT && key.return) {
        void submit();
      }
    },
    { isActive: active },
  );

  useEffect(() => {
    if (market && leverage > market.maxLeverage) setLeverage(market.maxLeverage);
  }, [market, leverage]);

  useEffect(() => {
    if (!capabilities.limitOrder) setOrderType("market");
  }, [capabilities.limitOrder]);

  const preview = useMemo(() => {
    const price = orderType === "limit" ? limitPrice : markPrice;
    if (!market || price == null || !price || !margin || !locked.data) return null;
    return calculateTradeParams({
      markPrice: price,
      slippage: orderType === "limit" ? 0 : slippageNum,
      positionType,
      userInput: margin,
      inputField: "PRICE",
      leverage: leverageNum,
      pricePrecision: market.pricePrecision,
      quantityPrecision: market.quantityPrecision,
      cvaPercent: locked.data.cva,
      lfPercent: locked.data.lf,
      partyAmmPercent: locked.data.partyAmm,
      partyBmmPercent: locked.data.partyBmm,
    });
  }, [market, markPrice, limitPrice, margin, locked.data, slippageNum, positionType, leverageNum, orderType]);

  const violations = useMemo(() => {
    if (!market || !preview || markPrice == null) return [];
    return validateInstantOpenAgainstMarket({
      market: market.market,
      quantity: preview.quantity,
      markPrice,
      cva: preview.cva,
      lf: preview.lf,
      partyAmm: preview.partyAmm,
      notionalCap: cap.data,
      positionType,
    }).violations;
  }, [market, preview, markPrice, cap.data, positionType]);

  const available = Number(spendable.availableMargin);
  const marginNum = parsePositiveNumber(margin);
  const limitPriceNum = parsePositiveNumber(limitPrice);
  const exceedsAvailable = marginNum != null && spendable.availableMarginWei != null && marginNum > available;
  const capServiceError = cap.data?.kind === "enigma" ? cap.data.error : null;
  const capUnavailable = market != null && (cap.data == null || cap.error != null || capServiceError != null);
  const mutationPending = open.isPending || limitOpen.isPending;
  const canSubmit =
    gate.isReady &&
    Boolean(market) &&
    spendable.availableMarginWei != null &&
    marginNum != null &&
    (orderType === "market" ? slippage > 0 : capabilities.limitOrder && limitPriceNum != null) &&
    (preview?.quantity ? Number(preview.quantity) > 0 : false) &&
    violations.length === 0 &&
    !capUnavailable &&
    !exceedsAvailable &&
    !mutationPending;

  async function submit() {
    if (!gate.isReady) {
      runGate();
      return;
    }
    if (!canSubmit || !market || markPrice == null) return;
    try {
      const marketInput = {
        id: market.symbolId,
        name: market.name,
        pricePrecision: market.pricePrecision,
        quantityPrecision: market.quantityPrecision,
      };
      if (orderType === "limit") {
        await limitOpen.mutateAsync({
          market: marketInput,
          positionType,
          initialMargin: margin,
          leverage: Math.round(leverageNum),
          price: limitPrice,
        });
      } else {
        await open.mutateAsync({
          market: marketInput,
          positionType,
          initialMargin: margin,
          leverage: Math.round(leverageNum),
          slippage: slippageNum,
          markPrice,
        });
      }
      setMargin("");
    } catch {
      /* surfaced via open.error below */
    }
  }

  const submitLabel = !gate.isReady
    ? gate.label
    : market && cap.isLoading
      ? "Checking market capacity…"
      : capUnavailable
        ? "Market capacity unavailable"
        : mutationPending
          ? "Submitting…"
          : `${orderType === "limit" ? "Place" : side === "long" ? "Buy / Long" : "Sell / Short"} ${market?.symbol ?? ""}${orderType === "limit" ? ` ${side.toUpperCase()}` : ""}`;

  return (
    <Box flexDirection={wide ? "row" : "column"} gap={1} flexGrow={1}>
      <Panel title="New order" focused={active} width={wide ? 46 : undefined}>
        <Box flexDirection="column" gap={1}>
          <Box>
            <Box width={13}>
              <Text color={row === ROWS.MARKET ? theme.primaryBright : theme.muted}>Market</Text>
            </Box>
            <Text color={row === ROWS.MARKET ? theme.borderFocus : theme.faint}>
              {row === ROWS.MARKET ? glyph.caret : " "}{" "}
            </Text>
            <Text color={theme.text}>{market?.symbol ?? "—"}</Text>
            {row === ROWS.MARKET && <Text color={theme.faint}> ← → change {glyph.dot} ⏎ search</Text>}
          </Box>

          <Box>
            <Box width={13}>
              <Text color={row === ROWS.SIDE ? theme.primaryBright : theme.muted}>Side</Text>
            </Box>
            <Text color={row === ROWS.SIDE ? theme.borderFocus : theme.faint}>
              {row === ROWS.SIDE ? glyph.caret : " "}{" "}
            </Text>
            <Segmented options={SIDE_OPTIONS} value={side} focused={row === ROWS.SIDE} onChange={setSide} />
          </Box>

          <Box>
            <Box width={13}>
              <Text color={row === ROWS.ORDER ? theme.primaryBright : theme.muted}>Order type</Text>
            </Box>
            <Text color={row === ROWS.ORDER ? theme.borderFocus : theme.faint}>
              {row === ROWS.ORDER ? glyph.caret : " "}{" "}
            </Text>
            <Segmented
              options={capabilities.limitOrder ? ORDER_OPTIONS : ORDER_OPTIONS.slice(0, 1)}
              value={orderType}
              focused={row === ROWS.ORDER}
              onChange={setOrderType}
            />
            {!capabilities.limitOrder && <Text color={theme.faint}> solver unsupported</Text>}
          </Box>

          <Field
            label="Margin"
            value={margin}
            onChange={setMargin}
            focused={row === ROWS.MARGIN}
            placeholder="0.00"
            suffix="USD"
            invalid={exceedsAvailable}
            hint={
              exceedsAvailable
                ? `exceeds spendable ${formatUsdString(available)}`
                : spendable.isLoading
                  ? "calculating spendable margin…"
                  : `spendable ${formatUsdString(available)}`
            }
          />
          <StepperRow
            label="Leverage"
            value={`${leverage}x`}
            focused={row === ROWS.LEVERAGE}
            hint={row === ROWS.LEVERAGE ? `← → adjust · max ${maxLeverage}x` : undefined}
          />
          {orderType === "limit" ? (
            <Field
              label="Limit price"
              value={limitPrice}
              onChange={setLimitPrice}
              focused={row === ROWS.PRICE}
              placeholder={markPrice ?? "0.00"}
              suffix="USD"
              invalid={limitPrice !== "" && limitPriceNum == null}
              hint={markPrice != null ? `mark ${formatPrice(markPrice, market?.pricePrecision)}` : undefined}
            />
          ) : (
            <StepperRow
              label="Slippage"
              value={`${slippage.toFixed(1)}%`}
              focused={row === ROWS.PRICE}
              hint={row === ROWS.PRICE ? "← → adjust" : undefined}
            />
          )}

          <Box marginTop={1}>
            <Text
              backgroundColor={canSubmit ? sideColor(side === "long") : undefined}
              color={canSubmit ? theme.onAccent : row === ROWS.SUBMIT ? theme.primaryBright : theme.faint}
              bold
            >
              {row === ROWS.SUBMIT ? `${glyph.caret} ` : "  "}
              {` ${submitLabel} `}
            </Text>
            {row === ROWS.SUBMIT && <Text color={theme.faint}> ⏎</Text>}
          </Box>
          {(open.error ?? limitOpen.error) != null && (
            <ErrorLine message={formatError(open.error ?? limitOpen.error)} />
          )}
          {cap.error != null && <ErrorLine message={`Market capacity: ${formatError(cap.error)}`} />}
          {capServiceError != null && <ErrorLine message={`Market capacity: ${capServiceError}`} />}
          {spendable.error != null && <ErrorLine message={formatError(spendable.error)} />}
        </Box>
      </Panel>

      <TradePreview
        market={market}
        markPrice={markPrice}
        history={history}
        side={side}
        orderType={orderType}
        preview={preview}
        violations={violations}
      />
    </Box>
  );
}

function TradePreview({
  market,
  markPrice,
  history,
  side,
  orderType,
  preview,
  violations,
}: {
  market?: MarketMeta;
  markPrice?: string;
  history: number[];
  side: "long" | "short";
  orderType: "market" | "limit";
  preview: ReturnType<typeof calculateTradeParams>;
  violations: QuoteConstraintViolation[];
}) {
  if (!market) {
    return (
      <Panel title="Preview" flexGrow={1}>
        <Text color={theme.faint}>Select a market to preview an order.</Text>
      </Panel>
    );
  }
  return (
    <Panel title={`Preview ${glyph.dot} ${market.symbol}`} flexGrow={1}>
      <Box marginBottom={1}>
        <Stat
          label="Mark price"
          value={markPrice != null ? formatPrice(markPrice, market.pricePrecision) : "—"}
          color={theme.primaryBright}
          minWidth={18}
        />
        <Stat label="Side" value={side.toUpperCase()} color={sideColor(side === "long")} />
        <Stat label="Order" value={orderType.toUpperCase()} />
      </Box>
      <Box marginBottom={1}>
        <Text color={theme.muted}>Trend </Text>
        <Sparkline data={history} width={28} />
      </Box>

      {preview ? (
        <Box flexDirection="column">
          <KeyValue label="Est. entry" value={preview.requestedOpenPrice} />
          <KeyValue label="Quantity" value={`${preview.quantity} ${market.symbol.replace("USDT", "")}`} />
          <KeyValue label="Notional" value={formatUsdString(preview.notional)} />
          <KeyValue label="Margin (CVA+LF)" value={formatSignedUsd(Number(preview.cva) + Number(preview.lf))} />
        </Box>
      ) : (
        <Text color={theme.faint}>Enter a margin amount to preview.</Text>
      )}

      {violations.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {violations.map((violation, index) => (
            <Text key={index} color={theme.negative}>
              {glyph.cross} {violationLabel(violation)}
            </Text>
          ))}
        </Box>
      )}
    </Panel>
  );
}
