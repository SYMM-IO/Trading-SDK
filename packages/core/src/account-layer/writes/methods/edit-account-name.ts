import type { Account, Address, Chain, Hash, Transport, WalletClient } from "viem";
import { accountLayerAbi } from "../../../abi";
import { resolveAccountLayerAddress } from "../../resolve-address";

/**
 * Parameters for {@link editAccountName}.
 */
export interface EditAccountNameParams {
  /**
   * The SYMMIO subaccount address being renamed. The wallet client's signing
   * account must be the subaccount's on-chain `owner`; the contract reverts
   * otherwise.
   */
  account: Address;
  /**
   * New display name.
   */
  name: string;
  /**
   * Override the `AccountLayer` contract address. Defaults to the built-in
   * registry for `client.chain.id`.
   */
  accountLayerAddress?: Address;
}

/**
 * Send the on-chain transaction that renames a SYMMIO subaccount.
 *
 * The `walletClient` must be constructed with an `account` already bound
 * (`createWalletClient({ account, ... })`). viem itself rejects writes from a
 * client whose `account` is undefined; this SDK enforces that at the type
 * level. The bound EOA must equal the subaccount's on-chain `owner`.
 *
 * @returns the submitted transaction hash. The caller is responsible for
 *   waiting on the receipt (e.g. `publicClient.waitForTransactionReceipt`).
 *
 * @example
 * const hash = await editAccountName(walletClient, {
 *   account: "0xsub...",
 *   name: "My Trading Account",
 * });
 *
 * @throws {SymmError} when the client has no chain and no address override is provided.
 * @throws Viem's write errors (`ContractFunctionExecutionError`, ...).
 */
export async function editAccountName<TTransport extends Transport, TChain extends Chain>(
  client: WalletClient<TTransport, TChain, Account>,
  params: EditAccountNameParams,
): Promise<Hash> {
  const address = resolveAccountLayerAddress(client, params.accountLayerAddress);
  // The cast suppresses viem's WriteContractParameters generic union, which
  // does not narrow cleanly through this wrapper. The shape is exact — only
  // the conditional `chain` and `account` discriminants are erased.

  return client.writeContract({
    address,
    abi: accountLayerAbi,
    functionName: "editAccountName",
    args: [params.account, params.name],
  } as unknown as Parameters<typeof client.writeContract>[0]);
}
