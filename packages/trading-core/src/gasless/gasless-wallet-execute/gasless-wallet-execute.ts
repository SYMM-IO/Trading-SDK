import { encodeFunctionData, isAddressEqual, zeroAddress, type Address } from "viem";
import type { Config } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute, FromParameter } from "../../shared/types/properties";
import { generateSalt } from "../../solvers/instant-open/shared/operations";
import { getSubAccount } from "../../symmio-contracts/account-layer/actions/get-sub-account";
import { getVirtualAccount } from "../../symmio-contracts/account-layer/actions/get-virtual-account";
import { getIsDelegationActive } from "../../symmio-contracts/instant-layer/actions/get-is-delegation-active";
import { GASLESS_WALLET_OPERATION_TYPES, getGaslessGatewayEip712Domain } from "../eip712";
import { toGaslessSafeNumber } from "../format-gasless-operation";
import { gaslessWalletAbi } from "../gateway/gasless-layer-abi";
import { getGaslessWalletAddress } from "../get-gasless-wallet-address/get-gasless-wallet-address";
import { getGaslessWalletNonce } from "../get-gasless-wallet-nonce/get-gasless-wallet-nonce";
import { gaslessPost, generateGaslessIdempotencyKey, isRetryableGaslessSubmitError, resolveGaslessHttp } from "../http";
import { withGaslessNonceLock } from "../nonce-lock";
import { toGaslessSubmitReceipt } from "../relay-instant-operations/relay-instant-operations";
import type { GaslessSubmitReceipt } from "../types";
import type { GaslessWireOperationAccepted, GaslessWireRelayInstantRequest } from "../wire-types";
import { toWalletCallTuple, type GaslessWalletCall } from "./calls";
import { getGaslessWalletExecuteSelectors } from "./selectors";

/** How long a wallet-operation signature stays valid. */
const GASLESS_WALLET_OPERATION_DEADLINE_SECONDS = 10 * 60;

/** Default workflow label stored with a wallet-execute request. */
const GASLESS_WALLET_EXECUTE_OPERATION_TYPE = "gaslessqWalletExecute";

/**
 * The identities the GaslessLayer derives from a wallet operation, mirroring
 * `GaslessWalletExecutionLib._walletOwnerForOperation`.
 *
 * A **live** virtual account rolls up to its parent (a deleted one stays
 * itself, so a historical VA cannot widen authority); the wallet then belongs
 * to `ownerOf(canonicalAccount)`, falling back to the account itself when the
 * AccountLayer knows no owner — which is exactly what makes a bare EOA resolve
 * to its own wallet.
 */
async function resolveWalletIdentities(
  config: Config,
  parameters: { chainId?: number; account: Address },
): Promise<{ canonicalAccount: Address; ownerWallet: Address }> {
  const { chainId, account } = parameters;

  const virtualAccount = await getVirtualAccount(config, { chainId, account });
  const canonicalAccount = virtualAccount.isExists ? virtualAccount.parentAccount : account;

  const detail = await getSubAccount(config, { chainId, account: canonicalAccount });
  const ownerWallet = detail.isExists && !isAddressEqual(detail.owner, zeroAddress) ? detail.owner : canonicalAccount;

  return { canonicalAccount, ownerWallet };
}

/**
 * Parameters for {@link gaslessWalletExecute}.
 */
export type GaslessWalletExecuteParameters = Compute<
  ChainIdParameter &
    FromParameter & {
      /**
       * Owner of the deterministic gasless wallet. Defaults to `signerAccount`,
       * or to the signing wallet's address when that is omitted too. When
       * `signerAccount` names a sub-account the owner is read from the
       * AccountLayer, so a session key never has to supply it.
       */
      owner?: Address;
      /**
       * Account whose InstantLayer delegations authorize the operation, whose
       * wallet-operation nonce is consumed, and which the gateway bills.
       * Defaults to `owner`.
       *
       * **Pass a sub-account whenever a session key signs.** `grantDelegation`
       * is `onlyAccountOwner` and the AccountLayer knows no owner for a bare
       * EOA, so a delegation with an EOA delegator can never be granted — the
       * default therefore only ever works owner-signed. The wallet is unchanged
       * either way: the gateway derives it from `ownerOf(signerAccount)`, which
       * is the same owner and so the same address.
       *
       * It is also the billing account. An EOA holds no SYMMIO collateral, so
       * the default is payable only while the daily free quota covers it; a
       * funded sub-account is what makes the fee chargeable.
       */
      signerAccount?: Address;
      /**
       * The calls to execute from the wallet, in order. The batch is atomic:
       * if any call reverts, the whole operation reverts and nothing is charged.
       */
      calls: readonly GaslessWalletCall[];
      /**
       * Free-form workflow label (1-128 characters) stored with the request for
       * metrics and vendor support. Defaults to `"gaslessqWalletExecute"`. Fees
       * are **not** keyed from it — they come from the inner call selectors.
       */
      operationType?: string;
      /** Stable retry key for the relay submit; defaults to a random UUID. */
      idempotencyKey?: string;
      /** Non-secret client correlation data stored with the request. */
      metadata?: Record<string, unknown>;
    }
