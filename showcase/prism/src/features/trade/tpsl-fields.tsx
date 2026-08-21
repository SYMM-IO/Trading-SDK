"use client";

import { Field } from "@/components/field";
import { Segmented } from "@/components/segmented";
import type { PrismMarket } from "@/features/markets/types";
import { PositionType, validateTpSl, type TpSlPriceType } from "@symmio/trading-core";
import { useTpSlConfig } from "@symmio/trading-react";
import { useMemo } from "react";

const PRICE_TYPES = [
  { value: "markPrice" as const, label: "Mark" },
  { value: "lastPrice" as const, label: "Last" },
];

/** One conditional leg, as the ticket holds it. */
export interface TpSlDraft {
  takeProfit: string;
  stopLoss: string;
  priceType: TpSlPriceType;
}

export const EMPTY_TPSL: TpSlDraft = { takeProfit: "", stopLoss: "", priceType: "markPrice" };

export interface TpSlValidationResult {
  tpError?: string;
  slError?: string;
  /** True when at least one leg is filled and every filled leg is valid. */
  isSubmittable: boolean;
  /** True when a leg is filled but invalid — submit must be blocked. */
  hasError: boolean;
}

/**
 * Validate a TP/SL draft against the solver's published rules.
 *
 * The distances a solver accepts are not a UI constant — they come from its own
 * `/tpsl` config and differ per deployment — so the check is the SDK's
 * `validateTpSl` over `useTpSlConfig`, not a local rule. It never throws; each
 * leg gets its own message.
 */
export function useTpSlValidation(
  draft: TpSlDraft,
  options: { market: PrismMarket; side: PositionType; openPrice: number | undefined; enabled: boolean },
): TpSlValidationResult {
  const { market: entry, side, openPrice, enabled } = options;
  const { chainId } = entry.deployment;

  const config = useTpSlConfig({ chainId, query: { enabled } });

  return useMemo(() => {
    const hasTp = draft.takeProfit.trim().length > 0;
    const hasSl = draft.stopLoss.trim().length > 0;
    if (!enabled || (!hasTp && !hasSl)) return { isSubmittable: false, hasError: false };
    if (!config.data || !openPrice) return { isSubmittable: false, hasError: false };

    const result = validateTpSl({
      takeProfitPrice: hasTp ? draft.takeProfit : undefined,
      stopLossPrice: hasSl ? draft.stopLoss : undefined,
      openPrice: String(openPrice),
      positionType: side,
      pricePrecision: entry.market.pricePrecision,
      config: config.data,
    });

    return {
      tpError: result.ok ? undefined : result.tpError,
      slError: result.ok ? undefined : result.slError,
      isSubmittable: result.ok,
      hasError: !result.ok,
    };
  }, [draft, enabled, config.data, openPrice, side, entry.market.pricePrecision]);
}

export interface TpSlFieldsProps {
  market: PrismMarket;
  side: PositionType;
  draft: TpSlDraft;
  onChange: (draft: TpSlDraft) => void;
  validation: TpSlValidationResult;
}

/**
 * Take-profit and stop-loss inputs for an order that has not been placed yet.
 *
 * Both legs are attached in the same call that opens the position, signed
 * against the Virtual Account the open is about to create. The trigger prices
 * are validated against the solver's own minimum distance before submit, so a
 * level the handler would reject never reaches it.
 */
export function TpSlFields({ market: entry, side, draft, onChange, validation }: TpSlFieldsProps) {
  const isLong = side === PositionType.LONG;

  return (
    <div className="flex flex-col gap-2.5 rounded-md border border-line bg-bg-2 p-3">
      <Field
        label="Take profit"
        value={draft.takeProfit}
        onChange={(event) => onChange({ ...draft, takeProfit: event.target.value })}
        inputMode="decimal"
        placeholder="0.00"
        invalid={Boolean(validation.tpError)}
        footnote={validation.tpError ?? `Triggers ${isLong ? "above" : "below"} your entry.`}
      />

      <Field
        label="Stop loss"
        value={draft.stopLoss}
        onChange={(event) => onChange({ ...draft, stopLoss: event.target.value })}
        inputMode="decimal"
        placeholder="0.00"
        invalid={Boolean(validation.slError)}
        footnote={validation.slError ?? `Triggers ${isLong ? "below" : "above"} your entry.`}
      />

      <div className="flex items-center gap-2">
        <span className="text-2xs font-semibold tracking-[0.12em] text-fg-3 uppercase">Trigger on</span>
        <Segmented
          className="ml-auto"
          options={PRICE_TYPES}
          value={draft.priceType}
          onChange={(priceType) => onChange({ ...draft, priceType })}
          size="sm"
        />
      </div>

      <p className="text-2xs leading-relaxed text-fg-3">
        Both legs are signed for {entry.deployment.solverName} at the same time as the open, against the Virtual Account
        this order creates. The solver confirms them over its own socket a moment later.
      </p>
    </div>
  );
}
