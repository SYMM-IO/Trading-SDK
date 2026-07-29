"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { formatUsd, WEI_DECIMALS } from "@/lib/format";
import {
  calculateTradeParams,
  isolationTypeForSide,
  PositionType,
  SymmioRequestError,
  TpSlPriceType,
  useAccountBalanceOf,
  useAvailableInstantOpenMargin,
  useEnigmaPriceServicePricesByNames,
  useFeeForUser,
  useInstantOpenWithTpSl,
  UseInstantOpenWithTpSlReturnType,
  useLockedParams,
  useMarkets,
  useNotionalCapBySymbolId,
  usePredictedNextVirtualAccount,
  validateInstantOpenAgainstMarket,
  type QuoteConstraintViolation,
} from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { MarketSelect, type MarketSelectItem } from "@symmio/ui/components/market-select";
import { Slider } from "@symmio/ui/components/slider";
import { Spinner } from "@symmio/ui/components/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@symmio/ui/components/tooltip";
import { cn } from "@symmio/ui/lib/utils";
import { formatCompact, formatWithCommas, shortenAddress } from "@symmio/utils";
import { useEffect, useMemo, useState } from "react";
import { formatUnits, type Address } from "viem";
import { EstimatedPricePreview } from "./estimated-price-preview";

type TradeSide = "long" | "short";
type Market = NonNullable<ReturnType<typeof useMarkets>["data"]>[number];

const TRADE_SIDES = [
  { value: "long", label: "Long" },
  { value: "short", label: "Short" },
] as const;

interface Props {
  subAccount: Address;
  sessionKey: Address;
  /** Test-id namespace; lets two mounts on the same page have distinct selectors. */
  idPrefix?: string;
}

/**
 * Instant-open form: market + side + initial margin + leverage + slippage +
 * submit. Pre-fetches cache-hot data (mark price, locked-params %, fee rates,
 * subaccount balance) so the SDK mutation can run without round-trips. Used by
 * both the Integration wizard and the Solvers page card; both pass an already-
 * gated `subAccount` and `sessionKey`.
 */
