"use client";

import {
  getActiveVirtualAccountByKeyQueryOptions,
  type ConfigParameter,
  type GetActiveVirtualAccountByKeyOptions,
  type GetActiveVirtualAccountByKeyReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useActiveVirtualAccountByKey}: the core query
 * options (subAccount, isolation type, symbol id, chain id, TanStack `query` overrides) plus an
 * optional `config`.
 */
export type UseActiveVirtualAccountByKeyParameters = GetActiveVirtualAccountByKeyOptions & ConfigParameter;

/** Return type of {@link useActiveVirtualAccountByKey}. */
export type UseActiveVirtualAccountByKeyReturnType = UseQueryResult<
  GetActiveVirtualAccountByKeyReturnType,
  SymmioRequestError
>;

/**
 * Read a subaccount's **active** Virtual Account (VA) for an isolation key
 * `(isolationType, symbolId)` — the VA new quotes on that market and side are
 * routed into under single-VA mode — or `null` when none is active. The query
 * is disabled until `subAccount`, `isolationType` and `symbolId` are all set.
 * `chainId` defaults to the connected chain. Errors are normalized to
 * {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * import { isolationTypeForSide, PositionType } from "@symmio/trading-react";
 *
 * const { data: activeVa } = useActiveVirtualAccountByKey({
 *   subAccount,
 *   isolationType: isolationTypeForSide(PositionType.LONG),
 *   symbolId: 42n,
 *   chainId,
 * });
 * ```
 */
export function useActiveVirtualAccountByKey(
  parameters: UseActiveVirtualAccountByKeyParameters = {},
): UseActiveVirtualAccountByKeyReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getActiveVirtualAccountByKeyQueryOptions(config, {
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
  }) as UseActiveVirtualAccountByKeyReturnType;
}
