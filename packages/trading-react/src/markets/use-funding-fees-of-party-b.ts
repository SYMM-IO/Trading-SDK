"use client";

import {
  getFundingFeesOfPartyBQueryOptions,
  type ConfigParameter,
  type GetFundingFeesOfPartyBOptions,
  type GetFundingFeesOfPartyBReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useFundingFeesOfPartyB}: the core query options (symbol
 * id, partyB, chain id, TanStack `query` overrides) plus an optional `config`.
 */
export type UseFundingFeesOfPartyBParameters = GetFundingFeesOfPartyBOptions & ConfigParameter;

/** Return type of {@link useFundingFeesOfPartyB}. */
export type UseFundingFeesOfPartyBReturnType = UseQueryResult<GetFundingFeesOfPartyBReturnType, SymmioRequestError>;

/**
 * Read the accumulated-funding state a solver (partyB) keeps for one symbol —
 * the SYMMIO core diamond's `FundingFee` struct: current and weighted-average
 * rates, epoch tracking and carried-over fee snapshots.
 *
 * Values are the raw contract values: rates are **cost-positive** (a positive
 * long/short value means that side pays), the opposite of the SDK's
 * income-positive funding amounts. `epochDuration === 0n` means accumulated
 * funding is not configured for the pair; `startEpoch === 0n` and
 * `startEpochTimeStamp === 0n` with a duration set mean it is configured but has
 * not started; otherwise the pair accrues — read the per-quote amount with
 * {@link useQuotesPendingFunding}.
 *
 * Delegates to core's `getFundingFeesOfPartyB`. Does not poll by default; pass
 * `query.refetchInterval` to keep it fresh. `chainId` defaults to the connected
 * chain. Errors are normalized to {@link SymmioRequestError}.
 *
 * @param parameters - Symbol id, partyB, optional chain id, TanStack `query` overrides and `config`.
 * @returns A TanStack query result holding the pair's `FundingFee` state.
 *
 * A quote only has a `partyB` once a solver has locked it, so read the pair off
 * an on-chain quote (or the solver you target) and gate the query while it is
 * still missing.
 *
 * @example
 * ```tsx
 * const { data: quote } = useQuote({ quoteId: 7334n });
 * const { data: fee } = useFundingFeesOfPartyB({
 *   symbolId: quote?.symbolId ?? 0n,
 *   partyB: quote?.partyB ?? zeroAddress,
 *   query: { enabled: quote !== undefined && quote !== null },
 * });
 * const accruing = fee !== undefined && fee.epochDuration > 0n && (fee.startEpoch !== 0n || fee.startEpochTimeStamp !== 0n);
 * ```
 */
export function useFundingFeesOfPartyB(parameters: UseFundingFeesOfPartyBParameters): UseFundingFeesOfPartyBReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getFundingFeesOfPartyBQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
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
  }) as UseFundingFeesOfPartyBReturnType;
}
