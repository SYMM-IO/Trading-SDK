"use client";

import {
  calculateTradeParams,
  PositionType,
  prepareInstantOpenParamsQueryOptions,
  type ConfigParameter,
  type InstantOpenParameters,
  type PrepareInstantOpenParamsOptions,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useEstimatedPrice } from "../estimated-price/use-estimated-price";
import { useFeeForUser } from "../fees/use-fee-for-user";
import { useLockedParams } from "../locked-params/use-locked-params";
import { useMarkets } from "../markets/use-markets";
import { usePriceByName } from "../price-service/use-price-by-name";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link usePrepareInstantOpenParams}: the same trade intent the
 * submit takes (`subAccountAddress`, `from`, `market`, `positionType`,
 * `initialMargin` **or** `fund`, `leverage`, optional `slippage` / pre-fetched
 * data, TanStack `query` overrides) plus an optional `config`.
 */
export type UsePrepareInstantOpenParamsParameters = PrepareInstantOpenParamsOptions & ConfigParameter;

/**
 * Return type of {@link usePrepareInstantOpenParams}: the query result carrying
 * the prepared {@link InstantOpenParameters}, plus the dry-run estimate the
 * params were built with.
 */
export type UsePrepareInstantOpenParamsReturnType = UseQueryResult<InstantOpenParameters, SymmioRequestError> & {
  /**
   * The dry-run estimate the preview was built with (`undefined` when none was
   * usable). Forward it as `estimatedOpenPrice` to the submit so its
   * `margin.amount` — whose settlement leg tracks the estimate — matches this
   * preview bit-for-bit.
   */
  estimatedOpenPrice: string | undefined;
};

/**
 * Live-preview the exact {@link InstantOpenParameters} an instant-open submit
 * will sign — `order` (price + quantity), `lockedParam`, `margin.amount`, and
 * `solverFeeCaps` — by running `prepareInstantOpenParams` as a read.
 * `prepareInstantOpenParams` neither signs nor submits, so this is safe to run
 * live; drive a "quote preview" from it and what the user sees is bit-for-bit
 * what `sendQuote` receives, with no separate local recomputation to drift.
 *
 * Like {@link useInstantOpenFees}, it **pre-fetches every input through its own
 * cached queries** (market metadata, mark price, locked params, on-chain fee
 * rates, and the lowcap dry-run estimate) and passes them in as prefills, so the
 * query function is pure and does no per-render network. Previous data is kept
 * while inputs move, so a mark-price tick updates the numbers in place.
 *
 * For bit-for-bit parity on `margin.amount`, forward {@link
 * UsePrepareInstantOpenParamsReturnType.estimatedOpenPrice} to the submit call
 * (`useInstantOpenAuto` / `useInstantOpenWithTpSl`) as `estimatedOpenPrice`, so
 * both the preview and the send provision settlement at the same estimate. The
 * `order` and `lockedParam` fields already match without freezing — they do not
 * depend on the estimate.
 *
 * @example
 * ```tsx
 * const preview = usePrepareInstantOpenParams({
 *   subAccountAddress,
 *   from: sessionKey,
 *   market: { id: symbolId },
 *   positionType,
 *   initialMargin,
 *   leverage,
 *   slippage,
 * });
 * // preview.data?.order.quantity — the exact leveraged quantity (wei) the send signs
 * // submit: mutate({ …, estimatedOpenPrice: preview.estimatedOpenPrice })
 * ```
 */
