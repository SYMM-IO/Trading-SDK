import { encodeFunctionData, type Address, type Hash } from "viem";
import type { Config } from "../../../core/config";
import { maybeRelayAsGasless } from "../../../gasless/dispatch/maybe-relay-as-gasless";
import type { Compute, GaslessWriteParameter, WriteContractParameter } from "../../../shared/types/properties";
import { shouldSimulateBeforeWrite } from "../../../shared/utils/simulate-before-write";
import { accountLayerAbi } from "../../abi/v0.8.6/account-layer";
import type { SubAccountCreationData } from "../types";
import { simulateCreateSubAccounts } from "./simulate-create-sub-accounts";

/**
 * Parameters for {@link createSubAccounts}.
 */
export type CreateSubAccountsParameters = Compute<
  WriteContractParameter &
    GaslessWriteParameter & {
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
 * Relayable, with one condition of its own: pass `gasless` (or run the chain in
 * `gasless.execution.mode`) to sign the same calldata as an InstantLayer
 * operation instead of sending a transaction, and the created subaccounts still
 * belong to the signing wallet. Because the subaccounts do not exist yet there
 * is no account to sign under, so a relayed call **requires** `gasless.account`
 * naming an existing owned subaccount (which pays the operational fee) and
 * throws `GASLESS_ACCOUNT_UNRESOLVED` without it. A wallet with no subaccount at
 * all bootstraps through {@link settleGaslessDepositNewAccount} instead.
 *
 * Dry-runs the call with {@link simulateCreateSubAccounts} first unless
 * `simulateBeforeWrite` is `false` (per-call, falling back to the config default).
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
  const { chainId, affiliate, accountsData, from } = parameters;

  const { addresses } = config.getChainConfig(chainId);

  /**
   * Transparent gasless seam: the same AccountLayer calldata is signed as an
   * InstantLayer operation and relayed, and the created subaccounts still belong
   * to the signing wallet — the relayer scopes the AccountLayer call to the
   * owner, so the contract's signer resolves to the EOA rather than the relayer.
   *
   * Unlike every other relayable write this one has no account of its own to
   * relay under: the InstantLayer resolves the operation's `signerAccount` on
   * chain, and the subaccounts being created do not exist yet. So `gasless`
   * requires `gasless.account` naming an **existing** owned subaccount, which
   * pays the operational fee. A wallet with no subaccount at all cannot bootstrap
   * this way — that is what the gasless deposit settlement is for.
   *
   * `null` means: proceed on the wallet path below, unchanged.
   */
  const relayed = await maybeRelayAsGasless(config, {
    chainId,
    from,
    gasless: parameters.gasless,
    calls: [
      {
        target: addresses.accountLayerAddress,
        callData: encodeFunctionData({
          abi: accountLayerAbi,
          functionName: "createSubAccounts",
          args: [affiliate, accountsData],
        }),
      },
    ],
  });
  if (relayed !== null) return relayed;

  const walletClient = await config.getWalletClient({ chainId, from });

  if (shouldSimulateBeforeWrite(config, parameters)) {
    await simulateCreateSubAccounts(config, { chainId, affiliate, accountsData, from: walletClient.account.address });
  }

  return walletClient.writeContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "createSubAccounts",
    args: [affiliate, accountsData],
    account: walletClient.account,
    chain: walletClient.chain,
  });
}
