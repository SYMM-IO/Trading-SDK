"use client";

import {
  getInstantCloseFeesQueryOptions,
  type ConfigParameter,
  type GetInstantCloseFeesOptions,
  type GetInstantCloseFeesReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useFeeForUser } from "../fees/use-fee-for-user";
import { useMarkets } from "../markets/use-markets";
import { usePriceByName } from "../price-service/use-price-by-name";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { useSolverInfo } from "../solvers/use-solver-info";

/**
 * Parameters for {@link useInstantCloseFees}: the close intent
 * (`subAccountAddress`, `market`, `quantity`, `openedAt`, optional pre-fetched
 * data, TanStack `query` overrides) plus an optional `config`.
 */
export type UseInstantCloseFeesParameters = GetInstantCloseFeesOptions & ConfigParameter;

/** Return type of {@link useInstantCloseFees}. */
export type UseInstantCloseFeesReturnType = UseQueryResult<GetInstantCloseFeesReturnType, SymmioRequestError>;

/**
 * Preview every fee closing a position pays **right now** — the platform close
 * fee plus, on lowcap (Enigma), the holding-time solver close fee and the flat
 * static close leg. Read-only; nothing is signed. This is the close-flow
 * counterpart of `useInstantOpenFees`, which deliberately previews only the
 * open-side legs: the honest close cost exists only at close time, where the
 * notional and the decaying solver rate are real.
 *
 * Wraps `getInstantCloseFees`, but **pre-fetches every input through its own
 * cached queries and passes them in as prefills**, so the query function is
 * pure math with zero network hops: market metadata (`useMarkets`), on-chain
 * fee rates (`useFeeForUser`), and the solver's static fees (`useSolverInfo`)
 * are slow-moving and cached for minutes; the mark price rides the shared
 * price stream. Previous data is kept while inputs move, so a mark-price tick
 * updates the numbers in place.
 *
 * The holding time is stamped each time the query function runs, so a refetch
 * after the position ages re-prices the decaying solver close fee; pass `now`
 * for a deterministic preview. Narrow on `kind` to reach the lowcap-only legs
 * (`closeSolverFee`, `closeSolverFeeRate`, `holdingSeconds`,
 * `staticSolverFeeClose`).
 *
 * @example
 * ```tsx
 * const { data: fees } = useInstantCloseFees({
 *   subAccountAddress: partyA,
 *   market: { id: symbolId },
 *   quantity: quantityToClose,
 *   openedAt: position.createTimestamp,
 * });
 * // fees?.totalFee; fees?.kind === "enigma" && fees.closeSolverFee
 * ```
 */
export function useInstantCloseFees(parameters: UseInstantCloseFeesParameters): UseInstantCloseFeesReturnType {
  const config = useSymmioConfig(parameters);
  const contextChainId = useSymmioChainId();
  const chainId = parameters.chainId ?? contextChainId;
  const { subAccountAddress, market, quantity, openedAt, now, solverId } = parameters;
  const enabled = (parameters.query?.enabled ?? true) && quantity.length > 0;

  /** The solver close-fee schedule and the static leg exist only on lowcap (Enigma) solvers. */
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

  // Static close fee from the solver's `/info` config — lowcap only. Fail-soft:
  // an unreachable `/info` prices the static leg at "0" instead of blocking the
  // preview (mirrors the action's own resolver).
  const solverInfoQuery = useSolverInfo({
    config: parameters.config,
    chainId,
    solverId,
    query: { enabled: enabled && isLowcap && parameters.solverInfo === undefined },
  });
  const solverInfo = !isLowcap
    ? undefined
    : (parameters.solverInfo ?? solverInfoQuery.data ?? (solverInfoQuery.isError ? {} : undefined));
  const solverInfoSettled = !isLowcap || solverInfo !== undefined;

  // Mark price — caller's cache-hot value wins; otherwise the shared stream.
  const priceQuery = usePriceByName({
    name: marketName,
    solverId,
    enabled: enabled && parameters.markPrice === undefined,
  });
  const markPrice = parameters.markPrice ?? priceQuery.markPrice ?? undefined;

  // Every prefill present → the query function is pure math, zero fetches.
  const ready =
    enabled &&
    marketName !== undefined &&
    pricePrecision !== undefined &&
    quantityPrecision !== undefined &&
    feeRates !== undefined &&
    markPrice !== undefined &&
    (!isLowcap || (hedgerFeeOpen !== undefined && hedgerFeeClose !== undefined)) &&
    solverInfoSettled;

  const options = getInstantCloseFeesQueryOptions(config, {
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
    quantity,
    openedAt,
    now,
    markPrice,
    feeRates,
    solverInfo,
    query: {
      ...parameters.query,
      enabled: ready,
      // The mark price ticks often; keep showing the previous numbers while
      // the pure recompute runs instead of flashing a loader.
      placeholderData: (previous: GetInstantCloseFeesReturnType | undefined) => previous,
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
  }) as UseInstantCloseFeesReturnType;
}
