import { PositionType, validateInstantCloseAgainstMarket, type UnifiedQuote } from "@symmio/trading-core";
import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { glyph, sideColor, theme } from "../../config/theme.js";
import { formatError } from "../../lib/error.js";
import { formatPrice, formatSignedUsd } from "../../lib/format.js";
import { parsePositiveNumber } from "../../lib/parse-amount.js";
import { useInstantClose, useLimitClose } from "../../sdk/mutations.js";
import { useCapabilities } from "../../sdk/use-capabilities.js";
import { useMarketLookup } from "../../sdk/use-markets.js";
import { useLivePrices } from "../../sdk/use-prices.js";
import { Field, Segmented, StepperRow } from "../../ui/controls.js";
import { ErrorLine, LoadingLine } from "../../ui/feedback.js";
import { KeyValue } from "../../ui/kit.js";
import { Sheet } from "../../ui/sheet.js";
import { useAppState } from "../app-state.js";
import { useFormNav } from "../form-nav.js";
import { computePnl } from "../positions/pnl.js";
import { useToast } from "../toast.js";

const PERCENTS = [25, 50, 75, 100] as const;
const PERCENT_OPTIONS = PERCENTS.map((p) => ({ key: String(p), label: p === 100 ? "Max" : `${p}%` }));
const ORDER_OPTIONS = [
  { key: "market", label: "MARKET", color: theme.info },
  { key: "limit", label: "LIMIT", color: theme.primaryBright },
] as const;

/**
 * Default close slippage. Higher than the open default: lowcap marks move
 * between signing and fill, and a close that misses its limit leaves the
 * position open — a worse outcome than a slightly worse fill.
 */
const DEFAULT_CLOSE_SLIPPAGE = 5;