>;

/** Return type of {@link gaslessWalletExecute}. */
export type GaslessWalletExecuteReturnType = GaslessSubmitReceipt;

/**
 * Run **any contract call from the deterministic gasless wallet**, with no
 * native gas — an atomic batch of arbitrary `{ target, value, data }` calls
 * relayed by GaslessQ. Nothing in the SDK or the relayer restricts the inner
 * targets or selectors; authority comes from the owner's EIP-712 signature and
 * the wallet can only ever be moved by its owner.
 *
 * Give each call either raw `data` or an `{ abi, functionName, args }` triple
 * the SDK encodes; the two forms mix freely in one batch. Typical uses are a
 * collateral exit (a finalized withdrawal routed to the wallet), or an ERC-20
 * `approve` followed by a bridge or router call.
 *
 * **The wallet's own balance never pays the fee.** The GaslessLayer prices the
 * operation from the **inner** call selectors and charges it to the SYMMIO
 * account's collateral, bounded by its diamond-side operational-fee allowance;
 * a per-account daily free quota can waive it. Collateral parked at the wallet
 * is not a funding source for gas.
 *
 * The signature scheme is deliberately different from ordinary operations:
 * - `callData` is `GaslessWallet.execute((address,uint256,bytes)[])` (selector
 *   `0x3f707e6b`) and the operation's `target` is the **wallet** address;
 * - the EIP-712 domain is the **gateway** domain (`"GaslessGateway"`, with the
 *   GaslessLayer as `verifyingContract`);
 * - the signed struct has five fields (no `flexFields`, no `maxUses`) — the
 *   relay body still carries `flexFields: []` / `maxUses: 1`, appended after
 *   signing;
 * - the nonce comes from `walletOperationNonces(owner) + 1`, a separate
 *   counter from InstantLayer nonces;
 * - `signerAccount.addr` defaults to the **owner wallet itself**; pass a
 *   sub-account through `signerAccount` to sign with a session key.
 *
 * **Session keys.** A signer that is not the wallet's owner must hold
 * InstantLayer delegations for the wallet-execution sentinel **and every inner
 * call selector** — build them with `getGaslessWalletExecuteSelectors`. Because
 * a delegation can only be granted on an account the AccountLayer knows an
 * owner for, the delegation lives on a **sub-account**, which you then pass as
 * `signerAccount`; the wallet it resolves to is unchanged. A missing grant
 * throws `GASLESS_SIGNER_NOT_DELEGATED` before the signature prompt (disable
 * with `execution.preflightDelegation: false`).
 *
 * Fire-and-forget: persist the returned `requestId` and poll to a terminal
 * status. React consumers should reach for `useGaslessWalletExecute`, which
 * confirms the request before it resolves.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - The calls, optional owner/chain/signer/label overrides.
 * @returns The acceptance receipt; persist `requestId` immediately.
 * @throws {SymmError} `GASLESS_NOT_CONFIGURED` / `GASLESS_UNSUPPORTED_CONTRACTS_VERSION` /
 *   `GASLESS_WALLET_UNAVAILABLE`.
 * @throws {SymmError} `GASLESS_SIGNER_NOT_DELEGATED` when a non-owner signer is
 *   missing a delegation for the sentinel or an inner selector.
 * @throws {SymmApiError} `GASLESS_RELAY_SUBMIT_FAILED` on HTTP failure —
 *   `InvalidWalletOperationTarget` in the decoded revert means the operation's
 *   target was not the owner's wallet.
 *
 * @example
 * ```ts
 * // Approve a router, then call it — one atomic, gas-free batch.
 * const receipt = await gaslessWalletExecute(config, {
 *   calls: [
 *     { target: usdc, abi: erc20Abi, functionName: "approve", args: [router, amount] },
 *     { target: router, data: routeCalldata },
 *   ],
 *   operationType: "bridgeWithdraw",
 * });
 * ```
 */
