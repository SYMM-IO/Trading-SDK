import { erc20Abi, type Address, type PublicClient } from "viem";
import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { gaslessLayerAbi } from "../../symmio-contracts/abi/v0.8.6/gasless-layer";
import { getGaslessWalletAddress } from "../get-gasless-wallet-address/get-gasless-wallet-address";
import { getGaslessWalletCreationFee } from "../get-gasless-wallet-creation-fee/get-gasless-wallet-creation-fee";
import { resolveGaslessService } from "../resolve-gasless";
import { assertGaslessWalletId } from "../wallet-id";

/**
 * Parameters for {@link getGaslessDepositPolicy}.
 */
export type GetGaslessDepositPolicyParameters = Compute<
  ChainIdParameter & {
    /** The owner wallet onboarding through gasless deposit — an owner address, never a GaslessWallet address. */
    owner: Address;
    /**
     * Which of the owner's GaslessWallets receives the deposit. Defaults to
     * `0n`, the original wallet. Each id has its own address and balance, and
     * settling one wallet never sweeps another. Range `0n` through `2^256 - 1`.
     */
    walletId?: bigint;
  }
>;

/** Return type of {@link getGaslessDepositPolicy}. Every amount is in collateral token units. */
export interface GetGaslessDepositPolicyReturnType {
  /** The wallet id the policy was read for — `0n` when the parameter was omitted. */
  walletId: bigint;
  /** The deterministic deposit address: the GaslessWallet of `(owner, walletId)`. */
  depositAddress: Address;
  /** The only token the settlement sweeps — send nothing else to the address. */
  collateralTokenAddress: Address;
  /** The collateral token's ERC-20 `decimals()`, the scale of every amount in this policy. */
  collateralDecimals: number;
  /** Flat fee deducted from the observed balance at settlement (collateral token units). */
  depositFee: bigint;
  /** Minimum observed balance the service will settle (collateral token units). */
  minimumDeposit: bigint;
  /**
   * One-time fee the settlement also deducts when it deploys this wallet
   * (collateral token units) — `0n` once the wallet is deployed. See
   * `getGaslessWalletCreationFee`.
   */
  walletCreationFee: bigint;
  /**
   * The smallest balance that settles: `max(minimumDeposit, depositFee +
   * walletCreationFee + 1n)`. The GaslessLayer rejects a settlement unless the
   * swept balance both reaches `minimumDeposit` and exceeds the deposit fee
   * plus the creation fee. Gate the settlement UI on the observed balance
   * reaching this.
   */
  settlementMinimum: bigint;
}

/**
 * Read the GaslessLayer's collateral token and that token's ERC-20
 * `decimals()`. The decimals read needs the token address, so it starts as soon
 * as the first read resolves, while the policy's other reads are still running.
 *
 * The scale comes from the token the GaslessLayer itself sweeps, not from the
 * chain config's `collateralDecimals`: every amount in this policy is a
 * GaslessLayer value, so a deployment whose gasless collateral differs from the
 * configured one must still format correctly.
 */
async function readCollateralToken(
  client: PublicClient,
  gaslessLayerAddress: Address,
): Promise<{ address: Address; decimals: number }> {
  const address = await client.readContract({
    address: gaslessLayerAddress,
    abi: gaslessLayerAbi,
    functionName: "collateralToken",
  });
  const decimals = await client.readContract({ address, abi: erc20Abi, functionName: "decimals" });
  return { address, decimals };
}

/**
 * Read the gasless **deposit policy** for one of an owner's GaslessWallets —
 * the deterministic deposit address plus the fee and minimum terms — directly
 * from the GaslessLayer.
 *
 * All values are RPC contract reads (the service exposes no read endpoints):
 * `getGaslessWalletAddress(owner, walletId)`, `collateralToken()` and the
 * token's `decimals()`, `depositFee()`, `minimumDeposit()` and
 * `getWalletCreationFee(owner, walletId)`. The deposit address is a pure
 * `CREATE2` view, so it is safe to display before any transaction; collateral
 * sent there can only ever reach a sub-account owned by `owner`. Watch the
 * address's balance with the existing collateral-balance read
 * (`getCollateralBalance`) and enable settlement once it reaches
 * `settlementMinimum`.
 *
 * The settlement sweeps the wallet's **entire** balance, so keep separate
 * wallet ids for funding flows that must not be swept together.
 *
 * @param config - The SDK config.
 * @param parameters - Owner wallet, optional wallet id (default `0n`), optional chain id.
 * @returns The deposit policy.
 * @throws {SymmError} `GASLESS_WALLET_ID_INVALID` for a wallet id outside the `uint256` range
 *   (or a JavaScript `number`), before any RPC call.
 * @throws {SymmError} `GASLESS_NOT_CONFIGURED` / `GASLESS_UNSUPPORTED_CONTRACTS_VERSION` /
 *   `GASLESS_WALLET_UNAVAILABLE`.
 *
 * @example
 * ```ts
 * const policy = await getGaslessDepositPolicy(config, { owner });
 * showDepositAddress(policy.depositAddress);
 * const minimum = formatUnits(policy.settlementMinimum, policy.collateralDecimals);
 * ```
 */
export async function getGaslessDepositPolicy(
  config: Config,
  parameters: GetGaslessDepositPolicyParameters,
): Promise<GetGaslessDepositPolicyReturnType> {
  const { chainId, owner } = parameters;
  const walletId = assertGaslessWalletId(parameters.walletId ?? 0n);
  const gasless = resolveGaslessService(config, { chainId });
  const client = config.getClient({ chainId });

  const [depositAddress, collateral, depositFee, minimumDeposit, walletCreationFee] = await Promise.all([
    getGaslessWalletAddress(config, { chainId, owner, walletId }),
    readCollateralToken(client, gasless.gaslessLayerAddress),
    client.readContract({ address: gasless.gaslessLayerAddress, abi: gaslessLayerAbi, functionName: "depositFee" }),
    client.readContract({ address: gasless.gaslessLayerAddress, abi: gaslessLayerAbi, functionName: "minimumDeposit" }),
    getGaslessWalletCreationFee(config, { chainId, owner, walletId }),
  ]);

  /** The swept balance must reach the minimum AND exceed every fee the settlement deducts. */
  const aboveFees = depositFee + walletCreationFee + 1n;
  const settlementMinimum = minimumDeposit > aboveFees ? minimumDeposit : aboveFees;

  return {
    walletId,
    depositAddress,
    collateralTokenAddress: collateral.address,
    collateralDecimals: collateral.decimals,
    depositFee,
    minimumDeposit,
    walletCreationFee,
    settlementMinimum,
  };
}
