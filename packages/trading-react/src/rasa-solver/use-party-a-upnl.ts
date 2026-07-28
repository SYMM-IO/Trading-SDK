"use client";

import {
  getPartyAUpnlQueryOptions,
  type ConfigParameter,
  type GetPartyAUpnlData,
  type GetPartyAUpnlOptions,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link usePartyAUpnl}. */
export type UsePartyAUpnlParameters = GetPartyAUpnlOptions & ConfigParameter;

/** Return type of {@link usePartyAUpnl}. */
export type UsePartyAUpnlReturnType = UseQueryResult<GetPartyAUpnlData, SymmioRequestError>;

/**
 * Fetch a partyA's unrealized PnL (decimal string) from the Rasa-only
 * `/partyA_upnl` endpoint. Fails with `UNSUPPORTED_BY_SOLVER` when the
 * resolved solver is not a `rasa` solver.
 */
export function usePartyAUpnl(parameters: UsePartyAUpnlParameters): UsePartyAUpnlReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getPartyAUpnlQueryOptions(config, {
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
  }) as UsePartyAUpnlReturnType;
}
