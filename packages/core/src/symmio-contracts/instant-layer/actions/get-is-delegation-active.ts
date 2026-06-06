import type { Address, Hex } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { instantLayerAbi } from "../../abi/v0.8.5/instant-layer";

/**
 * Parameters for {@link getIsDelegationActive}.
 */
export type GetIsDelegationActiveParameters = Compute<
  ChainIdParameter & {
    /** Account that owns the delegation. */
    account: Address;
    /** Delegated signer being checked. */
    delegate: Address;
    /** Function selector (`bytes4`) being checked. */
    selector: Hex;
  }
>;

/** Return type of {@link getIsDelegationActive}. */
export type GetIsDelegationActiveReturnType = boolean;

/**
 * Read whether one Instant Layer delegation is active according to the contract.
 *
 * @param config - The SDK config.
 * @param parameters - Account, delegate, selector, optional chain id.
 * @returns `true` when the delegation is active.
 * @throws {SymmError} when the chain is unsupported.
 * @throws Viem read errors.
 *
 * @example
 * ```ts
 * const isActive = await getIsDelegationActive(config, { account, delegate, selector: "0x12345678" });
 * ```
 */
export async function getIsDelegationActive(
  config: Config,
  parameters: GetIsDelegationActiveParameters,
): Promise<GetIsDelegationActiveReturnType> {
  const { chainId, account, delegate, selector } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  return client.readContract({
    address: addresses.instantLayerAddress,
    abi: instantLayerAbi,
    functionName: "isDelegationActive",
    args: [account, delegate, selector],
  });
}
