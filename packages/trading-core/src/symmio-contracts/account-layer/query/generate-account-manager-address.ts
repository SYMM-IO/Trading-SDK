import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  generateAccountManagerAddress,
  type GenerateAccountManagerAddressParameters,
  type GenerateAccountManagerAddressReturnType,
} from "../actions/generate-account-manager-address";

/** Data resolved by the {@link generateAccountManagerAddressQueryOptions} query. */
export type GenerateAccountManagerAddressData = GenerateAccountManagerAddressReturnType;

/**
 * Build the TanStack Query key for {@link generateAccountManagerAddressQueryOptions}.
 *
 * @param options - Partial query parameters (chain id, registrant, name).
 * @returns A stable, hashable query key.
 */
export function generateAccountManagerAddressQueryKey(
  options: Compute<ExactPartial<GenerateAccountManagerAddressParameters> & ConfigKeyParameter> = {},
) {
  return ["generateAccountManagerAddress", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link generateAccountManagerAddressQueryKey}. */
export type GenerateAccountManagerAddressQueryKey = ReturnType<typeof generateAccountManagerAddressQueryKey>;

/**
 * Options accepted by {@link generateAccountManagerAddressQueryOptions}: the
 * action's parameters (all optional), an optional cache scope, and TanStack
 * overrides.
 */
export type GenerateAccountManagerAddressOptions = Compute<
  ExactPartial<GenerateAccountManagerAddressParameters> &
    QueryParameter<
      GenerateAccountManagerAddressData,
      Error,
      GenerateAccountManagerAddressData,
      GenerateAccountManagerAddressQueryKey
    >
>;

/** TanStack Query options returned by {@link generateAccountManagerAddressQueryOptions}. */
export type GenerateAccountManagerAddressQueryOptions = SymmioQueryOptions<
  GenerateAccountManagerAddressData,
  Error,
  GenerateAccountManagerAddressData,
  GenerateAccountManagerAddressQueryKey
>;

/**
 * Build TanStack Query options for {@link generateAccountManagerAddress}. The
 * query is disabled until both `registrant` and `name` are set. An unsupported
 * chain surfaces a {@link SymmError} from the query function.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(generateAccountManagerAddressQueryOptions(config, { registrant, name }));
 * ```
 */
export function generateAccountManagerAddressQueryOptions(
  config: Config,
  options: GenerateAccountManagerAddressOptions = {},
): GenerateAccountManagerAddressQueryOptions {
  return {
    ...options.query,
    queryKey: generateAccountManagerAddressQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: Boolean(options.registrant) && Boolean(options.name) && (options.query?.enabled ?? true),
    queryFn: () => {
      const { chainId, registrant, name } = options;
      if (!registrant || !name) {
        throw new SymmError(
          "validation",
          "MISSING_PARAMS",
          "generateAccountManagerAddress: `registrant` and `name` are required.",
        );
      }
      return generateAccountManagerAddress(config, { chainId, registrant, name });
    },
  };
}
