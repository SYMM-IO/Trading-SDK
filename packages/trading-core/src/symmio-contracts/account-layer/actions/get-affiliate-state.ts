import type { Address } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { accountLayerAbi } from "../../abi/v0.8.6/account-layer";
import { AffiliateState } from "../types";

/**
 * Parameters for {@link getAffiliateState}.
 */
export type GetAffiliateStateParameters = Compute<
  ChainIdParameter & {
    /** The affiliate (AccountManager) address to read the lifecycle state of. */
    affiliate: Address;
  }
>;

/** Return type of {@link getAffiliateState}. */
export type GetAffiliateStateReturnType = AffiliateState;

/**
 * Read an affiliate's current lifecycle state on the `AccountLayer`.
 *
 * Resolves the viem client and `AccountLayer` address from `config` for the
 * given chain (or the config's default chain when `chainId` is omitted). Use
 * this to poll after {@link requestToRegisterAffiliate}: the state advances from
 * `PENDING` to `ACTIVE` once an approver approves the registration.
 *
 * @param config - The SDK config.
 * @param parameters - Affiliate address, optional chain id.
 * @returns The affiliate's {@link AffiliateState} (`NONE` for an unknown address).
 * @throws {SymmError} when the chain is not supported.
 * @throws Viem's `ContractFunctionExecutionError` and friends for on-chain failures.
 *
 * @example
 * ```ts
 * const state = await getAffiliateState(config, { affiliate: "0xaff…" });
 * if (state === AffiliateState.ACTIVE) { }
 * ```
 */
export async function getAffiliateState(
  config: Config,
  parameters: GetAffiliateStateParameters,
): Promise<GetAffiliateStateReturnType> {
  const { chainId, affiliate } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  const result = await client.readContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "getAffiliateState",
    args: [affiliate],
  });

  return result as AffiliateState;
}
