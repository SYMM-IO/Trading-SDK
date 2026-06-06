import type { Address, Hash, Hex } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { instantLayerAbi } from "../../abi/v0.8.5/instant-layer";
import type { InstantLayerAccount } from "../types";

/**
 * Parameters for {@link grantDelegation}.
 */
export type GrantDelegationParameters = Compute<
  ChainIdParameter & {
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
  const { chainId, account, delegatedSigner, selectors, expiryTimestamp } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const walletClient = await config.getWalletClient({ chainId });

  return walletClient.writeContract({
    address: addresses.instantLayerAddress,
    abi: instantLayerAbi,
    functionName: "grantDelegation",
    args: [{ account, delegatedSigner, selectors, expiryTimestamp }],
    account: walletClient.account,
    chain: walletClient.chain,
  });
}
