import type { Config } from "@theoldvarorg/core";
import type { Hash } from "viem";
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
 * Shared tail of every write hook's `mutationFn`. Given a submitted transaction
 * `hash`, either return it immediately (`waitForReceipt: false`) or poll for the
 * mined receipt and return both. Applies the package-wide write defaults
 * (`waitForReceipt: true`, `confirmations: 1`).
 *
 * @param config - The SDK config (its `getClient` resolves the polling client).
 * @param hash - The submitted transaction hash.
 * @param options - Chain id and receipt-wait behavior.
 * @returns The hash, plus the receipt when `waitForReceipt` is enabled.
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
  if (!waitForReceipt) return { hash };
  const receipt = await config.getClient({ chainId }).waitForTransactionReceipt({ hash, confirmations });
  return { hash, receipt };
}
