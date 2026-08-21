"use client";

import type { FundingAccount } from "@/features/accounts/account-provider";
import type { PrismMarket } from "@/features/markets/types";
import { useMarkPrice } from "@/features/prices/price-provider";
import {
  PositionType,
  calculateLiquidationPrice,
  calculatePriceImpact,
  calculateTradeParams,
  computePlatformFee,
  supportsEstimatedPrice,
  validateInstantOpenAgainstMarket,
  type CalculateTradeParamsReturnType,
  type FeeForUser,
  type GetLockedParamsReturnType,
  type MarketNotionalCap,
  type QuoteConstraintViolation,
} from "@symmio/trading-core";
import {
  useAvailableInstantOpenMargin,
  useCheckSolverWhitelist,
  useEstimatedPrice,
  useFeeForUser,
  useLockedParams,
  useNotionalCapBySymbolId,
  useSolverPriceRange,
  useSolverReadiness,
  useSymmioConfig,
} from "@symmio/trading-react";
import { useMemo } from "react";
import { formatUnits, parseUnits, zeroAddress } from "viem";

/** How the margin field's number is denominated. */
export type MarginUnit = "usd" | "asset";

/** Everything the trade form knows before the SDK is asked anything. */
export interface TicketIntent {
  market: PrismMarket;
  account: FundingAccount | undefined;
  side: PositionType;
  /** The number in the margin field, as typed. */
  margin: string;
  /** What that number denominates. */
  unit: MarginUnit;
  leverage: number;
  /** Slippage tolerance, percent. */
  slippage: number;
  orderType: "market" | "limit";
  /** The resting price, when `orderType` is `limit`. */
  limitPrice: string;
}

/** Spendable margin, with "not known yet" kept distinct from "zero". */
export interface AvailableMargin {
  /** `undefined` until the balance and fee reads both resolve. */
  wei: bigint | undefined;
  /** The same figure as a number. Meaningless unless {@link isKnown}. */
  usd: number;
  /** True only when the ceiling is a fact, not a placeholder. */
  isKnown: boolean;
  isLoading: boolean;
  error: Error | null;
}

/** A precondition the deployment itself imposes, beyond the user's inputs. */
export interface SolverGate {
  /** The solver is not accepting orders right now. */
  offline: boolean;
  /** This account is not whitelisted with the solver, and the solver requires it. */
  needsWhitelist: boolean;
  /** True while either probe is still resolving. */
  isLoading: boolean;
}

export interface TicketModel {
  /** The price the order is sized against: the limit price, or the live mark. */
  referencePrice: number | undefined;
  /** Live mark, for the "vs mark" comparison. */
  markPrice: number | undefined;
  /** The SDK's own trade math — the numbers that will actually be signed. */
  trade: CalculateTradeParamsReturnType | null;
  /**
   * The collateral figure to submit as `initialMargin`, as a decimal string.
   *
   * In `usd` mode that is the typed number; in `asset` mode the SDK derives it
   * from the token amount, so it must be read off the trade rather than echoed.
   */
  initialMargin: string;
  /** The solver's locked-margin percentages for this market and leverage. */
  lockedParams: GetLockedParamsReturnType | undefined;
  /** On-chain fee rates for this account and market. */
  feeRates: FeeForUser | undefined;
  /** Round-trip platform fee for this order, as a decimal string. */
  fee: string | undefined;
  /** Every market/cap constraint this order breaks, named by the SDK. */
  violations: readonly QuoteConstraintViolation[];
  available: AvailableMargin;
  notionalCap: MarketNotionalCap | undefined;
  /** The solver's own explanation when it declines to publish a cap. */
  capError: string | undefined;
  /** Estimated fill price, where the solver quotes one for a size. */
  estimatedPrice: number | undefined;
  /** Signed impact percent of that estimate against the mark. */
  priceImpact: number | undefined;
  /** The band a Rasa solver will accept, where it publishes one. */
  priceBand: { min: number; max: number } | undefined;
  /** Projected liquidation price of the position this order would open. */
  liquidationPrice: number | undefined;
  solver: SolverGate;
  /** True once the solver's locked-param percentages have loaded. */
  isReady: boolean;
  /** The market is not accepting this order right now, with the reason. */
  marketClosed: string | undefined;
}