export function OpenPositionStep({ subAccount, sessionKey, idPrefix = "instant-open" }: Props) {
  const marketsQuery = useMarkets();
  if (marketsQuery?.data) {
    const datak = marketsQuery?.data;
    const pp = datak[0];
    if (pp?.kind === "enigma") {
      console.log("hell", pp.state);
    }
  }

  const markets = useMemo(() => getOpenMarkets(marketsQuery.data ?? []), [marketsQuery.data]);

  const marketItems = useMemo(() => toMarketSelectItems(markets), [markets]);

  const [marketId, setMarketId] = useState("");
  const [side, setSide] = useState<TradeSide>("long");
  const [initialMargin, setInitialMargin] = useState("");
  const [leverage, setLeverage] = useState(1);
  /** Draft text for the inline leverage field; `leverage` stays the source of truth for math. */
  const [leverageInput, setLeverageInput] = useState("1");
  const [slippage, setSlippage] = useState("5");

  const selectedMarket = useMemo(
    () => markets.find((market) => String(market.symbolId) === marketId),
    [marketId, markets],
  );
  const maxLeverage = getMaxLeverage(selectedMarket);
  const validInitialMargin = parsePositiveNumber(initialMargin);
  const validSlippage = parsePositiveNumber(slippage);
  const marketName = selectedMarket?.name;

  /** Keep `leverage` (and its inline draft) within the selected market's max. */
  useEffect(() => {
    const clamped = clampLeverage(leverage, maxLeverage);
    if (clamped !== leverage) {
      setLeverage(clamped);
      setLeverageInput(String(clamped));
    }
  }, [leverage, maxLeverage]);

  // Cache-hot pre-fetches; the SDK refetches inside the mutation if these are
  // not yet populated.
  const balanceQuery = useAccountBalanceOf({ account: subAccount });
  const priceQuery = useEnigmaPriceServicePricesByNames({
    names: marketName ? [marketName] : [],
    query: { enabled: Boolean(marketName), staleTime: 5_000 },
  });
  const lockedParamsQuery = useLockedParams({
    symbol: marketName ?? "",
    leverage,
    query: { enabled: Boolean(marketName) && leverage > 0, staleTime: 30_000 },
  });
  const feeQuery = useFeeForUser({
    user: subAccount,
    symbolId: selectedMarket?.symbolId !== undefined ? BigInt(selectedMarket.symbolId) : 0n,
    query: { enabled: Boolean(selectedMarket?.symbolId), staleTime: 30_000 },
  });
  const notionalCapQuery = useNotionalCapBySymbolId({
    symbolId: Number(selectedMarket?.symbolId ?? 0),
  });

  /**
   * Available margin for an instant open.
   *
   * Formula:
   *   available = balance
   *             × max(0, 1 − slippageFactor)
   *             × max(0, 1 − leverage × (openFee + closeFee))
   * where `slippageFactor = slippage` on SHORT and `0` on LONG.
   *
   * Two reasons the raw balance is shaved:
   *
   * 1. **Fees.** Open + close fees are charged on the leveraged notional.
   *    Deduct `leverage × (openFee + closeFee)` of the balance so the request
   *    still fits inside the deposit after fees clear.
   *
   * 2. **Slippage buffer (SHORT only).** Quantity is sized off
   *    `requestOpenPrice = markPrice × (1 ± slippage)`, but the solver may
   *    fill at a price closer to (or worse than) `markPrice`. For SHORT,
   *    `requestOpenPrice = markPrice × (1 − s)` is *below* mark, so any fill
   *    at a higher price inflates the actual notional by up to
   *    `markPrice / requestOpenPrice = 1 / (1 − s)`. To guarantee the user
   *    has enough deposit to cover the worst-case fill, cap the usable
   *    balance at `balance × (1 − s)`. LONG sets the request *above* mark, so
   *    any fill at the request price or below deflates notional — the user
   *    naturally has a buffer; no extra cap needed.
   *
   * Numeric notes: account-layer balance is 1e18-scaled regardless of
   * collateral token decimals; fee rates are 18-decimal fixed-point. All math
   * stays in BigInt for exactness.
   */
  const slippageFractionWei = useMemo<bigint | undefined>(() => {
    if (validSlippage === undefined) return undefined;
    return BigInt(Math.round(validSlippage * 1e16));
  }, [validSlippage]);

  const marginInfo = useAvailableInstantOpenMargin({
    account: subAccount,
    symbolId: selectedMarket?.symbolId,
    leverage,
    positionType: side === "short" ? PositionType.SHORT : PositionType.LONG,
    slippage: validSlippage ?? 0,
  });
  // Keep the form's "unavailable until slippage is valid" behavior.
  const availableMarginWei = validSlippage === undefined ? undefined : marginInfo.availableMarginWei;

  const availableMarginDecimal =
    availableMarginWei !== undefined ? Number(formatUnits(availableMarginWei, WEI_DECIMALS)) : undefined;
  const exceedsAvailable =
    validInitialMargin !== undefined &&
    availableMarginDecimal !== undefined &&
    validInitialMargin > availableMarginDecimal;

  // Compute candidate trade parameters locally so we can both validate against
  // the market and preview the locked-margin breakdown to the user. Returns
  // `null` when any required input is missing or invalid.
  const cachedMarkPrice = marketName ? priceQuery.data?.[marketName]?.markPrice : undefined;
  const tradeParams = useMemo(() => {
    if (
      selectedMarket === undefined ||
      cachedMarkPrice === undefined ||
      lockedParamsQuery.data === undefined ||
      validInitialMargin === undefined ||
      validSlippage === undefined
    ) {
      return null;
    }
    return calculateTradeParams({
      markPrice: String(cachedMarkPrice),
      slippage: validSlippage,
      positionType: side === "long" ? PositionType.LONG : PositionType.SHORT,
      userInput: initialMargin,
      inputField: "PRICE",
      leverage,
      pricePrecision: Number(selectedMarket.pricePrecision ?? 0),
      quantityPrecision: Number(selectedMarket.quantityPrecision ?? 0),
      cvaPercent: lockedParamsQuery.data.cva,
      lfPercent: lockedParamsQuery.data.lf,
      partyAmmPercent: lockedParamsQuery.data.partyAmm,
      partyBmmPercent: lockedParamsQuery.data.partyBmm,
    });
  }, [
    selectedMarket,
    cachedMarkPrice,
    lockedParamsQuery.data,
    validInitialMargin,
    validSlippage,
    side,
    initialMargin,
    leverage,
  ]);

  // Pre-submit quote validation: check the candidate quote against the
  // market's published constraints. Empty when validation can't run yet;
  // non-empty means the user can't submit.
  const quoteViolations = useMemo<QuoteConstraintViolation[]>(() => {
    if (selectedMarket === undefined || cachedMarkPrice === undefined || tradeParams === null) return [];
    return validateInstantOpenAgainstMarket({
      market: selectedMarket,
      quantity: tradeParams.quantity,
      markPrice: String(cachedMarkPrice),
      cva: tradeParams.cva,
      lf: tradeParams.lf,
      partyAmm: tradeParams.partyAmm,
      notionalCap: notionalCapQuery.data,
      positionType: side === "long" ? PositionType.LONG : PositionType.SHORT,
    }).violations;
  }, [selectedMarket, cachedMarkPrice, tradeParams, notionalCapQuery.data, side]);

  // Single SDK-side orchestrator: fires instant open, then TP/SL against the
  // predicted VA using the hedger's `tempQuoteId`. All request/response logic
  // lives in `@symmio/trading-react`; this component just gathers the inputs.
  const mutation = useInstantOpenWithTpSl();

  const [tpPrice, setTpPrice] = useState("");
  const [slPrice, setSlPrice] = useState("");
  const [tpPriceType, setTpPriceType] = useState<TpSlPriceType>("markPrice");
  const [slPriceType, setSlPriceType] = useState<TpSlPriceType>("markPrice");

  const positionTypeForSide = side === "long" ? PositionType.LONG : PositionType.SHORT;
  const marketSymbolId = selectedMarket ? BigInt(selectedMarket.symbolId ?? 0) : undefined;
  const predictedVaQuery = usePredictedNextVirtualAccount({
    subAccount,
    isolationType: isolationTypeForSide(positionTypeForSide),
    symbolId: marketSymbolId ?? 0n,
    query: { enabled: marketSymbolId !== undefined && marketSymbolId > 0n },
  });

  const canSubmit = Boolean(
    selectedMarket &&
    marketName &&
    validInitialMargin !== undefined &&
    validSlippage !== undefined &&
    !exceedsAvailable &&
    quoteViolations.length === 0 &&
    !mutation.isPending,
  );

  async function handleSubmit() {
    if (!canSubmit || !selectedMarket || !marketName) return;
    const hasTp = tpPrice.length > 0;
    const hasSl = slPrice.length > 0;
    const wantsTpSl = hasTp || hasSl;
    const virtualAccount = predictedVaQuery.data;
    const tpsl =
      wantsTpSl && virtualAccount && tradeParams
        ? {
            from: sessionKey,
            virtualAccount,
            subAccount,
            symbolId: BigInt(selectedMarket.symbolId ?? 0),
            positionType: positionTypeForSide,
            quantity: tradeParams.quantity,
            pricePrecision: Number(selectedMarket.pricePrecision ?? 4),
            tp: hasTp ? { triggerPrice: tpPrice, priceType: tpPriceType } : undefined,
            sl: hasSl ? { triggerPrice: slPrice, priceType: slPriceType } : undefined,
          }
        : undefined;
    await mutation.mutateAsync({
      subAccountAddress: subAccount,
      from: sessionKey,
      market: {
        id: Number(selectedMarket.symbolId ?? 0),
        name: marketName,
        pricePrecision: Number(selectedMarket.pricePrecision ?? 0),
        quantityPrecision: Number(selectedMarket.quantityPrecision ?? 0),
      },
      positionType: positionTypeForSide,
      initialMargin,
      leverage,
      slippage: validSlippage!,
      lockedParamPercent: lockedParamsQuery.data,
      markPrice: cachedMarkPrice !== undefined ? String(cachedMarkPrice) : undefined,
      feeRates: feeQuery.data,
      tpsl,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="market" htmlFor={`${idPrefix}-market`}>
        <MarketSelect
          idPrefix={`${idPrefix}-market`}
          value={marketId}
          items={marketItems}
          onValueChange={setMarketId}
          placeholder={marketsQuery.isLoading ? "Loading markets…" : "Select a market…"}
          disabled={marketsQuery.isLoading}
          searchPlaceholder="Search symbol, name, or ID…"
          emptyLabel="No open Enigma markets."
          emptyResultsLabel="No markets match this search."
          clearLabel="Clear market"
        />
      </Field>

      <Field label="side">
        <TradeSideControl idPrefix={idPrefix} value={side} onChange={setSide} />
      </Field>

      <Field
        label="initial margin (USD)"
        htmlFor={`${idPrefix}-margin`}
        action={
          <AvailableMarginLabel
            balanceLoading={balanceQuery.isLoading}
            balanceError={balanceQuery.error}
            balanceWei={balanceQuery.data}
            openFeeRate={feeQuery.data?.openFee}
            closeFeeRate={feeQuery.data?.closeFee}
            leverage={leverage}
            side={side}
            slippagePct={validSlippage}
            slippageFractionWei={slippageFractionWei}
            availableMarginWei={availableMarginWei}
            availableDecimal={availableMarginDecimal}
            idPrefix={idPrefix}
            onMax={() => {
              if (availableMarginWei === undefined || availableMarginWei === 0n) return;
              setInitialMargin(formatUsd(availableMarginWei));
            }}
          />
        }
        hint={
          exceedsAvailable
            ? "Exceeds available margin after fees."
            : "Collateral committed to the position. Fees scale with leverage."
        }
      >
        <Input
          id={`${idPrefix}-margin`}
          value={initialMargin}
          onChange={(event) => setInitialMargin(event.target.value)}
          placeholder="0.00"
          inputMode="decimal"
          aria-invalid={(initialMargin.length > 0 && validInitialMargin === undefined) || exceedsAvailable}
          data-testid={`${idPrefix}-margin`}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(140px,180px)]">
        <Field
          label="leverage"
          htmlFor={`${idPrefix}-leverage`}
          hint={
            selectedMarket
              ? `Max ${maxLeverage}x for ${selectedMarket.symbol ?? selectedMarket.name}.`
              : "Select a market first."
          }
        >
          <div
            className={cn(
              "border-border bg-input/40 focus-within:border-ring focus-within:bg-input/60 flex h-9 items-center gap-2.5 rounded-xl border px-3 transition-[color,box-shadow,background-color,border-color]",
              !selectedMarket && "opacity-50",
            )}
          >
            <Slider
              id={`${idPrefix}-leverage`}
              min={1}
              max={maxLeverage}
              step={1}
              value={[leverage]}
              disabled={!selectedMarket}
              onValueChange={([next]) => {
                if (next === undefined) return;
                setLeverage(next);
                setLeverageInput(String(next));
              }}
              className="flex-1"
              data-testid={`${idPrefix}-leverage`}
            />
            <span aria-hidden="true" className="bg-border h-[18px] w-px shrink-0" />
            <span className="flex shrink-0 items-baseline">
              <input
                aria-label="leverage value"
                inputMode="numeric"
                value={leverageInput}
                disabled={!selectedMarket}
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, "");
                  setLeverageInput(digits);
                  if (digits !== "") setLeverage(clampLeverage(Number(digits), maxLeverage));
                }}
                onBlur={() => setLeverageInput(String(leverage))}
                className="text-foreground w-[2.2ch] bg-transparent text-right font-mono text-sm tabular-nums outline-none"
                data-testid={`${idPrefix}-leverage-value`}
              />
              <span aria-hidden="true" className="text-muted-foreground font-mono text-sm">
                ×
              </span>
            </span>
          </div>
        </Field>

        <Field label="slippage (%)" htmlFor={`${idPrefix}-slippage`} hint="Percent tolerance — must be greater than 0.">
          <Input
            id={`${idPrefix}-slippage`}
            value={slippage}
            onChange={(event) => {
              // Strip leading minus and any other sign chars; slippage is always positive.
              const sanitized = event.target.value.replace(/[^\d.]/g, "");
              setSlippage(sanitized);
            }}
            placeholder="5"
            inputMode="decimal"
            min={0}
            aria-invalid={slippage.length > 0 && validSlippage === undefined}
            data-testid={`${idPrefix}-slippage`}
          />
        </Field>
      </div>

      <TpSlPresetCard
        idPrefix={idPrefix}
        tpPrice={tpPrice}
        onTpPriceChange={setTpPrice}
        tpPriceType={tpPriceType}
        onTpPriceTypeChange={setTpPriceType}
        slPrice={slPrice}
        onSlPriceChange={setSlPrice}
        slPriceType={slPriceType}
        onSlPriceTypeChange={setSlPriceType}
      />

      {tradeParams !== null ? (
        <TradePreview
          tradeParams={tradeParams}
          feeRates={feeQuery.data}
          markPrice={cachedMarkPrice !== undefined ? String(cachedMarkPrice) : undefined}
          notionalCap={notionalCapQuery.data}
          notionalCapLoading={notionalCapQuery.isLoading}
          side={side}
          pricePrecision={Number(selectedMarket?.pricePrecision ?? 2)}
          quantityPrecision={Number(selectedMarket?.quantityPrecision ?? 4)}
          idPrefix={idPrefix}
        />
      ) : (
        <QuotePreviewPlaceholder
          idPrefix={idPrefix}
          hasMarket={Boolean(selectedMarket)}
          marketsLoading={marketsQuery.isLoading}
          markPriceLoading={priceQuery.isLoading}
          lockedParamsLoading={lockedParamsQuery.isLoading}
          feeLoading={feeQuery.isLoading}
        />
      )}

      <EstimatedPricePreview
        symbolId={selectedMarket ? Number(selectedMarket.symbolId ?? 0) : undefined}
        quantity={tradeParams?.quantity}
        positionType={positionTypeForSide}
        entry="open"
        requestPrice={tradeParams?.requestedOpenPrice}
        markPrice={cachedMarkPrice !== undefined ? String(cachedMarkPrice) : undefined}
        pricePrecision={Number(selectedMarket?.pricePrecision ?? 2)}
        idPrefix={idPrefix}
      />

      {quoteViolations.length > 0 ? <QuoteViolationsPanel violations={quoteViolations} idPrefix={idPrefix} /> : null}

      <Button
        type="button"
        size="lg"
        disabled={!canSubmit}
        onClick={() => void handleSubmit()}
        data-testid={`${idPrefix}-submit`}
        className="w-full"
      >
        {mutation.isPending ? <Spinner className="size-4" /> : null}
        {mutation.isPending ? "Submitting…" : "Open position"}
      </Button>

      <SubmitStatus mutation={mutation} sessionKey={sessionKey} idPrefix={idPrefix} />

      {mutation.data?.tpsl || mutation.data?.tpslError || mutation.phase === "attaching-tpsl" ? (
        <TpSlAttachmentStatus idPrefix={idPrefix} mutation={mutation} />
      ) : null}
    </div>
  );
}

