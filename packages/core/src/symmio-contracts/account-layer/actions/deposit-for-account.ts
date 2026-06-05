import type { Address, Hash } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { accountLayerAbi } from "../../abi/v0.8.5/account-layer";

/**
 * Parameters for {@link depositForAccount}.
 */
export type DepositForAccountParameters = Compute<
  ChainIdParameter & {
    /**
     * The subaccount (or virtual account) to credit. The wallet's signing account
     * must be the subaccount's on-chain `owner`; the contract reverts otherwise.
     */
    account: Address;
    /**
     * Amount of collateral to deposit, in the collateral token's smallest unit
     * (e.g. `1_000000n` for 1 USDC at 6 decimals). The user must have approved at
     * least this much collateral to the SYMMIO core first — see `approveCollateral`.
     */
    amount: bigint;
  }
>;

/** Return type of {@link depositForAccount}: the submitted transaction hash. */
export type DepositForAccountReturnType = Hash;

/**
 * Deposit collateral into a subaccount's **available balance** on the SYMMIO core.
 *
 * Calls `AccountLayer.depositForAccount`, which pulls the collateral from the
 * connected wallet into the core and credits the subaccount. The funds land in
 * the available (withdrawable) balance, not in trading margin — use
 * {@link depositAndAllocateForAccount} to allocate in the same transaction.
 *
 * @remarks
 * Requires a prior ERC20 approval of the collateral token to the **SYMMIO core**
 * (`symmioAddress`), which is the contract that pulls the funds. See
 * `approveCollateral` / `getCollateralAllowance`.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - Subaccount address, amount (collateral units), optional chain id.
 * @returns The submitted transaction hash. The caller waits on the receipt.
 * @throws {SymmError} when the chain is unsupported or no wallet is available.
 * @throws Viem's write errors (`ContractFunctionExecutionError`, ...).
 *
 * @example
 * ```ts
 * const hash = await depositForAccount(config, { account: "0xsub…", amount: 1_000000n });
 * ```
 */
export async function depositForAccount(
  config: Config,
  parameters: DepositForAccountParameters,
): Promise<DepositForAccountReturnType> {
  const { chainId, account, amount } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const walletClient = await config.getWalletClient({ chainId });

  return walletClient.writeContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "depositForAccount",
    args: [account, amount],
    account: walletClient.account,
    chain: walletClient.chain,
  });
}
