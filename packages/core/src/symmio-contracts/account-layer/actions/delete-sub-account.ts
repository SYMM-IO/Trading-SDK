import type { Address, Hash } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute, SimulateBeforeWriteParameter } from "../../../shared/types/properties";
import { shouldSimulateBeforeWrite } from "../../../shared/utils/simulate-before-write";
import { accountLayerAbi } from "../../abi/v0.8.5/account-layer";
import { simulateDeleteSubAccount } from "./simulate-delete-sub-account";

/**
 * Parameters for {@link deleteSubAccount}.
 */
export type DeleteSubAccountParameters = Compute<
  ChainIdParameter &
    SimulateBeforeWriteParameter & {
      /**
       * The subaccount to delete. The bound wallet's signing account must be the
       * subaccount's on-chain `owner`; the contract reverts (`onlyAccountOwner`)
       * otherwise.
       */
      subAccount: Address;
    }
>;

/** Return type of {@link deleteSubAccount}: the submitted transaction hash. */
export type DeleteSubAccountReturnType = Hash;

/**
 * Send the on-chain transaction that deletes a SYMMIO subaccount on the
 * AccountLayer. Calls `AccountLayer.deleteSubAccount(subAccount)`.
 *
 * Resolves the bound wallet client and `AccountLayer` address from `config`. The
 * bound EOA must equal the subaccount's on-chain `owner`.
 *
 * @remarks
 * Deletion is irreversible and the contract only allows it once the subaccount is
 * fully wound down. It reverts when the subaccount still has any virtual accounts
 * (`HasActiveVirtualAccounts`), a non-zero free or allocated balance
 * (`SubAccountNotEmpty`), open positions (`OpenPositionsExist`), or pending quotes
 * (`PendingQuotesExist`) — and when it does not exist (`AccountDoesNotExist`) or
 * the caller is not its owner. Clear those first. On success it emits
 * `SubAccountDeleted(subAccount, owner, affiliate)`.
 *
 * Dry-runs the call with {@link simulateDeleteSubAccount} first unless
 * `simulateBeforeWrite` is `false` (per-call, falling back to the config default).
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - Subaccount address, optional chain id.
 * @returns The submitted transaction hash. The caller waits on the receipt.
 * @throws {SymmError} when the chain is unsupported or no wallet is available.
 * @throws Viem's write errors (`ContractFunctionExecutionError`, ...).
 *
 * @example
 * ```ts
 * const hash = await deleteSubAccount(config, { subAccount: "0xsub…" });
 * ```
 */
export async function deleteSubAccount(
  config: Config,
  parameters: DeleteSubAccountParameters,
): Promise<DeleteSubAccountReturnType> {
  const { chainId, subAccount } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const walletClient = await config.getWalletClient({ chainId });

  if (shouldSimulateBeforeWrite(config, parameters)) {
    await simulateDeleteSubAccount(config, { chainId, subAccount, from: walletClient.account.address });
  }

  return walletClient.writeContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "deleteSubAccount",
    args: [subAccount],
    account: walletClient.account,
    chain: walletClient.chain,
  });
}
