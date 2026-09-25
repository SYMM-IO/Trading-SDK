"use client";

import {
  getWithdrawRouteChoicesQueryOptions,
  type ConfigParameter,
  type GetWithdrawRouteChoicesOptions,
  type WithdrawRouteChoices,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useSubAccount } from "../account-layer/use-sub-account";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useWithdrawRouteChoices}. */
export type UseWithdrawRouteChoicesParameters = Omit<GetWithdrawRouteChoicesOptions, "isolationType"> & ConfigParameter;

/** Return type of {@link useWithdrawRouteChoices}. */
export type UseWithdrawRouteChoicesReturnType = UseQueryResult<WithdrawRouteChoices, SymmioRequestError>;

/**
 * Prepare the automatic recommendation and every route available for user selection.
 *
 * The hook resolves account isolation through {@link useSubAccount}. Core owns
 * recommendation and option discovery, performing at most one stateful Express
 * options request for the exact withdrawal intent.
 *
 * @param parameters - Required intent, optional policy/chain, and query overrides.
 * @returns Auto, Classic, and currently valid Express route choices.
 */
export function useWithdrawRouteChoices(
  parameters: UseWithdrawRouteChoicesParameters,
): UseWithdrawRouteChoicesReturnType {
  const config = useSymmioConfig(parameters);
  const connectedChainId = useSymmioChainId();
  const chainId = parameters.chainId ?? connectedChainId;
  const { data: subAccount } = useSubAccount({
    account: parameters.user,
    chainId,
    config,
    query: { enabled: parameters.query?.enabled !== false },
  });
  const options = getWithdrawRouteChoicesQueryOptions(config, {
    ...parameters,
    chainId,
    isolationType: subAccount?.isolationType,
    query: {
      ...parameters.query,
      enabled: parameters.query?.enabled !== false && subAccount !== undefined,
    },
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
  }) as UseWithdrawRouteChoicesReturnType;
}
