"use client";

import {
  getGaslessFeeQuoteQueryOptions,
  type ConfigParameter,
  type GetGaslessFeeQuoteOptions,
  type GetGaslessFeeQuoteReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useGaslessFeeQuote}. */
export type UseGaslessFeeQuoteParameters = GetGaslessFeeQuoteOptions & ConfigParameter;

/** Return type of {@link useGaslessFeeQuote}. */
export type UseGaslessFeeQuoteReturnType = UseQueryResult<GetGaslessFeeQuoteReturnType, SymmioRequestError>;

/**
 * Quote what the GaslessLayer would charge to relay a batch (`previewFeeQuote`)
 * before prompting the user to sign. Amounts are 18-decimal and the quote is a
 * preview (`exact` is always `false`). An exhausted daily free quota surfaces as
 * an error with code `GASLESS_FREE_QUOTA_EXHAUSTED` — check it with
 * `isGaslessFreeQuotaExhaustedError`.
 *
 * @param parameters - The batch (`operations`, each with an optional `walletId`), optional chain id, config and query overrides.
 * @returns The TanStack query result, with failures normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const quote = useGaslessFeeQuote({ operations: [{ operation }] });
 * const fee18 = quote.data?.totalFee18;
 * ```
 */
export function useGaslessFeeQuote(parameters: UseGaslessFeeQuoteParameters): UseGaslessFeeQuoteReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();

  const options = getGaslessFeeQuoteQueryOptions(config, {
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
