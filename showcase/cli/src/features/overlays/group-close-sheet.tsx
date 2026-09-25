import { planGroupClose, PositionType, toGroupCloseCandidates, type QuoteGroup } from "@symmio/trading-core";
import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { glyph, theme } from "../../config/theme.js";
import { formatError } from "../../lib/error.js";
import { formatToken } from "../../lib/format.js";
import { useInstantCloseBulk } from "../../sdk/mutations.js";
import { useMarketLookup } from "../../sdk/use-markets.js";
import { useLivePrices } from "../../sdk/use-prices.js";
import { Segmented } from "../../ui/controls.js";
import { ErrorLine, LoadingLine } from "../../ui/feedback.js";
import { KeyValue } from "../../ui/kit.js";
import { Sheet } from "../../ui/sheet.js";
import { useAppState } from "../app-state.js";
import { useToast } from "../toast.js";

const PERCENTS = [25, 50, 75, 100] as const;
const PERCENT_OPTIONS = PERCENTS.map((percent) => ({
  key: String(percent),
  label: percent === 100 ? "Max" : `${percent}%`,
}));
const DEFAULT_SLIPPAGE = 5;

/** Plan an exact close across every child in one market-direction VA group. */
export function GroupCloseSheet({ active, group }: { active: boolean; group: QuoteGroup }) {
  const { byId } = useMarketLookup();
  const { prices } = useLivePrices();
  const mutation = useInstantCloseBulk();
  const { closeOverlay } = useAppState();
  const toast = useToast();
  const [percentIndex, setPercentIndex] = useState(PERCENTS.length - 1);
  const [confirmed, setConfirmed] = useState(false);

  const percent = PERCENTS[percentIndex] ?? 100;
  const market = group.by.symbolId != null ? byId.get(String(group.by.symbolId)) : undefined;
  const minAcceptable = parseUnits(market?.market.minAcceptableQuoteValue ?? "0", 18);
  const target = percent === 100 ? group.metrics.openQuantity : (group.metrics.openQuantity * BigInt(percent)) / 100n;
  const plan = planGroupClose(toGroupCloseCandidates(group.quotes, minAcceptable), target);
  const markPrice = market ? prices.get(market.name) : undefined;
  const children = new Map(group.quotes.map((quote) => [quote.key, quote]));
  const orders = plan.feasible
    ? plan.allocations.flatMap((allocation) => {
        const quote = children.get(allocation.key);
        if (!quote || quote.quoteId == null || !market) return [];
        return [
          {
            partyA: quote.vaAddress ?? quote.partyA,
            market: {
              id: market.symbolId,
              name: market.name,
              pricePrecision: market.pricePrecision,
              quantityPrecision: market.quantityPrecision,
            },
            positionType: quote.positionType,
            quoteId: quote.quoteId,
            quantityToClose: formatUnits(allocation.closeQuantity, 18),
            slippage: DEFAULT_SLIPPAGE,
            ...(markPrice != null ? { markPrice } : {}),
          },
        ];
      })
    : [];

  useEffect(() => {
    if (!mutation.isSuccess) return;
    toast.push("info", `${orders.length} grouped close legs accepted — tracking fills in Positions`);
    closeOverlay();
  }, [mutation.isSuccess, orders.length, toast, closeOverlay]);

  useInput(
    (input, key) => {
      const previous = key.leftArrow || input === "h";
      const next = key.rightArrow || input === "l";
      if (confirmed) {
        if (input === "y" && orders.length > 0 && !mutation.isPending) mutation.mutate({ orders });
        else if (input === "n") setConfirmed(false);
      } else if (previous) {
        setPercentIndex((index) => Math.max(0, index - 1));
      } else if (next) {
        setPercentIndex((index) => Math.min(PERCENTS.length - 1, index + 1));
      } else if (key.return && orders.length > 0) {
        setConfirmed(true);
      }
    },
    { isActive: active },
  );

  const side = group.by.positionType === PositionType.LONG ? "LONG" : "SHORT";

  return (
    <Sheet title={`Group close ${market?.symbol ?? ""}`} subtitle={`${side} · one virtual account`}>
      <Box flexDirection="column">
        <KeyValue label="Open quantity" value={formatToken(group.metrics.openQuantity)} />
        <KeyValue label="Child positions" value={String(group.metrics.openCount)} />
        <KeyValue label="Minimum remainder" value={formatToken(minAcceptable)} />
      </Box>

      <Box marginTop={1} flexDirection="column" gap={1}>
        <Box>
          <Box width={13}>
            <Text color={theme.primaryBright}>Close size</Text>
          </Box>
          <Text color={theme.borderFocus}>{glyph.caret} </Text>
          <Segmented
            options={PERCENT_OPTIONS}
            value={String(percent)}
            focused
            onChange={(value) => setPercentIndex(PERCENTS.findIndex((candidate) => String(candidate) === value))}
          />
        </Box>
        <KeyValue label="Exact target" value={formatToken(target)} />
        <KeyValue label="Planned legs" value={String(orders.length)} />

        {mutation.isPending ? (
          <LoadingLine label="Signing and submitting grouped close…" />
        ) : confirmed ? (
          <Text>
            <Text color={theme.negative} bold>
              {" y "}
            </Text>
            <Text color={theme.text}>
              close {percent}% across {orders.length} positions
            </Text>
            <Text color={theme.faint}> · n cancel</Text>
          </Text>
        ) : (
          <Text
            backgroundColor={orders.length > 0 ? theme.negative : undefined}
            color={orders.length > 0 ? theme.onAccent : theme.faint}
            bold
          >
            {` ${glyph.caret} Close ${percent}% across group  ⏎ `}
          </Text>
        )}
        {!plan.feasible && (
          <Text color={theme.warning}>
            {glyph.dot} Cannot allocate this target: {plan.reason.replaceAll("-", " ")}.
          </Text>
        )}
        <Text color={theme.faint}>
          The SDK preserves every partial child&apos;s dust floor and submits all legs in one solver batch.
        </Text>
        {mutation.error != null && <ErrorLine message={formatError(mutation.error)} />}
      </Box>
    </Sheet>
  );
}
