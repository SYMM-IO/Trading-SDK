import { isAddressEqual, type Address, type Hex } from "viem";
import type { Config } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute, FromParameter } from "../../shared/types/properties";
import { generateSalt } from "../../solvers/instant-open/shared/operations";
import { getInstantLayerNonce } from "../../symmio-contracts/instant-layer/actions/get-instant-layer-nonce";
import { getIsDelegationActive } from "../../symmio-contracts/instant-layer/actions/get-is-delegation-active";
import { assertGaslessGatewayCoherence } from "../assert-gateway-coherence";
import type { GaslessBatchCall } from "../batch/calls";
import {
  buildGaslessBatchOperations,
  defaultGaslessBatchOperationType,
  distinctGaslessBatchWalletIds,
  readGaslessBatchWalletTargets,
  resolveGaslessBatchEntries,
  type ResolvedGaslessBatchEntry,
} from "../batch/resolve-gasless-batch";
import { findUndelegatedGaslessSelectors, getCachedGaslessAccountOwner } from "../delegation-preflight";
import { formatGaslessOperation } from "../format-gasless-operation";
import { getGaslessWalletExecuteSelectors } from "../gasless-wallet-execute/selectors";
import { getGaslessFeeQuote } from "../get-gasless-fee-quote/get-gasless-fee-quote";
import { getGaslessWalletNonce } from "../get-gasless-wallet-nonce/get-gasless-wallet-nonce";
import { generateGaslessIdempotencyKey, postGaslessSubmit, resolveGaslessHttp } from "../http";
import {
  blocksGaslessNonceStream,
  gaslessInstantNonceStreamKey,
  gaslessWalletNonceStreamKey,
  readGaslessStreamNonce,
  submitOnGaslessNonceStreams,
  withGaslessNonceLocks,
} from "../nonce-lock";
import { resolveGaslessService } from "../resolve-gasless";
import { resolveGaslessWalletIdentities, type GaslessWalletIdentities } from "../resolve-wallet-identities";
import { toGaslessSubmitReceipt } from "../to-gasless-submit-receipt";
import type { GaslessSubmitReceipt } from "../types";
import { toGaslessWalletIdWire } from "../wallet-id";
import type { GaslessWireOperationAccepted, GaslessWireRelayInstantRequest } from "../wire-types";
import { signGaslessBatchOperations } from "./sign-gasless-batch";

/** How long a batch's signatures stay valid — room for one wallet prompt per operation. */
const GASLESS_BATCH_DEADLINE_SECONDS = 20 * 60;

/**
 * Parameters for {@link relayGaslessBatch}.
 */
export type RelayGaslessBatchParameters = Compute<
  ChainIdParameter &
    FromParameter & {
      /**
       * The sub-account every operation runs under: the `signerAccount` of each
       * relayable write, whose InstantLayer nonces the batch consumes and whose
       * delegations authorize a session key; the billing account (a virtual
       * account bills its parent); and, for GaslessWallet entries, the account
       * whose owner's wallets execute — `ownerOf(account)`, so a sub-account
       * resolves to its owner's wallets.
       *
       * Margin writes run under the virtual account's **parent** sub-account,
       * with the virtual account as a calldata argument.
       */
      account: Address;
      /**
       * The calls, in execution order. The batch is **atomic**: one revert rolls
       * back every call and every fee. Each is signed separately — the protocol
       * has no batch signature — so a browser wallet shows one prompt per call,
       * while a session key signs them silently.
       */
      calls: readonly GaslessBatchCall[];
      /**
       * Free-form workflow label (1-128 characters) stored with the request for
       * metrics and vendor support. Defaults to the calls' own labels joined with
       * `+` (`"approveOperationalFee+allocate"`), or `"gaslessBatch"` when that is
       * too long. Fees are **not** keyed from it.
       */
      operationType?: string;
      /** Non-secret client correlation data stored with the request. */
      metadata?: Record<string, unknown>;
    }
>;

/** Return type of {@link relayGaslessBatch}. */
export type RelayGaslessBatchReturnType = GaslessSubmitReceipt;

