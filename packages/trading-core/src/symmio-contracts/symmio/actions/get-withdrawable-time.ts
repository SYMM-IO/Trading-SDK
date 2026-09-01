import type { Address } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.6/symmio";

/**
 * Parameters for {@link getWithdrawableTime}.
 */
export type GetWithdrawableTimeParameters = Compute<
  ChainIdParameter & {
    /** The subaccount whose earliest withdrawable time to read. */
    user: Address;
  }
>;

/**
 * Return type of {@link getWithdrawableTime}: a Unix timestamp (seconds) as a
 * `bigint`.
 */
export type GetWithdrawableTimeReturnType = bigint;

/**
 * Read the earliest timestamp at which a withdrawal initiated now could be
 * finalized for a subaccount.
 *
 * Returns `max(lastDeallocation + cooldownPeriod, block.timestamp)` — because the
 * cooldown is tied to the last deallocation, a subaccount whose funds have been
 * idle past the cooldown can finalize immediately. Useful to render a
 * "withdrawable at …" hint before {@link "initiateWithdraw"}.
 *
 * @param config - The SDK config.
 * @param parameters - Subaccount, optional chain id.
 * @returns The earliest finalizable timestamp, in seconds.
 * @throws {SymmError} when the chain is not supported.
 * @throws Viem's `ContractFunctionExecutionError` and friends for on-chain failures.
 *
 * @example
 * ```ts
 * const at = await getWithdrawableTime(config, { user: "0xsub…" });
 * ```
 */
export async function getWithdrawableTime(
  config: Config,
  parameters: GetWithdrawableTimeParameters,
): Promise<GetWithdrawableTimeReturnType> {
  const { chainId, user } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  return client.readContract({
    address: addresses.symmioAddress,
    abi: symmioAbi,
    functionName: "getWithdrawableTime",
    args: [user],
  });
}