export function usePrepareInstantOpenParams(
  parameters: UsePrepareInstantOpenParamsParameters,
): UsePrepareInstantOpenParamsReturnType {
  const config = useSymmioConfig(parameters);
  const contextChainId = useSymmioChainId();
  const chainId = parameters.chainId ?? contextChainId;
  const { subAccountAddress, market, positionType, initialMargin, fund, leverage, slippage, solverId } = parameters;
  const isFullBalance = fund !== undefined;
  /** The amount driving the sizing math — the typed margin, or the whole balance in full-balance mode. */
  const sizingInput = isFullBalance ? fund.balance : (initialMargin ?? "");
  const enabled = (parameters.query?.enabled ?? true) && sizingInput.length > 0;

  /** The dry-run estimate exists only on lowcap (Enigma) solvers. */
  const isLowcap = config.getSolver({ chainId, solverId }).id === "enigma";

  // Market metadata — slow-moving; dedupes with any other useMarkets on the page.
  const marketsQuery = useMarkets({
    config: parameters.config,
    chainId,
    solverId,
    query: { enabled, staleTime: 300_000 },
  });
  const resolvedMarket = marketsQuery.data?.find((entry) => entry.symbolId === market.id);
  const marketName = market.name ?? resolvedMarket?.name;
  const pricePrecision = market.pricePrecision ?? resolvedMarket?.pricePrecision;
  const quantityPrecision = market.quantityPrecision ?? resolvedMarket?.quantityPrecision;
  const hedgerFeeOpen = market.hedgerFeeOpen ?? resolvedMarket?.hedgerFeeOpen;
  const hedgerFeeClose = market.hedgerFeeClose ?? resolvedMarket?.hedgerFeeClose;

  // Time-decaying close-fee rates ride the same `useMarkets` read — Enigma-only
  // fields on `EnigmaMarket`, so narrow on `kind` before reading.
  const resolvedEnigmaMarket = resolvedMarket?.kind === "enigma" ? resolvedMarket : undefined;
  const hedgerFeeCloseEarlyRate =
    market.hedgerFeeCloseEarlyRate ?? resolvedEnigmaMarket?.hedgerFeeCloseEarlyRate ?? hedgerFeeClose;
  const hedgerFeeCloseEarlyThreshold =
    market.hedgerFeeCloseEarlyThreshold ?? resolvedEnigmaMarket?.hedgerFeeCloseEarlyThreshold ?? 0;
  const hedgerFeeCloseStandardThreshold =
    market.hedgerFeeCloseStandardThreshold ?? resolvedEnigmaMarket?.hedgerFeeCloseStandardThreshold ?? 0;

  // Quote constraints — full-balance sizing snaps to the lot grid and checks the
  // published floors; they ride the same `useMarkets` read.
  const minAcceptablePortionLf = market.minAcceptablePortionLf ?? resolvedMarket?.minAcceptablePortionLf;
  const minAcceptableQuoteValue = market.minAcceptableQuoteValue ?? resolvedMarket?.minAcceptableQuoteValue;
  const maxNotionalValue = market.maxNotionalValue ?? resolvedMarket?.maxNotionalValue;
  const minNotionalValue = market.minNotionalValue ?? resolvedMarket?.minNotionalValue;
  const maxQuantity = market.maxQuantity ?? resolvedMarket?.maxQuantity;
  const lotSize = market.lotSize ?? resolvedMarket?.lotSize;
  const constraintsReady =
    !isFullBalance ||
    (minAcceptablePortionLf !== undefined &&
      minAcceptableQuoteValue !== undefined &&
      maxNotionalValue !== undefined &&
      minNotionalValue !== undefined &&
      maxQuantity !== undefined &&
      lotSize !== undefined);

  // Locked-param percents — `prepareInstantOpenParams` always needs them to build
  // the signed `lockedParam` (both funding modes), so they are always prefilled.
  const lockedParamsQuery = useLockedParams({
    config: parameters.config,
    chainId,
    solverId,
    symbol: marketName ?? "",
    leverage,
    query: {
      enabled: enabled && parameters.lockedParamPercent === undefined && marketName !== undefined,
      staleTime: 300_000,
    },
  });
  const lockedParamPercent =
    parameters.lockedParamPercent ??
    (lockedParamsQuery.data
      ? {
          // The resolver skips its fetch only when all four fields are present —
          // mirror its `"0"` defaults for fields the solver omits.
          cva: lockedParamsQuery.data.cva ?? "0",
          lf: lockedParamsQuery.data.lf ?? "0",
          partyAmm: lockedParamsQuery.data.partyAmm ?? "0",
          partyBmm: lockedParamsQuery.data.partyBmm ?? "0",
        }
      : undefined);
  const lockedParamsReady = lockedParamPercent !== undefined;

  // On-chain platform fee rates — contract state, changes rarely; cached hard.
  const feeQuery = useFeeForUser({
    config: parameters.config,
    chainId,
    user: subAccountAddress,
    symbolId: BigInt(market.id),
    query: { enabled: enabled && parameters.feeRates === undefined, staleTime: 300_000 },
  });
  const feeRates = parameters.feeRates ?? feeQuery.data;

  // Mark price — caller's cache-hot value wins; otherwise the shared stream.
  const priceQuery = usePriceByName({
    name: marketName,
    solverId,
    enabled: enabled && parameters.markPrice === undefined,
  });
  const markPrice = parameters.markPrice ?? priceQuery.markPrice ?? undefined;

  // Lowcap dry-run estimate: mark-sized quantity, wide fixed request bound so the
  // solver's price gate never rejects the question. Debounced internally.
  const estimateQuantity = useMemo(() => {
    if (!enabled || !isLowcap || markPrice === undefined) return "";
    if (pricePrecision === undefined || quantityPrecision === undefined) return "";
    const sized = calculateTradeParams({
      markPrice,
      slippage: 0,
      positionType,
      userInput: sizingInput,
      inputField: "PRICE",
      leverage,
      pricePrecision,
      quantityPrecision,
    });
    return sized?.quantity ?? "";
  }, [enabled, isLowcap, markPrice, pricePrecision, quantityPrecision, positionType, sizingInput, leverage]);
  const estimateRequestPrice =
    markPrice !== undefined ? String(Number(markPrice) * (positionType === PositionType.SHORT ? 0.5 : 1.5)) : "";
  const estimateQuery = useEstimatedPrice({
    config: parameters.config,
    chainId,
    solverId,
    symbolId: market.id,
    quantity: estimateQuantity,
    positionType,
    entry: "open",
    price: estimateRequestPrice,
    query: {
      enabled: enabled && isLowcap && parameters.estimatedOpenPrice === undefined && estimateQuantity.length > 0,
      staleTime: 30_000,
    },
  });
  // `prepareInstantOpenParams` runs the slippage gate, which rejects a zero/`"0"`
  // fill — so unlike the fees action it must receive a *real* estimate or
  // `undefined`, never the `"0"` sentinel. An unusable estimate falls to
  // `undefined`: the params still build (gate skipped, zero settlement), and the
  // submit fed the same `undefined` provisions identically.
  const resolvedEstimate = !isLowcap
    ? undefined
    : (parameters.estimatedOpenPrice ?? estimateQuery.data?.estimatedPrice);
  const estimatedOpenPrice = resolvedEstimate && resolvedEstimate !== "0" ? resolvedEstimate : undefined;
  const estimateSettled =
    !isLowcap || parameters.estimatedOpenPrice !== undefined || estimateQuery.isFetched || estimateQuery.isError;

  // Every prefill present → the query function is pure, zero fetches.
  const ready =
    enabled &&
    marketName !== undefined &&
    pricePrecision !== undefined &&
    quantityPrecision !== undefined &&
    feeRates !== undefined &&
    markPrice !== undefined &&
    lockedParamsReady &&
    (!isLowcap || (hedgerFeeOpen !== undefined && hedgerFeeClose !== undefined)) &&
    constraintsReady &&
    estimateSettled;

  const options = prepareInstantOpenParamsQueryOptions(config, {
    subAccountAddress,
    from: parameters.from,
    solverId,
    chainId,
    market: {
      id: market.id,
      name: marketName,
      pricePrecision,
      quantityPrecision,
      hedgerFeeOpen,
      hedgerFeeClose,
      hedgerFeeCloseEarlyRate,
      hedgerFeeCloseEarlyThreshold,
      hedgerFeeCloseStandardThreshold,
      minAcceptablePortionLf,
      minAcceptableQuoteValue,
      maxNotionalValue,
      minNotionalValue,
      maxQuantity,
      lotSize,
    },
    positionType,
    initialMargin,
    fund,
    leverage,
    slippage,
    markPrice,
    feeRates,
    estimatedOpenPrice,
    lockedParamPercent,
    query: {
      ...parameters.query,
      enabled: ready,
      // Inputs (mark price, estimate) tick often; keep showing the previous
      // params while the pure recompute runs instead of flashing a loader.
      placeholderData: (previous: InstantOpenParameters | undefined) => previous,
    },
  });

  const query = useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseQueryResult<InstantOpenParameters, SymmioRequestError>;

  return { ...query, estimatedOpenPrice } as UsePrepareInstantOpenParamsReturnType;
}
