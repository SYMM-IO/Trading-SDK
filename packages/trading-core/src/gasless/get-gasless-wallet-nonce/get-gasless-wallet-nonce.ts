import type { Address } from "viem";
import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { gaslessLayerAbi } from "../../symmio-contracts/abi/v0.8.6/gasless-layer";
import { resolveGaslessService } from "../resolve-gasless";
import { assertGaslessWalletId } from "../wallet-id";

/**
 * Parameters for {@link getGaslessWalletNonce}.
 */
export type GetGaslessWalletNonceParameters = Compute<
  ChainIdParameter & {
    /** The owner wallet the gasless wallet belongs to — an owner address, never a GaslessWallet address. */
    owner: Address;
    /**
     * Which of the owner's GaslessWallets the operation executes from. Defaults
     * to `0n`, the original wallet, which keeps its pre-upgrade nonce stream.
     * Range `0n` through `2^256 - 1`.
     */
    walletId?: bigint;
    /**
     * The signer account the nonce is keyed under — the operation's
     * `signerAccount.addr` (the owner itself for an owner-signed call, or a
     * sub-account for a session-key signer).
     */
    account: Address;
  }
>;

/** Return type of {@link getGaslessWalletNonce}. */
export type GetGaslessWalletNonceReturnType = bigint;

/**
 * Read the GaslessLayer's **wallet-operation** replay nonce —
 * `walletOperationNonces(owner, walletId, signerAccount)`, the last nonce the
 * selected wallet consumed for that signer account.
 *
 * A separate counter from the InstantLayer's operation nonces — the two are
 * not interchangeable. Wallet-execute operations sign with `nonce + 1`, read
 * immediately before signing. Every `(walletId, signerAccount)` pair is its own
 * stream: wallet `0` keeps the original per-signer-account counter, and each
 * positive id counts separately for its own wallet address, so nonces from one
 * id never apply to another.
 *
 * @param config - The SDK config.
 * @param parameters - Owner wallet, optional wallet id (default `0n`), signer account, optional chain id.
 * @returns The current wallet-operation nonce. Sign with `nonce + 1n`.
 * @throws {SymmError} `GASLESS_WALLET_ID_INVALID` for a wallet id outside the `uint256` range
 *   (or a JavaScript `number`), before any RPC call.
 * @throws {SymmError} `GASLESS_NOT_CONFIGURED` / `GASLESS_UNSUPPORTED_CONTRACTS_VERSION`.
 *
 * @example
 * ```ts
 * const current = await getGaslessWalletNonce(config, { owner, walletId: 2n, account: subAccount });
 * const nextNonce = current + 1n;
 * ```
 */
export async function getGaslessWalletNonce(
  config: Config,
  parameters: GetGaslessWalletNonceParameters,
): Promise<GetGaslessWalletNonceReturnType> {
  const { chainId, owner, account } = parameters;
  const walletId = assertGaslessWalletId(parameters.walletId ?? 0n);
  const gasless = resolveGaslessService(config, { chainId });
  const client = config.getClient({ chainId });

  return client.readContract({
    address: gasless.gaslessLayerAddress,
    abi: gaslessLayerAbi,
    functionName: "walletOperationNonces",
    args: [owner, walletId, account],
  });
}
