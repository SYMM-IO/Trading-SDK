"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import {
  calculateClosePrice,
  PositionType,
  SymmioRequestError,
  useEnigmaPriceServicePricesByNames,
  useFeeForUser,
  useInstantCloseAuto,
  useMarkets,
  validateInstantCloseAgainstMarket,
  type CloseQuoteConstraintViolation,
} from "@symmio/trading-react";
import { Badge } from "@symmio/ui/components/badge";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { Spinner } from "@symmio/ui/components/spinner";
import { cn } from "@symmio/ui/lib/utils";
import { formatWithCommas } from "@symmio/utils";
import { useMemo, useState } from "react";
import { formatUnits, type Address } from "viem";
import { EstimatedPricePreview } from "./estimated-price-preview";

const WEI_DECIMALS = 18;

type Market = NonNullable<ReturnType<typeof useMarkets>["data"]>[number];

/**
 * Minimal subset of the on-chain `Quote` struct that {@link ClosePositionStep}
 * needs. Decoupled from the full SDK type so the component can be driven by
 * either a {@link useGetPartyAOpenPositions} result or any other source that
 * carries the same fields.
 */
export interface ClosablePosition {
  id: bigint;
  symbolId: bigint;
  positionType: PositionType;
  quantity: bigint;
  closedAmount: bigint;
  lockedValues: { cva: bigint; lf: bigint; partyAmm: bigint; partyBmm: bigint };
  /** Owner of the quote (the VA address). */
  partyA: Address;
}

interface Props {
  /** PartyA (the VA address) that owns the position. */
  partyA: Address;
  /** Session-key address used to sign the operation (display-only). */
  sessionKey: Address;
  /** Position the user is closing. */
  position: ClosablePosition;
  /**
   * Optional callback invoked by the in-form Refresh button to re-read the
   * position from chain. The parent owns the `usePartyAOpenPositions` query
   * (or equivalent), so the close form just triggers it; the markPrice +
   * feeRates queries owned by this component refetch in parallel.
   */
  onRefreshPosition?: () => void;
  /** Mirrors the parent position query's `isRefetching`. */
  isRefreshingPosition?: boolean;
  /** Test-id namespace; lets two mounts on the same page have distinct selectors. */
  idPrefix?: string;
}

/**
 * Instant-close form: position summary + quantity + slippage + submit.
 * Pre-fetches the market metadata and mark price; runs
 * {@link validateInstantCloseAgainstMarket} against the user's draft and
 * blocks submit on any violation. Used by both the Integration wizard and
 * the Solvers page card.
 */
