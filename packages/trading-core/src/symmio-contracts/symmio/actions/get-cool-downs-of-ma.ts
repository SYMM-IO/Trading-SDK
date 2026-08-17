import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.5/symmio";

/**
 * Parameters for {@link getCoolDownsOfMA}.
 */
export type GetCoolDownsOfMAParameters = Compute<ChainIdParameter>;

/**
 * Return type of {@link getCoolDownsOfMA}: the four cooldown periods from
 * `coolDownsOfMA()`, in contract order (unix seconds) —
 * `(withdrawCooldownPeriod, forceCancelCooldown, forceCancelCloseCooldown, forceCloseFirstCooldown)`.
 *
 * Index **1** is the **force-cancel cooldown** — the wait after a quote enters
 * `CANCEL_PENDING` before `forceCancelQuote` is allowed.
 */
export type GetCoolDownsOfMAReturnType = readonly [bigint, bigint, bigint, bigint];

/**
 * Read the protocol cooldown periods (`coolDownsOfMA()`), in unix seconds.
 *
 * The value at index **1** is the `forceCancelCooldown`: once a `CANCEL_PENDING`
 * quote's `statusModifyTimestamp + coolDownsOfMA()[1]` has passed, partyA may
 * call {@link "forceCancelQuote"}.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain id.
 * @returns The four cooldown values `[_, forceCancelCooldown, _, _]`.
 * @throws {SymmError} when the chain is not supported.
 *
 * @example
 * ```ts
 * const [, forceCancelCooldown] = await getCoolDownsOfMA(config);
 * ```
 */
export async function getCoolDownsOfMA(
  config: Config,
  parameters: GetCoolDownsOfMAParameters = {},
): Promise<GetCoolDownsOfMAReturnType> {
  const { chainId } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  return client.readContract({
    address: addresses.symmioAddress,
    abi: symmioAbi,
    functionName: "coolDownsOfMA",
  });
}