/**
 * Everything the SDK can say about an order **before** it is signed.
 *
 * The ticket used to do this arithmetic itself — quantity as `notional / mark`,
 * a liquidation price of `price ± price / leverage`, and no constraint check at
 * all — so the numbers on screen were not the numbers being signed, and a
 * violation of `lotSize`, `minAcceptableQuoteValue` or the solver's notional cap
 * surfaced as a rejection *after* the wallet prompt.
 *
 * Every figure here comes from the SDK's own kernel:
 *
 * - `calculateTradeParams` — the exact `requestedOpenPrice`, `quantity`, `cva`,
 *   `lf` and `partyAmm` that `prepareInstantOpenParams` derives internally.
 * - `validateInstantOpenAgainstMarket` — the one function that turns the
 *   market's published limits plus the live notional cap into named,
 *   renderable violations.
 * - `computePlatformFee` — the open + close fee `useAvailableInstantOpenMargin`
 *   already subtracts from the ceiling, made visible instead of implicit.
 * - `calculateLiquidationPrice` — the protocol's formula over the position this
 *   order would create, not a leverage rule of thumb.
 *
 * ## Where the two solvers differ
 *
 * Nothing here branches on a solver id. The three places the deployments
 * genuinely diverge are each answered by an SDK predicate or a discriminated
 * union: `supportsEstimatedPrice` decides whether a fill can be quoted for a
 * size, the price band is a Rasa-only read gated on the resolved solver kind,
 * and the notional cap arrives as a union whose Enigma arm carries side-by-side
 * availability while its Rasa arm carries only a total.
 */
