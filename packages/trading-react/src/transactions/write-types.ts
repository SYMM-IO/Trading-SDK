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
  /**
   * The transaction hash the write landed on. For a relayed (gasless) write
   * this is the **terminal** hash the request actually mined, which is not
   * necessarily the relayer's first broadcast — see
   * {@link WriteResult.gasless}.
   */
  hash: Hash;
  /** The mined receipt, present when `waitForReceipt` is enabled. */
  receipt?: TransactionReceipt;
  /**
   * Present only when the write was relayed through GaslessQ instead of the
   * wallet. The `requestId` is the workflow's stable handle — persist it, it is
   * what survives a replaced transaction and a reload — while `broadcastHash`
   * is the relayer's first attempt, kept so a UI that already showed it can
   * reconcile.
   */
  gasless?: {
    /** Stable service tracking id of the relay request. */
    requestId: string;
    /** The relayer's first broadcast hash, which `hash` may supersede. */
    broadcastHash: Hash;
  };
}
