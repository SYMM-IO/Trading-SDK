import { isAddressEqual, zeroAddress, type Address } from "viem";
import type { Config } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { gaslessLayerAbi } from "../../symmio-contracts/abi/v0.8.6/gasless-layer";
import { resolveGaslessService } from "../resolve-gasless";
import { assertGaslessWalletId } from "../wallet-id";

/**
 * Parameters for {@link getGaslessWalletAddress}.
 */
export type GetGaslessWalletAddressParameters = Compute<
  ChainIdParameter & {
    /** The owner wallet the deterministic gasless wallet belongs to — an owner address, never a GaslessWallet address. */
    owner: Address;
    /**
     * Which of the owner's GaslessWallets to read. Defaults to `0n`, the
     * original wallet, whose address is unchanged by the multi-wallet upgrade.
     * Every positive id derives its own independent address. Range `0n`
     * through `2^256 - 1`.
     */
    walletId?: bigint;
  }
>;

/** Return type of {@link getGaslessWalletAddress}. */
export type GetGaslessWalletAddressReturnType = Address;

/**
 * Read the deterministic address of an owner's GaslessWallet from the
 * GaslessLayer — `getGaslessWalletAddress(owner, walletId)`.
 *
 * A pure `CREATE2` view, safe to show **before** any transaction exists: a
 * wallet is deployed lazily on first use and can receive collateral before
 * that. A wallet is identified by `(owner, walletId)`, and each id has its own
 * address, balances and nonce stream. The address is the wallet's **deposit
 * address** for gasless onboarding and the `target` of its gasless-wallet
 * `execute` operations. Collateral sent to it can only ever reach a
 * sub-account owned by `owner`.
 *
 * @param config - The SDK config.
 * @param parameters - Owner wallet, optional wallet id (default `0n`), optional chain id.
 * @returns The deterministic wallet address.
 * @throws {SymmError} `GASLESS_WALLET_ID_INVALID` for a wallet id outside the `uint256` range
 *   (or a JavaScript `number`), before any RPC call.
 * @throws {SymmError} `GASLESS_NOT_CONFIGURED` / `GASLESS_UNSUPPORTED_CONTRACTS_VERSION`.
 * @throws {SymmError} `GASLESS_WALLET_UNAVAILABLE` when the gateway returns the
 *   zero address (an unconfigured deployment returns `0x0` instead of reverting).
 *
 * @example
 * ```ts
 * const original = await getGaslessWalletAddress(config, { owner });
 * const depositWallet = await getGaslessWalletAddress(config, { owner, walletId: 1n });
 * ```
 */
export async function getGaslessWalletAddress(
  config: Config,
  parameters: GetGaslessWalletAddressParameters,
): Promise<GetGaslessWalletAddressReturnType> {
  const { chainId, owner } = parameters;
  const walletId = assertGaslessWalletId(parameters.walletId ?? 0n);
  const gasless = resolveGaslessService(config, { chainId });
  const client = config.getClient({ chainId });

  const wallet = await client.readContract({
    address: gasless.gaslessLayerAddress,
    abi: gaslessLayerAbi,
    functionName: "getGaslessWalletAddress",
    args: [owner, walletId],
  });

  /** The zero-address guard is load-bearing: an unwired gateway answers 0x0. */
  if (isAddressEqual(wallet, zeroAddress)) {
    throw new SymmError(
      "api",
      "GASLESS_WALLET_UNAVAILABLE",
      `Gasless: the GaslessLayer returned the zero address for wallet ${walletId} of ${owner} — the gateway is not fully configured.`,
    );
  }
  return wallet;
}
