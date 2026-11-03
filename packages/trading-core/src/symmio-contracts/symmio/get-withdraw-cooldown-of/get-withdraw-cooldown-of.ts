import type { Address } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.6/symmio";

/** Parameters for {@link getWithdrawCooldownOf}. */
export type GetWithdrawCooldownOfParameters = Compute<
  ChainIdParameter & {
    /** Account whose last protocol-internal balance-credit timestamp to read. */
    user: Address;
  }
>;

/** Unix timestamp in seconds returned by {@link getWithdrawCooldownOf}, or zero if never stamped. */
export type GetWithdrawCooldownOfReturnType = bigint;

/**
 * Read `withdrawCooldownOf(user)`, the account's stored `deallocateTimestamp`.
 * This is the last qualifying balance-credit timestamp, not a duration or the
 * withdrawal unlock time. Deallocation and internal balance transfers stamp it;
 * ordinary external deposits do not. Use `getWithdrawableTime` for readiness
 * before initiation, and a pending request's stored `cooldownEndTime` afterward.
 *
 * @param config - SDK configuration.
 * @param parameters - Account and optional chain ID.
 * @returns The raw stored timestamp in seconds.
 * @throws {SymmError} when the chain is not supported.
 * @throws Viem's `ContractFunctionExecutionError` and friends for on-chain failures.
 *
 * @example
 * ```ts
 * const lastCredit = await getWithdrawCooldownOf(config, { user: account });
 * ```
 */
export async function getWithdrawCooldownOf(
  config: Config,
  parameters: GetWithdrawCooldownOfParameters,
): Promise<GetWithdrawCooldownOfReturnType> {
  const { chainId, user } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  return client.readContract({
    address: addresses.symmioAddress,
    abi: symmioAbi,
    functionName: "withdrawCooldownOf",
    args: [user],
  });
}
