"use client";

import {
  getPartyAOpenPositionsBatchQueryOptions,
  type ConfigParameter,
  type GetPartyAOpenPositionsBatchOptions,
  type GetPartyAOpenPositionsBatchReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link usePartyAOpenPositionsBatch}: the core query options
 * (accounts, page size, liquidation flag, batch size, chain id, TanStack `query`
 * overrides) plus an optional `config`.
 */
export type UsePartyAOpenPositionsBatchParameters = GetPartyAOpenPositionsBatchOptions & ConfigParameter;

/** Return type of {@link usePartyAOpenPositionsBatch}: one result per account, in input order. */
export type UsePartyAOpenPositionsBatchReturnType = UseQueryResult<
  GetPartyAOpenPositionsBatchReturnType,
  SymmioRequestError
>;

/**
 * Read the open positions of **many** partyAs (e.g. every virtual account of a
 * sub-account) in chunked multicalls. Each entry is a `success` (with `quotes`,
 * `hasMore`, and — with `includeLiquidationStatus` — `isLiquidated`) or a
 * `failure` for an account whose read reverted; one bad account never fails the
 * others. The query stays idle while `partyAs` is empty. `chainId` defaults to
 * the connected chain. Errors are normalized to {@link SymmioRequestError}.
 *
 * Not live: invalidate with `getPartyAOpenPositionsBatchQueryKey` (e.g. via
 * `predicateMatch`) when your app learns a position changed.
 *
 * @example
 * ```tsx
 * const { data } = usePartyAOpenPositionsBatch({ partyAs: virtualAccounts, includeLiquidationStatus: true });
 * const quotes = data?.flatMap((r) => (r.status === "success" && !r.isLiquidated ? r.quotes : [])) ?? [];
 * ```
 */
export function usePartyAOpenPositionsBatch(
  parameters: UsePartyAOpenPositionsBatchParameters,
): UsePartyAOpenPositionsBatchReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getPartyAOpenPositionsBatchQueryOptions(config, {
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
  }) as UsePartyAOpenPositionsBatchReturnType;
}
