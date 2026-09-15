import type { Config } from "../../../core/config";
import type { Compute, ConfigKeyParameter } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import type { InstantOpenParameters } from "../instant-open/types";
import { prepareInstantOpenParams, type PrepareInstantOpenParameters } from "./prepare-instant-open-params";

/** Data resolved by the {@link prepareInstantOpenParamsQueryOptions} query — the exact params a send will sign. */
export type PrepareInstantOpenParamsData = InstantOpenParameters;

/** Build the TanStack Query key for {@link prepareInstantOpenParamsQueryOptions}. */
export function getPrepareInstantOpenParamsQueryKey(
  options: Compute<PrepareInstantOpenParameters & ConfigKeyParameter>,
) {
  return ["prepareInstantOpenParams", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getPrepareInstantOpenParamsQueryKey}. */
export type PrepareInstantOpenParamsQueryKey = ReturnType<typeof getPrepareInstantOpenParamsQueryKey>;

/** Options accepted by {@link prepareInstantOpenParamsQueryOptions}. */
export type PrepareInstantOpenParamsOptions = Compute<
  PrepareInstantOpenParameters &
    QueryParameter<PrepareInstantOpenParamsData, Error, PrepareInstantOpenParamsData, PrepareInstantOpenParamsQueryKey>
>;

/** TanStack Query options returned by {@link prepareInstantOpenParamsQueryOptions}. */
export type PrepareInstantOpenParamsQueryOptions = SymmioQueryOptions<
  PrepareInstantOpenParamsData,
  Error,
  PrepareInstantOpenParamsData,
  PrepareInstantOpenParamsQueryKey
>;

/**
 * Build TanStack Query options for {@link prepareInstantOpenParams} — a
 * **read-only preview** of the exact {@link InstantOpenParameters} a send will
 * sign. `prepareInstantOpenParams` neither signs nor submits, so this is safe to
 * run live as inputs change; feed the result straight into a "quote preview" so
 * what the user sees is bit-for-bit what `sendQuote` receives.
 *
 * Disabled until a funding source exists — a non-empty `initialMargin`, or a
 * `fund` with a balance. Pre-fill the optional fields (`markPrice`, `feeRates`,
 * `lockedParamPercent`, `estimatedOpenPrice`, market metadata) so the query
 * function is pure and does no per-render network; passing the same
 * `estimatedOpenPrice` here and to the submit makes `margin.amount` (whose
 * settlement leg tracks the estimate) match the sent quote exactly.
 *
 * The slippage gate inside `prepareInstantOpenParams` still runs, so an
 * out-of-tolerance estimate surfaces as the query error — the honest preview of
 * a quote the submit would also reject.
 *
 * @example
 * ```ts
 * useQuery(
 *   prepareInstantOpenParamsQueryOptions(config, {
 *     subAccountAddress,
 *     from: sessionKey,
 *     market: { id: 1 },
 *     positionType: PositionType.LONG,
 *     initialMargin: "100",
 *     leverage: 5,
 *     slippage: 1,
 *   }),
 * );
 * ```
 */
export function prepareInstantOpenParamsQueryOptions(
  config: Config,
  options: PrepareInstantOpenParamsOptions,
): PrepareInstantOpenParamsQueryOptions {
  const { ...parameters } = options;
  const hasFunding =
    parameters.fund !== undefined ? parameters.fund.balance.length > 0 : (parameters.initialMargin?.length ?? 0) > 0;
  return {
    ...options.query,
    queryKey: getPrepareInstantOpenParamsQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: (options.query?.enabled ?? true) && hasFunding,
    queryFn: () => prepareInstantOpenParams(config, parameters),
  };
}
