"use client";

import {
  getWithdrawRouteQueryOptions,
  type ConfigParameter,
  type GetWithdrawRouteOptions,
  type WithdrawRoute,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useSubAccount } from "../account-layer/use-sub-account";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useWithdrawRoute}. */
export type UseWithdrawRouteParameters = Omit<GetWithdrawRouteOptions, "isolationType"> & ConfigParameter;

/** Return type of {@link useWithdrawRoute}. */
export type UseWithdrawRouteReturnType = UseQueryResult<WithdrawRoute, SymmioRequestError>;

/**
 * Prepare the default or caller-overridden route for a withdrawal intent.
 *
 * The hook reads isolation through {@link useSubAccount}; core owns every other
 * route decision. The returned route can be displayed and passed unchanged to
 * {@link useWithdrawWithExpress}.
 *
 * @param parameters - Required intent, optional policy/chain, and query overrides.
 * @returns A TanStack query result containing a prepared route.
 */
export function useWithdrawRoute(parameters: UseWithdrawRouteParameters): UseWithdrawRouteReturnType {
  const config = useSymmioConfig(parameters);
  const connectedChainId = useSymmioChainId();
  const chainId = parameters.chainId ?? connectedChainId;
  const { data: subAccount } = useSubAccount({
    account: parameters.user,
    chainId,
    config,
    query: { enabled: parameters.query?.enabled !== false },
  });
  const options = getWithdrawRouteQueryOptions(config, {
    ...parameters,
    chainId,
    isolationType: subAccount?.isolationType,
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
  }) as UseWithdrawRouteReturnType;
}
