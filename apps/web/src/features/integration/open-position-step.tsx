"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { formatUsd, WEI_DECIMALS } from "@/lib/format";
import {
  PositionType,
  SymmioRequestError,
  useAccountBalanceOf,
  useEnigmaPriceServicePricesByNames,
  useFeeForUser,
  useInstantOpenAuto,
  useLockedParams,
  useMarkets,
} from "@symm-frontier/react";
import { Button } from "@symm-frontier/ui/components/button";
import { Input } from "@symm-frontier/ui/components/input";
import { MarketSelect, type MarketSelectItem } from "@symm-frontier/ui/components/market-select";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@symm-frontier/ui/components/tooltip";
import { cn } from "@symm-frontier/ui/lib/utils";
import { shortenAddress } from "@symm-frontier/utils";
import { useEffect, useMemo, useState } from "react";
import { formatUnits, type Address } from "viem";

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
  const markets = useMemo(() => getOpenMarkets(marketsQuery.data ?? []), [marketsQuery.data]);
  const marketItems = useMemo(() => toMarketSelectItems(markets), [markets]);

  const [marketId, setMarketId] = useState("");
  const [side, setSide] = useState<TradeSide>("long");
  const [initialMargin, setInitialMargin] = useState("");
  const [leverage, setLeverage] = useState(1);
  const [slippage, setSlippage] = useState("5");

  const selectedMarket = useMemo(
    () => markets.find((market) => String(market.symbol_id) === marketId),
    [marketId, markets],
  );
  const maxLeverage = getMaxLeverage(selectedMarket);
  const validInitialMargin = parsePositiveNumber(initialMargin);
  const validSlippage = parsePositiveNumber(slippage);
  const marketName = selectedMarket?.name;

  useEffect(() => {
    setLeverage((current) => clampLeverage(current, maxLeverage));
  }, [maxLeverage]);

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
    symbolId: selectedMarket?.symbol_id !== undefined ? BigInt(selectedMarket.symbol_id) : 0n,
    query: { enabled: Boolean(selectedMarket?.symbol_id), staleTime: 30_000 },
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

  const availableMarginWei = useMemo<bigint | undefined>(() => {
    const balance = balanceQuery.data;
    const fees = feeQuery.data;
    if (balance === undefined || fees === undefined || slippageFractionWei === undefined) return undefined;
    const ONE_E18 = 10n ** 18n;
    const slippageMultiplier =
      side === "short" ? (slippageFractionWei >= ONE_E18 ? 0n : ONE_E18 - slippageFractionWei) : ONE_E18;
    const totalFeeRate = fees.openFee + fees.closeFee;
    const leverageScaled = BigInt(leverage) * totalFeeRate;
    const feeMultiplier = leverageScaled >= ONE_E18 ? 0n : ONE_E18 - leverageScaled;
    const afterSlippage = (balance * slippageMultiplier) / ONE_E18;
    return (afterSlippage * feeMultiplier) / ONE_E18;
  }, [balanceQuery.data, feeQuery.data, leverage, side, slippageFractionWei]);

  const availableMarginDecimal =
    availableMarginWei !== undefined ? Number(formatUnits(availableMarginWei, WEI_DECIMALS)) : undefined;
  const exceedsAvailable =
    validInitialMargin !== undefined &&
    availableMarginDecimal !== undefined &&
    validInitialMargin > availableMarginDecimal;

  const mutation = useInstantOpenAuto();

  const canSubmit = Boolean(
    selectedMarket &&
    marketName &&
    validInitialMargin !== undefined &&
    validSlippage !== undefined &&
    !exceedsAvailable &&
    !mutation.isPending,
  );

  async function handleSubmit() {
    if (!canSubmit || !selectedMarket || !marketName) return;
    const cachedMarkPrice = priceQuery.data?.[marketName]?.markPrice;
    await mutation.mutateAsync({
      subAccountAddress: subAccount,
      from: sessionKey,
      market: {
        id: Number(selectedMarket.symbol_id ?? 0),
        name: marketName,
        pricePrecision: Number(selectedMarket.price_precision ?? 0),
        quantityPrecision: Number(selectedMarket.quantity_precision ?? 0),
      },
      positionType: side === "long" ? PositionType.LONG : PositionType.SHORT,
      initialMargin,
      leverage,
      slippage: validSlippage!,
      lockedParamPercent: lockedParamsQuery.data,
      markPrice: cachedMarkPrice !== undefined ? String(cachedMarkPrice) : undefined,
      feeRates: feeQuery.data,
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
          label={
            <span className="inline-flex items-center gap-2">
              leverage <span className="text-foreground font-mono text-sm">{leverage}x</span>
            </span>
          }
          htmlFor={`${idPrefix}-leverage`}
          hint={
            selectedMarket
              ? `Max ${maxLeverage}x for ${selectedMarket.symbol ?? selectedMarket.name}.`
              : "Select a market first."
          }
        >
          <input
            id={`${idPrefix}-leverage`}
            type="range"
            min={1}
            max={maxLeverage}
            step={1}
            value={leverage}
            disabled={!selectedMarket}
            onChange={(event) => setLeverage(Number(event.target.value))}
            className="accent-primary h-9 w-full disabled:opacity-50"
            data-testid={`${idPrefix}-leverage`}
          />
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
    </div>
  );
}

function SubmitStatus({
  mutation,
  sessionKey,
  idPrefix,
}: {
  mutation: ReturnType<typeof useInstantOpenAuto>;
  sessionKey: Address;
  idPrefix: string;
}) {
  if (mutation.isPending) {
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
  if (mutation.data?.success) {
    const tempQuoteId = mutation.data.tempQuoteId ?? "(none)";
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
    .filter((market) => market.symbol_id !== undefined && (market.state === 2 || market.state === 3))
    .sort((a, b) => (a.symbol ?? a.name ?? "").localeCompare(b.symbol ?? b.name ?? ""));
}

function toMarketSelectItems(markets: Market[]): MarketSelectItem[] {
  return markets.map((market) => {
    const id = String(market.symbol_id);
    const label = market.symbol ?? market.name ?? `Market ${market.symbol_id}`;
    const name = market.name && market.name !== label ? market.name : undefined;
    return {
      id,
      label,
      description: name ? `${name} · max ${market.max_leverage ?? "1"}x` : `Max ${market.max_leverage ?? "1"}x`,
      meta: `ID ${id}`,
      searchText: [id, market.symbol, market.name].filter(Boolean).join(" "),
    };
  });
}

function getMaxLeverage(market?: Market): number {
  if (!market) return 1;
  const parsed = Math.floor(Number(market.max_leverage ?? 1));
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
