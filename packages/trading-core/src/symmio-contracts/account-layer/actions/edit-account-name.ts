import type { Address, Hash } from "viem";
import type { Config } from "../../../core/config";
import type { Compute, GaslessWriteParameter, WriteContractParameter } from "../../../shared/types/properties";
import { executeContractWrite } from "../../../transactions/execute-contract-write";
import { accountLayerAbi } from "../../abi/v0.8.6/account-layer";

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
 * Dry-runs wallet execution (including fallback) with `simulateContract` unless
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
  const chain = config.getChainConfig(parameters.chainId);
  return executeContractWrite(
    config,
    { ...parameters, chainId: chain.chainId },
    {
      contract: {
        address: chain.addresses.accountLayerAddress,
        abi: accountLayerAbi,
        functionName: "editAccountName",
        args: [parameters.account, parameters.name],
      },
      relay: { billingAccount: { kind: "subaccount", account: parameters.account } },
    },
  );
}
