"use client";

import { Button } from "@/components/button";
import { Chips } from "@/components/chips";
import { Field } from "@/components/field";
import { Modal } from "@/components/modal";
import { useToast } from "@/components/toast";
import { Numeric, ReceiptRow } from "@/components/value";
import type { PrismMarket } from "@/features/markets/types";
import { parseAmount } from "@/features/portfolio/amount";
import { GatedSubmit } from "@/features/portfolio/gated-submit";
import { useDescribeRequestError } from "@/features/sdk/describe-request-error";
import { useTradingDelegation } from "@/features/wallet/use-trading-delegation";
import { formatPnl, formatPrice, formatSize, formatUsd, fromWei, marketLabel } from "@/lib/format";
import {
  calculateQuotePnl,
  PositionType,
  validateInstantCloseAgainstMarket,
  type CloseQuoteConstraintViolation,
} from "@symmio/trading-core";
import { useLimitCloseAuto, useSolverPriceRange } from "@symmio/trading-react";
import { useMemo, useState } from "react";
import { formatUnits } from "viem";
import type { PrismQuote } from "./positions-provider";
import { useQuoteMetrics } from "./use-quote-metrics";

/** Decimals every `UnifiedQuote` amount is denominated in. */
const WEI_DECIMALS = 18;

/**
 * How long a limit close rests before the contract lets it be expired.
 *
 * Set here rather than left to the SDK's default so the sheet can say the
 * number it actually submits. It matches the SDK's own limit window; a longer
 * one has not been checked against the solver, so it is not offered as a choice.
 */
const LIMIT_CLOSE_WINDOW_SECONDS = 15 * 60;

/** Fractions of the open size offered as one-tap targets. */
const SIZE_PICKS = ["25%", "50%", "75%", "100%"] as const;

/**
 * Distances from the mark offered as one-tap targets, in the direction a close
 * improves on the mark: above it for a long (which sells), below it for a short.
 */
const LONG_PRICE_PICKS = ["Mark", "+1%", "+2%", "+5%"] as const;
const SHORT_PRICE_PICKS = ["Mark", "−1%", "−2%", "−5%"] as const;

export interface PositionLimitCloseModalProps {
  row: PrismQuote;
  /** The row's market. Required: a limit close is priced in the market's own precision. */
  market: PrismMarket;
  open: boolean;
  onClose: () => void;
}

/**
 * Close a majors position at a price the trader sets.
 *
 * A limit close is the same request as a market close with the slippage band
 * replaced by a resting price: the session key signs it, the solver relays it
 * on-chain as a close *request* at that price, and the position goes to
 * `CLOSE_PENDING` — still open, still priced, still paying funding — until the
 * solver fills it, the trader cancels it from the row, or its window runs out.
 * Nothing here is a wallet transaction, which is why the only gate on the
 * submit is the session key's delegation and never the chain the wallet is on.
 *
 * ## What the form checks, and what it does not
 *
 * The solver publishes the price band it will accept for the market, and a
 * limit outside it is rejected at submit — so the band is read and the field
 * says which edge was crossed. A price on the *wrong* side of the mark is not
 * an error: a long's limit close below the mark is a valid request that the
 * solver may fill at exactly that price, which is worse than the market. The
 * form says so and lets the trader decide, because the mark a second from now
 * may be on the other side of it.
 *
 * The size is validated the way the market close already is: against the
 * market's lot size and the minimum the remaining position must keep, using the
 * SDK's own constraint check rather than a local copy of the solver's rules.
 */
