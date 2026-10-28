import type { Address, Hex, LocalAccount, TypedDataDomain } from "viem";

/**
 * Raw session-key material.
 */
export interface SessionKeyMaterial {
  /** Session key public address. */
  address: Address;
  /** Session key private key. */
  privateKey: Hex;
}

/**
 * Stored session-key record supplied by a consumer-defined storage layer.
 */
export interface SessionKeyRecord {
  /** Owner wallet address this record belongs to. */
  owner: Address;
  /** Raw session key private key. Storage implementations may encrypt this before persistence. */
  privateKey: Hex;
  /** Public address derived from the private key. */
  address: Address;
  /** Creation timestamp in milliseconds. */
  createdAt: number;
  /** Expiry timestamp in milliseconds. */
  expiresAt: number;
  /** Optional app-defined label. */
  label?: string;
}

/**
 * Runtime state exposed by {@link SessionKeyManager}.
 */
export interface SessionKeyState {
  /** Whether a valid session key account is currently loaded in memory. */
  isReady: boolean;
  /** Whether the loaded key has expired, including expiry observed during signing or a state read. */
  isExpired: boolean;
  /** Session key public address, when initialized. */
  publicAddress: Address | null;
  /** Session key expiry timestamp in milliseconds, when initialized. */
  expiresAt: number | null;
}

/**
 * Result returned by raw message signing.
 */
export interface SessionKeySignature {
  /** Hex ECDSA signature. */
  signature: Hex;
  /** Address of the session key that produced the signature. */
  sessionKeyAddress: Address;
  /** Client-side signing duration, in milliseconds. */
  durationMs: number;
}

/**
 * Typed-data signing request supported by the session-key manager.
 */
export interface SessionKeyTypedDataParameters {
  /** EIP-712 domain. */
  domain: TypedDataDomain;
  /** EIP-712 type definitions. */
  types: Record<string, Array<{ name: string; type: string }>>;
  /** EIP-712 primary type name. */
  primaryType: string;
  /** EIP-712 message payload. */
  message: Record<string, unknown>;
}

/**
 * Persistence interface consumed by {@link createSessionKeyManager}.
 *
 * Implementations own storage location, serialization, and encryption. Browser
 * apps can use localStorage or IndexedDB; non-browser apps can use memory,
 * files, or remote storage.
 */
export interface SessionKeyStorage {
  /** Load a session-key record for `owner`. */
  load(owner: Address): Promise<SessionKeyRecord | null>;
  /** Save a session-key record for `owner`. */
  save(owner: Address, record: SessionKeyRecord): Promise<void>;
  /** Remove the stored key for `owner`. */
  remove(owner: Address): Promise<void>;
  /** Return stored metadata for `owner` without requiring the key to be loaded in memory. */
  getMetadata(owner: Address): Promise<SessionKeyMetadata | null>;
}

/**
 * Public metadata for a stored session key.
 */
export interface SessionKeyMetadata {
  /** Session key public address. */
  address: Address;
  /** Owner wallet address. */
  owner: Address;
  /** Creation timestamp in milliseconds. */
  createdAt: number;
  /** Expiry timestamp in milliseconds. */
  expiresAt: number;
}

/**
 * Session-key manager options.
 */
export interface CreateSessionKeyManagerOptions {
  /** Optional clock, useful for tests. */
  now?: () => number;
  /** Persistence implementation used to load/save session-key records. */
  storage: SessionKeyStorage;
  /** Default lifetime for newly generated/imported keys. Defaults to one year. */
  defaultTtlMs?: number;
  /**
   * What `initialize` does when storage loading or record validation fails —
   * a decryption failure, for example. Restore-only `load` always throws.
   *
   * - `"rotate"` (default): remove the stored record and generate a new key.
   *   The new key holds no on-chain delegation, so the user has to authorize
   *   it again.
   * - `"throw"`: leave the stored record untouched, clear the in-memory key, and
   *   reject with `SessionKeyLoadError`, so the app can retry or ask the user
   *   before replacing a key that may still be delegated.
   */
  onLoadError?: "rotate" | "throw";
}

/** Lifetime of an imported key: a relative duration or its original absolute expiry. */
export type SessionKeyImportOptions =
  | {
      /** Lifetime from import time, in milliseconds. Defaults to the manager's default lifetime. */
      ttlMs?: number;
      expiresAt?: never;
    }
  | {
      /** Absolute expiry in milliseconds, preserved during device transfer. Must be in the future. */
      expiresAt: number;
      ttlMs?: never;
    };

/**
 * Session-key manager for loading, generating, signing, and destroying local keys.
 */
