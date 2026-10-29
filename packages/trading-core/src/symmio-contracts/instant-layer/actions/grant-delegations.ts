import { encodeFunctionData, type Address, type Hash, type Hex } from "viem";
import type { Config } from "../../../core/config";
import { maybeRelayAsGasless } from "../../../gasless/dispatch/maybe-relay-as-gasless";
import type { Compute, GaslessWriteParameter, WriteContractParameter } from "../../../shared/types/properties";
import { shouldSimulateBeforeWrite } from "../../../shared/utils/simulate-before-write";
import { instantLayerAbi } from "../../abi/v0.8.6/instant-layer";
import { assertGrantDelegationsInput, toDelegationInfos } from "../grant-delegations-input";
import type { InstantLayerAccount } from "../types";
import { simulateGrantDelegations } from "./simulate-grant-delegations";

/**
 * One delegate entry of {@link grantDelegations}: who may sign, for which
 * selectors, until when. The granting account is shared by every entry.
 */
export interface GrantDelegationsEntry {
  /** Signer that may call the selected functions on the account's behalf. */
  delegatedSigner: Address;
  /** Function selectors (`bytes4[]`) to grant this signer. */
  selectors: readonly Hex[];
  /** Expiry timestamp in seconds. */
  expiryTimestamp: bigint;
}

/**
 * Parameters for {@link grantDelegations}.
 */
export type GrantDelegationsParameters = Compute<
  WriteContractParameter &
    GaslessWriteParameter & {
      /**
       * PartyA account that grants every delegation. The wallet must own it.
       * The contract applies all entries to this one account, so a PartyB
       * account is rejected.
       */
      account: InstantLayerAccount;
      /** One entry per delegate. Must not be empty. */
      delegations: readonly GrantDelegationsEntry[];
    }
>;

/**
 * Return type of {@link grantDelegations}: the submitted transaction hash. A
 * relayed grant returns the relayer's broadcast hash, which behaves exactly
 * like a wallet-submitted one.
 */
export type GrantDelegationsReturnType = Hash;

/**
 * Grant InstantLayer delegations to several signers of one account in a single
 * call — `InstantLayer.grantDelegations`.
 *
 * Relayed, the whole grant costs the owner one signature instead of one per
 * delegate (for example a session key and a TP/SL executor at once); sent from
 * the wallet, it costs one transaction. Every entry keeps its own selectors and
 * expiry, and granting clears any pending revocation for the selectors it
 * covers, exactly like {@link grantDelegation}.
 *
 * Resolves the bound wallet client and `InstantLayer` address from `config`.
 * The connected wallet must own `account`. Dry-runs the call with
 * {@link simulateGrantDelegations} first unless `simulateBeforeWrite` is
 * `false`. Relays through the gasless service when the chain runs in gasless
 * execution mode (or the call passes `gasless: true`), skipping the local
 * dry-run because the relayer simulates its own bundle.
 *
 * Requires an InstantLayer that has `grantDelegations` (perps-core v0.8.6 since
 * 2026-09-04). On an older deployment the call reverts with no matching
 * function; gate the UI on your own knowledge of the deployment.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - The granting account, its delegate entries, and optional chain / signer / gasless overrides.
 * @returns The submitted transaction hash. The caller waits on the receipt.
 * @throws {SymmError} `GRANT_DELEGATIONS_EMPTY` or `GRANT_DELEGATIONS_PARTYB_UNSUPPORTED` before any prompt; `config` errors when the chain is unsupported or no wallet is available.
 * @throws Viem's write errors (`ContractFunctionExecutionError`, ...).
 * @example
 * ```ts
 * const hash = await grantDelegations(config, {
 *   account: { addr: subAccount, isPartyB: false },
 *   delegations: [
 *     { delegatedSigner: sessionKey, selectors: sessionKeySelectors, expiryTimestamp },
 *     { delegatedSigner: tpslExecutor, selectors: tradingSelectors, expiryTimestamp },
 *   ],
 *   gasless: true,
 * });
 * ```
 */
export async function grantDelegations(
  config: Config,
  parameters: GrantDelegationsParameters,
): Promise<GrantDelegationsReturnType> {
  assertGrantDelegationsInput(parameters);

  const { chainId, account, from } = parameters;
  const { addresses } = config.getChainConfig(chainId);
  const infos = toDelegationInfos(parameters);

  /**
   * Transparent gasless seam: the same InstantLayer calldata is signed as an
   * InstantLayer operation and relayed, billed to the granting sub-account. A
   * grant is always owner-signed, so the calldata's account and the
   * operation's `signerAccount` are the same address. `null` means: proceed on
   * the wallet path below, unchanged.
   */
  const relayed = await maybeRelayAsGasless(config, {
    chainId,
    from,
    gasless: parameters.gasless,
    signerAccount: account.addr,
    calls: [
      {
        target: addresses.instantLayerAddress,
        callData: encodeFunctionData({ abi: instantLayerAbi, functionName: "grantDelegations", args: [infos] }),
      },
    ],
  });
  if (relayed !== null) return relayed;

  const walletClient = await config.getWalletClient({ chainId, from });

  if (shouldSimulateBeforeWrite(config, parameters)) {
    await simulateGrantDelegations(config, {
      chainId,
      account,
      delegations: parameters.delegations,
      from: walletClient.account.address,
    });
  }

  return walletClient.writeContract({
    address: addresses.instantLayerAddress,
    abi: instantLayerAbi,
    functionName: "grantDelegations",
    args: [infos],
    account: walletClient.account,
    chain: walletClient.chain,
  });
}