export function useTicketModel(intent: TicketIntent): TicketModel {
  const { market: entry, account, side, margin, unit, leverage, slippage, orderType, limitPrice } = intent;
  const { chainId, solverId } = entry.deployment;
  const market = entry.market;
  const config = useSymmioConfig();

  const markPrice = useMarkPrice(entry.family, market.name);

  /* A limit order rests at the price the user names, so that — not the mark —
     sizes the order and is what the constraints are checked against. */
  const typedLimit = Number(limitPrice);
  const referencePrice =
    orderType === "limit" && Number.isFinite(typedLimit) && typedLimit > 0 ? typedLimit : markPrice;

  /* `symbol` here is the market's full NAME, decoration and all — that is what
     `prepareInstantOpenParams` passes internally, so using the same value makes
     the preview and the signed quote share one cache entry instead of
     disagreeing. The `enabled` guard is not optional: the query-options factory
     has no auto-disable, and an empty symbol is a 404, not an empty result. */
  const locked = useLockedParams({
    chainId,
    solverId,
    symbol: market.name,
    leverage,
    query: { enabled: Boolean(market.name) && leverage > 0 },
  });

  /* Fees are chain-scoped, not solver-scoped: they come off the SYMMIO core
     contract for this account and symbol, not from the solver's API. */
  const fees = useFeeForUser({
    chainId,
    user: account?.address ?? zeroAddress,
    symbolId: market.symbolId,
    query: { enabled: Boolean(account) },
  });

  const cap = useNotionalCapBySymbolId({ chainId, solverId, symbolId: market.symbolId });

  /* The ceiling is a solver policy, not a balance: Rasa reserves 10% of a
     cross-margin account, VA isolations shave fees and worst-case slippage. */
  const availableQuery = useAvailableInstantOpenMargin({
    account: account?.address,
    symbolId: market.symbolId,
    leverage,
    positionType: side,
    slippage,
    chainId,
    solverId,
  });

  const available = useMemo<AvailableMargin>(() => {
    const wei = availableQuery.availableMarginWei;
    return {
      wei,
      usd: wei === undefined ? 0 : Number(formatUnits(wei, 18)),
      /* `availableMargin` is the string `"0"` when the account is empty, when
         the reads have not landed, when they errored, and — on the cross-margin
         path — until the price socket has priced every open position. Only the
         wei field separates "zero" from "not yet known", and that difference is
         the whole guard: treating unknown as zero lets an order through that the
         solver will certainly reject. */
      isKnown: wei !== undefined,
      isLoading: availableQuery.isLoading,
      error: availableQuery.error,
    };
  }, [availableQuery.availableMarginWei, availableQuery.isLoading, availableQuery.error]);

  const trade = useMemo(() => {
    if (!referencePrice || referencePrice <= 0) return null;
    return calculateTradeParams({
      markPrice: String(referencePrice),
      /* A limit order is placed at its own price — there is no slippage leg to
         apply, and `prepareLimitOpenParams` passes `slippage: 0` for exactly
         this reason. */
      slippage: orderType === "limit" ? 0 : slippage,
      positionType: side,
      userInput: margin,
      /* The unit switch is not cosmetic: it selects which side of the SDK's own
         input model the typed number lands on. `PRICE` means USD collateral;
         `TOKEN` means the same collateral denominated in the base asset. */
      inputField: unit === "usd" ? "PRICE" : "TOKEN",
      leverage,
      pricePrecision: market.pricePrecision,
      quantityPrecision: market.quantityPrecision,
      cvaPercent: locked.data?.cva,
      lfPercent: locked.data?.lf,
      partyAmmPercent: locked.data?.partyAmm,
      partyBmmPercent: locked.data?.partyBmm,
    });
  }, [referencePrice, orderType, slippage, side, margin, unit, leverage, market, locked.data]);

  /* `initialMargin` is always USD collateral. In asset mode the SDK has already
     converted it — `notionalBasic` is the un-leveraged notional, which is the
     collateral figure — so read it back rather than re-deriving it here. */
  const initialMargin = unit === "usd" ? margin : (trade?.notionalBasic ?? "");

  const fee = useMemo(() => {
    if (!trade || !fees.data) return undefined;
    return computePlatformFee(fees.data, trade.notional, trade.notional);
  }, [trade, fees.data]);

  const violations = useMemo<readonly QuoteConstraintViolation[]>(() => {
    /* Without locked params the cva/lf/partyAmm legs are all "0", which the
       validator reads as "unpublished" and skips — so checking early would
       report a clean order that has not actually been checked. */
    if (!trade || !referencePrice || !locked.data) return [];
    return validateInstantOpenAgainstMarket({
      market,
      quantity: trade.quantity,
      markPrice: String(referencePrice),
      cva: trade.cva,
      lf: trade.lf,
      partyAmm: trade.partyAmm,
      notionalCap: cap.data,
      /* Required, or the cap arm never runs — the check is per side. */
      positionType: side,
    }).violations;
  }, [trade, referencePrice, locked.data, market, cap.data, side]);

  /**
   * "What will this fill at?" has two shapes, and neither is a fallback.
   *
   * Enigma quotes an estimate for a specific quantity; Rasa publishes the band
   * it will accept for the market. `supportsEstimatedPrice` is the SDK's own
   * answer to which one this deployment offers, so the ticket asks it rather
   * than comparing solver ids.
   */
  const canEstimate = useMemo(() => {
    try {
      return supportsEstimatedPrice(config, { chainId, solverId });
    } catch {
      return false;
    }
  }, [config, chainId, solverId]);

  const isRasa = useMemo(() => {
    try {
      return config.getSolver({ chainId, solverId }).id === "rasa";
    } catch {
      return false;
    }
  }, [config, chainId, solverId]);

  const estimate = useEstimatedPrice({
    chainId,
    solverId,
    symbolId: market.symbolId,
    /* The precision-trimmed quantity and the slippage-adjusted request price —
       the endpoint documents `price` as the request price, not the raw mark, so
       passing the mark prices the wrong trade. */
    quantity: trade?.quantity ?? "0",
    positionType: side,
    entry: "open",
    price: trade?.requestedOpenPrice ?? "0",
    query: { enabled: canEstimate && Boolean(trade) },
  });

  const priceRange = useSolverPriceRange({
    chainId,
    solverId,
    symbol: market.name,
    query: { enabled: isRasa },
  });

  const readiness = useSolverReadiness({
    chainId,
    solverId,
    query: { enabled: isRasa, refetchInterval: 30_000 },
  });

  const whitelist = useCheckSolverWhitelist({
    address: account?.address ?? zeroAddress,
    chainId,
    solverId,
    query: { enabled: isRasa && Boolean(account) },
  });

  const estimatedPrice = useMemo(() => {
    const value = Number(estimate.data?.estimatedPrice);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }, [estimate.data]);

  const priceImpact = useMemo(() => {
    if (estimatedPrice === undefined || !markPrice) return undefined;
    return calculatePriceImpact({ estimatedPrice: String(estimatedPrice), referencePrice: String(markPrice) });
  }, [estimatedPrice, markPrice]);

  const priceBand = useMemo(() => {
    const min = Number(priceRange.data?.min_price);
    const max = Number(priceRange.data?.max_price);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= 0) return undefined;
    return { min, max };
  }, [priceRange.data]);

  const liquidationPrice = useMemo(() => {
    if (!trade) return undefined;
    const marginWei = toWei(initialMargin);
    if (marginWei === undefined || marginWei <= 0n) return undefined;

    /* The protocol's own formula over the position this order would create.
       For a VA-isolated market that IS the whole liquidation domain; on a
       cross-margin account it is this position considered alone, which is why
       the ticket labels it as the order's projection and the portfolio shows
       the account-level figure separately. */
    const price = calculateLiquidationPrice({
      positions: [{ quantity: toWei(trade.quantity) ?? 0n, openedPrice: toWei(trade.requestedOpenPrice) ?? 0n }],
      positionType: side,
      allocatedBalance: marginWei,
      lockedCVA: toWei(trade.cva) ?? 0n,
      lockedLF: toWei(trade.lf) ?? 0n,
    });

    if (price <= 0n) return undefined;
    return Number(formatUnits(price, 18));
  }, [trade, initialMargin, side]);

  /**
   * Enigma publishes a per-market trading state and an allowed side; Rasa does
   * not, and its type has no such fields. Narrowing on `kind` is how the SDK
   * says so — the check is skipped for a Rasa market rather than defaulted.
   */
  const marketClosed = useMemo(() => {
    if (!market.rfqAllowed) return "This market does not accept instant orders.";
    if (market.kind === "enigma") {
      if (market.state === 0) return "The solver has this market disabled.";
      if (market.state === 1) return "Close-only — this market is not accepting opens.";
      if (market.side === "long" && side === PositionType.SHORT) return "This market is long-only.";
      if (market.side === "short" && side === PositionType.LONG) return "This market is short-only.";
    }
    return undefined;
  }, [market, side]);

  const capError = cap.data?.kind === "enigma" ? (cap.data.error ?? undefined) : undefined;

  return {
    referencePrice,
    markPrice,
    trade,
    initialMargin,
    lockedParams: locked.data,
    feeRates: fees.data,
    fee,
    violations,
    available,
    notionalCap: cap.data,
    capError,
    estimatedPrice,
    priceImpact,
    priceBand,
    liquidationPrice,
    solver: {
      offline: isRasa && readiness.data?.isReady === false,
      needsWhitelist: isRasa && whitelist.data === false,
      isLoading: isRasa && (readiness.isLoading || whitelist.isLoading),
    },
    isReady: locked.isSuccess,
    marketClosed,
  };
}

