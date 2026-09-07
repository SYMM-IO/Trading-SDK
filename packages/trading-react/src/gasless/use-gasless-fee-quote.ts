"use client";

import {
  getGaslessOperationalFeeQuoteQueryOptions,
  type ConfigParameter,
  type GetGaslessOperationalFeeQuoteOptions,
  type GetGaslessOperationalFeeQuoteReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useGaslessFeeQuote}. */
export type UseGaslessFeeQuoteParameters = GetGaslessOperationalFeeQuoteOptions & ConfigParameter;

/** Return type of {@link useGaslessFeeQuote}. */
export type UseGaslessFeeQuoteReturnType = UseQueryResult<GetGaslessOperationalFeeQuoteReturnType, SymmioRequestError>;

/**
 * Quote the operational fee the GaslessLayer would charge for a batch of
 * operations - the authoritative pre-flight before asking the user to sign.
 * Treat `wouldBlockOnQuota` as a hard stop.
 *
 * @example
 * ```tsx
 * const query = useGaslessFeeQuote({ account, operations });
 * ```
 */
export function useGaslessFeeQuote(parameters: UseGaslessFeeQuoteParameters): UseGaslessFeeQuoteReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();

  const options = getGaslessOperationalFeeQuoteQueryOptions(config, {
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
  }) as UseGaslessFeeQuoteReturnType;
}
