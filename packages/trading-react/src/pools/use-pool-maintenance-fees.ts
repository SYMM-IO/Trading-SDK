"use client";
import {
  getPoolMaintenanceFeesQueryOptions,
  type ConfigParameter,
  type GetPoolMaintenanceFeesOptions,
} from "@symmio/trading-core";
import { useQuery } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Options for {@link usePoolMaintenanceFees}. */
export type UsePoolMaintenanceFeesParameters = GetPoolMaintenanceFeesOptions & ConfigParameter;
/** Read maintenance fees through the configured listing backend. */
export function usePoolMaintenanceFees(parameters: UsePoolMaintenanceFeesParameters) {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getPoolMaintenanceFeesQueryOptions(config, { ...parameters, chainId: parameters.chainId ?? chainId });
  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (error) {
        throw normalizeSymmError(error);
      }
    },
  });
}
