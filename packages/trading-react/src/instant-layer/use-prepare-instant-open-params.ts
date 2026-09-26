"use client";

import {
  prepareInstantOpenParamsQueryOptions,
  type ConfigParameter,
  type PrepareInstantOpenParamsOptions,
  type PrepareInstantOpenParamsReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useInstantOpenInputs } from "./use-instant-open-inputs";

/**
 * Parameters for {@link usePrepareInstantOpenParams}: the same trade intent the
 * submit takes (`subAccountAddress`, `from`, `market`, `positionType`,
 * `initialMargin` **or** `fund`, optional `availableBalance` for automatic sizing,
 * `leverage`, optional `slippage` / pre-fetched
 * data, TanStack `query` overrides) plus an optional `config`.
 */
export type UsePrepareInstantOpenParamsParameters = PrepareInstantOpenParamsOptions & ConfigParameter;

/**
 * Return type of {@link usePrepareInstantOpenParams}: the query result carrying
 * the prepared {@link PrepareInstantOpenParamsReturnType}, plus the dry-run estimate the
 * params were built with.
 */
export type UsePrepareInstantOpenParamsReturnType = UseQueryResult<
  PrepareInstantOpenParamsReturnType,
  SymmioRequestError
> & {
  /**
   * The dry-run estimate the preview was built with (`null` when unavailable;
   * `undefined` while pending or on a non-lowcap solver). Forward it as
   * `estimatedOpenPrice` to the submit so its `margin.amount` — whose settlement leg tracks the estimate — matches this
   * preview bit-for-bit.
   */
  estimatedOpenPrice: string | null | undefined;
  /** Synchronous input error. Display before query.error; dependent queries stay disabled. */
  validationError: SymmioRequestError | undefined;
  /** True when all inputs and the current preparation have settled; gate submission on this. */
  isReady: boolean;
};

/**
 * Live-preview the exact {@link PrepareInstantOpenParamsReturnType} an instant-open submit
 * will sign — `order` (price + quantity), `lockedParam`, `margin.amount`, and
 * `solverFeeCaps` — by running `prepareInstantOpenParams` as a read.
 * `prepareInstantOpenParams` neither signs nor submits, so this is safe to run
 * live; drive a "quote preview" from it and what the user sees is bit-for-bit
 * what `sendQuote` receives, with no separate local recomputation to drift.
 *
 * Like {@link useInstantOpenFees}, it **pre-fetches every input through its own
 * cached queries** (market metadata, mark price, locked params, on-chain fee
 * rates, solver info, and the lowcap dry-run estimate) and passes them in as
 * prefills, so the query function is pure and does no per-render network. Previous data is kept
 * while inputs move, so a mark-price tick updates the numbers in place.
 *
 * For bit-for-bit parity on `margin.amount`, forward {@link
 * UsePrepareInstantOpenParamsReturnType.estimatedOpenPrice} to the submit call
 * (`useInstantOpenAuto` / `useInstantOpenWithTpSl`) as `estimatedOpenPrice`, so
 * both the preview and the send provision settlement at the same estimate. The
 * full-balance sizing decision and quantity also depend on that estimate.
 * Gate submission on `isReady` while inputs or the estimate are settling.
 * Display `validationError ?? error`; input errors are synchronous, including offline.
 * A disabled hook or empty input remains idle without input validation.
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
  const inputs = useInstantOpenInputs(parameters, "prepare", parameters.query?.enabled !== false);
  const options = prepareInstantOpenParamsQueryOptions(inputs.config, {
    ...parameters,
    ...inputs.prefills,
    query: {
      ...parameters.query,
      enabled: inputs.ready,
      placeholderData: (previous) => (inputs.validationError === undefined ? previous : undefined),
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
  }) as UseQueryResult<PrepareInstantOpenParamsReturnType, SymmioRequestError>;

  return {
    ...query,
    validationError: inputs.validationError,
    estimatedOpenPrice: inputs.prefills.estimatedOpenPrice,
    isReady: inputs.ready && query.isSuccess && !query.isFetching && !query.isPlaceholderData,
  };
}
