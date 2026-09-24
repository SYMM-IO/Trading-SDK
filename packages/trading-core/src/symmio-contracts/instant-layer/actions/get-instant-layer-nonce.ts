import type { Address } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { instantLayerAbi } from "../../abi/v0.8.6/instant-layer";

/**
 * Parameters for {@link getInstantLayerNonce}.
 */
export type GetInstantLayerNonceParameters = Compute<
  ChainIdParameter & {
    /** InstantLayer signer account (the sub-account the operation runs under). */
    account: Address;
  }
>;

/** Return type of {@link getInstantLayerNonce}: the account's current replay nonce. */
export type GetInstantLayerNonceReturnType = bigint;

/**
 * Read the Instant Layer replay nonce for a signer account.
 *
 * Nonces are **sequential**: an operation must be signed with the *next* nonce
 * (`current + 1`), and a batch must carry strictly consecutive nonces in
 * signed-op order (`current + 1`, `current + 2`, …). Read this immediately
 * before building operations — a stale value produces signatures the relayer's
 * simulation rejects. Two concurrent operations built from the same read will
 * collide; serialize per account.
 *
 * @param config - The SDK config.
 * @param parameters - Signer account, optional chain id.
 * @returns The current on-chain nonce. Sign with `nonce + 1n`.
 * @throws {SymmError} when the chain is unsupported.
 * @throws Viem read errors.
 *
 * @example
 * ```ts
 * const current = await getInstantLayerNonce(config, { account: subAccount });
 * const operation = buildSignedOperation({ ...fields, nonce: current + 1n });
 * ```
 */
export async function getInstantLayerNonce(
  config: Config,
  parameters: GetInstantLayerNonceParameters,
): Promise<GetInstantLayerNonceReturnType> {
  const { chainId, account } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  return client.readContract({
    address: addresses.instantLayerAddress,
    abi: instantLayerAbi,
    functionName: "nonces",
    args: [account],
  });
}