/** Close (or partially close) a position via the instant flow. */
export function CloseSheet({ active, quote }: { active: boolean; quote: UnifiedQuote }) {
  const { byId } = useMarketLookup();
  const { prices } = useLivePrices();
  const { closeOverlay } = useAppState();
  const toast = useToast();
  const capabilities = useCapabilities();
  const close = useInstantClose();
  const limitClose = useLimitClose();

  const meta = byId.get(String(quote.symbolId));
  const markRaw = meta ? prices.get(meta.name) : undefined;
  const markPrice = markRaw != null ? Number(markRaw) : null;
  const isLong = quote.positionType === PositionType.LONG;

  const [percentIndex, setPercentIndex] = useState(3);
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [limitPrice, setLimitPrice] = useState("");
  const [slippage, setSlippage] = useState(DEFAULT_CLOSE_SLIPPAGE);
  const percent = PERCENTS[percentIndex] ?? 100;

  const { row } = useFormNav(4, active, (current) => current === 2 && orderType === "limit");

  const remaining = quote.openQuantity;
  const closeWei = percent >= 100 ? remaining : (remaining * BigInt(Math.round(percent * 100))) / 10_000n;
  const quantityToClose = formatUnits(closeWei, 18);
  const pnl = computePnl(quote, markPrice);
  const realizedPnl = pnl.uPnlUsd * (percent / 100);
  const validLimitPrice = orderType !== "limit" || parsePositiveNumber(limitPrice) != null;

  const violations =
    meta && closeWei > 0n
      ? validateInstantCloseAgainstMarket({
          market: meta.market,
          originalQuantity: formatUnits(remaining, 18),
          closeQuantity: quantityToClose,
          cva: formatUnits(quote.lockedValues.cva, 18),
          lf: formatUnits(quote.lockedValues.lf, 18),
          partyAmm: formatUnits(quote.lockedValues.partyAmm, 18),
        }).violations
      : [];
  const canSubmit = Boolean(
    meta && quote.quoteId != null && closeWei > 0n && violations.length === 0 && validLimitPrice,
  );

  useEffect(() => {
    if (close.isSuccess || limitClose.isSuccess) {
      toast.push("info", `${orderType === "limit" ? "Limit close" : "Close"} sent — awaiting solver confirmation`);
      closeOverlay();
    }
  }, [close.isSuccess, limitClose.isSuccess, orderType, toast, closeOverlay]);

  useEffect(() => {
    if (!capabilities.limitOrder) setOrderType("market");
  }, [capabilities.limitOrder]);

  function submit() {
    if (!meta || quote.quoteId == null || close.isPending || limitClose.isPending || !canSubmit) return;
    const variables = {
      partyA: quote.vaAddress ?? quote.partyA,
      market: {
        id: Number(quote.symbolId),
        name: meta.name,
        pricePrecision: meta.pricePrecision,
        quantityPrecision: meta.quantityPrecision,
      },
      positionType: quote.positionType,
      quoteId: quote.quoteId,
      quantityToClose,
    };
    if (orderType === "limit") limitClose.mutate({ ...variables, price: limitPrice });
    else close.mutate({ ...variables, slippage, ...(markRaw != null ? { markPrice: markRaw } : {}) });
  }

  useInput(
    (input, key) => {
      const dec = key.leftArrow || input === "h";
      const inc = key.rightArrow || input === "l";
      if (row === 0) {
        if (inc) setPercentIndex((index) => Math.min(PERCENTS.length - 1, index + 1));
        else if (dec) setPercentIndex((index) => Math.max(0, index - 1));
      } else if (row === 1 && capabilities.limitOrder && (dec || inc)) {
        setOrderType((current) => (current === "market" ? "limit" : "market"));
      } else if (row === 2 && orderType === "market") {
        if (inc) setSlippage((current) => Math.min(50, Math.round((current + 0.5) * 10) / 10));
        else if (dec) setSlippage((current) => Math.max(0.1, Math.round((current - 0.5) * 10) / 10));
      } else if (row === 3 && key.return) submit();
    },
    { isActive: active },
  );

  return (
    <Sheet title={`Close ${meta?.symbol ?? ""}`} subtitle={isLong ? "LONG" : "SHORT"}>
      <Box marginBottom={1}>
        <KeyValue label="Mark price" value={markPrice != null ? formatPrice(markPrice, meta?.pricePrecision) : "—"} />
        <Box width={2} />
        <Text color={theme.muted}>uPnL </Text>
        <Text color={sideColor(pnl.uPnlUsd >= 0)}>{formatSignedUsd(pnl.uPnlUsd)}</Text>
      </Box>

      <Box flexDirection="column" gap={1}>
        <Box>
          <Box width={13}>
            <Text color={row === 0 ? theme.primaryBright : theme.muted}>Close size</Text>
          </Box>
          <Text color={row === 0 ? theme.borderFocus : theme.faint}>{row === 0 ? glyph.caret : " "} </Text>
          <Segmented
            options={PERCENT_OPTIONS}
            value={String(percent)}
            focused={row === 0}
            onChange={(value) => setPercentIndex(PERCENTS.findIndex((candidate) => String(candidate) === value))}
          />
        </Box>
        <Box>
          <Box width={13}>
            <Text color={row === 1 ? theme.primaryBright : theme.muted}>Order type</Text>
          </Box>
          <Text color={row === 1 ? theme.borderFocus : theme.faint}>{row === 1 ? glyph.caret : " "} </Text>
          <Segmented
            options={capabilities.limitOrder ? ORDER_OPTIONS : ORDER_OPTIONS.slice(0, 1)}
            value={orderType}
            focused={row === 1}
            onChange={setOrderType}
          />
        </Box>
        {orderType === "limit" ? (
          <Field
            label="Limit price"
            value={limitPrice}
            onChange={setLimitPrice}
            focused={row === 2}
            placeholder={markRaw ?? "0.00"}
            suffix="USD"
            invalid={limitPrice !== "" && parsePositiveNumber(limitPrice) == null}
            hint={markPrice != null ? `mark ${formatPrice(markPrice, meta?.pricePrecision)}` : undefined}
          />
        ) : (
          <StepperRow
            label="Slippage"
            value={`${slippage.toFixed(1)}%`}
            focused={row === 2}
            hint={row === 2 ? "← → adjust" : undefined}
          />
        )}

        <Box flexDirection="column">
          <KeyValue label="Closing" value={`${quantityToClose} ${(meta?.symbol ?? "").replace("USDT", "")}`} />
          <KeyValue label="Est. realized" value={formatSignedUsd(realizedPnl)} color={sideColor(realizedPnl >= 0)} />
        </Box>

        <Box marginTop={1} flexDirection="column">
          {close.isPending || limitClose.isPending ? (
            <LoadingLine label={orderType === "limit" ? "Placing limit close…" : "Sending close…"} />
          ) : (
            <Text
              backgroundColor={canSubmit ? theme.negative : undefined}
              color={canSubmit ? theme.onAccent : row === 3 ? theme.primaryBright : theme.faint}
              bold
            >
              {row === 3 ? `${glyph.caret} ` : "  "}
              {` ${orderType === "limit" ? "Place close" : "Close"} ${percent === 100 ? "position" : `${percent}%`} `}
              {row === 3 ? " ⏎" : ""}
            </Text>
          )}
          {violations.map((violation, index) => (
            <Text key={index} color={theme.negative}>
              {glyph.cross} {violation.kind.replaceAll("_", " ").toLowerCase()}
            </Text>
          ))}
          {(close.error ?? limitClose.error) != null && (
            <ErrorLine message={formatError(close.error ?? limitClose.error)} />
          )}
        </Box>
      </Box>
    </Sheet>
  );
}