/**
 * Placeholder shown in place of the quote preview while any of the inputs
 * `calculateTradeParams` needs is missing. Surfaces WHY the preview is empty
 * so the user knows what to do next.
 */
function QuotePreviewPlaceholder({
  idPrefix,
  hasMarket,
  marketsLoading,
  markPriceLoading,
  lockedParamsLoading,
  feeLoading,
}: {
  idPrefix: string;
  hasMarket: boolean;
  marketsLoading: boolean;
  markPriceLoading: boolean;
  lockedParamsLoading: boolean;
  feeLoading: boolean;
}) {
  const busy = marketsLoading || markPriceLoading || lockedParamsLoading || feeLoading;
  const message = marketsLoading
    ? "Loading markets…"
    : !hasMarket
      ? "Select a market to build a preview."
      : markPriceLoading
        ? "Waiting for mark price…"
        : lockedParamsLoading
          ? "Loading market parameters…"
          : feeLoading
            ? "Loading fees…"
            : "Enter margin, leverage, and slippage to compute the preview.";
  return (
    <div
      data-testid={`${idPrefix}-preview-placeholder`}
      className="border-border/70 bg-muted/20 grid gap-2 rounded-xl border p-4 text-sm"
    >
      <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Quote preview</div>
      <div className="text-muted-foreground inline-flex items-center gap-2 text-xs">
        {busy ? <Spinner className="size-3" /> : null}
        <span>{message}</span>
      </div>
    </div>
  );
}

