import type { Address } from "viem";
import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { gaslessLayerAbi } from "../gateway/gasless-layer-abi";
import { getGaslessWalletAddress } from "../get-gasless-wallet-address/get-gasless-wallet-address";
import { resolveGaslessService } from "../resolve-gasless";

/**
 * Parameters for {@link getGaslessDepositPolicy}.
 */
export type GetGaslessDepositPolicyParameters = Compute<
  ChainIdParameter & {
    /** The owner wallet onboarding through gasless deposit. */
    owner: Address;
  }
>;

/** Return type of {@link getGaslessDepositPolicy}. */
export interface GetGaslessDepositPolicyReturnType {
  /** The owner's deterministic deposit address (their gasless wallet). */
  depositAddress: Address;
  /** The only token the settlement sweeps — send nothing else to the address. */
  collateralTokenAddress: Address;
  /** Flat fee deducted from the observed balance at settlement (raw units). */
  depositFee: bigint;
  /** Minimum observed balance the service will settle (raw units). */
  minimumDeposit: bigint;
  /**
   * The balance that actually settles: `max(minimumDeposit, depositFee + 1n)`
   * — a settlement must both clear the minimum and exceed the flat fee, or it
   * is rejected. Gate the settlement UI on the observed balance reaching this.
   */
  settlementMinimum: bigint;
}

/**
 * Read the gasless **deposit policy** for an owner — the deterministic deposit
 * address plus the fee/minimum terms — directly from the GaslessLayer.
 *
 * All values are RPC contract reads (the service exposes no read endpoints).
 * The deposit address is a pure `CREATE2` view, so it is safe to display
 * before any transaction; collateral sent there can only ever reach a
 * sub-account owned by `owner`. Watch the address's balance with the existing
 * collateral-balance read and enable settlement once it reaches
 * `settlementMinimum`.
 *
 * @param config - The SDK config.
 * @param parameters - Owner wallet, optional chain id.
 * @returns The deposit policy.
 * @throws {SymmError} `GASLESS_NOT_CONFIGURED` / `GASLESS_UNSUPPORTED_CONTRACTS_VERSION` /
 *   `GASLESS_WALLET_UNAVAILABLE`.
 *
 * @example
 * ```ts
 * const policy = await getGaslessDepositPolicy(config, { owner });
 * showDepositAddress(policy.depositAddress);
 * ```
 */
export async function getGaslessDepositPolicy(
  config: Config,
  parameters: GetGaslessDepositPolicyParameters,
): Promise<GetGaslessDepositPolicyReturnType> {
  const { chainId, owner } = parameters;
  const gasless = resolveGaslessService(config, { chainId });
  const client = config.getClient({ chainId });

  const [depositAddress, collateralTokenAddress, depositFee, minimumDeposit] = await Promise.all([
    getGaslessWalletAddress(config, { chainId, owner }),
    client.readContract({
      address: gasless.gaslessLayerAddress,
      abi: gaslessLayerAbi,
      functionName: "collateralToken",
    }),
    client.readContract({ address: gasless.gaslessLayerAddress, abi: gaslessLayerAbi, functionName: "depositFee" }),
    client.readContract({ address: gasless.gaslessLayerAddress, abi: gaslessLayerAbi, functionName: "minimumDeposit" }),
  ]);

  const settlementMinimum = minimumDeposit > depositFee ? minimumDeposit : depositFee + 1n;

  return { depositAddress, collateralTokenAddress, depositFee, minimumDeposit, settlementMinimum };
}
