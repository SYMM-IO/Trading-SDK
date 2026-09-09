import { type Address, type Hash, type Hex } from "viem";
import type { Config } from "../../../core/config";
import type { Compute, WriteContractParameter } from "../../../shared/types/properties";
import { shouldSimulateBeforeWrite } from "../../../shared/utils/simulate-before-write";
import { instantLayerAbi } from "../../abi/v0.8.6/instant-layer";
import type { InstantLayerAccount } from "../types";

/**
 * Parameters for {@link initiateRevokeDelegation}.
 */
export type InitiateRevokeDelegationParameters = Compute<
  WriteContractParameter & {
    /** Account the delegation was granted under. */
    account: InstantLayerAccount;
    /** Delegated signer whose authority is being revoked. */
    delegate: Address;
    /** Function selectors (`bytes4[]`) to revoke. */
    selectors: readonly Hex[];
  }
>;

/** Return type of {@link initiateRevokeDelegation}: the submitted transaction hash. */
export type InitiateRevokeDelegationReturnType = Hash;

/**
 * Start revoking Instant Layer delegation access for one delegated signer.
 *
 * **Who may call it.** The contract accepts a revocation from the account
 * owner, from the delegate itself, or from a holder of `REVOKER_ROLE`
 * (`InstantLayer.initiateRevokeDelegation`). A session key can therefore
 * retire its own authority without an owner prompt — but see the gas note
 * below, because it still has to pay for the transaction.
 *
 * **This write cannot be relayed, and deliberately takes no `gasless` option.**
 * The relay path signs an InstantLayer *operation*, and `_verifyOperation`
 * sends every operation whose `target` is the InstantLayer itself to
 * `_verifyGrantOperation`, which reverts `InvalidGrantOperation` for any
 * selector other than `grantDelegation` / `grantDelegations`. A relayed
 * revocation would therefore always revert. Revocation is a plain gas-paid
 * transaction: normally the owner sends it, and a session key can only send it
 * itself if that key holds native gas.
 *
 * **Two-step, with a residual authority window.** This call only *starts* the
 * revocation: it stamps `pendingRevocationEta = now + revocationCooldown` (see
 * {@link getRevocationCooldown}) and no-ops for selectors that are not
 * currently active. Until that ETA passes the delegate keeps its authority.
 * Once it passes, {@link finalizeRevokeDelegation} clears the stored grant —
 * and that second leg is permissionless, so anyone can complete it.
 *
 * Dry-runs the call first unless `simulateBeforeWrite` is `false` (per-call,
 * falling back to the config default).
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - Delegating account, delegate, selectors, optional chain id.
 * @returns The submitted transaction hash. The caller waits on the receipt.
 * @throws {SymmError} when the chain is unsupported or no wallet is available.
 * @throws Viem's write errors (`ContractFunctionExecutionError`, ...).
 *
 * @example
 * ```ts
 * const hash = await initiateRevokeDelegation(config, {
 *   account: { addr: subAccount, isPartyB: false },
 *   delegate: sessionKeyAddress,
 *   selectors: getSessionKeySelectors(config, { chainId }),
 * });
 * ```
 */
export async function initiateRevokeDelegation(
  config: Config,
  parameters: InitiateRevokeDelegationParameters,
): Promise<InitiateRevokeDelegationReturnType> {
  const { chainId, account, delegate, selectors, from } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const walletClient = await config.getWalletClient({ chainId, from });

  if (shouldSimulateBeforeWrite(config, parameters)) {
    await config.getClient({ chainId }).simulateContract({
      address: addresses.instantLayerAddress,
      abi: instantLayerAbi,
      functionName: "initiateRevokeDelegation",
      args: [account, delegate, selectors],
      account: walletClient.account.address,
    });
  }

  return walletClient.writeContract({
    address: addresses.instantLayerAddress,
    abi: instantLayerAbi,
    functionName: "initiateRevokeDelegation",
    args: [account, delegate, selectors],
    account: walletClient.account,
    chain: walletClient.chain,
  });
}
