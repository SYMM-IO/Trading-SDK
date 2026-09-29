import { encodeFunctionData, type Address, type Hash, type Hex } from "viem";
import type { Config } from "../../../core/config";
import { maybeRelayAsGasless } from "../../../gasless/dispatch/maybe-relay-as-gasless";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, GaslessWriteParameter, WriteContractParameter } from "../../../shared/types/properties";
import { shouldSimulateBeforeWrite } from "../../../shared/utils/simulate-before-write";
import { instantLayerAbi } from "../../abi/v0.8.6/instant-layer";
import type { InstantLayerAccount } from "../types";
import { simulateGrantDelegation } from "./simulate-grant-delegation";

/**
 * Parameters for {@link grantDelegation}.
 */
export type GrantDelegationParameters = Compute<
  WriteContractParameter &
    GaslessWriteParameter & {
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

/**
 * Return type of {@link grantDelegation}: the submitted transaction hash.
 *
 * A relayed grant returns the relayer's broadcast hash, which behaves exactly
 * like a wallet-submitted one — so a caller's receipt wait and invalidation
 * work the same either way, and the transport never leaks into the type.
 */
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
 * Relays through the gasless service when the chain runs in gasless execution
 * mode (or the call passes `gasless: true`), so onboarding a session key costs
 * the owner no native gas — the grant itself is a relayable write. The relayed
 * path signs an InstantLayer operation instead of sending a transaction, so it
 * skips the local dry-run; the relayer simulates its own bundle.
 *
 * A `isPartyB: true` account cannot be relayed — the signed-operation encoder
 * has no PartyB form — so it degrades to the wallet path, or throws when
 * gasless was demanded explicitly.
 *
 * **Granting clears any pending revocation** for each selector it covers: the
 * contract deletes `pendingRevocationEta` alongside writing the new expiry. A
 * schedule left unfinalized therefore cannot silently neuter a fresh grant, and
 * {@link finalizeRevokeDelegation} is never a prerequisite for re-granting.
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

  /**
   * Transparent gasless seam: the same InstantLayer calldata is signed as an
   * InstantLayer operation and relayed, with the granting sub-account as the
   * billing/authority account — a grant is always owner-signed, so the calldata's
   * `account.addr` and the operation's `signerAccount` are the same address.
   * `null` means: proceed on the wallet path below, unchanged.
   */
  if (!account.isPartyB) {
    const relayed = await maybeRelayAsGasless(config, {
      chainId,
      from,
      gasless: parameters.gasless,
      signerAccount: account.addr,
      calls: [
        {
          target: addresses.instantLayerAddress,
          callData: encodeFunctionData({
            abi: instantLayerAbi,
            functionName: "grantDelegation",
            args: [{ account, delegatedSigner, selectors, expiryTimestamp }],
          }),
        },
      ],
    });
    if (relayed !== null) return relayed;
  } else if (parameters.gasless === true || (typeof parameters.gasless === "object" && parameters.gasless.enabled)) {
    /**
     * Refuse rather than silently sign for the wrong identity: the operation
     * encoder always builds `isPartyB: false`, so a relayed PartyB grant would
     * carry a signerAccount the InstantLayer resolves to a different party.
     */
    throw new SymmError(
      "validation",
      "GASLESS_PARTYB_UNSUPPORTED",
      "Gasless: a PartyB delegation grant cannot be relayed — the signed-operation encoder has no PartyB form. Send it from the wallet instead.",
    );
  }

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
