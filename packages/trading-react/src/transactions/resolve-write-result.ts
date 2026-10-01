import {
  confirmGaslessRequest,
  getGaslessWriteRequest,
  type Config,
  type GaslessWriteRequest,
} from "@symmio/trading-core";
import type { Hash, TransactionReceipt } from "viem";
import { SymmioRequestError } from "../errors/symmio-request-error";
import type { WriteResult } from "./write-types";

/**
 * Options for {@link resolveWriteResult}.
 */
interface ResolveWriteResultOptions {
  /**
   * Chain the transaction was submitted on. Resolves the public client that
   * polls for the receipt; omit to use the config's default chain.
   */
  chainId?: number;
  /**
   * Resolve only after the receipt is mined (default `true`). When `false`,
   * resolve immediately with just the hash.
   */
  waitForReceipt?: boolean;
  /** Confirmations to wait for when `waitForReceipt` is true. Defaults to `1`. */
  confirmations?: number;
}

/**
 * The error every write hook throws when its transaction was mined but reverted
 * on-chain.
 *
 * A subclass of {@link SymmioRequestError} with `kind: "contract-revert"`, so
 * existing consumer branches (`error.kind === "contract-revert"`) keep working
 * unchanged and {@link normalizeSymmError} passes it through untouched. It adds
 * the `hash` and the mined `receipt` on top, so a UI can link the failure to a
 * block explorer and read `gasUsed` / `blockNumber` without unwrapping `cause`.
 *
 * @example
 * ```ts
 * const { error } = useAllocate();
 * if (error instanceof TransactionRevertedError) {
 *   return <a href={`${explorer}/tx/${error.hash}`}>Transaction reverted</a>;
 * }
 * ```
 */
export class TransactionRevertedError extends SymmioRequestError {
  /** The reverted transaction's hash. */
  readonly hash: Hash;
  /** The mined receipt whose `status` is `"reverted"`. */
  readonly receipt: TransactionReceipt;

  /**
   * @param options - The submitted hash and the mined receipt that reported the revert.
   */
  constructor(options: { hash: Hash; receipt: TransactionReceipt }) {
    super({
      kind: "contract-revert",
      code: "TRANSACTION_REVERTED",
      message: `Transaction ${options.hash} was mined but reverted on-chain — no state change was applied.`,
    });
    this.hash = options.hash;
    this.receipt = options.receipt;
  }
}

/**
 * Shared tail of every write hook's `mutationFn`. Given a submitted transaction
 * `hash`, either return it immediately (`waitForReceipt: false`) or poll for the
 * mined receipt and return both. Applies the package-wide write defaults
 * (`waitForReceipt: true`, `confirmations: 1`).
 *
 * A mined-but-reverted transaction is a **failure**, not a result: it throws
 * {@link TransactionRevertedError} instead of returning, so the hook's
 * `onSuccess` (and its cache invalidation) never runs for a write that applied
 * nothing.
 *
 * **A relayed write waits on its request, not on its first hash.** When the
 * dispatcher relayed the write, the hash it returned is only the relayer's
 * first broadcast: a gas bump or a stuck nonce makes the service replace it,
 * and waiting on a replaced hash waits forever. So a relayed write is followed
 * through `confirmGaslessRequest`, which resolves on the terminal record, and
 * the result reports that record's hash plus `gasless: { requestId,
 * broadcastHash }`. A relay that ends `reverted` / `failed` / `rejected` throws
 * the typed gasless error carrying the record, instead of
 * {@link TransactionRevertedError}, because the relayer's verdict names the
 * cause and a receipt for the replaced hash may not exist at all.
 *
 * @param config - The SDK config (its `getClient` resolves the polling client).
 * @param hash - The submitted transaction hash.
 * @param options - Chain id and receipt-wait behavior.
 * @returns The hash, plus the receipt when `waitForReceipt` is enabled, plus `gasless` for a relayed write.
 * @throws {TransactionRevertedError} when the mined receipt's `status` is `"reverted"`.
 * @throws {SymmApiError} `GASLESS_RELAY_REVERTED` / `GASLESS_RELAY_FAILED` /
 *   `GASLESS_RELAY_REJECTED` when a relayed write's request ends non-succeeded.
 *
 * @example
 * ```ts
 * const hash = await base.mutationFn({ ...variables, chainId });
 * return resolveWriteResult(config, hash, { chainId, waitForReceipt, confirmations });
 * ```
 */
export async function resolveWriteResult(
  config: Config,
  hash: Hash,
  options: ResolveWriteResultOptions = {},
): Promise<WriteResult> {
  const { chainId, waitForReceipt = true, confirmations = 1 } = options;
  const relayed = getGaslessWriteRequest(config, { hash });

  if (!waitForReceipt) {
    return relayed ? { hash, gasless: relayedHandle(relayed) } : { hash };
  }
  if (relayed) return resolveRelayedWriteResult(config, relayed, confirmations);
  const receipt = await config.getClient({ chainId }).waitForTransactionReceipt({ hash, confirmations });
  /**
   * Load-bearing, do not "simplify" away: viem does **not** throw for a reverted
   * transaction. `waitForTransactionReceipt` resolves normally and reports the
   * failure only through `receipt.status === "reverted"`. Without this explicit
   * check the shared write tail returns a success result for a transaction that
   * changed nothing, and every write hook — gasless and wallet alike — fires
   * `onSuccess`, invalidates its caches, and renders the write as applied.
   */
  if (receipt?.status === "reverted") throw new TransactionRevertedError({ hash, receipt });
  return { hash, receipt };
}

/** The part of a relay a write result carries: the durable id, and the hash that was shown. */
function relayedHandle(relayed: GaslessWriteRequest): NonNullable<WriteResult["gasless"]> {
  return { requestId: relayed.requestId, broadcastHash: relayed.broadcastHash };
}

/**
 * Follow a relayed write to its terminal record and report the hash that
 * actually mined. The receipt comes from *this config's* client, so the
 * invalidation that follows re-reads a node that has seen the block.
 */
async function resolveRelayedWriteResult(
  config: Config,
  relayed: GaslessWriteRequest,
  confirmations: number,
): Promise<WriteResult> {
  const confirmed = await confirmGaslessRequest(config, {
    chainId: relayed.chainId,
    requestId: relayed.requestId,
    service: relayed.service,
    until: "receipt",
    receiptConfirmations: confirmations,
  });
  return { hash: confirmed.txHash, receipt: confirmed.receipt, gasless: relayedHandle(relayed) };
}
