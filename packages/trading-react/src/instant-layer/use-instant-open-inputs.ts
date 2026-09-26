"use client";

import {
  calculateTradeParams,
  PositionType,
  type ConfigParameter,
  type GetInstantOpenFeesParameters,
} from "@symmio/trading-core";
import { useMemo } from "react";
import { useEstimatedPrice } from "../estimated-price/use-estimated-price";
import { useFeeForUser } from "../fees/use-fee-for-user";
import { useLockedParams } from "../locked-params/use-locked-params";
import { useMarkets } from "../markets/use-markets";
import { usePriceByName } from "../price-service/use-price-by-name";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { useSolverInfo } from "../solvers/use-solver-info";
import { getInstantOpenFundingError } from "./get-instant-open-funding-error";

/** Shared input orchestration for preparation and fee previews; calculations stay in core. */
export function useInstantOpenInputs(
  parameters: GetInstantOpenFeesParameters & ConfigParameter,
  purpose: "prepare" | "fees",
  queryEnabled = true,
) {
  const config = useSymmioConfig(parameters);
  const contextChainId = useSymmioChainId();
  const chainId = parameters.chainId ?? contextChainId;
  const { subAccountAddress, market, positionType, initialMargin, fund, leverage, solverId } = parameters;
  const isFullBalance = fund !== undefined;
  const canSizeFullBalance = isFullBalance || parameters.availableBalance !== undefined;
  const needsLockedParams = purpose === "prepare" || canSizeFullBalance;
  const needsSolverFeeCaps = purpose === "prepare" && config.getChainConfig(chainId).contractsVersion === "0.8.6";
  /** The amount driving the sizing math — the typed margin, or the whole balance in full-balance mode. */
  const sizingInput = isFullBalance ? fund.balance : (initialMargin ?? "");
  const requested = queryEnabled && sizingInput.length > 0;

  /** The dry-run estimate exists only on lowcap (Enigma) solvers. */
  const isLowcap = config.getSolver({ chainId, solverId }).id === "enigma";
  const validationError = requested ? getInstantOpenFundingError({ ...parameters, isLowcap }) : undefined;
  const enabled = requested && validationError === undefined;

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

  const minOpenSolverFeeCap =
    market.minOpenSolverFeeCap ??
    (resolvedMarket ? (resolvedMarket.kind === "enigma" ? resolvedMarket.minOpenSolverFeeCap : "0") : undefined);
  const minCloseSolverFeeCap =
    market.minCloseSolverFeeCap ??
    (resolvedMarket ? (resolvedMarket.kind === "enigma" ? resolvedMarket.minCloseSolverFeeCap : "0") : undefined);
  const capsReady = !needsSolverFeeCaps || (minOpenSolverFeeCap !== undefined && minCloseSolverFeeCap !== undefined);

  // Time-decaying close-fee rates ride the same `useMarkets` read — Enigma-only
  // fields on `EnigmaMarket`, so narrow on `kind` before reading.
  const resolvedEnigmaMarket = resolvedMarket?.kind === "enigma" ? resolvedMarket : undefined;
  const hedgerFeeCloseEarlyRate =
    market.hedgerFeeCloseEarlyRate ?? resolvedEnigmaMarket?.hedgerFeeCloseEarlyRate ?? hedgerFeeClose;
  const hedgerFeeCloseEarlyThreshold =
    market.hedgerFeeCloseEarlyThreshold ?? resolvedEnigmaMarket?.hedgerFeeCloseEarlyThreshold ?? 0;
  const hedgerFeeCloseStandardThreshold =
    market.hedgerFeeCloseStandardThreshold ?? resolvedEnigmaMarket?.hedgerFeeCloseStandardThreshold ?? 0;

  // Quote constraints — explicit or automatic full-balance sizing snaps to the lot grid and checks the
  // published floors; they ride the same `useMarkets` read.
  const minAcceptablePortionLf = market.minAcceptablePortionLf ?? resolvedMarket?.minAcceptablePortionLf;
  const minAcceptableQuoteValue = market.minAcceptableQuoteValue ?? resolvedMarket?.minAcceptableQuoteValue;
  const maxNotionalValue = market.maxNotionalValue ?? resolvedMarket?.maxNotionalValue;
  const minNotionalValue = market.minNotionalValue ?? resolvedMarket?.minNotionalValue;
  const maxQuantity = market.maxQuantity ?? resolvedMarket?.maxQuantity;
  const lotSize = market.lotSize ?? resolvedMarket?.lotSize;
  const constraintsReady =
    !canSizeFullBalance ||
    (minAcceptablePortionLf !== undefined &&
      minAcceptableQuoteValue !== undefined &&
      maxNotionalValue !== undefined &&
      minNotionalValue !== undefined &&
      maxQuantity !== undefined &&
      lotSize !== undefined);

  // Preparation always needs locks; the fee preview needs them only for balance sizing.
  const locksPrefilled =
    parameters.lockedParamPercent?.cva !== undefined &&
    parameters.lockedParamPercent.lf !== undefined &&
    parameters.lockedParamPercent.partyAmm !== undefined &&
    parameters.lockedParamPercent.partyBmm !== undefined;
  const lockedParamsQuery = useLockedParams({
    config: parameters.config,
    chainId,
    solverId,
    symbol: marketName ?? "",
    leverage,
    query: {
      enabled: enabled && needsLockedParams && !locksPrefilled && marketName !== undefined,
      staleTime: 300_000,
    },
  });
  const lockedParamPercent = locksPrefilled
    ? parameters.lockedParamPercent
    : lockedParamsQuery.data
      ? {
          // The resolver skips its fetch only when all four fields are present —
          // mirror its `"0"` defaults for fields the solver omits.
          cva: lockedParamsQuery.data.cva ?? "0",
          lf: lockedParamsQuery.data.lf ?? "0",
          partyAmm: lockedParamsQuery.data.partyAmm ?? "0",
          partyBmm: lockedParamsQuery.data.partyBmm ?? "0",
        }
      : undefined;
  const lockedParamsReady = !needsLockedParams || lockedParamPercent !== undefined;

  // Static solver fees follow the same cached input path as the other prefills.
  // A failed optional /info read keeps core's existing zero-static-fee fallback.
  const solverInfoQuery = useSolverInfo({
    config: parameters.config,
    chainId,
    solverId,
    query: { enabled: enabled && isLowcap && parameters.solverInfo === undefined, staleTime: 300_000, retry: false },
  });
  const solverInfo = parameters.solverInfo ?? solverInfoQuery.data ?? (solverInfoQuery.isError ? {} : undefined);
  const solverInfoReady = !isLowcap || solverInfo !== undefined;

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
  // undefined = pending, string = available, null = settled but unavailable.
  // Pass null through to core so a failed cached request is not fetched again.
  const estimateUpdating =
    isLowcap && parameters.estimatedOpenPrice === undefined && (estimateQuery.isDebouncing || estimateQuery.isFetching);
  const estimateSettled =
    !isLowcap ||
    parameters.estimatedOpenPrice !== undefined ||
    (!estimateUpdating && (estimateQuery.isFetched || estimateQuery.isError));
  const resolvedEstimate =
    parameters.estimatedOpenPrice !== undefined ? parameters.estimatedOpenPrice : estimateQuery.data?.estimatedPrice;
  const estimatedOpenPrice =
    !isLowcap || !estimateSettled ? undefined : resolvedEstimate && resolvedEstimate !== "0" ? resolvedEstimate : null;

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
    capsReady &&
    solverInfoReady &&
    estimateSettled;

  return {
    config,
    validationError,
    ready,
    prefills: {
      chainId,
      market: {
        id: market.id,
        name: marketName,
        pricePrecision,
        quantityPrecision,
        minOpenSolverFeeCap,
        minCloseSolverFeeCap,
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
      markPrice,
      feeRates,
      lockedParamPercent,
      solverInfo,
      estimatedOpenPrice,
    },
  };
}
