import type { Address, Hash, Hex } from "viem";
import type { Config } from "../../../core/config";
import type { Compute, WriteContractParameter } from "../../../shared/types/properties";
import { shouldSimulateBeforeWrite } from "../../../shared/utils/simulate-before-write";
import { instantLayerAbi } from "../../abi/v0.8.5/instant-layer";
import type { InstantLayerAccount } from "../types";
import { simulateGrantDelegation } from "./simulate-grant-delegation";

/**
 * Parameters for {@link grantDelegation}.
 */
export type GrantDelegationParameters = Compute<
  WriteContractParameter & {
      /** Account that grants the delegation. The wallet must own this account. */
      account: InstantLayerAccount;
      /** Signer that may call the selected Instant Layer functions. */
      delegatedSigner: Address;
      /** Function selectors (`bytes4[]`) to grant. */
      selectors: readonly Hex[];
      /** Expiry timestamp in seconds. */
      expiryTimestamp: bigint;
    }
>;

/** Return type of {@link grantDelegation}: the submitted transaction hash. */
export type GrantDelegationReturnType = Hash;

/**
 * Grant Instant Layer delegation access for one delegated signer.
 *
 * Resolves the bound wallet client and `InstantLayer` address from `config`.
 * The connected wallet must own `account`; the contract reverts otherwise.
 *
 * Dry-runs the call with {@link simulateGrantDelegation} first unless
 * `simulateBeforeWrite` is `false` (per-call, falling back to the config default).
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - Delegation account, signer, selectors, expiry, optional chain id.
 * @returns The submitted transaction hash. The caller waits on the receipt.
 * @throws {SymmError} when the chain is unsupported or no wallet is available.
 * @throws Viem's write errors (`ContractFunctionExecutionError`, ...).
 *
 * @example
 * ```ts
 * const hash = await grantDelegation(config, {
 *   account: { addr: account, isPartyB: false },
 *   delegatedSigner,
 *   selectors: ["0x12345678"],
 *   expiryTimestamp,
 * });
 * ```
 */
export async function grantDelegation(
  config: Config,
  parameters: GrantDelegationParameters,
): Promise<GrantDelegationReturnType> {
  const { chainId, account, delegatedSigner, selectors, expiryTimestamp, from } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const walletClient = await config.getWalletClient({ chainId, from });

  if (shouldSimulateBeforeWrite(config, parameters)) {
    await simulateGrantDelegation(config, {
      chainId,
      account,
      delegatedSigner,
      selectors,
      expiryTimestamp,
      from: walletClient.account.address,
    });
  }

  return walletClient.writeContract({
    address: addresses.instantLayerAddress,
    abi: instantLayerAbi,
    functionName: "grantDelegation",
    args: [{ account, delegatedSigner, selectors, expiryTimestamp }],
    account: walletClient.account,
    chain: walletClient.chain,
  });
}