function TradePreview({
  tradeParams,
  feeRates,
  markPrice,
  notionalCap,
  notionalCapLoading,
  side,
  pricePrecision,
  quantityPrecision,
  idPrefix,
}: {
  tradeParams: NonNullable<ReturnType<typeof calculateTradeParams>>;
  feeRates: { openFee: bigint; closeFee: bigint } | undefined;
  markPrice: string | undefined;
  pricePrecision: number;
  quantityPrecision: number;
  notionalCap:
    | {
        availableToLong: number;
        availableToShort: number;
        totalCap: number;
        used: number;
        error: string | null;
      }
    | undefined;
  notionalCapLoading: boolean;
  side: TradeSide;
  idPrefix: string;
}) {
  const lockedTotal = sumDecimals([tradeParams.cva, tradeParams.lf, tradeParams.partyAmm]);
  const openFeeAmount = feeRates ? computeFeeAmount(feeRates.openFee, tradeParams.notional) : undefined;
  const closeFeeAmount = feeRates ? computeFeeAmount(feeRates.closeFee, tradeParams.notional) : undefined;
  const totalFeeAmount =
    openFeeAmount !== undefined && closeFeeAmount !== undefined
      ? sumDecimals([openFeeAmount, closeFeeAmount])
      : undefined;

  return (
    <div
      data-testid={`${idPrefix}-preview`}
      className="border-border/70 bg-muted/20 grid gap-3 rounded-xl border p-4 text-sm"
    >
      <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Quote preview</div>

      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5">
        <PreviewRow
          label="Mark price"
          value={markPrice !== undefined ? formatPriceAt(markPrice, pricePrecision) : "—"}
          testId={`${idPrefix}-preview-mark-price`}
        />
        <PreviewRow
          label="Request price"
          value={formatPriceAt(tradeParams.requestedOpenPrice, pricePrecision)}
          testId={`${idPrefix}-preview-request-price`}
        />
        <PreviewRow
          label="quantity"
          value={formatQuantityAt(tradeParams.quantity, quantityPrecision)}
          testId={`${idPrefix}-preview-quantity`}
        />
        <PreviewRow
          label="Notional"
          hint="(quantity × requestedOpenPrice)"
          value={formatDecimalUsd(tradeParams.notional)}
          testId={`${idPrefix}-preview-notional`}
        />
      </dl>

      <div className="border-border/60 border-t pt-3">
        <div className="text-muted-foreground mb-1.5 text-xs font-medium tracking-wide uppercase">Fees</div>
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
          <PreviewRow
            label="Open fee"
            value={openFeeAmount !== undefined ? formatDecimalUsd(openFeeAmount) : "—"}
            testId={`${idPrefix}-preview-open-fee`}
          />
          <PreviewRow
            label="Close fee"
            value={closeFeeAmount !== undefined ? formatDecimalUsd(closeFeeAmount) : "—"}
            testId={`${idPrefix}-preview-close-fee`}
          />
          <PreviewRow
            label="Total fee"
            value={totalFeeAmount !== undefined ? formatDecimalUsd(totalFeeAmount) : "—"}
            bold
            testId={`${idPrefix}-preview-total-fee`}
          />
        </dl>
      </div>

      <div className="border-border/60 border-t pt-3">
        <div className="text-muted-foreground mb-1.5 text-xs font-medium tracking-wide uppercase">Locked margin</div>
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
          <PreviewRow label="CVA" value={formatDecimalUsd(tradeParams.cva)} testId={`${idPrefix}-preview-cva`} />
          <PreviewRow label="LF" value={formatDecimalUsd(tradeParams.lf)} testId={`${idPrefix}-preview-lf`} />
          <PreviewRow
            label="partyAmm"
            value={formatDecimalUsd(tradeParams.partyAmm)}
            testId={`${idPrefix}-preview-partyamm`}
          />
          <PreviewRow
            label="Total locked"
            value={formatDecimalUsd(lockedTotal)}
            bold
            testId={`${idPrefix}-preview-locked-total`}
          />
        </dl>
      </div>

      <div className="border-border/60 border-t pt-3">
        <div className="text-muted-foreground mb-1.5 text-xs font-medium tracking-wide uppercase">
          Available liquidity
        </div>
        {notionalCapLoading && !notionalCap ? (
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <Spinner className="size-3" /> <span>Loading…</span>
          </div>
        ) : notionalCap?.error ? (
          <p className="text-destructive text-xs" data-testid={`${idPrefix}-preview-cap-error`}>
            Solver error: {notionalCap.error}
          </p>
        ) : notionalCap ? (
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
            <PreviewRow
              label="Available to long"
              value={formatCompactUsd(notionalCap.availableToLong)}
              bold={side === "long"}
              testId={`${idPrefix}-preview-cap-long`}
            />
            <PreviewRow
              label="Available to short"
              value={formatCompactUsd(notionalCap.availableToShort)}
              bold={side === "short"}
              testId={`${idPrefix}-preview-cap-short`}
            />
          </dl>
        ) : (
          <p className="text-muted-foreground text-xs">No cap data.</p>
        )}
      </div>
    </div>
  );
}

