import { isAddressEqual, zeroAddress, type Address } from "viem";
import type { Config } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { gaslessLayerAbi } from "../gateway/gasless-layer-abi";
import { resolveGaslessService } from "../resolve-gasless";

/**
 * Parameters for {@link getGaslessWalletAddress}.
 */
export type GetGaslessWalletAddressParameters = Compute<
  ChainIdParameter & {
    /** The owner wallet the deterministic gasless wallet belongs to. */
    owner: Address;
  }
>;

/** Return type of {@link getGaslessWalletAddress}. */
export type GetGaslessWalletAddressReturnType = Address;

/**
 * Read the owner's deterministic gasless-wallet address from the GaslessLayer.
 *
 * A pure `CREATE2` view — safe to show **before** any transaction exists. The
 * same address is the owner's **deposit address** for gasless onboarding and
 * the `target` of gasless-wallet `execute` operations. Collateral sent to it
 * can only ever reach a sub-account owned by `owner`.
 *
 * @param config - The SDK config.
 * @param parameters - Owner wallet, optional chain id.
 * @returns The deterministic wallet address.
 * @throws {SymmError} `GASLESS_WALLET_UNAVAILABLE` when the gateway returns the
 *   zero address (an unconfigured deployment returns `0x0` instead of reverting).
 *
 * @example
 * ```ts
 * const depositAddress = await getGaslessWalletAddress(config, { owner });
 * ```
 */
export async function getGaslessWalletAddress(
  config: Config,
  parameters: GetGaslessWalletAddressParameters,
): Promise<GetGaslessWalletAddressReturnType> {
  const { chainId, owner } = parameters;
  const gasless = resolveGaslessService(config, { chainId });
  const client = config.getClient({ chainId });

  const wallet = await client.readContract({
    address: gasless.gaslessLayerAddress,
    abi: gaslessLayerAbi,
    functionName: "getGaslessWalletAddress",
    args: [owner],
  });

  /** The zero-address guard is load-bearing: an unwired gateway answers 0x0. */
  if (isAddressEqual(wallet, zeroAddress)) {
    throw new SymmError(
      "api",
      "GASLESS_WALLET_UNAVAILABLE",
      `Gasless: the GaslessLayer returned the zero address for ${owner}'s wallet — the gateway is not fully configured.`,
    );
  }
  return wallet;
}
