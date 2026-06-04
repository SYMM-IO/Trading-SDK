import type { Address } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { accountLayerAbi } from "../../abi/v0.8.5/account-layer";

/**
 * Parameters for {@link getSubAccountVirtualNonce}.
 */
export type GetSubAccountVirtualNonceParameters = Compute<
  ChainIdParameter & {
    /** The subaccount address whose Virtual Account nonce to read. */
    subAccount: Address;
  }
>;

/** Return type of {@link getSubAccountVirtualNonce}: the subaccount's VA creation nonce. */
export type GetSubAccountVirtualNonceReturnType = bigint;

/**
 * Read a subaccount's Virtual Account (VA) nonce - the per-subaccount counter
 * that seeds deterministic VA address derivation (used by
 * `predictNextVirtualAccountAddress`).
 *
 * Resolves the viem client and `AccountLayer` address from `config` for the
 * given chain (or the config's default chain when `chainId` is omitted).
 *
 * @param config - The SDK config.
 * @param parameters - Subaccount address, optional chain id.
 * @returns The subaccount's current VA nonce.
 * @throws {SymmError} when the chain is not supported.
 * @throws Viem's `ContractFunctionExecutionError` and friends for on-chain failures.
 *
 * @example
 * ```ts
 * const nonce = await getSubAccountVirtualNonce(config, { subAccount: "0xsub…" });
 * ```
 */
export async function getSubAccountVirtualNonce(
  config: Config,
  parameters: GetSubAccountVirtualNonceParameters,
): Promise<GetSubAccountVirtualNonceReturnType> {
  const { chainId, subAccount } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  return client.readContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "getSubAccountVirtualNonce",
    args: [subAccount],
  });
}
