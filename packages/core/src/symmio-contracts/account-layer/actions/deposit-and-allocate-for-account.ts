import type { Address, Hash } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { accountLayerAbi } from "../../abi/v0.8.5/account-layer";

/**
 * Parameters for {@link depositAndAllocateForAccount}.
 */
export type DepositAndAllocateForAccountParameters = Compute<
  ChainIdParameter & {
    /**
     * The subaccount (or virtual account) to credit and allocate for. The wallet's
     * signing account must be the subaccount's on-chain `owner`; the contract
     * reverts otherwise.
     */
    account: Address;
    /**
     * Amount of collateral to deposit and allocate, in the collateral token's
     * smallest unit (e.g. `1_000000n` for 1 USDC at 6 decimals). The user must have
     * approved at least this much collateral to the SYMMIO core first — see
     * {@link approveCollateral}.
     */
    amount: bigint;
  }
>;

/** Return type of {@link depositAndAllocateForAccount}: the submitted transaction hash. */
export type DepositAndAllocateForAccountReturnType = Hash;

/**
 * Deposit collateral into a subaccount **and allocate it into trading margin** in
 * a single transaction.
 *
 * Calls `AccountLayer.depositAndAllocateForAccount`. Equivalent to
 * {@link depositForAccount} followed by an allocate, but atomic: the deposited
 * funds become usable margin immediately instead of sitting in the available
 * balance.
 *
 * @remarks
 * Requires a prior ERC20 approval of the collateral token to the **SYMMIO core**
 * (`symmioAddress`), which is the contract that pulls the funds. See
 * {@link approveCollateral} / {@link getCollateralAllowance}.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - Subaccount address, amount (collateral units), optional chain id.
 * @returns The submitted transaction hash. The caller waits on the receipt.
 * @throws {SymmError} when the chain is unsupported or no wallet is available.
 * @throws Viem's write errors (`ContractFunctionExecutionError`, ...).
 *
 * @example
 * ```ts
 * const hash = await depositAndAllocateForAccount(config, { account: "0xsub…", amount: 1_000000n });
 * ```
 */
export async function depositAndAllocateForAccount(
  config: Config,
  parameters: DepositAndAllocateForAccountParameters,
): Promise<DepositAndAllocateForAccountReturnType> {
  const { chainId, account, amount } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const walletClient = await config.getWalletClient({ chainId });

  return walletClient.writeContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "depositAndAllocateForAccount",
    args: [account, amount],
    account: walletClient.account,
    chain: walletClient.chain,
  });
}
