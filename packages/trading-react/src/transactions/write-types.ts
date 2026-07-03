import type { ConfigParameter } from "@symmio/trading-core";
import type { Hash, TransactionReceipt } from "viem";

/**
 * Parameters shared by every write hook — those that submit a transaction and
 * optionally wait for its receipt. A slice-specific hook's parameter type
 * extends (or aliases) this; the transaction's own call inputs (addresses,
 * amounts, …) are passed as the mutation `variables`, not here.
 */
export interface WriteParameters extends ConfigParameter {
  /**
   * Resolve only after the receipt is mined (default `true`). Set `false` to
   * resolve as soon as the tx hash is broadcast — useful for optimistic UIs.
   */
  waitForReceipt?: boolean;
  /** Confirmations to wait for when `waitForReceipt` is true. Defaults to `1`. */
  confirmations?: number;
}

/**
 * Result shared by every write hook: the submitted transaction hash, plus the
 * mined receipt when `waitForReceipt` is enabled.
 */
export interface WriteResult {
  /** The submitted transaction hash. */
  hash: Hash;
  /** The mined receipt, present when `waitForReceipt` is enabled. */
  receipt?: TransactionReceipt;
}
