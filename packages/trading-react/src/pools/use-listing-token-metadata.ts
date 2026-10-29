"use client";
import {
  getListingTokenMetadataQueryOptions,
  type ConfigParameter,
  type GetListingTokenMetadataOptions,
} from "@symmio/trading-core";
import { useQuery } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Options for {@link useListingTokenMetadata}. */
export type UseListingTokenMetadataParameters = GetListingTokenMetadataOptions & ConfigParameter;
/** Read token metadata through the configured listing backend. */
export function useListingTokenMetadata(parameters: UseListingTokenMetadataParameters) {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getListingTokenMetadataQueryOptions(config, {
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
