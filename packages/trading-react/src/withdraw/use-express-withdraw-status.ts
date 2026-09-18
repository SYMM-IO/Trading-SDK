"use client";

import {
  getExpressWithdrawStatusQueryOptions,
  isExpressWithdrawPayoutComplete,
  type ConfigParameter,
  type ExpressWithdrawStatus,
  type GetExpressWithdrawStatusOptions,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useExpressWithdrawStatus}. */
export type UseExpressWithdrawStatusParameters = GetExpressWithdrawStatusOptions & ConfigParameter;

/** Return type of {@link useExpressWithdrawStatus}. */
export type UseExpressWithdrawStatusReturnType = UseQueryResult<ExpressWithdrawStatus, SymmioRequestError>;

/**
 * Poll service/provider progress until receiver payout or a terminal failure.
 *
 * Polls every three seconds by default. `STANDARD` keeps polling through Core
 * `FINALIZED` until provider `PROCESSED`; an initial local `NOT_FOUND` also keeps
 * polling while the service indexer catches up.
 *
 * @param parameters - Subaccount, request id, optional chain, and query overrides.
 * @returns A TanStack query result containing normalized progress.
 */
export function useExpressWithdrawStatus(
  parameters: UseExpressWithdrawStatusParameters,
): UseExpressWithdrawStatusReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getExpressWithdrawStatusQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
  });

  return useQuery({
    ...options,
    refetchInterval:
      parameters.query?.refetchInterval ??
      ((query) => {
        const status = query.state.data;
        if (!status) return 3_000;
        if (isExpressWithdrawPayoutComplete(status)) return false;
        if (
          status.onChain.status === "CANCELLED" ||
          status.onChain.status === "SUSPENDED" ||
          status.local.status === "FAILED" ||
          status.local.status === "CANCELLED" ||
          status.local.status === "SUSPENDED"
        ) {
          return false;
        }
        return 3_000;
      }),
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseExpressWithdrawStatusReturnType;
}
