"use client";
import {
  checkListingTokenSupportQueryOptions,
  type CheckListingTokenSupportOptions,
  type ConfigParameter,
} from "@symmio/trading-core";
import { useQuery } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Options for {@link useListingTokenSupport}. */
export type UseListingTokenSupportParameters = CheckListingTokenSupportOptions & ConfigParameter;
/** Read token support through the configured listing backend. */
export function useListingTokenSupport(parameters: UseListingTokenSupportParameters) {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = checkListingTokenSupportQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
  });
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
