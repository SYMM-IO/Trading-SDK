import { isAddressEqual, type Address, type Hash, type Hex } from "viem";
import type { GaslessExecutionConfig, SymmioGaslessConfig } from "../../core/chains/types";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { GaslessWriteOptions } from "../../shared/types/properties";
import { getInstantLayerEip712Domain, signSignedOperation } from "../../solvers/instant-open/shared/eip712";
import { buildSignedOperation } from "../../solvers/instant-open/shared/operations";
import { getVirtualAccount } from "../../symmio-contracts/account-layer/actions/get-virtual-account";
import { getInstantLayerNonce } from "../../symmio-contracts/instant-layer/actions/get-instant-layer-nonce";
import { fireGaslessEvent, toGaslessRecordBody } from "../events";
import { isConfirmedGaslessFeeLimitError, isConfirmedGaslessUnavailableError } from "../fallback";
import { gaslessLayerAbi } from "../gateway/gasless-layer-abi";
import { getGaslessOperationalFeeQuote } from "../get-gasless-operational-fee-quote/get-gasless-operational-fee-quote";
import { withGaslessNonceLock } from "../nonce-lock";
import { relayInstantOperations } from "../relay-instant-operations/relay-instant-operations";
import { GASLESS_RELAYABLE_WRITES } from "../relayable-writes";
import { resolveGaslessService, supportsGaslessService } from "../resolve-gasless";
import { GaslessRequestStatus } from "../types";
import { waitForGaslessRequest } from "../wait-for-gasless-request/wait-for-gasless-request";

/** How long a relayed operation's signature stays valid. */
const GASLESS_OPERATION_DEADLINE_SECONDS = 20 * 60;

/** One inner call of a write the dispatcher may relay. @internal */
export interface GaslessDispatchCall {
  /** Contract the calldata targets (core diamond or AccountLayer). */
  target: Address;
  /** Raw function calldata. */
  callData: Hex;
}

/** Input the write seams hand to {@link maybeRelayAsGasless}. @internal */
export interface MaybeRelayAsGaslessParameters {
  chainId?: number;
  from?: Address;
  /** The write's `gasless` parameter, verbatim. */
  gasless: boolean | GaslessWriteOptions | undefined;
  /** The calls, in execution order (a multi-call `_call` batch stays atomic as a relay batch). */
  calls: readonly GaslessDispatchCall[];
  /**
   * The sub-account the operations run under. The `_call` seam knows it; the
   * margin seam passes `virtualAccount` instead and the parent is resolved
   * on-chain (or taken from `gasless.account`).
   */
  signerAccount?: Address;
  /** The virtual account of a margin write, for parent-sub-account resolution. */
  virtualAccount?: Address;
  /**
   * An account a write targets that may be either a sub-account or a virtual
   * account — the deposit seams cannot tell the two apart from their parameters.
   * A VA resolves to its parent sub-account (a VA has no balance of its own to
   * bill); anything else is used as the billing account unchanged. Unlike
   * {@link MaybeRelayAsGaslessParameters.virtualAccount} this never throws for a
   * non-VA address.
   */
  accountMaybeVirtual?: Address;
}

interface ResolvedGaslessDispatch {
  gasless: SymmioGaslessConfig;
  options: GaslessWriteOptions;
  execution: GaslessExecutionConfig;
  fallback: "error" | "wallet";
}

function resolveDispatch(
  config: Config,
  parameters: MaybeRelayAsGaslessParameters,
): ResolvedGaslessDispatch | "wallet" | "unconfigured-explicit" {
  const raw = parameters.gasless;
  const options: GaslessWriteOptions = typeof raw === "boolean" ? { enabled: raw } : (raw ?? {});

  const supported = supportsGaslessService(config, { chainId: parameters.chainId });
  const execution = supported ? (resolveGaslessService(config, { chainId: parameters.chainId }).execution ?? {}) : {};
  const enabled = options.enabled ?? (execution.mode === "gasless" ? true : false);

  if (!enabled) return "wallet";
  if (!supported) {
    /** Implicit (config-driven) mode degrades silently; an explicit `gasless: true` must not. */
    return typeof raw === "boolean" || raw?.enabled !== undefined ? "unconfigured-explicit" : "wallet";
  }

  return {
    gasless: resolveGaslessService(config, { chainId: parameters.chainId }),
    options,
    execution,
    fallback: options.fallback ?? execution.fallback ?? "error",
  };
}

/** One coherence probe per (config, chainId) — the gateway address is a config constant. */
const coherenceChecks = new WeakMap<Config, Map<number, Promise<void>>>();

