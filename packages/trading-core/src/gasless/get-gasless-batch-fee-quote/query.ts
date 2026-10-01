import type { Hex } from "viem";
import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  gaslessBatchCallData,
  isGaslessBatchWalletExecute,
  type GaslessBatchCall,
  type GaslessBatchContractCall,
  type GaslessBatchRawCall,
} from "../batch/calls";
import { gaslessWalletCallData, type GaslessWalletCall } from "../gasless-wallet-execute/calls";
import {
  getGaslessBatchFeeQuote,
  type GetGaslessBatchFeeQuoteParameters,
  type GetGaslessBatchFeeQuoteReturnType,
} from "./get-gasless-batch-fee-quote";

/** Data resolved by the {@link getGaslessBatchFeeQuoteQueryOptions} query. */
export type GetGaslessBatchFeeQuoteData = GetGaslessBatchFeeQuoteReturnType;

/**
 * A call's calldata for the query key — or, when an ABI-level call does not
 * encode, its function name and arguments. A key builder runs during render,
 * where a throw would take the component down with it; falling back keeps the
 * key deterministic and leaves the encoding error to the query function, which
 * reports it as the query's error.
 */
function keyedCallData(
  call: GaslessBatchContractCall | GaslessBatchRawCall | GaslessWalletCall,
  encode: () => Hex,
): unknown {
  try {
    return encode();
  } catch {
    return "functionName" in call ? { functionName: call.functionName, args: call.args } : null;
  }
}

/**
 * The part of a batch call that decides its price, in a hashable form: encoded
 * calldata in place of the ABI (a full contract ABI would otherwise be walked
 * and hashed on every render), and every default made explicit, so equivalent
 * calls share one cache entry.
 */
function toGaslessBatchCallKey(call: GaslessBatchCall): unknown {
  if (isGaslessBatchWalletExecute(call)) {
    return {
      walletId: call.walletId ?? 0n,
      walletCalls: call.walletCalls.map((walletCall) => ({
        target: walletCall.target,
        value: walletCall.value ?? 0n,
        data: keyedCallData(walletCall, () => gaslessWalletCallData(walletCall)),
      })),
    };
  }
  return { data: keyedCallData(call, () => gaslessBatchCallData(call)) };
}

/**
 * Build the TanStack Query key for {@link getGaslessBatchFeeQuoteQueryOptions}.
 *
 * Each call is keyed by its **encoded calldata**, not its ABI: an
 * `{ abi, functionName, args }` call and the raw `{ data }` it encodes to share
 * one cache entry, and an omitted `walletId` / `value` keys as `0n`.
 *
 * @param options - Partial query parameters.
 * @returns A stable, hashable query key.
 */
export function getGaslessBatchFeeQuoteQueryKey(
  options: Compute<ExactPartial<GetGaslessBatchFeeQuoteParameters> & ConfigKeyParameter> = {},
) {
  return [
    "getGaslessBatchFeeQuote",
    filterQueryOptions({ ...options, calls: options.calls?.map(toGaslessBatchCallKey) }),
  ] as const;
}

/** Query-key type produced by {@link getGaslessBatchFeeQuoteQueryKey}. */
export type GetGaslessBatchFeeQuoteQueryKey = ReturnType<typeof getGaslessBatchFeeQuoteQueryKey>;

/**
 * Options accepted by {@link getGaslessBatchFeeQuoteQueryOptions}.
 */
export type GetGaslessBatchFeeQuoteOptions = Compute<
  GetGaslessBatchFeeQuoteParameters &
    QueryParameter<GetGaslessBatchFeeQuoteData, Error, GetGaslessBatchFeeQuoteData, GetGaslessBatchFeeQuoteQueryKey>
>;

/** TanStack Query options returned by {@link getGaslessBatchFeeQuoteQueryOptions}. */
export type GetGaslessBatchFeeQuoteQueryOptions = SymmioQueryOptions<
  GetGaslessBatchFeeQuoteData,
  Error,
  GetGaslessBatchFeeQuoteData,
  GetGaslessBatchFeeQuoteQueryKey
>;

/**
 * Build TanStack Query options for {@link getGaslessBatchFeeQuote}.
 *
 * The key covers the account, the chain and every call's encoded calldata, so
 * changing an argument re-quotes instead of reusing a stale quote.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(
 *   getGaslessBatchFeeQuoteQueryOptions(config, {
 *     account: subAccount,
 *     calls: [{ functionName: "allocate", args: [amount] }],
 *   }),
 * );
 * ```
 */
export function getGaslessBatchFeeQuoteQueryOptions(
  config: Config,
  options: GetGaslessBatchFeeQuoteOptions,
): GetGaslessBatchFeeQuoteQueryOptions {
  return {
    ...options.query,
    queryKey: getGaslessBatchFeeQuoteQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getGaslessBatchFeeQuote(config, { chainId: options.chainId, account: options.account, calls: options.calls }),
  };
}
