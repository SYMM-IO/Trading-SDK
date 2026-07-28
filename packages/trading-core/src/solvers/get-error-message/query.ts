import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { getErrorMessage, type GetErrorMessageParameters, type GetErrorMessageReturnType } from "./get-error-message";

/** Data resolved by the {@link getErrorMessageQueryOptions} query. */
export type GetErrorMessageData = GetErrorMessageReturnType;

/**
 * Build the TanStack Query key for {@link getErrorMessageQueryOptions}.
 *
 * @param options - Query parameters (error code, chain id, scope).
 * @returns A stable, hashable query key.
 */
export function getErrorMessageQueryKey(options: Compute<GetErrorMessageParameters & ConfigKeyParameter>) {
  return ["getErrorMessage", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getErrorMessageQueryKey}. */
export type GetErrorMessageQueryKey = ReturnType<typeof getErrorMessageQueryKey>;

/** Options accepted by {@link getErrorMessageQueryOptions}. */
export type GetErrorMessageOptions = Compute<
  GetErrorMessageParameters & QueryParameter<GetErrorMessageData, Error, GetErrorMessageData, GetErrorMessageQueryKey>
>;

/** TanStack Query options returned by {@link getErrorMessageQueryOptions}. */
export type GetErrorMessageQueryOptions = SymmioQueryOptions<
  GetErrorMessageData,
  Error,
  GetErrorMessageData,
  GetErrorMessageQueryKey
>;

/**
 * Build TanStack Query options for {@link getErrorMessage}. A non-rasa solver
 * surfaces `UNSUPPORTED_BY_SOLVER` from the query function.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 */
export function getErrorMessageQueryOptions(
  config: Config,
  options: GetErrorMessageOptions,
): GetErrorMessageQueryOptions {
  return {
    ...options.query,
    queryKey: getErrorMessageQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getErrorMessage(config, { errorCode: options.errorCode, chainId: options.chainId, solverId: options.solverId }),
  };
}
