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
  /** Whether the last loaded storage record was expired. */
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
   * What `initialize` does when the storage adapter's `load` throws — a
   * decryption failure, for example.
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

/**
 * Session-key manager for loading, generating, signing, and destroying local keys.
 */
export interface SessionKeyManager {
  /**
   * Load an existing non-expired key for `owner`, or generate and persist a new
   * one. Concurrent calls for the same owner share one run, and every lifecycle
   * call (`initialize`, `importPrivateKey`, `rotate`, `destroy`) runs after the
   * previous one settles. Starting a different lifecycle call immediately
   * revokes the in-memory signer; a still-running older call rejects with
   * `SessionKeyOperationSupersededError` instead of publishing stale key
   * material. After saving, the manager makes a best-effort check for a competing
   * storage writer. A failing `load` follows the manager's `onLoadError`.
   */
  initialize(owner: Address, options?: { ttlMs?: number }): Promise<SessionKeyState>;
  /** Import an existing private key and persist it for `owner`, revoking the current in-memory signer immediately. */
  importPrivateKey(owner: Address, privateKey: Hex, options?: { ttlMs?: number }): Promise<SessionKeyState>;
  /** Replace any existing key for `owner` with a newly generated key, revoking the current signer immediately. */
  rotate(owner: Address, options?: { ttlMs?: number }): Promise<SessionKeyState>;
  /** Sign an arbitrary message with the loaded session key. */
  sign(message: string): Promise<SessionKeySignature>;
  /** Sign EIP-712 typed data with the loaded session key. */
  signTypedData(parameters: SessionKeyTypedDataParameters): Promise<Hex>;
  /** Immediately clear the in-memory key. When `owner` is passed, also remove its stored key asynchronously. */
  destroy(owner?: Address): Promise<void>;
  /** Return the current runtime state. */
  getState(): SessionKeyState;
  /** Return whether a session key is currently ready in memory. */
  isReady(): boolean;
  /** Return the current session key public address, if loaded. */
  getAddress(): Address | null;
  /**
   * Return the loaded session key as a viem account.
   *
   * This is the signer to hand to viem's `createWalletClient` or to an SDK
   * wallet-client resolver. It is strictly preferred over
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
   * @returns The session key account, or `null` when no key is loaded.
   */
  getAccount(): LocalAccount | null;
  /**
   * Return the current raw private key, if loaded.
   *
   * Intended for explicit device-transfer/export flows only. For signing, use
   * {@link SessionKeyManager.getAccount} instead so the raw key never leaves
   * the manager.
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