/**
 * Compute a fee amount in USD as a decimal string. `feeRate` is 18-decimal
 * fixed-point (`getFeeForUser` shape); `notional` is the trade's notional as a
 * decimal string. Plain `Number` math is fine here — preview-only precision.
 */
function computeFeeAmount(feeRate: bigint, notional: string): string {
  const rate = Number(feeRate) / 1e18;
  const notionalNum = Number(notional);
  if (!Number.isFinite(rate) || !Number.isFinite(notionalNum)) return "0";
  return String(rate * notionalNum);
}

function PreviewRow({
  label,
  hint,
  value,
  bold = false,
  testId,
}: {
  label: string;
  /** Optional short clarifier shown next to the label (e.g. the formula). */
  hint?: string;
  value: string;
  bold?: boolean;
  testId?: string;
}) {
  return (
    <>
      <dt
        className={cn(
          "text-muted-foreground inline-flex items-baseline gap-1.5",
          bold && "text-foreground font-medium",
        )}
      >
        <span>{label}</span>
        {hint ? <span className="text-muted-foreground/70 text-[0.65rem]">{hint}</span> : null}
      </dt>
      <dd className={cn("text-foreground justify-self-end font-mono", bold && "font-semibold")} data-testid={testId}>
        {value}
      </dd>
    </>
  );
}

function sumDecimals(values: readonly string[]): string {
  let total = 0;
  for (const v of values) {
    const n = Number(v);
    if (Number.isFinite(n)) total += n;
  }
  return String(total);
}

