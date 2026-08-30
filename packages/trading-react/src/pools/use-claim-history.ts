"use client";

import {
  getClaimHistoryQueryOptions,
  type ConfigParameter,
  type GetClaimHistoryOptions,
  type GetClaimHistoryReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useClaimHistory}: the core query options plus an optional `config`. */
export type UseClaimHistoryParameters = GetClaimHistoryOptions & ConfigParameter;

/** Return type of {@link useClaimHistory}: one page of the user's past claims. */
export type UseClaimHistoryReturnType = UseQueryResult<GetClaimHistoryReturnType, SymmioRequestError>;

/**
 * Read the signed-in user's claim history — their past pool-reward claims,
 * newest first.
 *
 * Authed and scoped to the caller: it only ever returns claims the user owns, so
 * pass the Bearer `accessToken` from {@link useAuthenticateListing}. Optionally
 * narrow to one pool (`tokenContractAddress`) or one receiving sub-account
 * (`accountAddress`). `count` is the total across all pages, so it is what a
 * pager should divide — not `items.length`. Errors are normalized to
 * {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data } = useClaimHistory({ accessToken, tokenContractAddress, size: 25 });
 * ```
 */
export function useClaimHistory(parameters: UseClaimHistoryParameters): UseClaimHistoryReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getClaimHistoryQueryOptions(config, {
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
  }) as UseClaimHistoryReturnType;
}
