"use client";

import {
  getExpressWithdrawOptionsQueryOptions,
  type ConfigParameter,
  type ExpressWithdrawOptions,
  type GetExpressWithdrawOptionsOptions,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useExpressWithdrawOptions}. */
export type UseExpressWithdrawOptionsParameters = GetExpressWithdrawOptionsOptions & ConfigParameter;

/** Return type of {@link useExpressWithdrawOptions}. */
export type UseExpressWithdrawOptionsReturnType = UseQueryResult<ExpressWithdrawOptions, SymmioRequestError>;

/**
 * Request non-expired signed withdrawal options for one exact withdrawal intent.
 *
 * The options request is not retried automatically because the service records
 * each `POST /options`. `chainId` defaults to the connected chain.
 *
 * @param parameters - Account, amount, receiver, optional affiliate/chain, and query overrides.
 * @returns A TanStack query result containing normalized options.
 */
export function useExpressWithdrawOptions(
  parameters: UseExpressWithdrawOptionsParameters,
): UseExpressWithdrawOptionsReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getExpressWithdrawOptionsQueryOptions(config, {
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
  }) as UseExpressWithdrawOptionsReturnType;
}