export function PositionLimitCloseModal({ row, market, open, onClose }: PositionLimitCloseModalProps) {
  const { quote, deployment } = row;
  const toast = useToast();
  const describeError = useDescribeRequestError(deployment);
  const delegation = useTradingDelegation(row.account);
  const mutation = useLimitCloseAuto();
  const metrics = useQuoteMetrics(row, market);

  const name = marketLabel(market.market.symbol, market.market.name);
  const symbol = market.market.symbol;
  const pricePrecision = market.market.pricePrecision;
  const isLong = quote.positionType === PositionType.LONG;
  const mark = metrics.mark;

  /* The band is a Rasa read and this sheet only opens on a solver that declares
     limit orders, which in the shipped registry is Rasa — so the read is
     expected to resolve. Keyed by the market's *name*: the endpoint does not
     know the display symbol. */
  const band = useSolverPriceRange({
    chainId: deployment.chainId,
    solverId: deployment.solverId,
    symbol: market.market.name,
    query: { enabled: open },
  });

  /* The exact open size as a string, never via `Number`: it is what the 100%
     chip fills in and what a full close submits. */
  const openQuantity = formatUnits(quote.openQuantity, WEI_DECIMALS);
  const [price, setPrice] = useState("");
  const [size, setSize] = useState(openQuantity);

  const priceNumber = Number(price);
  const hasPrice = price.trim() !== "";
  const isPriceValid = hasPrice && Number.isFinite(priceNumber) && priceNumber > 0;

  const bandMin = Number(band.data?.min_price);
  const bandMax = Number(band.data?.max_price);
  const hasBand = Number.isFinite(bandMin) && Number.isFinite(bandMax) && bandMax > 0;

  /* The reference app's rule, kept: the solver bounds a long's close from
     above and a short's from below. Crossing the *other* edge is not possible
     for a sensible price — a long's close far below the band minimum is only
     a very bad market close, which the warning below already covers. */
  const bandError = useMemo(() => {
    if (!isPriceValid || !hasBand) return undefined;
    if (isLong && priceNumber > bandMax) {
      return `Above what ${deployment.solverName} accepts for this market — at most ${formatPrice(bandMax, pricePrecision)}.`;
    }
    if (!isLong && priceNumber < bandMin) {
      return `Below what ${deployment.solverName} accepts for this market — at least ${formatPrice(bandMin, pricePrecision)}.`;
    }
    return undefined;
  }, [isPriceValid, hasBand, isLong, priceNumber, bandMax, bandMin, deployment.solverName, pricePrecision]);

  /* On the wrong side of the mark the request could fill at once, at a price
     the market would have beaten. Allowed, but said. */
  const crossesMark = isPriceValid && mark !== undefined && (isLong ? priceNumber < mark : priceNumber > mark);

  const distance = isPriceValid && mark !== undefined && mark > 0 ? ((priceNumber - mark) / mark) * 100 : undefined;

  const sizeWei = parseAmount(size, WEI_DECIMALS);
  const isSizeWithin = sizeWei !== undefined && sizeWei > 0n && sizeWei <= quote.openQuantity;

  /* The same check the market close runs, on the typed size rather than the
     whole position: a leftover under the lot size or the minimum quote value is
     rejected by the solver, not by the SDK, which clamps precision but does not
     validate. */
  const violations = useMemo<CloseQuoteConstraintViolation[]>(() => {
    if (!isSizeWithin) return [];
    return validateInstantCloseAgainstMarket({
      market: market.market,
      originalQuantity: openQuantity,
      closeQuantity: size,
      cva: formatUnits(quote.lockedValues.cva, WEI_DECIMALS),
      lf: formatUnits(quote.lockedValues.lf, WEI_DECIMALS),
      partyAmm: formatUnits(quote.lockedValues.partyAmm, WEI_DECIMALS),
    }).violations;
  }, [isSizeWithin, market.market, openQuantity, size, quote.lockedValues]);

  const sizeError =
    sizeWei !== undefined && sizeWei > quote.openQuantity
      ? `More than the ${formatSize(fromWei(quote.openQuantity), symbol)} open.`
      : violations[0]
        ? describeViolation(violations[0])
        : undefined;

  /* What the close is worth if it fills at the resting price — realized, not
     unrealized, because the price is fixed by the trader rather than by the
     market. A pure core calculator answers it; no feed is needed. */
  const settledOpen = quote.openedPrice !== undefined && quote.openedPrice !== 0n ? quote.openedPrice : undefined;
  const priceWei = parseAmount(price, WEI_DECIMALS);
  const estimate =
    isPriceValid && isSizeWithin && settledOpen !== undefined && priceWei !== undefined && sizeWei !== undefined
      ? calculateQuotePnl({
          positionType: quote.positionType,
          closedAmount: sizeWei,
          closedPrice: priceWei,
          openedPrice: settledOpen,
          leverage: String(metrics.leverage),
        })
      : undefined;

  const canSubmit =
    isPriceValid &&
    bandError === undefined &&
    isSizeWithin &&
    sizeError === undefined &&
    !mutation.isPending &&
    Boolean(delegation.sessionKey);

  function pickPrice(pick: string) {
    if (mark === undefined || !Number.isFinite(mark)) return;
    const percent = pick === "Mark" ? 0 : Number(pick.replace("%", "").replace("−", "-"));
    setPrice((mark * (1 + percent / 100)).toFixed(pricePrecision));
  }

  function pickSize(pick: string) {
    if (pick === "100%") {
      setSize(openQuantity);
      return;
    }
    const fraction = BigInt(pick.replace("%", ""));
    /* Truncated to the market's own precision so the number in the field is the
       number the SDK submits — it clamps the same way before signing. */
    setSize(
      truncateDecimals(
        formatUnits((quote.openQuantity * fraction) / 100n, WEI_DECIMALS),
        market.market.quantityPrecision,
      ),
    );
  }

  function submit() {
    if (!canSubmit || !delegation.sessionKey) return;

    const pending = toast.push({
      title: `Placing a limit close · ${name}…`,
      body: `${deployment.solverTag} on ${deployment.chainName}`,
      tone: "pending",
    });

    mutation.mutate(
      {
        chainId: deployment.chainId,
        solverId: deployment.solverId,
        from: delegation.sessionKey,
        /* PartyA is whichever account holds the position. A majors position
           sits on the sub-account itself; the reconciler resolved that. */
        partyA: quote.vaAddress ?? quote.partyA,
        market: {
          id: Number(quote.symbolId),
          name: market.market.name,
          pricePrecision,
          quantityPrecision: market.market.quantityPrecision,
        },
        positionType: quote.positionType,
        quoteId: quote.quoteId ?? 0n,
        quantityToClose: size,
        price,
        deadline: BigInt(Math.floor(Date.now() / 1000) + LIMIT_CLOSE_WINDOW_SECONDS),
      },
      {
        onSuccess: () => {
          toast.update(pending, {
            title: `Limit close resting · ${name}`,
            body: `Rests at ${formatPrice(priceNumber, pricePrecision)} until ${deployment.solverName} reaches it. It expires on its own in ${LIMIT_CLOSE_WINDOW_SECONDS / 60} minutes if it does not fill — cancel it from the row any time before.`,
            tone: "warn",
          });
          onClose();
        },
        onError: (error) => {
          const described = describeError(error, "Limit close rejected");
          if (described.isSilent) {
            toast.dismiss(pending);
            return;
          }
          toast.update(pending, { title: described.title, body: described.body, tone: "error" });
        },
      },
    );
  }

  const entryPrice = settledOpen === undefined ? undefined : fromWei(settledOpen);

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={`${deployment.label} · ${row.account.name}`}
      title={`Limit close · ${name}`}
      footer={
        delegation.isActive ? (
          <>
            {/* Not gated on the chain: the request is signed by the session
                key and relayed to the solver over HTTP, so the browser wallet
                is never asked for anything. Only the grant below it is a
                transaction. */}
            <Button
              variant="primary"
              size="lg"
              onClick={submit}
              disabled={!canSubmit}
              loading={mutation.isPending}
              className="w-full"
            >
              Place limit close
            </Button>
            <span className="text-center text-2xs leading-relaxed text-fg-3">
              Signed by your session key, no wallet prompt. The position stays open until the close fills — cancel it
              from the row at any time.
            </span>
          </>
        ) : (
          <>
            <GatedSubmit
              deployment={deployment}
              label={delegation.sessionKey ? "Enable trading" : "Create a session key first"}
              onSubmit={delegation.grant}
              disabled={!delegation.sessionKey || delegation.isLoading}
              loading={delegation.isGranting}
              size="lg"
              className="w-full"
            />
            <span className="text-center text-2xs leading-relaxed text-fg-3">
              A limit close is signed by your session key, so this account has to authorise it first. That grant is the
              only wallet transaction here.
            </span>
            {delegation.error ? (
              <span className="text-center text-2xs text-short">{delegation.error.message}</span>
            ) : null}
          </>
        )
      }
    >
      <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
        <ReceiptRow
          label="Position"
          value={
            <span className="flex items-center justify-end gap-2">
              <span
                className="text-sm font-semibold"
                style={{ color: isLong ? "var(--long-500)" : "var(--short-500)" }}
              >
                {isLong ? "Long" : "Short"}
              </span>
              <Numeric size="sm" tone="strong">
                {formatSize(fromWei(quote.openQuantity), symbol)}
              </Numeric>
            </span>
          }
        />
        <ReceiptRow
          label="Entry"
          value={
            <Numeric size="sm" tone={entryPrice === undefined ? "muted" : undefined}>
              {entryPrice === undefined ? "—" : formatPrice(entryPrice, pricePrecision)}
            </Numeric>
          }
        />
        <ReceiptRow
          label="Mark"
          value={
            mark === undefined ? (
              <Numeric size="sm" tone="muted">
                —
              </Numeric>
            ) : (
              <Numeric size="sm" tone="strong">
                {formatPrice(mark, pricePrecision)}
              </Numeric>
            )
          }
        />
      </div>

      <div className="flex flex-col gap-2">
        <Field
          label="Limit price"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          inputMode="decimal"
          placeholder={mark === undefined ? "0.00" : formatPrice(mark, pricePrecision)}
          disabled={mutation.isPending}
          invalid={Boolean(bandError)}
          hint={
            distance === undefined ? (
              `${isLong ? "sells" : "buys"} to close`
            ) : (
              <span className="tnum" style={{ color: crossesMark ? "var(--warn-500)" : undefined }}>
                {distance >= 0 ? "+" : "−"}
                {Math.abs(distance).toFixed(2)}% from mark
              </span>
            )
          }
          footnote={
            bandError ? (
              <span className="text-short">{bandError}</span>
            ) : crossesMark ? (
              <span className="text-warn">
                {isLong ? "Below" : "Above"} the mark. {deployment.solverName} may fill this at once, at your price —
                which the market would have beaten. Use Close for a market fill.
              </span>
            ) : hasBand ? (
              `${deployment.solverName} accepts ${formatPrice(bandMin, pricePrecision)} – ${formatPrice(bandMax, pricePrecision)} right now.`
            ) : (
              `Rests with ${deployment.solverName} until the market reaches it.`
            )
          }
        />
        <Chips options={isLong ? LONG_PRICE_PICKS : SHORT_PRICE_PICKS} onChange={pickPrice} />
      </div>

      <div className="flex flex-col gap-2">
        <Field
          label="Size"
          value={size}
          onChange={(event) => setSize(event.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          disabled={mutation.isPending}
          invalid={Boolean(sizeError)}
          adornment={symbol ? <span className="font-mono text-sm text-fg-2">{symbol}</span> : undefined}
          hint={
            <>
              OPEN{" "}
              <Numeric size="sm" tone="muted">
                {formatSize(fromWei(quote.openQuantity), symbol)}
              </Numeric>
            </>
          }
          footnote={
            sizeError ? (
              <span className="text-short">{sizeError}</span>
            ) : sizeWei !== undefined && sizeWei < quote.openQuantity ? (
              `Leaves ${formatSize(fromWei(quote.openQuantity - sizeWei), symbol)} open after the fill.`
            ) : (
              "Closes the whole position when it fills."
            )
          }
        />
        <Chips options={SIZE_PICKS} value={size === openQuantity ? "100%" : undefined} onChange={pickSize} />
      </div>

      <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
        <ReceiptRow
          label="Closes at"
          value={
            <Numeric size="sm" tone={isPriceValid ? "strong" : "muted"}>
              {isPriceValid ? formatPrice(priceNumber, pricePrecision) : "—"}
            </Numeric>
          }
        />
        <ReceiptRow
          label="P&L if filled"
          value={
            estimate === undefined ? (
              <Numeric size="sm" tone="muted">
                —
              </Numeric>
            ) : (
              <Numeric size="sm" signed={Number(estimate.pnl)}>
                {formatPnl(Number(estimate.pnl))}
              </Numeric>
            )
          }
        />
        <ReceiptRow
          label="Rests for"
          value={
            <span className="text-sm text-fg-1">
              up to <span className="tnum">{LIMIT_CLOSE_WINDOW_SECONDS / 60} min</span>
            </span>
          }
        />
      </div>

      <p className="text-2xs leading-relaxed text-fg-3">
        The request is written on-chain at your price and the position goes to{" "}
        <span className="text-fg-2">Close pending</span> — still open, still priced, still paying funding — until{" "}
        {deployment.solverName} fills it. If it has not filled in {LIMIT_CLOSE_WINDOW_SECONDS / 60} minutes it expires
        and the position is simply open again.
      </p>
    </Modal>
  );
}

/** One of the SDK's close constraints, in the sheet's own voice. */
function describeViolation(violation: CloseQuoteConstraintViolation): string {
  switch (violation.kind) {
    case "CLOSE_QUANTITY_BELOW_LOT_SIZE":
      return violation.side === "close"
        ? `Below the market's lot size of ${violation.lotSize}.`
        : `Would leave less than the lot size (${violation.lotSize}) open. Close the whole position instead.`;
    case "CLOSE_QUANTITY_NOT_LOT_MULTIPLE":
      return violation.side === "close"
        ? `Must be a multiple of the lot size (${violation.lotSize}).`
        : `Would leave a remainder that is not a multiple of the lot size (${violation.lotSize}).`;
    case "REMAINING_LOCKED_BELOW_MIN_QUOTE_VALUE":
      return `Would leave ${formatUsd(violation.remainingLockedSum, { exact: true })} of margin open, under the market's ${formatUsd(violation.minQuoteValue, { exact: true })} minimum. Close the whole position instead.`;
  }
}

/** Cut a decimal string to `decimals` places without rounding. */
function truncateDecimals(value: string, decimals: number): string {
  const [whole, fraction = ""] = value.split(".");
  if (decimals <= 0 || fraction.length === 0) return whole ?? "0";
  const kept = fraction.slice(0, decimals).replace(/0+$/, "");
  return kept ? `${whole}.${kept}` : (whole ?? "0");
}