export interface SessionKeyManager {
  /**
   * Load an existing non-expired key for `owner`, or generate and persist a new
   * one. When that owner's key is already loaded and not expired, it resolves
   * the current state at once: nothing is read, nothing is revoked, and accounts
   * from `getAccount()` keep signing, so calling it on every mount is safe.
   * Concurrent calls for the same owner share one run, and every lifecycle
   * call (`initialize`, `load`, `importPrivateKey`, `rotate`, `destroy`) runs after the
   * previous one settles. Starting a different lifecycle call immediately
   * revokes the in-memory signer; a still-running older call rejects with
   * `SessionKeyOperationSupersededError` instead of publishing stale key
   * material. After saving, the manager makes a best-effort check for a competing
   * storage writer. A storage read or record validation failure during initialize
   * follows the manager's `onLoadError` policy.
   */
  initialize(owner: Address, options?: { ttlMs?: number }): Promise<SessionKeyState>;
  /**
   * Restore a valid existing key without creating, rotating, or removing records.
   * Missing or expired records return non-ready state; read or validation errors
   * throw `SessionKeyLoadError`, regardless of `onLoadError`. Immediately revokes
   * the previous in-memory signer. Prefer this for a device that cannot authorize
   * replacement keys.
   *
   * @param owner - Wallet whose existing key should be restored.
   * @returns A ready state, or a non-ready state for missing or expired storage.
   * @example
   * ```ts
   * const restored = await manager.load(owner);
   * if (!restored.isReady) showSessionRecovery();
   * ```
   */
  load(owner: Address): Promise<SessionKeyState>;
  /**
   * Import a private key for `owner`. Pass `expiresAt` to preserve a transferred
   * session's absolute expiry. Invalid inputs reject before revoking the current
   * signer or writing storage; a valid import immediately revokes the signer.
   */
  importPrivateKey(owner: Address, privateKey: Hex, options?: SessionKeyImportOptions): Promise<SessionKeyState>;
  /** Replace any existing key for `owner` with a newly generated key, revoking the current signer immediately. */
  rotate(owner: Address, options?: { ttlMs?: number }): Promise<SessionKeyState>;
  /** Sign an arbitrary message with the loaded session key. */
  sign(message: string): Promise<SessionKeySignature>;
  /** Sign EIP-712 typed data with the loaded session key. */
  signTypedData(parameters: SessionKeyTypedDataParameters): Promise<Hex>;
  /** Immediately clear the in-memory key. When `owner` is passed, also remove its stored key asynchronously. */
  destroy(owner?: Address): Promise<void>;
  /** Return the current runtime state as a frozen snapshot; accessors refresh local expiry. */
  getState(): SessionKeyState;
  /** Return whether a session key is currently ready in memory. */
  isReady(): boolean;
  /** Return the current session key public address, if loaded. */
  getAddress(): Address | null;
  /**
   * Return the loaded session key as a viem account.
   *
   * This is the signer to hand to viem's `createWalletClient` or to an SDK
   * wallet-client resolver. Captured accounts reject signing before and after
   * asynchronous work if their lifecycle is replaced or the key expires. Prefer it over
   * {@link SessionKeyManager.getPrivateKey}: the raw private key never leaves
   * the manager, only its signing capability does.
   *
   * @example
   * ```ts
   * const account = manager.getAccount();
   * if (account) {
   *   const walletClient = createWalletClient({ account, chain, transport: http() });
   * }
   * ```
   *
   * @returns The session key account, or `null` when no unexpired key is loaded.
   */
  getAccount(): LocalAccount | null;
  /**
   * Return the current raw private key, if loaded.
   *
   * Intended for explicit device-transfer/export flows only. For signing, use
   * {@link SessionKeyManager.getAccount} instead so the raw key never leaves
   * the manager. A copied raw key cannot be revoked by this manager.
   *
   * @returns The raw private key, or `null` when no key is loaded.
   */
  getPrivateKey(): Hex | null;
  /** Return stored metadata for `owner`. */
  getMetadata(owner: Address): Promise<SessionKeyMetadata | null>;
  /** Subscribe to runtime state changes. */
  subscribe(listener: () => void): () => void;
  /** Snapshot helper for framework integrations. */
  getSnapshot(): Address | null;
}

/**
 * Short-lived payload used to move a session key to another device.
 */
export interface SessionKeyTransferPayload {
  /** Schema version. */
  version: number;
  /** Owner wallet address. */
  owner: Address;
  /** Session key private key. `null` allows metadata-only payloads. */
  sessionPrivateKey: Hex | null;
  /** Session key public address, when known. */
  sessionAddress?: Address;
  /** Payload creation timestamp in milliseconds. */
  createdAt: number;
  /** Optional session expiry timestamp in milliseconds. */
  expiresAt?: number;
}
