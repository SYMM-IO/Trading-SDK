"use client";

import type { EstimatedPriceEntry, SolverId } from "@symmio/trading-core";
import {
  calculatePriceImpact,
  PositionType,
  supportsEstimatedPrice,
  useEstimatedPrice,
  useSymmioConfig,
} from "@symmio/trading-react";
import { Spinner } from "@symmio/ui/components/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@symmio/ui/components/tooltip";
import { formatPercentage, formatWithCommas } from "@symmio/utils";

interface Props {
  /** Solver market id. */
  symbolId: number | undefined;
  /** Target solver. Defaults to the chain's default solver. */
  solverId?: SolverId;
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
  /** Paired values from open preparation; disables this component's independent estimate read. */
  preparedEstimate?: { price: string | null | undefined; priceWithoutShadow?: string };
  idPrefix: string;
}

/**
 * Solver-estimated fill price for the current open/close inputs, plus the price
 * impact of that fill versus the mark. Wraps `useEstimatedPrice` (disabled until
 * quantity + request price are set) and `calculatePriceImpact`
 * (`(estimated − mark) / mark`). Once inputs are set the row is always shown — a
 * spinner fills the value slot until the solver responds. Open preparation can
 * supply its paired estimate instead, disabling the independent read and exposing
 * the optional no-shadow diagnostic below that same execution price.
 */
export function EstimatedPricePreview({
  symbolId,
  solverId,
  quantity,
  positionType,
  entry,
  requestPrice,
  markPrice,
  pricePrecision,
  preparedEstimate,
  idPrefix,
}: Props) {
  const config = useSymmioConfig();
  // Some solvers (e.g. Base's) have no /estimated-price endpoint — never call it
  // and render nothing rather than an eternal spinner.
  const supported = supportsEstimatedPrice(config, { solverId });
  const enabled = supported && symbolId !== undefined && Boolean(quantity) && Boolean(requestPrice);
  const query = useEstimatedPrice({
    symbolId: symbolId ?? 0,
    solverId,
    quantity: quantity ?? "",
    positionType,
    entry,
    price: requestPrice ?? "",
    query: { enabled: enabled && preparedEstimate === undefined },
  });

  // Hidden while the solver lacks the endpoint, or until the caller has a
  // quantity and a request price.
  if (!enabled) return null;

  const isUpdating =
    preparedEstimate !== undefined ? preparedEstimate.price === undefined : query.isFetching || query.isDebouncing;
  const estimated =
    preparedEstimate !== undefined ? preparedEstimate.price : isUpdating ? undefined : query.data?.estimatedPrice;
  const withoutShadow = preparedEstimate?.priceWithoutShadow;
  const showWithoutShadow =
    !isUpdating &&
    Number(estimated) > 0 &&
    withoutShadow !== undefined &&
    Number.isFinite(Number(withoutShadow)) &&
    Number(withoutShadow) > 0;
  const impact =
    estimated && estimated !== "0" && markPrice
      ? calculatePriceImpact({ estimatedPrice: estimated, referencePrice: markPrice })
      : undefined;

  return (
    <div
      data-testid={`${idPrefix}-estimated-price`}
      className="border-border/60 bg-muted/20 rounded-lg border px-3 py-2 text-sm"
    >
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs">Estimated {entry} price</span>
        <span className="flex items-baseline gap-2 font-mono tabular-nums">
          {isUpdating ? (
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
      {showWithoutShadow ? (
        <div
          data-testid={`${idPrefix}-estimated-price-without-shadow`}
          className="text-muted-foreground mt-2 flex items-center justify-between gap-2 text-xs"
        >
          <span>Price without shadow</span>
          <span className="font-mono tabular-nums">${withoutShadow}</span>
        </div>
      ) : null}
    </div>
  );
}
