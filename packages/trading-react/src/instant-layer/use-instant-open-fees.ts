"use client";

import {
  getInstantOpenFeesQueryOptions,
  type ConfigParameter,
  type GetInstantOpenFeesOptions,
  type GetInstantOpenFeesReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useInstantOpenInputs } from "./use-instant-open-inputs";

/**
 * Parameters for {@link useInstantOpenFees}: the trade intent
 * (`subAccountAddress`, `market`, `positionType`, `initialMargin` **or**
 * `fund` for a full-balance preview, `leverage`, optional `slippage` /
 * pre-fetched data, TanStack `query` overrides) plus an optional `config`.
 */
export type UseInstantOpenFeesParameters = GetInstantOpenFeesOptions & ConfigParameter;

/** Return type of {@link useInstantOpenFees}. */
export type UseInstantOpenFeesReturnType = UseQueryResult<GetInstantOpenFeesReturnType, SymmioRequestError> & {
  /** Synchronous input error. Display before query.error; dependent queries stay disabled. */
  validationError: SymmioRequestError | undefined;
  /** True when all inputs and the current fee preview have settled successfully. */
  isReady: boolean;
};

/**
 * Preview every fee a new instant-open quote pays — separated by leg plus the
 * total — before the user submits. Read-only; nothing is signed.
 *
 * Wraps `getInstantOpenFees`, but **pre-fetches every input through its own
 * cached queries and passes them in as prefills**, so the query function is
 * pure math with zero network hops: market metadata (`useMarkets`) and
 * on-chain fee rates (`useFeeForUser`) and solver info are cached for minutes.
 * The mark price rides the shared price stream; the lowcap dry-run estimate
 * uses `useEstimatedPrice` (debounced internally). Previous data is
 * kept while inputs move, so a mark-price tick updates the numbers in place —
 * it never resets the result to a loading state.
 *
 * The result is a `kind`-discriminated union of the **open-side** legs: both
 * kinds carry `platformOpenFee`, the sized `quantity`, and `totalFee`; an
 * `"enigma"` (lowcap) result adds `openSolverFee`, `staticSolverFeeOpen`, and
 * `expectedSettlementLoss`. Close fees are charged at close from the position
 * and are deliberately not part of this preview — price them in the close flow
 * with `useInstantCloseFees`, where the notional and holding time are real.
 * `totalFee` includes the settlement provision by default; pass
 * `includeSettlementInTotalFee: false` to sum the fee legs only.
 *
 * With `fund` (`FullBalanceFunding`) instead of `initialMargin`, the
 * preview runs the same probe-and-rescale sizing as the open, so the legs and
 * `quantity` equal what a full-balance open will actually charge and submit —
 * the extra inputs it needs (locked-param percents, market quote constraints)
 * are prefetched here through the same cached queries.
 *
 * With `initialMargin` and `availableBalance`, core automatically uses full-balance
 * sizing when required funding exceeds the raw balance. `data.fundingMode` reports
 * the effective choice; pass the same inputs to preparation and submission.
 * Display `validationError ?? error` and check `isReady` before using the fees
 * for the current input. Input errors are synchronous, including offline.
 * A disabled hook or empty input remains idle without input validation.
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
  const inputs = useInstantOpenInputs(parameters, "fees", parameters.query?.enabled !== false);
  const options = getInstantOpenFeesQueryOptions(inputs.config, {
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
  }) as UseQueryResult<GetInstantOpenFeesReturnType, SymmioRequestError>;

  return {
    ...query,
    validationError: inputs.validationError,
    isReady: inputs.ready && query.isSuccess && !query.isFetching && !query.isPlaceholderData,
  };
}
