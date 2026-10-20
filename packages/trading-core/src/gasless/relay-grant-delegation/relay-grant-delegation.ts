import { encodeFunctionData, type Address, type Hex } from "viem";
import type { Config } from "../../core/config";
import type {
  ChainIdParameter,
  Compute,
  FromParameter,
  GaslessIdempotencyKeyParameter,
} from "../../shared/types/properties";
import { getInstantLayerEip712Domain, signSignedOperation } from "../../solvers/instant-open/shared/eip712";
import { buildSignedOperation } from "../../solvers/instant-open/shared/operations";
import { instantLayerAbi } from "../../symmio-contracts/abi/v0.8.6/instant-layer";
import { getInstantLayerNonce } from "../../symmio-contracts/instant-layer/actions/get-instant-layer-nonce";
import { GASLESS_SIGNATURE_LIFETIME_SECONDS } from "../constants";
import { resolveGaslessIdempotencyKey } from "../idempotency-key";
import {
  blocksGaslessNonceStream,
  gaslessInstantNonceStreamKey,
  getGaslessPendingAcceptance,
  readGaslessStreamNonce,
  submitOnGaslessNonceStream,
  withGaslessNonceLock,
} from "../nonce-lock";
import { relayInstantOperations } from "../relay-instant-operations/relay-instant-operations";
import type { GaslessSubmitReceipt } from "../types";

/**
 * Parameters for {@link relayGrantDelegation}.
 */
export type RelayGrantDelegationParameters = Compute<
  ChainIdParameter &
    FromParameter &
    GaslessIdempotencyKeyParameter & {
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
 * Pass `idempotencyKey` (one per user action, from
 * `generateGaslessIdempotencyKey`) to make the grant retryable: a later call
 * with the same key never waits for its own earlier submit, returns that
 * submit's receipt when this config saw it accepted, and is otherwise accepted
 * by the service at most once. Omitted, a key is generated for this call alone.
 * The signature's deadline is fixed when the call starts
 * (`GASLESS_SIGNATURE_LIFETIME_SECONDS`).
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - Delegation fields, optional chain id / signer / idempotency-key override.
 * @returns The acceptance receipt; persist `requestId` immediately.
 * @throws {SymmError} `GASLESS_IDEMPOTENCY_KEY_INVALID` for a blank key or one longer than 128 characters.
 * @throws {SymmError} `GASLESS_NOT_CONFIGURED` / `GASLESS_UNSUPPORTED_CONTRACTS_VERSION`.
 * @throws {SymmApiError} `GASLESS_RELAY_SUBMIT_FAILED` on HTTP failure.
 * @throws {SymmApiError} `GASLESS_SUBMIT_UNCONFIRMED` when the outcome could not be
 *   established; call again under the same `idempotencyKey`, or replay it with
 *   `resubmitGaslessRequest`, rather than signing a new grant under a new key.
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

  /** Fixed when the call starts, before any lock wait or prompt. */
  const deadline = BigInt(Math.floor(Date.now() / 1000) + GASLESS_SIGNATURE_LIFETIME_SECONDS);
  /** One key per user action; validated before any network call or prompt. */
  const callerOwnedKey = parameters.idempotencyKey !== undefined;
  const idempotencyKey = resolveGaslessIdempotencyKey(parameters.idempotencyKey);

  const chain = config.getChainConfig(chainId);
  const streamKey = gaslessInstantNonceStreamKey(chain.chainId, account);

  /** This config already saw an attempt under the same key accepted: return it instead of signing again. */
  if (callerOwnedKey) {
    const earlier = getGaslessPendingAcceptance(config, [streamKey], idempotencyKey);
    if (earlier) return earlier;
  }

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

  return withGaslessNonceLock(config, streamKey, async () => {
    const currentNonce = await readGaslessStreamNonce(
      config,
      streamKey,
      () => getInstantLayerNonce(config, { chainId, account }),
      callerOwnedKey ? idempotencyKey : undefined,
    );

    const operation = buildSignedOperation({
      signer: walletClient.account.address,
      target: chain.addresses.instantLayerAddress,
      callData,
      signerAccount: account,
      deadline,
      nonce: currentNonce + 1n,
    });
    const signature = await signSignedOperation(operation, domain, walletClient);

    return submitOnGaslessNonceStream(
      config,
      streamKey,
      {
        signedNonce: currentNonce + 1n,
        service: "operations",
        chainId: chain.chainId,
        deadline,
        idempotencyKey,
        callerOwnedKey,
      },
      () =>
        relayInstantOperations(config, {
          chainId,
          userAddress: walletClient.account.address,
          operationType: "grantDelegation",
          /** A delegation grant is an ordinary InstantLayer operation: wallet 0. */
          operations: [{ operation, signature }],
          idempotencyKey,
        }),
      blocksGaslessNonceStream,
    );
  });
}
