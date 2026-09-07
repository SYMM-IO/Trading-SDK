import { encodeFunctionData, type Address, type Hex } from "viem";
import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute, FromParameter } from "../../shared/types/properties";
import { generateSalt } from "../../solvers/instant-open/shared/operations";
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

/** How long a wallet-operation signature stays valid. */
const GASLESS_WALLET_OPERATION_DEADLINE_SECONDS = 10 * 60;

/** One inner call of a gasless-wallet `execute` batch. */
export interface GaslessWalletCall {
  /** Contract the wallet calls. */
  target: Address;
  /** Native value forwarded with the call (usually `0n`). */
  value: bigint;
  /** Calldata for the target. */
  data: Hex;
}

/**
 * Parameters for {@link gaslessWalletExecute}.
 */
export type GaslessWalletExecuteParameters = Compute<
  ChainIdParameter &
    FromParameter & {
      /**
       * Owner of the deterministic gasless wallet. Defaults to the signing
       * wallet's address. The owner's wallet signs the operation — delegated
       * (session-key) wallet execution is not supported by this action.
       */
      owner?: Address;
      /** The calls to execute from the wallet, in order. */
      calls: readonly GaslessWalletCall[];
      /** Stable retry key for the relay submit; defaults to a random UUID. */
      idempotencyKey?: string;
      /** Non-secret client correlation data stored with the request. */
      metadata?: Record<string, unknown>;
    }
>;

/** Return type of {@link gaslessWalletExecute}. */
export type GaslessWalletExecuteReturnType = GaslessSubmitReceipt;

/**
 * Execute calls **from the deterministic gasless wallet** without native gas —
 * the exit path for collateral sitting at the wallet (e.g. finalized
 * withdrawals routed there).
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
 * - `signerAccount.addr` is the **owner wallet itself**, not a sub-account.
 *
 * Fees derive from the **inner** call selectors. Fire-and-forget: persist the
 * returned `requestId` and poll to a terminal status.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - The calls, optional owner/chain/signer overrides.
 * @returns The acceptance receipt; persist `requestId` immediately.
 * @throws {SymmError} `GASLESS_NOT_CONFIGURED` / `GASLESS_UNSUPPORTED_CONTRACTS_VERSION` /
 *   `GASLESS_WALLET_UNAVAILABLE`.
 * @throws {SymmApiError} `GASLESS_RELAY_SUBMIT_FAILED` on HTTP failure —
 *   `InvalidWalletOperationTarget` in the decoded revert means the operation's
 *   target was not the owner's wallet.
 *
 * @example
 * ```ts
 * const receipt = await gaslessWalletExecute(config, {
 *   calls: [{ target: usdc, value: 0n, data: transferCalldata }],
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
  const owner = parameters.owner ?? walletClient.account.address;

  const callData = encodeFunctionData({
    abi: gaslessWalletAbi,
    functionName: "execute",
    args: [calls.map((call) => ({ target: call.target, value: call.value, data: call.data }))],
  });

  return withGaslessNonceLock(config, chain.chainId, `wallet:${owner}`, async () => {
    const [wallet, currentNonce] = await Promise.all([
      getGaslessWalletAddress(config, { chainId, owner }),
      getGaslessWalletNonce(config, { chainId, account: owner }),
    ]);

    const replayAttackHeader = {
      nonce: currentNonce + 1n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + GASLESS_WALLET_OPERATION_DEADLINE_SECONDS),
      salt: generateSalt(),
    };

    /** The 5-field gateway-domain struct — exactly what gets signed. */
    const message = {
      signer: walletClient.account.address,
      target: wallet,
      callData,
      signerAccount: { addr: owner, isPartyB: false },
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
      accountId: owner,
      operationType: "gaslessqWalletExecute",
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