/**
 * Relay **several gasless actions as one request** — one atomic transaction the
 * GaslessQ relayer broadcasts and pays gas for.
 *
 * Give each relayable write as `{ functionName, args }` (with an optional
 * `abi`) or raw `{ data }` — the target contract is resolved from its selector —
 * and calls the owner's GaslessWallet makes as `{ walletCalls, walletId }`. The
 * forms mix freely:
 *
 * 1. every call is encoded and checked before any network call — a write the
 *    relayer cannot carry throws `GASLESS_NOT_RELAYABLE`;
 * 2. a session key's delegations are checked before any prompt
 *    (`execution.preflightDelegation`, default on);
 * 3. fresh nonces are read and sequenced per stream — the account's InstantLayer
 *    nonces for the writes, each wallet id's own nonces for its entries;
 * 4. the batch is priced on-chain before any prompt (`execution.preflightFee`,
 *    default on) — a quote the contract refuses throws, a quote that fails for
 *    transport reasons does not block;
 * 5. each operation is signed — one EIP-712 prompt per call, in order;
 * 6. one `relay-instant` request carries them all, with one wallet id per
 *    operation (`0` for every write).
 *
 * The fee is collected **after** the whole batch executes, so an operational-fee
 * approval earlier in the batch already covers the calls after it. Preview the
 * same calls with {@link getGaslessBatchFeeQuote}.
 *
 * Fire-and-forget, like {@link relayInstantOperations}: persist the receipt's
 * `requestId`, `owner`, `walletIds` and `idempotencyKey`, then follow the
 * request to a terminal status. A `202` is the point of no return. React
 * consumers should reach for `useRelayGaslessBatch`, which confirms the request
 * before it resolves.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - The account, the calls, and optional chain / signer / label overrides.
 * @returns The acceptance receipt; persist it immediately.
 * @throws {SymmError} `GASLESS_NOT_CONFIGURED` / `GASLESS_UNSUPPORTED_CONTRACTS_VERSION`.
 * @throws {SymmError} `GASLESS_EMPTY_BATCH`, `GASLESS_NOT_RELAYABLE` or `GASLESS_WALLET_ID_INVALID`
 *   before any network call.
 * @throws {SymmError} `GASLESS_CONFIG_INCOHERENT` when the GaslessLayer verifies another InstantLayer.
 * @throws {SymmError} `GASLESS_SIGNER_NOT_DELEGATED` when a session key is missing a selector —
 *   grant `getGaslessBatchSelectors(calls)` on `account`.
 * @throws {SymmError} `GASLESS_FREE_QUOTA_EXHAUSTED`, `GASLESS_FEE_QUOTE_REVERTED` or
 *   `GASLESS_LAYER_INTERFACE_UNSUPPORTED` from the fee pre-flight, before any prompt.
 * @throws {SymmError} `GASLESS_NONCE_STREAM_BUSY` when an earlier relay on one of the
 *   batch's nonce streams is still unaccounted for.
 * @throws {SymmApiError} `GASLESS_RELAY_SUBMIT_FAILED` on HTTP failure, and
 *   `GASLESS_SUBMIT_UNCONFIRMED` when the outcome could not be established — replay it with
 *   `resubmitGaslessRequest`, never by signing the batch again.
 * @throws The wallet's own error when the user rejects a prompt; nothing is submitted.
 *
 * @example
 * ```ts
 * import { relayGaslessBatch } from "@symmio/trading-core";
 *
 * // Approve the gateway's fee allowance and use it in the same request.
 * const receipt = await relayGaslessBatch(config, {
 *   account: subAccount,
 *   calls: [
 *     { functionName: "approveOperationalFeeWithMultiplier", args: [[gaslessLayer], [budget18], [10_000n]] },
 *     { functionName: "allocate", args: [amount] },
 *   ],
 * });
 * ```
 */
