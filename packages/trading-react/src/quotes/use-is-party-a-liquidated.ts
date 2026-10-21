"use client";

import {
  isPartyALiquidatedQueryOptions,
  type ConfigParameter,
  type IsPartyALiquidatedOptions,
  type IsPartyALiquidatedReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useIsPartyALiquidated}: the core query options (partyA,
 * chain id, TanStack `query` overrides) plus an optional `config`.
 */
export type UseIsPartyALiquidatedParameters = IsPartyALiquidatedOptions & ConfigParameter;

/** Return type of {@link useIsPartyALiquidated}. */
export type UseIsPartyALiquidatedReturnType = UseQueryResult<IsPartyALiquidatedReturnType, SymmioRequestError>;

/**
 * Read whether a partyA is **in liquidation** right now — `true` from the moment
 * a liquidator starts its liquidation until that liquidation is finalized. While
 * it is `true` the account is frozen and actions on its positions revert. The
 * query is disabled until `partyA` is set. `chainId` defaults to the connected
 * chain. Errors are normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data: inLiquidation } = useIsPartyALiquidated({ partyA: virtualAccount });
 * ```
 */
export function useIsPartyALiquidated(
  parameters: UseIsPartyALiquidatedParameters = {},
): UseIsPartyALiquidatedReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = isPartyALiquidatedQueryOptions(config, {
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
  }) as UseIsPartyALiquidatedReturnType;
}