function assertGatewayCoherence(config: Config, chainId: number, gasless: SymmioGaslessConfig): Promise<void> {
  let byChain = coherenceChecks.get(config);
  if (!byChain) {
    byChain = new Map();
    coherenceChecks.set(config, byChain);
  }
  const cached = byChain.get(chainId);
  if (cached) return cached;

  const probe = (async () => {
    const { addresses } = config.getChainConfig(chainId);
    const client = config.getClient({ chainId });
    const gatewayInstantLayer = await client.readContract({
      address: gasless.gaslessLayerAddress,
      abi: gaslessLayerAbi,
      functionName: "instantLayer",
    });
    if (!isAddressEqual(gatewayInstantLayer, addresses.instantLayerAddress)) {
      throw new SymmError(
        "config",
        "GASLESS_CONFIG_INCOHERENT",
        `Gasless: the configured GaslessLayer (${gasless.gaslessLayerAddress}) verifies operations against InstantLayer ${gatewayInstantLayer}, but chain ${chainId} is configured with instantLayerAddress ${addresses.instantLayerAddress}. Relayed signatures would be rejected — align the two addresses (createConfig override) before using gasless execution.`,
      );
    }
  })();
  /**
   * Cache the real probe, not a swallowed copy. A pre-swallowed promise would
   * resolve for every caller that arrived while the first probe was still in
   * flight, so a concurrent write would sail past the guard on a misconfigured
   * chain and sign against an InstantLayer the gateway does not verify.
   *
   * The entry is dropped on rejection so a transient RPC failure cannot poison
   * the config — the next write probes again.
   */
  byChain.set(chainId, probe);
  probe.catch(() => {
    if (byChain.get(chainId) === probe) byChain.delete(chainId);
  });
  return probe;
}

/**
 * The transparent gasless dispatcher. Called by relayable write actions before
 * their wallet path: returns the relayer's broadcast transaction hash when the
 * write was relayed, or `null` when the caller must proceed on the normal
 * gas-paid wallet path (gasless off, unsupported selector, or a definitive
 * pre-broadcast rejection under `fallback: "wallet"`).
 *
 * The full policy lives in the docs; the load-bearing rules are:
 * - **202 is the point of no return** — after acceptance there is no wallet
 *   fallback ever, except a `rejected` terminal whose cause is a confirmed
 *   fee/quota limit (nothing was broadcast, so a wallet retry cannot
 *   double-execute).
 * - A user's signature rejection always propagates — the user said no.
 * - The returned hash behaves exactly like a wallet-submitted hash: the
 *   caller's receipt-wait and invalidation pipelines run unchanged.
 *
 * @internal
 */
