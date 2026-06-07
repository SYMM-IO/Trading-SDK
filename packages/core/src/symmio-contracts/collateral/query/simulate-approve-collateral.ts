import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  simulateApproveCollateral,
  type SimulateApproveCollateralParameters,
  type SimulateApproveCollateralReturnType,
} from "../actions/simulate-approve-collateral";

/** Data resolved by the {@link getSimulateApproveCollateralQueryOptions} query. */
export type SimulateApproveCollateralData = SimulateApproveCollateralReturnType;

/**
 * Build the TanStack Query key for {@link getSimulateApproveCollateralQueryOptions}.
 *
 * @param options - Partial simulate parameters (chain id, amount, from).
 * @returns A stable, hashable query key.
 */
export function getSimulateApproveCollateralQueryKey(
  options: Compute<ExactPartial<SimulateApproveCollateralParameters> & ConfigKeyParameter> = {},
) {
  return ["simulateApproveCollateral", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getSimulateApproveCollateralQueryKey}. */
export type SimulateApproveCollateralQueryKey = ReturnType<typeof getSimulateApproveCollateralQueryKey>;

/** Options accepted by {@link getSimulateApproveCollateralQueryOptions}. */
export type SimulateApproveCollateralOptions = Compute<
  ExactPartial<SimulateApproveCollateralParameters> &
    QueryParameter<
      SimulateApproveCollateralData,
      Error,
      SimulateApproveCollateralData,
      SimulateApproveCollateralQueryKey
    >
>;

/** TanStack Query options returned by {@link getSimulateApproveCollateralQueryOptions}. */
export type SimulateApproveCollateralQueryOptions = SymmioQueryOptions<
  SimulateApproveCollateralData,
  Error,
  SimulateApproveCollateralData,
  SimulateApproveCollateralQueryKey
>;

/**
 * Build TanStack Query options that dry-run `approveCollateral`. The query is
 * disabled until `amount` is set.
 *
 * @param config - The SDK config.
 * @param options - Simulate parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 */
export function getSimulateApproveCollateralQueryOptions(
  config: Config,
  options: SimulateApproveCollateralOptions = {},
): SimulateApproveCollateralQueryOptions {
  return {
    ...options.query,
    queryKey: getSimulateApproveCollateralQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.amount !== undefined && (options.query?.enabled ?? true),
    queryFn: () => {
      const { chainId, amount, from } = options;
      if (amount === undefined) {
        throw new SymmError("validation", "MISSING_ARGS", "simulateApproveCollateral: `amount` is required.");
      }
      return simulateApproveCollateral(config, { chainId, amount, from });
    },
  };
}
