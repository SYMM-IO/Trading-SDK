import type { Address } from "viem";
import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { gaslessLayerAbi } from "../gateway/gasless-layer-abi";
import { resolveGaslessService } from "../resolve-gasless";

/**
 * Parameters for {@link getGaslessWalletNonce}.
 */
export type GetGaslessWalletNonceParameters = Compute<
  ChainIdParameter & {
    /** The account whose wallet-operation nonce to read (the owner wallet). */
    account: Address;
  }
>;

/** Return type of {@link getGaslessWalletNonce}. */
export type GetGaslessWalletNonceReturnType = bigint;

/**
 * Read the GaslessLayer's **wallet-operation** replay nonce for an account.
 *
 * A separate counter from the InstantLayer's operation nonces — the two are
 * not interchangeable. Wallet-execute operations sign with `nonce + 1`, read
 * immediately before signing.
 *
 * @param config - The SDK config.
 * @param parameters - Owner account, optional chain id.
 * @returns The current wallet-operation nonce. Sign with `nonce + 1n`.
 *
 * @example
 * ```ts
 * const current = await getGaslessWalletNonce(config, { account: owner });
 * ```
 */
export async function getGaslessWalletNonce(
  config: Config,
  parameters: GetGaslessWalletNonceParameters,
): Promise<GetGaslessWalletNonceReturnType> {
  const { chainId, account } = parameters;
  const gasless = resolveGaslessService(config, { chainId });
  const client = config.getClient({ chainId });

  return client.readContract({
    address: gasless.gaslessLayerAddress,
    abi: gaslessLayerAbi,
    functionName: "walletOperationNonces",
    args: [account],
  });
}