function QuoteViolationsPanel({ violations, idPrefix }: { violations: QuoteConstraintViolation[]; idPrefix: string }) {
  return (
    <div
      data-testid={`${idPrefix}-quote-violations`}
      role="alert"
      className="border-destructive/30 bg-destructive/10 text-destructive flex flex-col gap-1.5 rounded-xl border px-3 py-2.5 text-sm"
    >
      <span className="text-foreground/90 font-medium">Quote can&apos;t be sent yet:</span>
      <ul className="flex flex-col gap-1 pl-4 [&>li]:list-disc">
        {violations.map((violation, index) => (
          <li key={`${violation.kind}-${index}`} className="text-foreground/85 text-xs">
            {describeViolation(violation)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Render one violation as a short, user-readable sentence. */
function describeViolation(violation: QuoteConstraintViolation): string {
  switch (violation.kind) {
    case "LF_PORTION_TOO_LOW":
      return `LF portion ${formatRatio(violation.actualPortion)} is below the market minimum ${formatRatio(violation.minPortion)}. Raise leverage or pick a different market.`;
    case "QUOTE_VALUE_TOO_LOW":
      return `Locked margin ${formatDecimalUsd(violation.actualQuoteValue)} (CVA + LF + partyAmm) is below the market minimum ${formatDecimalUsd(violation.minQuoteValue)}.`;
    case "NOTIONAL_TOO_HIGH":
      return `Notional ${formatDecimalUsd(violation.actualNotional)} exceeds the market cap ${formatDecimalUsd(violation.maxNotional)}. Lower the margin or leverage.`;
    case "NOTIONAL_TOO_LOW":
      return `Notional ${formatDecimalUsd(violation.actualNotional)} is below the market minimum ${formatDecimalUsd(violation.minNotional)}.`;
    case "QUANTITY_TOO_HIGH":
      return `Quantity ${formatDecimalAmount(violation.actualQuantity)} exceeds the market cap ${formatDecimalAmount(violation.maxQuantity)}.`;
    case "QUANTITY_BELOW_LOT_SIZE":
      return `Quantity ${formatDecimalAmount(violation.actualQuantity)} is below the market's minimum lot ${formatDecimalAmount(violation.lotSize)}.`;
    case "QUANTITY_NOT_LOT_MULTIPLE":
      return `Quantity ${formatDecimalAmount(violation.actualQuantity)} must be an exact multiple of the lot size ${formatDecimalAmount(violation.lotSize)}.`;
    case "CAP_REACHED": {
      const sideLabel = violation.side === PositionType.LONG ? "long" : "short";
      return `Notional ${formatDecimalUsd(violation.actualNotional)} exceeds the solver's available liquidity on the ${sideLabel} side (${formatDecimalUsd(violation.available)}).`;
    }
  }
}

function formatRatio(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  return `${(parsed * 100).toFixed(2)}%`;
}

function formatDecimalUsd(value: string): string {
  return `$${formatDecimalAmount(value)}`;
}

/** A market price at the market's `price_precision` decimals (padded), with a `$`. */
function formatPriceAt(value: string, pricePrecision: number): string {
  if (!Number.isFinite(Number(value))) return value;
  return `$${formatWithCommas(value, { fixedDecimals: pricePrecision })}`;
}

/** A quantity / size at the market's `quantity_precision` decimals (padded). */
function formatQuantityAt(value: string, quantityPrecision: number): string {
  if (!Number.isFinite(Number(value))) return value;
  return formatWithCommas(value, { fixedDecimals: quantityPrecision });
}

/**
 * Compact-notation USD formatter (K/M/B/T). Used for solver liquidity figures
 * where magnitude matters more than precision (`$1.2M` reads better than
 * `$1,234,567`). Sub-1k values fall through to comma-separated formatting.
 */
function formatCompactUsd(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `$${formatCompact(value, { maxDecimals: 2 })}`;
}

/**
 * Format a decimal string with at most 4 fractional digits, no thousand
 * separators, trailing zeros stripped. `parseFloat` round-trip drops trailing
 * zeros for free; falls through to the raw string when the value isn't a
 * finite number so we never display `"NaN"`.
 */
function formatDecimalAmount(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  return parseFloat(parsed.toFixed(4)).toString();
}

function SubmitStatus({
  mutation,
  sessionKey,
  idPrefix,
}: {
  mutation: UseInstantOpenWithTpSlReturnType;
  sessionKey: Address;
  idPrefix: string;
}) {
  if (mutation.phase === "opening") {
    return (
      <ResultNote testId={`${idPrefix}-loading`} loading>
        Signing operations with session key <span className="font-mono">{shortenAddress(sessionKey)}</span> and
        submitting to the hedger…
      </ResultNote>
    );
  }
  if (mutation.error) {
    const solver = solverErrorOf(mutation.error);
    return (
      <ResultError
        testId={`${idPrefix}-error`}
        kind={solver?.category ?? mutation.error.kind}
        message={
          <span className="flex flex-col gap-0.5">
            <span>{solver?.message ?? mutation.error.message}</span>
            {solver?.code !== undefined ? (
              <span className="text-muted-foreground text-xs">code: {solver.code}</span>
            ) : null}
            {solver?.detail ? <span className="text-muted-foreground text-xs">{solver.detail}</span> : null}
          </span>
        }
      />
    );
  }
  if (mutation.data?.instantOpen?.success) {
    const tempQuoteId = mutation.data.instantOpen.tempQuoteId ?? "(none)";
    return (
      <ResultSuccess testId={`${idPrefix}-success`}>
        <span className="text-foreground">Submitted to hedger.</span>
        <span className="text-muted-foreground text-xs">
          tempQuoteId: <span className="text-foreground font-mono">{tempQuoteId}</span>
        </span>
      </ResultSuccess>
    );
  }
  return null;
}

function AvailableMarginLabel({
  balanceLoading,
  balanceError,
  balanceWei,
  openFeeRate,
  closeFeeRate,
  leverage,
  side,
  slippagePct,
  slippageFractionWei,
  availableMarginWei,
  availableDecimal,
  idPrefix,
  onMax,
}: {
  balanceLoading: boolean;
  balanceError: unknown;
  balanceWei: bigint | undefined;
  openFeeRate: bigint | undefined;
  closeFeeRate: bigint | undefined;
  leverage: number;
  side: TradeSide;
  slippagePct: number | undefined;
  slippageFractionWei: bigint | undefined;
  availableMarginWei: bigint | undefined;
  availableDecimal: number | undefined;
  idPrefix: string;
  onMax: () => void;
}) {
  if (balanceLoading) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
        <Spinner className="size-3" /> available…
      </span>
    );
  }
  if (balanceError) {
    return <span className="text-destructive text-xs">available: unavailable</span>;
  }
  if (availableMarginWei === undefined || availableDecimal === undefined) {
    return (
      <span className="text-muted-foreground text-xs" data-testid={`${idPrefix}-available-empty`}>
        available: select a market
      </span>
    );
  }

  // Fee impact per side in 1e18 wei: balance × leverage × rate / 1e18.
  const ONE_E18 = 10n ** 18n;
  const leverageBig = BigInt(leverage);
  const openFeeImpactWei =
    balanceWei !== undefined && openFeeRate !== undefined
      ? (balanceWei * leverageBig * openFeeRate) / ONE_E18
      : undefined;
  const closeFeeImpactWei =
    balanceWei !== undefined && closeFeeRate !== undefined
      ? (balanceWei * leverageBig * closeFeeRate) / ONE_E18
      : undefined;

  // Slippage shaves the cap on SHORT only (see availableMarginWei comment in OpenPositionStep).
  const showSlippageRow = side === "short" && balanceWei !== undefined && slippageFractionWei !== undefined;
  const slippageImpactWei = showSlippageRow ? (balanceWei * slippageFractionWei) / ONE_E18 : undefined;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="text-muted-foreground inline-flex cursor-help items-center gap-2 text-xs"
          data-testid={`${idPrefix}-available`}
        >
          available: <span className="text-foreground font-mono">{formatUsd(availableMarginWei)}</span>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onMax();
            }}
            disabled={availableMarginWei === 0n}
            data-testid={`${idPrefix}-max`}
            className="text-foreground hover:bg-muted/60 disabled:text-muted-foreground ring-border/60 rounded px-1.5 py-0.5 text-[0.65rem] font-medium tracking-wide uppercase ring-1 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            Max
          </button>
        </span>
      </TooltipTrigger>
      <TooltipContent className="w-64 p-3" sideOffset={6}>
        <div className="grid gap-1.5 text-xs" data-testid={`${idPrefix}-available-tooltip`}>
          <BreakdownRow label="Balance" value={balanceWei !== undefined ? formatUsd(balanceWei) : "—"} />
          {showSlippageRow ? (
            <BreakdownRow
              label="Slippage (short)"
              value={slippageImpactWei !== undefined ? `−${formatUsd(slippageImpactWei)}` : "—"}
              sub={slippagePct !== undefined ? `${formatSlippagePct(slippagePct)}` : undefined}
            />
          ) : null}
          <BreakdownRow
            label={`Open fee (×${leverage})`}
            value={openFeeImpactWei !== undefined ? `−${formatUsd(openFeeImpactWei)}` : "—"}
            sub={openFeeRate !== undefined ? formatRatePercent(openFeeRate) : undefined}
          />
          <BreakdownRow
            label={`Close fee (×${leverage})`}
            value={closeFeeImpactWei !== undefined ? `−${formatUsd(closeFeeImpactWei)}` : "—"}
            sub={closeFeeRate !== undefined ? formatRatePercent(closeFeeRate) : undefined}
          />
          <div className="border-border/60 mt-1 border-t pt-1.5">
            <BreakdownRow label="Available" value={formatUsd(availableMarginWei)} bold />
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function BreakdownRow({
  label,
  value,
  sub,
  bold = false,
}: {
  label: string;
  value: string;
  sub?: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground inline-flex items-baseline gap-1.5">
        <span>{label}</span>
        {sub ? <span className="text-[0.65rem] opacity-70">{sub}</span> : null}
      </span>
      <span className={cn("font-mono", bold ? "text-foreground font-medium" : "text-foreground")}>{value}</span>
    </div>
  );
}

/** Format an 18-decimal fixed-point rate (e.g. `5_000000000000000` = 0.5%) as a percent string. */
function formatRatePercent(rateWei: bigint): string {
  const percent = Number(rateWei) / 1e16; // /1e18 × 100
  if (!Number.isFinite(percent)) return "—";
  return `${percent.toFixed(percent < 0.01 ? 4 : 2)}%`;
}

/** Format the user's slippage input (already in percent) — caps trailing zeros. */
function formatSlippagePct(pct: number): string {
  if (!Number.isFinite(pct)) return "—";
  const rounded = Math.round(pct * 100) / 100;
  return `${rounded}%`;
}

function TradeSideControl({
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string;
  value: TradeSide;
  onChange: (value: TradeSide) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Trade side"
      className="bg-muted/70 ring-border/70 inline-flex h-9 w-full items-center gap-1 rounded-xl p-1 ring-1"
    >
      {TRADE_SIDES.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            data-testid={`${idPrefix}-side-${option.value}`}
            className={cn(
              "focus-visible:ring-ring/40 h-7 flex-1 rounded-lg text-sm font-medium transition-all outline-none focus-visible:ring-2",
              active
                ? option.value === "long"
                  ? "bg-positive/15 text-positive ring-positive/30 ring-1"
                  : "bg-destructive/15 text-destructive ring-destructive/30 ring-1"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function getOpenMarkets(markets: Market[]): Market[] {
  return markets
    .filter(
      // Solvers that omit `state` (e.g. Rasa) are treated as tradable; only an
      // explicit non-open state filters a market out.
      (market) => market.kind !== "enigma" || market.state === 2 || market.state === 3,
    )
    .sort((a, b) => (a.symbol ?? a.name ?? "").localeCompare(b.symbol ?? b.name ?? ""));
}

function toMarketSelectItems(markets: Market[]): MarketSelectItem[] {
  return markets.map((market) => {
    const id = String(market.symbolId);
    const label = market.symbol ?? market.name ?? `Market ${market.symbolId}`;
    const name = market.name && market.name !== label ? market.name : undefined;
    return {
      id,
      label,
      description: name ? `${name} · max ${market.maxLeverage ?? "1"}x` : `Max ${market.maxLeverage ?? "1"}x`,
      meta: `ID ${id}`,
      searchText: [id, market.symbol, market.name].filter(Boolean).join(" "),
    };
  });
}

function getMaxLeverage(market?: Market): number {
  if (!market) return 1;
  const parsed = Math.floor(Number(market.maxLeverage ?? 1));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function clampLeverage(value: number, maxLeverage: number): number {
  return Math.max(1, Math.min(maxLeverage, Math.floor(value)));
}

function parsePositiveNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * Solver/hedger error body shape — matches the documented
 * `XfiberErrorResponse`-style payload (`{code, error_category, error_message,
 * error_detail}`). Extracted off `SymmApiError.responseData` so the UI can show
 * the structured fields instead of just `.message`.
 */
interface SolverErrorBody {
  message?: string;
  code?: number;
  category?: string;
  detail?: string;
}

function solverErrorOf(error: unknown): SolverErrorBody | undefined {
  if (!(error instanceof SymmioRequestError) || error.kind !== "api") return undefined;
  const body = error.responseData;
  if (body === null || typeof body !== "object") return undefined;
  const data = body as Record<string, unknown>;
  const message = typeof data.error_message === "string" ? data.error_message : undefined;
  const code =
    typeof data.code === "number" ? data.code : typeof data.error_code === "number" ? data.error_code : undefined;
  const category = typeof data.error_category === "string" ? data.error_category : undefined;
  const detail = typeof data.error_detail === "string" ? data.error_detail : undefined;
  if (message === undefined && code === undefined && category === undefined && detail === undefined) return undefined;
  return { message, code, category, detail };
}

/**
 * Optional pre-fill for TP/SL. Values ride with the instant open request: on
 * hedger accept we capture the tempQuoteId, poll until an on-chain quote id
 * arrives, then post `setQuoteTpSl` for it.
 */
function TpSlPresetCard({
  idPrefix,
  tpPrice,
  onTpPriceChange,
  tpPriceType,
  onTpPriceTypeChange,
  slPrice,
  onSlPriceChange,
  slPriceType,
  onSlPriceTypeChange,
}: {
  idPrefix: string;
  tpPrice: string;
  onTpPriceChange: (v: string) => void;
  tpPriceType: TpSlPriceType;
  onTpPriceTypeChange: (t: TpSlPriceType) => void;
  slPrice: string;
  onSlPriceChange: (v: string) => void;
  slPriceType: TpSlPriceType;
  onSlPriceTypeChange: (t: TpSlPriceType) => void;
}) {
  return (
    <div className="border-border/60 grid gap-2 rounded-xl border p-3 text-sm">
      <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">TP/SL (optional)</div>
      <div className="grid gap-2 sm:grid-cols-2">
        <TpSlPresetSide
          label="Take Profit"
          idPrefix={`${idPrefix}-tp`}
          price={tpPrice}
          onPriceChange={onTpPriceChange}
          priceType={tpPriceType}
          onPriceTypeChange={onTpPriceTypeChange}
        />
        <TpSlPresetSide
          label="Stop Loss"
          idPrefix={`${idPrefix}-sl`}
          price={slPrice}
          onPriceChange={onSlPriceChange}
          priceType={slPriceType}
          onPriceTypeChange={onSlPriceTypeChange}
        />
      </div>
    </div>
  );
}

function TpSlPresetSide({
  label,
  idPrefix,
  price,
  onPriceChange,
  priceType,
  onPriceTypeChange,
}: {
  label: string;
  idPrefix: string;
  price: string;
  onPriceChange: (v: string) => void;
  priceType: TpSlPriceType;
  onPriceTypeChange: (t: TpSlPriceType) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-muted-foreground text-[0.7rem]" htmlFor={`${idPrefix}-price`}>
        {label}
      </label>
      <Input
        id={`${idPrefix}-price`}
        value={price}
        onChange={(event) => onPriceChange(event.target.value)}
        placeholder="Trigger price"
        inputMode="decimal"
      />
      <div className="flex gap-1">
        {(["markPrice", "lastPrice"] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onPriceTypeChange(type)}
            className={cn(
              "border-border/60 rounded-md border px-2 py-0.5 text-[0.65rem] transition-colors",
              priceType === type ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {type === "markPrice" ? "mark" : "last"}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Status for the TP/SL attachment leg. The orchestrator hook's `phase` +
 * partial-success payload (`tpsl` / `tpslError`) drive the render — no local
 * mutation state needed.
 */
function TpSlAttachmentStatus({
  idPrefix,
  mutation,
}: {
  idPrefix: string;
  mutation: UseInstantOpenWithTpSlReturnType;
}) {
  if (mutation.data?.tpsl) {
    return (
      <ResultSuccess testId={`${idPrefix}-tpsl-success`}>
        TP/SL submitted — WebSocket will confirm activation.
      </ResultSuccess>
    );
  }
  if (mutation.data?.tpslError) {
    return (
      <ResultError
        testId={`${idPrefix}-tpsl-error`}
        kind={mutation.data.tpslError.kind ?? "generic"}
        message={mutation.data.tpslError.message ?? "TP/SL submission failed."}
      />
    );
  }
  return (
    <ResultNote testId={`${idPrefix}-tpsl-status`}>
      <span className="inline-flex items-center gap-2">
        <Spinner className="size-3" /> Submitting TP/SL for temp quote…
      </span>
    </ResultNote>
  );
}
