import { type Address, type Hash, type Hex } from "viem";
import type { Config } from "../../../core/config";
import type { Compute, WriteContractParameter } from "../../../shared/types/properties";
import { shouldSimulateBeforeWrite } from "../../../shared/utils/simulate-before-write";
import { instantLayerAbi } from "../../abi/v0.8.6/instant-layer";
import type { InstantLayerAccount } from "../types";

/**
 * Parameters for {@link finalizeRevokeDelegation}.
 */
export type FinalizeRevokeDelegationParameters = Compute<
  WriteContractParameter & {
    /** Account the delegation was granted under. */
    account: InstantLayerAccount;
    /** Delegated signer whose scheduled revocation is being completed. */
    delegate: Address;
    /** Function selectors (`bytes4[]`) to clear. */
    selectors: readonly Hex[];
  }
>;

/** Return type of {@link finalizeRevokeDelegation}: the submitted transaction hash. */
export type FinalizeRevokeDelegationReturnType = Hash;

/**
 * Complete a scheduled Instant Layer revocation, deleting the stored grant.
 *
 * **Permissionless.** Unlike {@link initiateRevokeDelegation}, the contract
 * lets *anyone* call this once the cooldown ETA has passed — so a backend, a
 * keeper, or the user's own wallet can finish a revocation the owner started.
 * It reverts `RevocationCooldownNotOver` while the ETA is still in the future,
 * and silently skips any selector that was never scheduled.
 *
 * **This write cannot be relayed, and deliberately takes no `gasless` option.**
 * `_verifyOperation` routes every operation targeting the InstantLayer itself
 * to `_verifyGrantOperation`, which accepts only `grantDelegation` /
 * `grantDelegations` and reverts `InvalidGrantOperation` for anything else — a
 * relayed revocation would always revert. See {@link initiateRevokeDelegation}.
 *
 * **It is optional.** Enforcement reads `pendingRevocationEta` on every
 * operation, so authority ends on its own at the ETA — this call is the
 * bookkeeping leg, not the moment the key loses access, and skipping it leaves
 * a revoked key just as powerless. Nor is it a prerequisite for re-granting:
 * {@link grantDelegation} deletes the pending ETA for each selector it grants,
 * so a stale schedule cannot silently neuter a fresh grant. Present it as
 * cleanup — never as "the revoke".
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
 * const hash = await finalizeRevokeDelegation(config, {
 *   account: { addr: subAccount, isPartyB: false },
 *   delegate: sessionKeyAddress,
 *   selectors,
 * });
 * ```
 */
export async function finalizeRevokeDelegation(
  config: Config,
  parameters: FinalizeRevokeDelegationParameters,
): Promise<FinalizeRevokeDelegationReturnType> {
  const { chainId, account, delegate, selectors, from } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const walletClient = await config.getWalletClient({ chainId, from });

  if (shouldSimulateBeforeWrite(config, parameters)) {
    await config.getClient({ chainId }).simulateContract({
      address: addresses.instantLayerAddress,
      abi: instantLayerAbi,
      functionName: "finalizeRevokeDelegation",
      args: [account, delegate, selectors],
      account: walletClient.account.address,
    });
  }

  return walletClient.writeContract({
    address: addresses.instantLayerAddress,
    abi: instantLayerAbi,
    functionName: "finalizeRevokeDelegation",
    args: [account, delegate, selectors],
    account: walletClient.account,
    chain: walletClient.chain,
  });
}
