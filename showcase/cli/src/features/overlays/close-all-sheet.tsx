import type { UnifiedQuote } from "@symmio/trading-core";
import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { glyph, theme } from "../../config/theme.js";
import { formatError } from "../../lib/error.js";
import { useInstantCloseBulk } from "../../sdk/mutations.js";
import { useMarketLookup } from "../../sdk/use-markets.js";
import { useLivePrices } from "../../sdk/use-prices.js";
import { ErrorLine, LoadingLine } from "../../ui/feedback.js";
import { KeyValue } from "../../ui/kit.js";
import { Sheet } from "../../ui/sheet.js";
import { useAppState } from "../app-state.js";
import { useToast } from "../toast.js";

const DEFAULT_SLIPPAGE = 5;

/** Review and submit a single solver batch that closes every actionable position. */
export function CloseAllSheet({ active, quotes }: { active: boolean; quotes: UnifiedQuote[] }) {
  const { byId } = useMarketLookup();
  const { prices } = useLivePrices();
  const close = useInstantCloseBulk();
  const { closeOverlay } = useAppState();
  const toast = useToast();
  const [confirmed, setConfirmed] = useState(false);

  const orders = quotes.flatMap((quote) => {
    const market = byId.get(String(quote.symbolId));
    if (!market || quote.quoteId == null || quote.openQuantity <= 0n) return [];
    const markPrice = prices.get(market.name);
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
        quantityToClose: formatUnits(quote.openQuantity, 18),
        slippage: DEFAULT_SLIPPAGE,
        ...(markPrice != null ? { markPrice } : {}),
      },
    ];
  });

  useEffect(() => {
    if (!close.isSuccess) return;
    toast.push("info", `${orders.length} close requests accepted — tracking fills in Positions`);
    closeOverlay();
  }, [close.isSuccess, orders.length, toast, closeOverlay]);

  useInput(
    (input, key) => {
      if (!confirmed && key.return && orders.length > 0) setConfirmed(true);
      else if (confirmed && input === "y" && !close.isPending) close.mutate({ orders });
      else if (confirmed && (input === "n" || key.escape)) setConfirmed(false);
    },
    { isActive: active },
  );

  return (
    <Sheet title="Close all positions" subtitle="one solver batch">
      <Box flexDirection="column">
        <KeyValue label="Positions" value={String(orders.length)} />
        <KeyValue label="Slippage per order" value={`${DEFAULT_SLIPPAGE}%`} />
        <KeyValue label="Missing market data" value={String(quotes.length - orders.length)} />
      </Box>

      <Box marginTop={1} flexDirection="column">
        {close.isPending ? (
          <LoadingLine label="Signing and submitting the close batch…" />
        ) : confirmed ? (
          <Text>
            <Text color={theme.negative} bold>
              {" "}
              y{" "}
            </Text>
            <Text color={theme.text}>close {orders.length} positions</Text>
            <Text color={theme.faint}> · n cancel</Text>
          </Text>
        ) : (
          <Text
            color={orders.length > 0 ? theme.onAccent : theme.faint}
            backgroundColor={orders.length > 0 ? theme.negative : undefined}
            bold
          >
            {` ${glyph.caret} Review close-all  ⏎ `}
          </Text>
        )}
        <Text color={theme.faint}>Each fill remains visible and reconciles independently in Positions.</Text>
        {close.error != null && <ErrorLine message={formatError(close.error)} />}
      </Box>
    </Sheet>
  );
}