export async function gaslessWalletExecute(
  config: Config,
  parameters: GaslessWalletExecuteParameters,
): Promise<GaslessWalletExecuteReturnType> {
  const { chainId, calls, from, metadata } = parameters;

  const chain = config.getChainConfig(chainId);
  const context = resolveGaslessHttp(config, { chainId, service: "operations" });
  const walletClient = await config.getWalletClient({ chainId, from });
  const signer = walletClient.account.address;

  /**
   * `signedOp.signerAccount.addr`: the nonce key, the delegation scope, and the
   * billing identity. Defaults to `owner` so the owner-signed call is unchanged.
   */
  const account = parameters.signerAccount ?? parameters.owner ?? signer;

  /**
   * Without an explicit `signerAccount` the account is an owner EOA by
   * definition of this API, and the gateway's own resolution is the identity on
   * both counts — so skip two reads on the hot path rather than confirming what
   * cannot differ.
   */
  const { canonicalAccount, ownerWallet } =
    parameters.signerAccount === undefined
      ? { canonicalAccount: account, ownerWallet: parameters.owner ?? account }
      : await resolveWalletIdentities(config, { chainId, account });
  const owner = parameters.owner ?? ownerWallet;

  /** Encoded before any network work, so a malformed ABI call throws up front. */
  const callData = encodeFunctionData({
    abi: gaslessWalletAbi,
    functionName: "execute",
    args: [calls.map(toWalletCallTuple)],
  });

  /**
   * A signer that is not the wallet's owner is a delegate, and the GaslessLayer
   * demands an active delegation for the wallet-execution sentinel **and every
   * inner selector**. Probing here turns a relayer-side
   * `WalletDelegationMissing` into a local error that names the missing
   * selectors, before the user is asked to sign anything.
   */
  if ((chain.gasless?.execution?.preflightDelegation ?? true) && !isAddressEqual(signer, owner)) {
    const required = getGaslessWalletExecuteSelectors(calls);
    const active = await Promise.all(
      required.map((selector) =>
        getIsDelegationActive(config, { chainId, account: canonicalAccount, delegate: signer, selector }),
      ),
    );
    const missing = required.filter((_, index) => !active[index]);
    if (missing.length > 0) {
      throw new SymmError(
        "validation",
        "GASLESS_SIGNER_NOT_DELEGATED",
        `Gasless: ${signer} holds no delegation from ${canonicalAccount} for ${missing.join(", ")}. Grant getGaslessWalletExecuteSelectors(calls) to the key, on a sub-account — an owner EOA cannot be a delegator.`,
      );
    }
  }

  return withGaslessNonceLock(config, chain.chainId, `wallet:${account}`, async () => {
    const [wallet, currentNonce] = await Promise.all([
      getGaslessWalletAddress(config, { chainId, owner }),
      getGaslessWalletNonce(config, { chainId, account }),
    ]);

    const replayAttackHeader = {
      nonce: currentNonce + 1n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + GASLESS_WALLET_OPERATION_DEADLINE_SECONDS),
      salt: generateSalt(),
    };

    /** The 5-field gateway-domain struct — exactly what gets signed. */
    const message = {
      signer,
      target: wallet,
      callData,
      signerAccount: { addr: account, isPartyB: false },
      replayAttackHeader,
    };

    const signature = await walletClient.signTypedData({
      account: walletClient.account,
      domain: getGaslessGatewayEip712Domain(config, { chainId }),
      types: GASLESS_WALLET_OPERATION_TYPES,
      primaryType: "SignedOperation",
      message,
    });

    /** The wire twin of the signed struct: uint256 fields become JSON numbers. */
    const wireOperation = {
      signer: message.signer,
      target: message.target,
      callData: message.callData,
      signerAccount: message.signerAccount,
      replayAttackHeader: {
        nonce: toGaslessSafeNumber(replayAttackHeader.nonce, "replayAttackHeader.nonce"),
        deadline: toGaslessSafeNumber(replayAttackHeader.deadline, "replayAttackHeader.deadline"),
        salt: replayAttackHeader.salt,
      },
    };

    const idempotencyKey = parameters.idempotencyKey ?? generateGaslessIdempotencyKey();
    const body: GaslessWireRelayInstantRequest = {
      idempotencyKey,
      userAddress: owner,
      accountId: account,
      operationType: parameters.operationType ?? GASLESS_WALLET_EXECUTE_OPERATION_TYPE,
      /** Transport-only fields (`flexFields`, `maxUses`) the signature deliberately excludes. */
      signedOps: [{ ...wireOperation, flexFields: [], maxUses: 1 }],
      signatures: [signature],
      fills: [[]],
      flexFillerSignatures: [[]],
      ...(metadata !== undefined ? { metadata } : {}),
    };

    let raw: GaslessWireOperationAccepted;
    try {
      raw = await gaslessPost<GaslessWireOperationAccepted>(
        context,
        "/gateway/relay-instant",
        body,
        "GASLESS_RELAY_SUBMIT_FAILED",
      );
    } catch (err) {
      if (!isRetryableGaslessSubmitError(err)) throw err;
      raw = await gaslessPost<GaslessWireOperationAccepted>(
        context,
        "/gateway/relay-instant",
        body,
        "GASLESS_RELAY_SUBMIT_FAILED",
      );
    }
    return toGaslessSubmitReceipt(raw);
  });
}