export async function maybeRelayAsGasless(
  config: Config,
  parameters: MaybeRelayAsGaslessParameters,
): Promise<Hash | null> {
  const resolved = resolveDispatch(config, parameters);
  if (resolved === "wallet") return null;
  if (resolved === "unconfigured-explicit") {
    /** Throws the precise typed error (not-configured vs wrong contracts version). */
    resolveGaslessService(config, { chainId: parameters.chainId });
    return null;
  }
  const { gasless, options, execution, fallback } = resolved;

  /** Selector gate — any non-relayable call sends the whole write to the wallet path. */
  const writes = parameters.calls.map((call) =>
    GASLESS_RELAYABLE_WRITES.get(call.callData.slice(0, 10).toLowerCase() as Hex),
  );
  if (writes.some((write) => write === undefined)) {
    if (options.enabled === true) {
      if (fallback === "wallet") return null;
      throw new SymmError(
        "validation",
        "GASLESS_NOT_RELAYABLE",
        "Gasless: this write's calldata is not relayable through the gasless service.",
      );
    }
    return null;
  }
  const operationType = writes[0]?.operationType ?? "gaslessWrite";

  const chain = config.getChainConfig(parameters.chainId);
  const chainId = chain.chainId;

  await assertGatewayCoherence(config, chainId, gasless);

  /** Billing/authority account: explicit override → seam-provided sub-account → VA parent. */
  let signerAccount = options.account ?? parameters.signerAccount;
  if (!signerAccount && parameters.accountMaybeVirtual) {
    const detail = await getVirtualAccount(config, { chainId, account: parameters.accountMaybeVirtual });
    signerAccount = detail.isExists ? detail.parentAccount : parameters.accountMaybeVirtual;
  }
  if (!signerAccount) {
    if (!parameters.virtualAccount) {
      throw new SymmError(
        "validation",
        "GASLESS_ACCOUNT_UNRESOLVED",
        "Gasless: no sub-account to relay under — pass `gasless.account`.",
      );
    }
    const detail = await getVirtualAccount(config, { chainId, account: parameters.virtualAccount });
    if (!detail.isExists) {
      throw new SymmError(
        "validation",
        "GASLESS_ACCOUNT_UNRESOLVED",
        `Gasless: ${parameters.virtualAccount} is not a known virtual account — pass \`gasless.account\` with the paying sub-account.`,
      );
    }
    signerAccount = detail.parentAccount;
  }
  const resolvedSignerAccount = signerAccount;

  const walletClient = await config.getWalletClient({ chainId, from: parameters.from });
  const domain = getInstantLayerEip712Domain(config, { chainId });

  return withGaslessNonceLock(config, chainId, resolvedSignerAccount, async () => {
    /** Fresh sequential nonces, read inside the lock, immediately before signing. */
    const currentNonce = await getInstantLayerNonce(config, { chainId, account: resolvedSignerAccount });
    const deadline = BigInt(Math.floor(Date.now() / 1000) + GASLESS_OPERATION_DEADLINE_SECONDS);

    const operations = parameters.calls.map((call, index) =>
      buildSignedOperation({
        signer: walletClient.account.address,
        target: call.target,
        callData: call.callData,
        signerAccount: resolvedSignerAccount,
        deadline,
        nonce: currentNonce + BigInt(index + 1),
      }),
    );

    /** Fee pre-flight before any signature prompt. */
    if (execution.preflightFee ?? true) {
      const quote = await getGaslessOperationalFeeQuote(config, {
        chainId,
        account: resolvedSignerAccount,
        operations,
      });
      if (quote.wouldBlockOnQuota) {
        if (fallback === "wallet") return null;
        throw new SymmError(
          "api",
          "GASLESS_FEE_UNAFFORDABLE",
          `Gasless: the daily gasless quota would block this request (quoted fee ${quote.amountDue}). Retry after the UTC reset or use the wallet path.`,
        );
      }
    }

    /** EIP-712 prompts — a user rejection propagates unwrapped, with no fallback. */
    const signatures: Hex[] = [];
    for (const operation of operations) {
      signatures.push(await signSignedOperation(operation, domain, walletClient));
    }

    const idempotencyKey = options.idempotencyKey ?? globalThis.crypto.randomUUID();
    const events = execution.onEvent;

    let receipt;
    try {
      receipt = await relayInstantOperations(config, {
        chainId,
        userAddress: walletClient.account.address,
        operationType,
        operations: operations.map((operation, index) => ({ operation, signature: signatures[index]! })),
        idempotencyKey,
      });
    } catch (err) {
      const canFallBack = isConfirmedGaslessFeeLimitError(err) || isConfirmedGaslessUnavailableError(err);
      if (canFallBack && fallback === "wallet") return null;
      throw err;
    }

    fireGaslessEvent(events, {
      type: "accepted",
      requestId: receipt.requestId,
      service: "operations",
      chainId,
      protocolInstance: gasless.protocolInstance ?? "",
      operationType,
      idempotencyKey,
    });

    const record = await waitForGaslessRequest(config, {
      chainId,
      requestId: receipt.requestId,
      until: "broadcast",
      timeoutMs: options.broadcastTimeoutMs ?? execution.broadcastTimeoutMs,
      queuedPollMs: execution.queuedPollMs,
      submittedPollMs: execution.submittedPollMs,
      signal: options.signal,
      onUpdate: (update) => {
        if (update.txHash)
          fireGaslessEvent(events, { type: "broadcast", requestId: update.requestId, txHash: update.txHash, chainId });
      },
    });

    if (record.txHash !== null) {
      return record.txHash;
    }

    /** Terminal without a broadcast: rejected or failed before any transaction. */
    fireGaslessEvent(events, {
      type: "terminal",
      requestId: record.requestId,
      status: record.status,
      txHash: record.txHash,
      chainId,
    });

    const terminalError = new SymmApiError({
      code: record.status === GaslessRequestStatus.REJECTED ? "GASLESS_RELAY_REJECTED" : "GASLESS_RELAY_FAILED",
      message: `Gasless: request ${record.requestId} ended ${record.status} before any broadcast${record.errorMessage ? ` — ${record.errorMessage}` : ""}.`,
      status: 200,
      statusText: "OK",
      responseData: toGaslessRecordBody(record),
      url: gasless.url,
      method: "GET",
    });

    /** A confirmed fee/quota rejection never broadcast — the one post-202 wallet fallback. */
    if (fallback === "wallet" && isConfirmedGaslessFeeLimitError(terminalError)) return null;
    throw terminalError;
  });
}
