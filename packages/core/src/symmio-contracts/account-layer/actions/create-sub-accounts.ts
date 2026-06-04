import type { Address, Hash } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { accountLayerAbi } from "../../abi/v0.8.5/account-layer";
import type { SubAccountCreationData } from "../types";

/**
 * Parameters for {@link createSubAccounts}.
 */
export type CreateSubAccountsParameters = Compute<
  ChainIdParameter & {
    /**
     * Affiliate that custodies the new subaccounts. Must be `ACTIVE` on-chain,
     * and each entry's `symmioCore` must be whitelisted and registered for it.
     */
    affiliate: Address;
    /**
     * One entry per subaccount to create. The returned addresses are in this
     * same order.
     */
    accountsData: readonly SubAccountCreationData[];
  }
>;

/**
 * Return type of {@link createSubAccounts}: the submitted transaction hash.
 *
 * @remarks
 * The contract call returns the created subaccount addresses, but those are only
 * available once the transaction is mined - read them from the `SubAccountCreated`
 * events on the receipt. This action returns the hash so the caller controls how
 * it waits.
 */
export type CreateSubAccountsReturnType = Hash;

/**
 * Send the on-chain transaction that creates one or more SYMMIO subaccounts under
 * an affiliate. The bound wallet's account becomes the `owner` of every created
 * subaccount.
 *
 * Resolves the bound wallet client and `AccountLayer` address from `config`.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - Affiliate, per-subaccount creation data, optional chain id.
 * @returns The submitted transaction hash. The caller waits on the receipt.
 * @throws {SymmError} when the chain is unsupported or no wallet is available.
 * @throws Viem's write errors (`ContractFunctionExecutionError`, ...).
 *
 * @example
 * ```ts
 * const hash = await createSubAccounts(config, {
 *   affiliate: "0xaff…",
 *   accountsData: [
 *     {
 *       name: "Main",
 *       metadata: "0x",
 *       symmioCore: "0xcore…",
 *       isolationType: SubAccountIsolationType.MARKET,
 *       singleVAMode: true,
 *     },
 *   ],
 * });
 * ```
 */
export async function createSubAccounts(
  config: Config,
  parameters: CreateSubAccountsParameters,
): Promise<CreateSubAccountsReturnType> {
  const { chainId, affiliate, accountsData } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const walletClient = await config.getWalletClient({ chainId });

  return walletClient.writeContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "createSubAccounts",
    args: [affiliate, accountsData],
    account: walletClient.account,
    chain: walletClient.chain,
  });
}
