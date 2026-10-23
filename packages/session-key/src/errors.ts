import type { Address } from "viem";

/**
 * Thrown by `SessionKeyManager.load` when reading or validating a stored record
 * fails, or by `initialize` when configured with `onLoadError: "throw"`.
 *
 * A restore failure leaves storage untouched and no key loaded in memory, so
 * the app can retry once decryption is available. A post-save reconciliation
 * failure can also throw this error; it does not undo the completed save.
 * The underlying read or validation error is on `cause`.
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
    super(`Could not load a valid stored session key for ${owner}.`, options);
    this.owner = owner;
  }
}

/**
 * Thrown when a newer lifecycle request replaces an `initialize`, import,
 * rotation, or signing operation that was still running, including signing
 * through an account captured earlier with `getAccount()`.
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
  readonly operation:
    | "importPrivateKey"
    | "initialize"
    | "load"
    | "rotate"
    | "sign"
    | "signAuthorization"
    | "signMessage"
    | "signTransaction"
    | "signTypedData";

  constructor(operation: SessionKeyOperationSupersededError["operation"]) {
    super(`Session-key ${operation} was superseded by a newer lifecycle operation.`);
    this.operation = operation;
  }
}

/**
 * Thrown when a manager or captured account tries to sign after local expiry.
 * The persisted record is left untouched; restore or authorize a new session
 * through the application's recovery flow.
 */
export class SessionKeyExpiredError extends Error {
  override readonly name = "SessionKeyExpiredError";

  /** Public address of the expired session key. */
  readonly address: Address;
  /** Expiry timestamp in milliseconds. */
  readonly expiresAt: number;

  constructor(address: Address, expiresAt: number) {
    super(`Session key ${address} has expired.`);
    this.address = address;
    this.expiresAt = expiresAt;
  }
}