/** Decimal string → 18-decimal wei, or `undefined` when it is not a number. */
function toWei(value: string): bigint | undefined {
  const trimmed = value.trim();
  if (!trimmed || !Number.isFinite(Number(trimmed))) return undefined;
  try {
    return parseUnits(trimmed, 18);
  } catch {
    return undefined;
  }
}

/**
 * A market/cap violation, rendered as a sentence a trader can act on.
 *
 * The SDK returns a discriminated union rather than a message so the consumer
 * owns the wording — and the `switch` deliberately has no `default`, so a new
 * violation kind in a future SDK release is a compile error here rather than a
 * blank bullet in the ticket.
 */
export function describeViolation(violation: QuoteConstraintViolation, symbol: string): string {
  switch (violation.kind) {
    case "LF_PORTION_TOO_LOW":
      return `The liquidation-fee portion of this order (${violation.actualPortion}) is under the market minimum ${violation.minPortion}. Raise the size or lower the leverage.`;
    case "QUOTE_VALUE_TOO_LOW":
      return `Locked margin ${money(violation.actualQuoteValue)} is under this market's minimum quote value ${money(violation.minQuoteValue)}.`;
    case "NOTIONAL_TOO_HIGH":
      return `Order value ${money(violation.actualNotional)} is over the market maximum ${money(violation.maxNotional)}.`;
    case "NOTIONAL_TOO_LOW":
      return `Order value ${money(violation.actualNotional)} is under the market minimum ${money(violation.minNotional)}.`;
    case "QUANTITY_TOO_HIGH":
      return `Size ${violation.actualQuantity} ${symbol} is over the market maximum ${violation.maxQuantity} ${symbol}.`;
    case "QUANTITY_BELOW_LOT_SIZE":
      return `Size ${violation.actualQuantity} ${symbol} is under the ${violation.lotSize} ${symbol} lot size.`;
    case "QUANTITY_NOT_LOT_MULTIPLE":
      return `Size ${violation.actualQuantity} ${symbol} is not a multiple of the ${violation.lotSize} ${symbol} lot size.`;
    case "CAP_REACHED":
      return `The solver's ${violation.side === PositionType.LONG ? "long" : "short"} cap has ${money(violation.available)} left; this order needs ${money(violation.actualNotional)}.`;
  }
}

/** Round a decimal-string figure to something readable inside a sentence. */
function money(value: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return `$${numeric.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}
