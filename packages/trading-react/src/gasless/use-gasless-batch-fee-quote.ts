"use client";

import {
  getGaslessBatchFeeQuoteQueryOptions,
  type ConfigParameter,
  type GetGaslessBatchFeeQuoteOptions,
  type GetGaslessBatchFeeQuoteReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { useDebouncedBatch } from "./use-debounced-batch";

/** Default quiet period (ms) before a changed batch is re-quoted. */
const DEFAULT_DEBOUNCE_MS = 500;

/** Parameters for {@link useGaslessBatchFeeQuote}. */
export type UseGaslessBatchFeeQuoteParameters = GetGaslessBatchFeeQuoteOptions &
  ConfigParameter & {
    /**
     * Quiet period (ms) before a changed `account` or `calls` is re-quoted, so
     * a form that rebuilds its calls on every keystroke reads the GaslessLayer
     * once the user pauses — not once per keystroke. Until then the quote of
     * the last settled batch stays in place. Changes are detected by content,
     * so rebuilding an identical array on every render never restarts the wait.
     * The first batch is quoted at once. Defaults to 500; `0` quotes every
     * change immediately.
     */
    debounceMs?: number;
  };

/** Return type of {@link useGaslessBatchFeeQuote}. */
export type UseGaslessBatchFeeQuoteReturnType = UseQueryResult<GetGaslessBatchFeeQuoteReturnType, SymmioRequestError>;

/**
 * Preview what relaying a gasless batch would cost — the same `account` and
 * `calls` you would hand to {@link useRelayGaslessBatch}, priced by the
 * GaslessLayer's `previewFeeQuote` before any signature prompt.
 *
 * The result depends only on the account and the calls (their nonces,
 * deadlines and signatures are never priced), so it caches per batch, and a
 * call given by `functionName`, by `abi` or as raw `data` shares one cache
 * entry. Amounts are 18-decimal; `totalFee18` is the batch total and
 * `payments` has one row per call. An exhausted daily free quota surfaces as
 * an error with code `GASLESS_FREE_QUOTA_EXHAUSTED`.
 *
 * Pass the form's live inputs straight in: a changed batch is **debounced
 * internally** (`debounceMs`, default 500), so typing an amount reads the
 * GaslessLayer once the user settles.
 *
 * @param parameters - The account, the calls, optional chain id, debounce, config and query overrides.
 * @returns The TanStack query result, with failures normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const quote = useGaslessBatchFeeQuote({
 *   account: subAccount,
 *   calls: [{ functionName: "allocate", args: [amount] }],
 * });
 * const fee = quote.data ? formatUnits(quote.data.totalFee18, 18) : undefined;
 * ```
 */
export function useGaslessBatchFeeQuote(
  parameters: UseGaslessBatchFeeQuoteParameters,
): UseGaslessBatchFeeQuoteReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();

  /** `debounceMs` is pulled out so it never reaches the query options or the cache key. */
  const { debounceMs, ...queryParameters } = parameters;
  const batch = useDebouncedBatch(
    { account: parameters.account, calls: parameters.calls },
    debounceMs ?? DEFAULT_DEBOUNCE_MS,
  );

  const options = getGaslessBatchFeeQuoteQueryOptions(config, {
    ...queryParameters,
    ...batch,
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
  }) as UseGaslessBatchFeeQuoteReturnType;
}
