"use client";

import {
  calculateTradeParams,
  getInstantOpenFeesQueryOptions,
  PositionType,
  type ConfigParameter,
  type GetInstantOpenFeesOptions,
  type GetInstantOpenFeesReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useEstimatedPrice } from "../estimated-price/use-estimated-price";
import { useFeeForUser } from "../fees/use-fee-for-user";
import { useMarkets } from "../markets/use-markets";
import { usePriceByName } from "../price-service/use-price-by-name";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useInstantOpenFees}: the trade intent
 * (`subAccountAddress`, `market`, `positionType`, `initialMargin`,
 * `leverage`, optional `slippage` / pre-fetched data, TanStack `query`
 * overrides) plus an optional `config`.
 */
export type UseInstantOpenFeesParameters = GetInstantOpenFeesOptions & ConfigParameter;

/** Return type of {@link useInstantOpenFees}. */
export type UseInstantOpenFeesReturnType = UseQueryResult<GetInstantOpenFeesReturnType, SymmioRequestError>;

/**
 * Preview every fee a new instant-open quote pays — separated by leg plus the
 * total — before the user submits. Read-only; nothing is signed.
 *
 * Wraps `getInstantOpenFees`, but **pre-fetches every input through its own
 * cached queries and passes them in as prefills**, so the query function is
 * pure math with zero network hops: market metadata (`useMarkets`) and
 * on-chain fee rates (`useFeeForUser`) are slow-moving and cached for
 * minutes; the mark price rides the shared price stream; the lowcap dry-run
 * estimate uses `useEstimatedPrice` (debounced internally). Previous data is
 * kept while inputs move, so a mark-price tick updates the numbers in place —
 * it never resets the result to a loading state.
 *
 * The result is a `kind`-discriminated union: both kinds carry the platform
 * legs and `totalFee`; an `"enigma"` (lowcap) result adds `openSolverFee`,
 * `closeSolverFee`, and `expectedSettlementLoss`.
 *
 * @example
 * ```tsx
 * const { data: fees } = useInstantOpenFees({
 *   subAccountAddress,
 *   market: { id: symbolId },
 *   positionType,
 *   initialMargin,
 *   leverage,
 * });
 * // fees?.totalFee; fees?.kind === "enigma" && fees.expectedSettlementLoss
 * ```
 */
export function useInstantOpenFees(parameters: UseInstantOpenFeesParameters): UseInstantOpenFeesReturnType {
  const config = useSymmioConfig(parameters);
  const contextChainId = useSymmioChainId();
  const chainId = parameters.chainId ?? contextChainId;
  const { subAccountAddress, market, positionType, initialMargin, leverage, slippage, solverId } = parameters;
  const enabled = (parameters.query?.enabled ?? true) && initialMargin.length > 0;

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

  // Time-decaying close-fee rates ride the same `useMarkets` read — they are
  // Enigma-only fields on `EnigmaMarket`, so narrow on `kind` before reading.
  const resolvedEnigmaMarket = resolvedMarket?.kind === "enigma" ? resolvedMarket : undefined;
  const hedgerFeeCloseEarlyRate =
    market.hedgerFeeCloseEarlyRate ?? resolvedEnigmaMarket?.hedgerFeeCloseEarlyRate ?? hedgerFeeClose;
  const hedgerFeeCloseEarlyThreshold =
    market.hedgerFeeCloseEarlyThreshold ?? resolvedEnigmaMarket?.hedgerFeeCloseEarlyThreshold ?? 0;
  const hedgerFeeCloseStandardThreshold =
    market.hedgerFeeCloseStandardThreshold ?? resolvedEnigmaMarket?.hedgerFeeCloseStandardThreshold ?? 0;

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

  // Lowcap dry-run estimate: mark-sized quantity, wide fixed request bound so
  // the solver's price gate never rejects the question. Debounced internally.
  const estimateQuantity = useMemo(() => {
    if (!enabled || !isLowcap || markPrice === undefined) return "";
    if (pricePrecision === undefined || quantityPrecision === undefined) return "";
    const sized = calculateTradeParams({
      markPrice,
      slippage: 0,
      positionType,
      userInput: initialMargin,
      inputField: "PRICE",
      leverage,
      pricePrecision,
      quantityPrecision,
    });
    return sized?.quantity ?? "";
  }, [enabled, isLowcap, markPrice, pricePrecision, quantityPrecision, positionType, initialMargin, leverage]);
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
  // `"0"` is the action's "no usable estimate" sentinel: it suppresses the
  // action's own fetch (the input IS supplied) and yields a zero settlement
  // provision — so a solver outage never puts network calls back in queryFn.
  const estimatedOpenPrice = !isLowcap
    ? undefined
    : (parameters.estimatedOpenPrice ?? estimateQuery.data?.estimatedPrice ?? "0");
  const estimateSettled =
    !isLowcap || parameters.estimatedOpenPrice !== undefined || estimateQuery.isFetched || estimateQuery.isError;

  // Every prefill present → the query function is pure math, zero fetches.
  const ready =
    enabled &&
    marketName !== undefined &&
    pricePrecision !== undefined &&
    quantityPrecision !== undefined &&
    feeRates !== undefined &&
    markPrice !== undefined &&
    (!isLowcap || (hedgerFeeOpen !== undefined && hedgerFeeClose !== undefined)) &&
    estimateSettled;

  const options = getInstantOpenFeesQueryOptions(config, {
    subAccountAddress,
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
    },
    positionType,
    initialMargin,
    leverage,
    slippage,
    markPrice,
    feeRates,
    estimatedOpenPrice,
    query: {
      ...parameters.query,
      enabled: ready,
      // Inputs (mark price, estimate) tick often; keep showing the previous
      // numbers while the pure recompute runs instead of flashing a loader.
      placeholderData: (previous: GetInstantOpenFeesReturnType | undefined) => previous,
    },
  });

  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseInstantOpenFeesReturnType;
}
