import type { Address, Hash } from "viem";
import type { Config } from "../../../core/config";
import type { Compute, GaslessWriteParameter, WriteContractParameter } from "../../../shared/types/properties";
import { executeContractWrite } from "../../../transactions/execute-contract-write";
import { accountLayerAbi } from "../../abi/v0.8.6/account-layer";
import type { SubAccountCreationData } from "../types";

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
 * an affiliate. A direct transaction uses the bound wallet as owner; a relayed
 * operation uses the billing account's owner, including when a delegate signs.
 *
 * Resolves the bound wallet client and `AccountLayer` address from `config`.
 *
 * Relayable, with one condition of its own: pass `gasless` (or run the chain in
 * `gasless.execution.mode`) to sign the same calldata as an InstantLayer
 * operation instead of sending a transaction. Because the subaccounts do not
 * exist yet, a relayed call **requires** `gasless.account`
 * naming an existing owned subaccount (which pays the operational fee) and
 * throws `GASLESS_ACCOUNT_UNRESOLVED` without it. A wallet with no subaccount at
 * all bootstraps through {@link settleGaslessDepositNewAccount} instead.
 *
 * To make account creation recoverable, pass `gasless.idempotencyKey` — one key
 * per user action, saved with the action's inputs before the call. After an
 * unknown outcome, call again with the same key: the service accepts the key at
 * most once. A key makes the call strictly gasless; see the gasless
 * "Recovering gasless writes" guide for the full lifecycle.
 *
 * Dry-runs wallet execution (including fallback) with `simulateContract` unless
 * `simulateBeforeWrite` is `false` (per-call, falling back to the config default).
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - Affiliate, per-subaccount creation data, optional chain id.
 * @returns The transaction hash, once broadcast. The caller waits for the receipt.
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
 *       singleVAMode: true,
 *       symmioCore: "0xcore…",
 *       isolationType: SubAccountIsolationType.MARKET,
 *       metadata: encodeSubAccountHookMetadata({ partyBToBind: solverAddress }),
 *     },
 *   ],
 * });
 *
 * // Recoverable, relayed creation billed to an existing subaccount:
 * const key = generateGaslessIdempotencyKey();
 * await pendingActions.save({ key, accountsData });
 * const relayed = await createSubAccounts(config, {
 *   affiliate: "0xaff…",
 *   accountsData,
 *   gasless: { account: payerSubAccount, idempotencyKey: key },
 * });
 * ```
 */
export async function createSubAccounts(
  config: Config,
  parameters: CreateSubAccountsParameters,
): Promise<CreateSubAccountsReturnType> {
  const chain = config.getChainConfig(parameters.chainId);
  return executeContractWrite(
    config,
    { ...parameters, chainId: chain.chainId },
    {
      contract: {
        address: chain.addresses.accountLayerAddress,
        abi: accountLayerAbi,
        functionName: "createSubAccounts",
        args: [parameters.affiliate, parameters.accountsData],
      },
      relay: { billingAccount: { kind: "explicit" } },
    },
  );
}
