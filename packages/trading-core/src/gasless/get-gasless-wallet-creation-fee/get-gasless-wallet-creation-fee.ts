import type { Address } from "viem";
import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { gaslessLayerAbi } from "../../symmio-contracts/abi/v0.8.6/gasless-layer";
import { resolveGaslessService } from "../resolve-gasless";
import { assertGaslessWalletId } from "../wallet-id";

/**
 * Parameters for {@link getGaslessWalletCreationFee}.
 */
export type GetGaslessWalletCreationFeeParameters = Compute<
  ChainIdParameter & {
    /** The owner wallet the gasless wallet belongs to — an owner address, never a GaslessWallet address. */
    owner: Address;
    /**
     * Which of the owner's GaslessWallets to quote. Defaults to `0n`, the
     * original wallet. Range `0n` through `2^256 - 1`.
     */
    walletId?: bigint;
  }
>;

/**
 * Return type of {@link getGaslessWalletCreationFee}: the fee in the collateral
 * token's own units (its decimals, not SYMMIO's 18).
 */
export type GetGaslessWalletCreationFeeReturnType = bigint;

/**
 * Read the one-time fee for deploying a GaslessWallet —
 * `getWalletCreationFee(owner, walletId)` on the GaslessLayer.
 *
 * Wallets deploy lazily, on their first use. While the wallet derived from
 * `(owner, walletId)` has no code, the read returns the GaslessLayer's
 * configured `walletCreationFee`; once the wallet is deployed it returns `0n`.
 * That holds for **every** wallet id, wallet `0` included: an original wallet
 * that was never deployed pays the fee once too.
 *
 * The amount is in **collateral token units**, and whoever deploys the wallet
 * pays it once:
 * - a deposit settlement deducts it from the swept balance, on top of the
 *   deposit fee, so it raises the settlement minimum (see
 *   `getGaslessDepositPolicy`);
 * - a relayed wallet operation charges it to the payer's SYMMIO balance,
 *   rescaled to 18 decimals — the `walletCreationFee18` of that operation's
 *   fee-quote payment (see `getGaslessFeeQuote`).
 *
 * It is a snapshot of the current state: the value drops to `0n` as soon as
 * any action deploys the wallet.
 *
 * @param config - The SDK config.
 * @param parameters - Owner wallet, optional wallet id (default `0n`), optional chain id.
 * @returns The creation fee in collateral token units; `0n` for a deployed wallet.
 * @throws {SymmError} `GASLESS_WALLET_ID_INVALID` for a wallet id outside the `uint256` range
 *   (or a JavaScript `number`), before any RPC call.
 * @throws {SymmError} `GASLESS_NOT_CONFIGURED` / `GASLESS_UNSUPPORTED_CONTRACTS_VERSION`.
 *
 * @example
 * ```ts
 * const fee = await getGaslessWalletCreationFee(config, { owner, walletId: 1n });
 * // Collateral token units; 0n once the wallet is deployed or when the deployment charges none.
 * ```
 */
export async function getGaslessWalletCreationFee(
  config: Config,
  parameters: GetGaslessWalletCreationFeeParameters,
): Promise<GetGaslessWalletCreationFeeReturnType> {
  const { chainId, owner } = parameters;
  const walletId = assertGaslessWalletId(parameters.walletId ?? 0n);
  const gasless = resolveGaslessService(config, { chainId });
  const client = config.getClient({ chainId });

  return client.readContract({
    address: gasless.gaslessLayerAddress,
    abi: gaslessLayerAbi,
    functionName: "getWalletCreationFee",
    args: [owner, walletId],
  });
}
