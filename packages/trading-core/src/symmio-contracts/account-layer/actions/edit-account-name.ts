import { encodeFunctionData, type Address, type Hash } from "viem";
import type { Config } from "../../../core/config";
import { maybeRelayAsGasless } from "../../../gasless/dispatch/maybe-relay-as-gasless";
import type { Compute, GaslessWriteParameter, WriteContractParameter } from "../../../shared/types/properties";
import { shouldSimulateBeforeWrite } from "../../../shared/utils/simulate-before-write";
import { accountLayerAbi } from "../../abi/v0.8.6/account-layer";
import { simulateEditAccountName } from "./simulate-edit-account-name";

/**
 * Parameters for {@link editAccountName}.
 */
export type EditAccountNameParameters = Compute<
  WriteContractParameter &
    GaslessWriteParameter & {
      /**
       * The SYMMIO subaccount address being renamed. The wallet's signing account
       * must be the subaccount's on-chain `owner`; the contract reverts otherwise.
       */
      account: Address;
      /** New display name. */
      name: string;
    }
>;

/** Return type of {@link editAccountName}: the submitted transaction hash. */
export type EditAccountNameReturnType = Hash;

/**
 * Send the on-chain transaction that renames a SYMMIO subaccount.
 *
 * Resolves the bound wallet client and `AccountLayer` address from `config`. The
 * bound EOA must equal the subaccount's on-chain `owner`.
 *
 * Dry-runs the call with {@link simulateEditAccountName} first unless
 * `simulateBeforeWrite` is `false` (per-call, falling back to the config default).
 *
 * Relayable: pass `gasless` (or run the chain in `gasless.execution.mode`) to
 * sign the same calldata as an InstantLayer operation instead of sending a
 * transaction. The operation is signed under `account`, which is therefore the
 * account charged the operational fee — unless `gasless.account` names another.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - Subaccount address, new name, optional chain id.
 * @returns The submitted transaction hash. The caller waits on the receipt.
 * @throws {SymmError} when the chain is unsupported or no wallet is available.
 * @throws Viem's write errors (`ContractFunctionExecutionError`, ...).
 *
 * @example
 * ```ts
 * const hash = await editAccountName(config, { account: "0xsub…", name: "Main" });
 * ```
 */
export async function editAccountName(
  config: Config,
  parameters: EditAccountNameParameters,
): Promise<EditAccountNameReturnType> {
  const { chainId, account, name, from } = parameters;

  const { addresses } = config.getChainConfig(chainId);

  /**
   * Transparent gasless seam: the same AccountLayer calldata is signed as an
   * InstantLayer operation and relayed. The renamed sub-account is its own
   * billing/authority account. `null` means: proceed on the wallet path below,
   * unchanged.
   */
  const relayed = await maybeRelayAsGasless(config, {
    chainId,
    from,
    gasless: parameters.gasless,
    signerAccount: account,
    calls: [
      {
        target: addresses.accountLayerAddress,
        callData: encodeFunctionData({
          abi: accountLayerAbi,
          functionName: "editAccountName",
          args: [account, name],
        }),
      },
    ],
  });
  if (relayed !== null) return relayed;

  const walletClient = await config.getWalletClient({ chainId, from });

  if (shouldSimulateBeforeWrite(config, parameters)) {
    await simulateEditAccountName(config, { chainId, account, name, from: walletClient.account.address });
  }

  return walletClient.writeContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "editAccountName",
    args: [account, name],
    account: walletClient.account,
    chain: walletClient.chain,
  });
}