export async function relayGaslessBatch(
  config: Config,
  parameters: RelayGaslessBatchParameters,
): Promise<RelayGaslessBatchReturnType> {
  const { account, calls, from, metadata } = parameters;
  const gasless = resolveGaslessService(config, { chainId: parameters.chainId });
  const chain = config.getChainConfig(parameters.chainId);
  const chainId = chain.chainId;

  const entries = resolveGaslessBatchEntries(chain.addresses, calls);
  const operationType = parameters.operationType ?? defaultGaslessBatchOperationType(entries);
  const context = resolveGaslessHttp(config, { chainId, service: "operations" });
  const execution = gasless.execution ?? {};

  const instantSelectors = entries.flatMap((entry) => (entry.type === "instant" ? [entry.selector] : []));
  const walletIds = distinctGaslessBatchWalletIds(entries);

  /** Relayable writes sign for the configured InstantLayer; make sure the gateway verifies that one. */
  if (instantSelectors.length > 0) await assertGaslessGatewayCoherence(config, chainId, gasless);

  const walletClient = await config.getWalletClient({ chainId, from });
  const signer = walletClient.account.address;

  const identities = walletIds.length > 0 ? await resolveGaslessWalletIdentities(config, { chainId, account }) : null;

  /**
   * Delegation pre-flight, before any signature prompt: a session key missing a
   * selector would otherwise sign every operation, and the relayer's simulation
   * would reject the batch after the user paid for the prompts.
   */
  if (execution.preflightDelegation ?? true) {
    const missing = [
      ...(instantSelectors.length > 0
        ? await findUndelegatedGaslessSelectors(config, {
            chainId,
            signer,
            signerAccount: account,
            selectors: instantSelectors,
          })
        : []),
      ...(identities ? await findUndelegatedWalletSelectors(config, { chainId, signer, identities, entries }) : []),
    ];
    if (missing.length > 0) {
      throw new SymmError(
        "validation",
        "GASLESS_SIGNER_NOT_DELEGATED",
        `Gasless: signer ${signer} holds no active InstantLayer delegation from ${account} for selector(s) ${[...new Set(missing)].join(", ")}. Grant getGaslessBatchSelectors(calls) to the session key on ${account}, or sign the batch with the account's owner.`,
      );
    }
  }

  /**
   * `userAddress` is the service's tracking identity: the owner of the account's
   * wallets, else the sub-account's owner. The signer may be a session key that
   * owns nothing, so an unreadable owner falls back to it rather than failing
   * the batch over a tracking label.
   */
  const owner =
    identities?.ownerWallet ??
    (await getCachedGaslessAccountOwner(config, chainId, account).catch(() => null)) ??
    signer;

  const instantKey = instantSelectors.length > 0 ? gaslessInstantNonceStreamKey(chainId, account) : null;
  const walletKeys = new Map(
    walletIds.map((walletId) => [walletId, gaslessWalletNonceStreamKey(chainId, walletId, owner, account)] as const),
  );
  const streamKeys = [...(instantKey === null ? [] : [instantKey]), ...walletKeys.values()];

  /**
   * The locks span read-sign-submit on every stream the batch signs on. They are
   * released at the `202`; the signed nonces are recorded on each stream so the
   * next caller waits for them lazily instead of signing them again.
   */
  return withGaslessNonceLocks(config, streamKeys, async () => {
    const [instantNonce, walletTargets, walletNonces] = await Promise.all([
      instantKey === null
        ? 0n
        : readGaslessStreamNonce(config, instantKey, () => getInstantLayerNonce(config, { chainId, account })),
      readGaslessBatchWalletTargets(config, { chainId, owner, walletIds }),
      readWalletNonces(config, { chainId, owner, account, walletKeys }),
    ]);

    const deadline = BigInt(Math.floor(Date.now() / 1000) + GASLESS_BATCH_DEADLINE_SECONDS);
    const built = buildGaslessBatchOperations(entries, {
      signer,
      account,
      deadline,
      instantNonce,
      walletTargets,
      walletNonces,
      salt: generateSalt,
    });

    /** Fee pre-flight before any signature prompt. */
    if (execution.preflightFee ?? true) {
      try {
        await getGaslessFeeQuote(config, {
          chainId,
          operations: built.operations.map((operation, index) => ({ operation, walletId: built.walletIds[index] })),
        });
      } catch (err) {
        /**
         * A refused quote — an exhausted free quota, a batch the contract
         * rejects, a GaslessLayer without the quote interface — means the relay
         * would fail the same way, and nothing is signed yet.
         */
        if (err instanceof SymmError) throw err;
        /**
         * Anything else is inconclusive: a transport or RPC failure of the quote
         * read itself. The relayer simulates the full transaction before
         * accepting it, so signing proceeds.
         */
      }
    }

    const signatures = await signGaslessBatchOperations(config, {
      chainId,
      walletClient,
      entries,
      operations: built.operations,
    });

    /**
     * One key per signature: the operations were just signed, so the key is
     * minted here. Replaying a lost response is `resubmitGaslessRequest`'s job,
     * which reuses this key with the exact bytes that went with it.
     */
    const idempotencyKey = generateGaslessIdempotencyKey();
    const body: GaslessWireRelayInstantRequest = {
      idempotencyKey,
      userAddress: owner,
      accountId: account,
      operationType,
      signedOps: built.operations.map(formatGaslessOperation),
      signatures,
      walletIds: built.walletIds.map(toGaslessWalletIdWire),
      fills: built.operations.map(() => []),
      flexFillerSignatures: built.operations.map(() => []),
      ...(metadata !== undefined ? { metadata } : {}),
    };

    const streams = [
      ...(instantKey === null || built.lastInstantNonce === null
        ? []
        : [{ key: instantKey, signedNonce: built.lastInstantNonce }]),
      ...[...walletKeys].map(([walletId, key]) => ({
        key,
        signedNonce: built.lastWalletNonces.get(walletId) ?? 0n,
      })),
    ];

    return submitOnGaslessNonceStreams(
      config,
      streams,
      { service: "operations", chainId, deadline },
      async () => {
        const raw = await postGaslessSubmit<GaslessWireOperationAccepted>(
          context,
          "/gateway/relay-instant",
          body,
          idempotencyKey,
        );
        return toGaslessSubmitReceipt(raw, {
          owner,
          walletIds: built.walletIds,
          idempotencyKey,
          protocolInstance: context.protocolInstance,
        });
      },
      blocksGaslessNonceStream,
    );
  });
}

