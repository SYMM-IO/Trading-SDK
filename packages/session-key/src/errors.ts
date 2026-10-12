import type { Address } from "viem";

/**
 * Thrown by `SessionKeyManager.initialize` when the storage adapter's `load`
 * fails and the manager was created with `onLoadError: "throw"`.
 *
 * The stored record is left untouched and no key is loaded in memory, so the
 * app can retry (for example once a decryption key is available again) or ask
 * the user before replacing a key that may still hold an on-chain delegation.
 * The adapter's error is on `cause`.
 *
 * @example
 * ```ts
 * try {
 *   await manager.initialize(owner);
 * } catch (error) {
 *   if (error instanceof SessionKeyLoadError) showUnlockRetry(error.owner);
 * }
 * ```
 */
export class SessionKeyLoadError extends Error {
  override readonly name = "SessionKeyLoadError";

  /** The owner whose stored key could not be loaded. */
  readonly owner: Address;

  constructor(owner: Address, options?: ErrorOptions) {
    super(`Could not load the stored session key for ${owner}. The stored record was left untouched.`, options);
    this.owner = owner;
  }
}

/**
 * Thrown when a newer lifecycle request replaces an `initialize`, import,
 * rotation, or manager-owned signing operation that was still running.
 *
 * The superseded operation never publishes or returns key material. Callers
 * should normally ignore this error and follow the newer lifecycle request.
 *
 * @example
 * ```ts
 * try {
 *   await manager.initialize(owner);
 * } catch (error) {
 *   if (!(error instanceof SessionKeyOperationSupersededError)) throw error;
 * }
 * ```
 */
export class SessionKeyOperationSupersededError extends Error {
  override readonly name = "SessionKeyOperationSupersededError";

  /** The operation that was replaced by a newer lifecycle request. */
  readonly operation: "importPrivateKey" | "initialize" | "rotate" | "sign" | "signTypedData";

  constructor(operation: SessionKeyOperationSupersededError["operation"]) {
    super(`Session-key ${operation} was superseded by a newer lifecycle operation.`);
    this.operation = operation;
  }
}
