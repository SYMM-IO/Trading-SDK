"use client";

import {
  getPredictedNextVirtualAccountQueryOptions,
  type ConfigParameter,
  type GetPredictedNextVirtualAccountOptions,
  type GetPredictedNextVirtualAccountReturnType,
} from "@theoldvarorg/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link usePredictedNextVirtualAccount}: the core query options
 * (`subAccount`, `isolationType`, `symbolId`, chain id, TanStack `query`
 * overrides) plus an optional `config`.
 */
export type UsePredictedNextVirtualAccountParameters = GetPredictedNextVirtualAccountOptions & ConfigParameter;

/** Return type of {@link usePredictedNextVirtualAccount}. */
export type UsePredictedNextVirtualAccountReturnType = UseQueryResult<
  GetPredictedNextVirtualAccountReturnType,
  SymmioRequestError
>;

/**
 * Predict the deterministic address of the next Virtual Account (VA) a
 * subaccount would create for a given `(isolationType, symbolId)`.
 *
 * In lowcap, an instant-open isolates its position into a VA that does not exist
 * on-chain until the trade lands; the AccountLayer computes that VA's address up
 * front. Use this to surface a brand-new position's VA — e.g. as the `partyA`
 * for quote reads — before it is created. The prediction is stable per
 * `(subAccount, isolationType, symbolId)` only until the subaccount's virtual
 * nonce advances, so a short default `staleTime` applies (override via
 * `query.staleTime`).
 *
 * The query is disabled until `subAccount`, `isolationType`, and `symbolId` are
 * all set. `chainId` defaults to the connected chain. Errors are normalized to
 * {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data: va } = usePredictedNextVirtualAccount({
 *   subAccount: "0xsub…",
 *   isolationType: VIRTUAL_ACCOUNT_ISOLATION_TYPE.MARKET_LONG,
 *   symbolId: 1n,
 * });
 * ```
 */
export function usePredictedNextVirtualAccount(
  parameters: UsePredictedNextVirtualAccountParameters = {},
): UsePredictedNextVirtualAccountReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getPredictedNextVirtualAccountQueryOptions(config, {
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
  }) as UsePredictedNextVirtualAccountReturnType;
}
