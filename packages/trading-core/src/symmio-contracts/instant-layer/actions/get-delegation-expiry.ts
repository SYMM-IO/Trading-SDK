import type { Address, Hex } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { instantLayerAbi } from "../../abi/v0.8.6/instant-layer";

/**
 * Parameters for {@link getDelegationExpiry}.
 */
export type GetDelegationExpiryParameters = Compute<
  ChainIdParameter & {
    /** Account that owns the delegation. */
    account: Address;
    /** Delegated signer being checked. */
    delegate: Address;
    /** Function selector (`bytes4`) being checked. */
    selector: Hex;
  }
>;

/** Return type of {@link getDelegationExpiry}: raw Unix timestamp in seconds. */
export type GetDelegationExpiryReturnType = bigint;

/**
 * Read the raw Instant Layer delegation expiry timestamp for one account,
 * delegate, and selector.
 *
 * Resolves the `InstantLayer` address from `config` and reads the public
 * `delegations` mapping.
 *
 * @param config - The SDK config.
 * @param parameters - Account, delegate, selector, optional chain id.
 * @returns Raw expiry timestamp in seconds.
 * @throws {SymmError} when the chain is unsupported.
 * @throws Viem read errors.
 *
 * @example
 * ```ts
 * const expiry = await getDelegationExpiry(config, { account, delegate, selector: "0x12345678" });
 * ```
 */
export async function getDelegationExpiry(
  config: Config,
  parameters: GetDelegationExpiryParameters,
): Promise<GetDelegationExpiryReturnType> {
  const { chainId, account, delegate, selector } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  return client.readContract({
    address: addresses.instantLayerAddress,
    abi: instantLayerAbi,
    functionName: "delegations",
    args: [account, delegate, selector],
  });
}