export function ClosePositionStep({
  partyA,
  sessionKey,
  position,
  onRefreshPosition,
  isRefreshingPosition = false,
  idPrefix = "instant-close",
}: Props) {
  const marketsQuery = useMarkets();
  const market = useMemo<Market | undefined>(
    () => marketsQuery.data?.find((m) => BigInt(m.symbolId ?? -1) === position.symbolId),
    [marketsQuery.data, position.symbolId],
  );
  const marketName = market?.name;

  const priceQuery = useEnigmaPriceServicePricesByNames({
    names: marketName ? [marketName] : [],
    query: { enabled: Boolean(marketName), staleTime: 5_000 },
  });
  const feeQuery = useFeeForUser({
    user: partyA,
    symbolId: position.symbolId,
    query: { enabled: true, staleTime: 30_000 },
  });

  const [quantity, setQuantity] = useState("");
  const [slippage, setSlippage] = useState("5");

  const validQuantity = parsePositiveNumber(quantity);
  const validSlippage = parsePositiveNumber(slippage);

  const cachedMarkPrice = marketName ? priceQuery.data?.[marketName]?.markPrice : undefined;
  const remainingQuantityDecimal = useMemo(() => {
    const remainingWei = position.quantity - position.closedAmount;
    return formatUnits(remainingWei, WEI_DECIMALS);
  }, [position.quantity, position.closedAmount]);

  // Slippage-adjusted close price (decimal string) — pure preview, no SDK call.
  const closePrice = useMemo(() => {
    if (market === undefined || cachedMarkPrice === undefined || validSlippage === undefined) return null;
    return calculateClosePrice({
      markPrice: String(cachedMarkPrice),
      slippage: validSlippage,
      positionType: position.positionType,
      pricePrecision: Number(market.pricePrecision ?? 0),
    });
  }, [market, cachedMarkPrice, validSlippage, position.positionType]);

  const exceedsRemaining = validQuantity !== undefined && validQuantity > Number(remainingQuantityDecimal);

  // Close-side validator. Original cva/lf/partyAmm come from the on-chain
  // `Quote.lockedValues`; the validator scales them by remaining/original
  // for the post-close locked-margin floor check.
  const violations = useMemo<CloseQuoteConstraintViolation[]>(() => {
    if (market === undefined || cachedMarkPrice === undefined || validQuantity === undefined) return [];
    return validateInstantCloseAgainstMarket({
      market,
      originalQuantity: remainingQuantityDecimal,
      closeQuantity: String(validQuantity),
      cva: formatUnits(position.lockedValues.cva, WEI_DECIMALS),
      lf: formatUnits(position.lockedValues.lf, WEI_DECIMALS),
      partyAmm: formatUnits(position.lockedValues.partyAmm, WEI_DECIMALS),
    }).violations;
  }, [
    market,
    cachedMarkPrice,
    validQuantity,
    remainingQuantityDecimal,
    position.lockedValues.cva,
    position.lockedValues.lf,
    position.lockedValues.partyAmm,
  ]);

  const mutation = useInstantCloseAuto();
  const canSubmit = Boolean(
    market &&
    marketName &&
    validQuantity !== undefined &&
    validSlippage !== undefined &&
    !exceedsRemaining &&
    violations.length === 0 &&
    !mutation.isPending,
  );

  const isRefreshing =
    isRefreshingPosition || marketsQuery.isRefetching || priceQuery.isRefetching || feeQuery.isRefetching;

  function handleRefresh() {
    onRefreshPosition?.();
    void marketsQuery.refetch();
    void priceQuery.refetch();
    void feeQuery.refetch();
  }

  async function handleSubmit() {
    if (!canSubmit || !market || !marketName) return;
    await mutation.mutateAsync({
      partyA,
      from: sessionKey,
      market: {
        id: Number(market.symbolId ?? 0),
        name: marketName,
        pricePrecision: Number(market.pricePrecision ?? 0),
        quantityPrecision: Number(market.quantityPrecision ?? 0),
      },
      positionType: position.positionType,
      quoteId: position.id,
      quantityToClose: quantity,
      slippage: validSlippage!,
      markPrice: cachedMarkPrice !== undefined ? String(cachedMarkPrice) : undefined,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground text-xs">Quote data from on-chain + solver.</span>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          data-testid={`${idPrefix}-refresh`}
          className="text-foreground hover:bg-muted/60 ring-border/60 disabled:text-muted-foreground inline-flex items-center gap-1.5 rounded px-2 py-1 text-[0.7rem] font-medium tracking-wide uppercase ring-1 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRefreshing ? <Spinner className="size-3" /> : null}
          {isRefreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <PositionSummary position={position} market={market} markPrice={cachedMarkPrice} idPrefix={idPrefix} />

      <Field
        label="quantity to close"
        htmlFor={`${idPrefix}-quantity`}
        action={
          <button
            type="button"
            onClick={() => setQuantity(remainingQuantityDecimal)}
            disabled={Number(remainingQuantityDecimal) === 0}
            data-testid={`${idPrefix}-max`}
            className="text-foreground hover:bg-muted/60 disabled:text-muted-foreground ring-border/60 rounded px-1.5 py-0.5 text-[0.65rem] font-medium tracking-wide uppercase ring-1 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            Max
          </button>
        }
        hint={
          exceedsRemaining
            ? "Exceeds remaining quantity."
            : `Remaining: ${formatDecimalAmount(remainingQuantityDecimal)} (after past closes).`
        }
      >
        <Input
          id={`${idPrefix}-quantity`}
          value={quantity}
          onChange={(event) => setQuantity(event.target.value.replace(/[^\d.]/g, ""))}
          placeholder="0.00"
          inputMode="decimal"
          aria-invalid={(quantity.length > 0 && validQuantity === undefined) || exceedsRemaining}
          data-testid={`${idPrefix}-quantity`}
        />
      </Field>

      <Field label="slippage (%)" htmlFor={`${idPrefix}-slippage`} hint="Percent tolerance — must be greater than 0.">
        <Input
          id={`${idPrefix}-slippage`}
          value={slippage}
          onChange={(event) => setSlippage(event.target.value.replace(/[^\d.]/g, ""))}
          placeholder="5"
          inputMode="decimal"
          min={0}
          aria-invalid={slippage.length > 0 && validSlippage === undefined}
          data-testid={`${idPrefix}-slippage`}
        />
      </Field>

      {closePrice !== null ? (
        <ClosePreview
          closePrice={closePrice}
          markPrice={cachedMarkPrice !== undefined ? String(cachedMarkPrice) : undefined}
          quantity={validQuantity !== undefined ? String(validQuantity) : undefined}
          feeRates={feeQuery.data}
          idPrefix={idPrefix}
        />
      ) : null}

      <EstimatedPricePreview
        symbolId={Number(position.symbolId)}
        quantity={validQuantity !== undefined ? String(validQuantity) : undefined}
        positionType={position.positionType}
        entry="close"
        requestPrice={closePrice ?? undefined}
        markPrice={cachedMarkPrice !== undefined ? String(cachedMarkPrice) : undefined}
        pricePrecision={Number(market?.pricePrecision ?? 2)}
        idPrefix={idPrefix}
      />

      {violations.length > 0 ? <ViolationsPanel violations={violations} idPrefix={idPrefix} /> : null}

      <Button
        type="button"
        size="lg"
        disabled={!canSubmit}
        onClick={() => void handleSubmit()}
        data-testid={`${idPrefix}-submit`}
        className="w-full"
      >
        {mutation.isPending ? <Spinner className="size-4" /> : null}
        {mutation.isPending ? "Submitting…" : "Close position"}
      </Button>

      <SubmitStatus mutation={mutation} idPrefix={idPrefix} />
    </div>
  );
}

function PositionSummary({
  position,
  market,
  markPrice,
  idPrefix,
}: {
  position: ClosablePosition;
  market: Market | undefined;
  markPrice: number | string | undefined;
  idPrefix: string;
}) {
  const sideLabel = position.positionType === PositionType.LONG ? "Long" : "Short";
  const sideVariant = position.positionType === PositionType.LONG ? "positive" : "destructive";
  const quantityDec = formatUnits(position.quantity, WEI_DECIMALS);
  const closedDec = formatUnits(position.closedAmount, WEI_DECIMALS);
  const pricePrecision = Number(market?.pricePrecision ?? 2);
  const quantityPrecision = Number(market?.quantityPrecision ?? 4);

  return (
    <div
      data-testid={`${idPrefix}-position-summary`}
      className="border-border/70 bg-muted/20 grid gap-2 rounded-xl border p-4 text-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Closing</span>
        <Badge variant={sideVariant}>{sideLabel}</Badge>
      </div>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5">
        <PreviewRow label="Quote" value={`#${position.id.toString()}`} />
        <PreviewRow label="Market" value={market?.symbol ?? market?.name ?? `#${position.symbolId.toString()}`} />
        <PreviewRow
          label="Mark price"
          value={markPrice !== undefined ? formatPriceAt(String(markPrice), pricePrecision) : "—"}
        />
        <PreviewRow label="Total quantity" value={formatQuantityAt(quantityDec, quantityPrecision)} />
        <PreviewRow label="Already closed" value={formatQuantityAt(closedDec, quantityPrecision)} />
      </dl>
    </div>
  );
}

function ClosePreview({
  closePrice,
  markPrice,
  quantity,
  feeRates,
  idPrefix,
}: {
  closePrice: string;
  markPrice: string | undefined;
  quantity: string | undefined;
  feeRates: { openFee: bigint; closeFee: bigint } | undefined;
  idPrefix: string;
}) {
  const notional = useMemo(() => {
    if (markPrice === undefined || quantity === undefined) return undefined;
    return String(Number(markPrice) * Number(quantity));
  }, [markPrice, quantity]);

  const closeFeeAmount = feeRates && notional ? computeFeeAmount(feeRates.closeFee, notional) : undefined;

  return (
    <div
      data-testid={`${idPrefix}-preview`}
      className="border-border/70 bg-muted/20 grid gap-3 rounded-xl border p-4 text-sm"
    >
      <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Close preview</div>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5">
        <PreviewRow
          label="Request close price"
          value={formatDecimalUsd(closePrice)}
          testId={`${idPrefix}-preview-close-price`}
        />
        <PreviewRow
          label="Notional"
          hint="(quantity × markPrice)"
          value={notional !== undefined ? formatDecimalUsd(notional) : "—"}
          testId={`${idPrefix}-preview-notional`}
        />
        <PreviewRow
          label="Close fee"
          value={closeFeeAmount !== undefined ? formatDecimalUsd(closeFeeAmount) : "—"}
          testId={`${idPrefix}-preview-close-fee`}
        />
      </dl>
    </div>
  );
}

function ViolationsPanel({ violations, idPrefix }: { violations: CloseQuoteConstraintViolation[]; idPrefix: string }) {
  return (
    <div
      data-testid={`${idPrefix}-violations`}
      role="alert"
      className="border-destructive/30 bg-destructive/10 text-destructive flex flex-col gap-1.5 rounded-xl border px-3 py-2.5 text-sm"
    >
      <span className="text-foreground/90 font-medium">Close can&apos;t be sent yet:</span>
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

function describeViolation(violation: CloseQuoteConstraintViolation): string {
  switch (violation.kind) {
    case "CLOSE_QUANTITY_BELOW_LOT_SIZE":
      return `${capitalize(violation.side)} quantity ${formatDecimalAmount(violation.actualQuantity)} is below the market's minimum lot ${formatDecimalAmount(violation.lotSize)}.`;
    case "CLOSE_QUANTITY_NOT_LOT_MULTIPLE":
      return `${capitalize(violation.side)} quantity ${formatDecimalAmount(violation.actualQuantity)} must be an exact multiple of the lot size ${formatDecimalAmount(violation.lotSize)}.`;
    case "REMAINING_LOCKED_BELOW_MIN_QUOTE_VALUE":
      return `Remaining locked margin ${formatDecimalUsd(violation.remainingLockedSum)} (after close) is below the market minimum ${formatDecimalUsd(violation.minQuoteValue)}. Close more or close fully.`;
  }
}

function SubmitStatus({ mutation, idPrefix }: { mutation: ReturnType<typeof useInstantCloseAuto>; idPrefix: string }) {
  if (mutation.isPending) {
    return (
      <ResultNote testId={`${idPrefix}-loading`} loading>
        Signing close operation and submitting to the hedger…
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
    return (
      <ResultSuccess testId={`${idPrefix}-success`}>
        <span className="text-foreground">Close request submitted to the hedger.</span>
      </ResultSuccess>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function PreviewRow({ label, hint, value, testId }: { label: string; hint?: string; value: string; testId?: string }) {
  return (
    <>
      <dt className="text-muted-foreground inline-flex items-baseline gap-1.5">
        <span>{label}</span>
        {hint ? <span className="text-muted-foreground/70 text-[0.65rem]">{hint}</span> : null}
      </dt>
      <dd className={cn("text-foreground justify-self-end font-mono")} data-testid={testId}>
        {value}
      </dd>
    </>
  );
}

function parsePositiveNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function formatDecimalUsd(value: string): string {
  return `$${formatDecimalAmount(value)}`;
}

function formatDecimalAmount(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  return parseFloat(parsed.toFixed(4)).toString();
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

function computeFeeAmount(feeRate: bigint, notional: string): string {
  const rate = Number(feeRate) / 1e18;
  const notionalNum = Number(notional);
  if (!Number.isFinite(rate) || !Number.isFinite(notionalNum)) return "0";
  return String(rate * notionalNum);
}

function capitalize(value: string): string {
  return value.length === 0 ? value : `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

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