/**
 * The consumed wallet-operation nonce of each wallet a batch executes from,
 * waiting first for anything this SDK already signed on that stream.
 */
async function readWalletNonces(
  config: Config,
  parameters: { chainId: number; owner: Address; account: Address; walletKeys: ReadonlyMap<bigint, string> },
): Promise<Map<bigint, bigint>> {
  const { chainId, owner, account, walletKeys } = parameters;
  const entries = await Promise.all(
    [...walletKeys].map(
      async ([walletId, key]) =>
        [
          walletId,
          await readGaslessStreamNonce(config, key, () =>
            getGaslessWalletNonce(config, { chainId, owner, walletId, account }),
          ),
        ] as const,
    ),
  );
  return new Map(entries);
}

/**
 * The wallet-entry selectors a delegate may not relay: the GaslessLayer demands
 * a delegation for the wallet-execution sentinel **and every inner selector**,
 * on the account's canonical delegator. The wallet's owner needs none.
 */
async function findUndelegatedWalletSelectors(
  config: Config,
  parameters: {
    chainId: number;
    signer: Address;
    identities: GaslessWalletIdentities;
    entries: readonly ResolvedGaslessBatchEntry[];
  },
): Promise<Hex[]> {
  const { chainId, signer, identities, entries } = parameters;
  if (isAddressEqual(signer, identities.ownerWallet)) return [];

  const required = [
    ...new Set(
      entries.flatMap((entry) => (entry.type === "wallet" ? getGaslessWalletExecuteSelectors(entry.walletCalls) : [])),
    ),
  ];
  const active = await Promise.all(
    required.map((selector) =>
      getIsDelegationActive(config, { chainId, account: identities.canonicalAccount, delegate: signer, selector }),
    ),
  );
  return required.filter((_, index) => !active[index]);
}
