"use client";
import {
  getLegacyCollateralLockedQueryOptions,
  type ConfigParameter,
  type GetLegacyCollateralLockedData,
  type GetLegacyCollateralLockedOptions,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Authenticated inputs and query controls for {@link useLegacyCollateralLocked}. */
export type UseLegacyCollateralLockedParameters = GetLegacyCollateralLockedOptions & ConfigParameter;
/** Data and request state returned by {@link useLegacyCollateralLocked}. */
export type UseLegacyCollateralLockedReturnType = UseQueryResult<GetLegacyCollateralLockedData, SymmioRequestError>;
/**
 * Read exact legacy locked collateral using the selected deployment.
 * @param parameters - Required account/token, optional chain/solver and query controls.
 * @returns Query state; the host owns credential lifetime and refresh policy.
 * @example const query = useLegacyCollateralLocked({ account, accessToken, chainId: 42161 });
 */
export function useLegacyCollateralLocked(
  parameters: UseLegacyCollateralLockedParameters,
): UseLegacyCollateralLockedReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getLegacyCollateralLockedQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
  });
  return useQuery({
    ...options,
    queryFn: async (context) => {
      try {
        return await options.queryFn(context);
      } catch (error) {
        throw normalizeSymmError(error);
      }
    },
  }) as UseLegacyCollateralLockedReturnType;
}
