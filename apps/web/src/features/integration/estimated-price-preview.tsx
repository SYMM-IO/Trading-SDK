"use client";

import { calculatePriceImpact, PositionType, type EstimatedPriceEntry } from "@symmio/trading-core";
import { useEstimatedPrice } from "@symmio/trading-react";
import { Spinner } from "@symmio/ui/components/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@symmio/ui/components/tooltip";
import { formatPercentage, formatWithCommas } from "@symmio/utils";

interface Props {
  /** Solver market id. */
  symbolId: number | undefined;
  /** Order quantity (decimal string) — the leveraged quantity to open, or the amount to close. */
  quantity: string | undefined;
  positionType: PositionType;
  entry: EstimatedPriceEntry;
  /** Slippage-adjusted request price sent to the solver (decimal string). */
  requestPrice: string | undefined;
  /** Reference (mark) price the price impact is measured against (decimal string). */
  markPrice: string | undefined;
  /** The market's `price_precision` — decimals the estimate is shown at. */
  pricePrecision: number;
  idPrefix: string;
}

/**
 * Solver-estimated fill price for the current open/close inputs, plus the price
 * impact of that fill versus the mark. Wraps `useEstimatedPrice` (disabled until
 * quantity + request price are set) and `calculatePriceImpact`
 * (`(estimated − mark) / mark`). Once inputs are set the row is always shown — a
 * spinner fills the value slot until the solver responds.
 */
export function EstimatedPricePreview({
  symbolId,
  quantity,
  positionType,
  entry,
  requestPrice,
  markPrice,
  pricePrecision,
  idPrefix,
}: Props) {
  const enabled = symbolId !== undefined && Boolean(quantity) && Boolean(requestPrice);
  const query = useEstimatedPrice({
    symbolId: symbolId ?? 0,
    quantity: quantity ?? "",
    positionType,
    entry,
    price: requestPrice ?? "",
    query: { enabled },
  });

  // Nothing to estimate until the caller has a quantity and a request price.
  if (!enabled) return null;

  const estimated = query.data?.estimatedPrice;
  const impact =
    estimated && estimated !== "0" && markPrice
      ? calculatePriceImpact({ estimatedPrice: estimated, referencePrice: markPrice })
      : undefined;

  return (
    <div
      data-testid={`${idPrefix}-estimated-price`}
      className="border-border/60 bg-muted/20 flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
    >
      <span className="text-muted-foreground text-xs">Estimated {entry} price</span>
      <span className="flex items-baseline gap-2 font-mono tabular-nums">
        {query.isFetching && !estimated ? (
          <Spinner className="size-4" />
        ) : estimated && estimated !== "0" ? (
          <>
            ${formatWithCommas(estimated, { fixedDecimals: pricePrecision })}
            {impact !== undefined && impact !== 0 ? (
              <span className="text-muted-foreground text-xs">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help underline decoration-dotted underline-offset-2">PI</span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-56">
                    <span className="font-medium">Price impact</span> — the % gap between the estimated fill price and
                    the current mark. Positive fills above mark, negative below.
                  </TooltipContent>
                </Tooltip>{" "}
                {formatPercentage(impact, { maxDecimals: 3, withSign: true })}
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </span>
    </div>
  );
}
