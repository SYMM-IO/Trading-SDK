import { encodeFunctionData, type Address, type Hex } from "viem";
import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute, FromParameter } from "../../shared/types/properties";
import { getInstantLayerEip712Domain, signSignedOperation } from "../../solvers/instant-open/shared/eip712";
import { buildSignedOperation } from "../../solvers/instant-open/shared/operations";
import { instantLayerAbi } from "../../symmio-contracts/abi/v0.8.6/instant-layer";
import { getInstantLayerNonce } from "../../symmio-contracts/instant-layer/actions/get-instant-layer-nonce";
import { withGaslessNonceLock } from "../nonce-lock";
import { relayInstantOperations } from "../relay-instant-operations/relay-instant-operations";
import type { GaslessSubmitReceipt } from "../types";

/**
 * Parameters for {@link relayGrantDelegation}.
 */
export type RelayGrantDelegationParameters = Compute<
  ChainIdParameter &
    FromParameter & {
      /**
       * The sub-account granting the delegation. The account **owner's** wallet
       * signs the operation — a delegation grant is always owner-signed.
       */
      account: Address;
      /** The signer being delegated to (e.g. a session key address). */
      delegatedSigner: Address;
      /** Function selectors the delegate may sign for. */
      selectors: readonly Hex[];
      /** Unix timestamp (seconds) when the delegation expires. */
      expiryTimestamp: bigint;
      /** Stable retry key for the relay submit; defaults to a random UUID. */
      idempotencyKey?: string;
    }
>;

/** Return type of {@link relayGrantDelegation}. */
export type RelayGrantDelegationReturnType = GaslessSubmitReceipt;

/**
 * Grant an Instant Layer delegation **through the gasless relayer** — no
 * native gas needed.
 *
 * **Prefer `grantDelegation` with `gasless: true`.** A grant is a relayable
 * write, so the ordinary action relays it and returns a transaction hash, with
 * no separate code path and no separate result shape. This stays as the
 * low-level escape hatch, for when you want the `requestId` and the fee figures
 * off the acceptance receipt — the same relationship `relayInstantOperations`
 * has with the transparent path.
 *
 * A delegation grant is an ordinary owner-signed InstantLayer operation:
 * `grantDelegation(DelegationInfo)` calldata targeting the InstantLayer,
 * signed under the InstantLayer EIP-712 domain with a fresh sequential nonce,
 * submitted through `relay-instant`. (The old standalone delegation-relay
 * endpoint and `SignedDelegation` payload no longer exist.) Combine with
 * `GASLESS_SESSION_KEY_SELECTORS` to onboard a session key that can then sign
 * gasless account management without further wallet prompts.
 *
 * Fire-and-forget like every relay: persist the returned `requestId` and poll
 * `getGaslessRequest` (or `waitForGaslessRequest`) to a terminal status. The
 * wallet-paid alternative is the plain `grantDelegation` write.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - Delegation fields, optional chain id / signer override.
 * @returns The acceptance receipt; persist `requestId` immediately.
 * @throws {SymmError} `GASLESS_NOT_CONFIGURED` / `GASLESS_UNSUPPORTED_CONTRACTS_VERSION`.
 * @throws {SymmApiError} `GASLESS_RELAY_SUBMIT_FAILED` on HTTP failure.
 *
 * @example
 * ```ts
 * const receipt = await relayGrantDelegation(config, {
 *   account: subAccount,
 *   delegatedSigner: sessionKeyAddress,
 *   selectors: GASLESS_SESSION_KEY_SELECTORS,
 *   expiryTimestamp: BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 3600),
 * });
 * ```
 */
export async function relayGrantDelegation(
  config: Config,
  parameters: RelayGrantDelegationParameters,
): Promise<RelayGrantDelegationReturnType> {
  const { chainId, account, delegatedSigner, selectors, expiryTimestamp, from } = parameters;

  const chain = config.getChainConfig(chainId);
  const walletClient = await config.getWalletClient({ chainId, from });
  const domain = getInstantLayerEip712Domain(config, { chainId });

  const callData = encodeFunctionData({
    abi: instantLayerAbi,
    functionName: "grantDelegation",
    args: [
      {
        account: { addr: account, isPartyB: false },
        delegatedSigner,
        selectors: [...selectors],
        expiryTimestamp,
      },
    ],
  });

  return withGaslessNonceLock(config, chain.chainId, account, async () => {
    const currentNonce = await getInstantLayerNonce(config, { chainId, account });

    const operation = buildSignedOperation({
      signer: walletClient.account.address,
      target: chain.addresses.instantLayerAddress,
      callData,
      signerAccount: account,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 20 * 60),
      nonce: currentNonce + 1n,
    });
    const signature = await signSignedOperation(operation, domain, walletClient);

    return relayInstantOperations(config, {
      chainId,
      userAddress: walletClient.account.address,
      operationType: "grantDelegation",
      operations: [{ operation, signature }],
      idempotencyKey: parameters.idempotencyKey,
    });
  });
}
