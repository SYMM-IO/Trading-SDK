import type { Address, Hex, LocalAccount } from "viem";
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { SESSION_KEY_EXPIRY_MS } from "./constants";
import { SessionKeyExpiredError, SessionKeyLoadError, SessionKeyOperationSupersededError } from "./errors";
import { createSessionKeyAccount } from "./session-key-account";
import {
  resolveSessionKeyExpiry,
  validateSessionKeyOwner,
  validateSessionKeyPrivateKey,
  validateSessionKeyRecord,
} from "./session-key-record";
import type {
  CreateSessionKeyManagerOptions,
  SessionKeyImportOptions,
  SessionKeyManager,
  SessionKeyMaterial,
  SessionKeyRecord,
  SessionKeySignature,
  SessionKeyState,
  SessionKeyTypedDataParameters,
} from "./types";

const EMPTY_STATE: SessionKeyState = Object.freeze({
  isReady: false,
  isExpired: false,
  publicAddress: null,
  expiresAt: null,
});

/**
 * Generate a new EVM session key pair.
 *
 * @example
 * ```ts
 * const key = createSessionKey();
 * console.log(key.address);
 * ```
 *
 * @returns The generated private key and derived public address.
 */
export function createSessionKey(): SessionKeyMaterial {
  const privateKey = generatePrivateKey();
  return sessionKeyFromPrivateKey(privateKey);
}

/**
 * Restore EVM session-key material from a private key.
 *
 * @example
 * ```ts
 * const key = sessionKeyFromPrivateKey(privateKey);
 * console.log(key.address);
 * ```
 *
 * @param privateKey - Raw EVM private key.
 * @returns The private key and derived public address.
 */
export function sessionKeyFromPrivateKey(privateKey: Hex): SessionKeyMaterial {
  const account = privateKeyToAccount(privateKey);
  return { address: account.address, privateKey };
}

/**
 * Create a framework-agnostic session-key manager.
 *
 * The manager keeps the private key in memory only. Persistence, serialization,
 * and encryption are delegated to the provided `storage` implementation.
 *
 * @example
 * ```ts
 * const storage: SessionKeyStorage = createAppStorage();
 * const manager = createSessionKeyManager({
 *   storage,
 * });
 * await manager.initialize(owner);
 * const signature = await manager.sign("hello");
 * ```
 *
 * @param options - Storage, lifetime, and optional clock configuration.
 * @returns A manager for initializing, signing with, and clearing a session key.
 */
export function createSessionKeyManager(options: CreateSessionKeyManagerOptions): SessionKeyManager {
  return new DefaultSessionKeyManager(options);
}

class DefaultSessionKeyManager implements SessionKeyManager {
  private account: PrivateKeyAccount | null = null;
  private rawPrivateKey: Hex | null = null;
  private state: SessionKeyState = EMPTY_STATE;
  private listeners = new Set<() => void>();
  private readonly defaultTtlMs: number;
  private readonly now: () => number;
  private readonly onLoadError: "rotate" | "throw";
  /** Incremented as soon as a new lifecycle request revokes the current key. */
  private lifecycleGeneration = 0;
  /**
   * Tail of the lifecycle queue. Every `initialize`, `load`, `importPrivateKey`,
   * `rotate` and `destroy` runs after the previous one settles, so two callers
   * can never interleave their storage reads and writes.
   */
  private lifecycle: Promise<unknown> = Promise.resolve();
  /** The in-flight `initialize` per owner, shared by concurrent callers. */
  private readonly initializing = new Map<string, Promise<SessionKeyState>>();

  constructor(private readonly options: CreateSessionKeyManagerOptions) {
    this.defaultTtlMs = options.defaultTtlMs ?? SESSION_KEY_EXPIRY_MS;
    this.now = options.now ?? Date.now;
    this.onLoadError = options.onLoadError ?? "rotate";
    resolveSessionKeyExpiry(0, this.defaultTtlMs);
  }

  initialize(owner: Address, options?: { ttlMs?: number }): Promise<SessionKeyState> {
    try {
      validateSessionKeyOwner(owner);
      resolveSessionKeyExpiry(this.now(), this.defaultTtlMs, options);
    } catch (error) {
      return Promise.reject(error);
    }
    const key = owner.toLowerCase();
    const pending = this.initializing.get(key);
    if (pending) return pending;

    const generation = this.beginLifecycleTransition();
    const run = this.enqueue(() => this.initializeNow(owner, generation, options));
    this.initializing.set(key, run);
    const settle = () => {
      if (this.initializing.get(key) === run) this.initializing.delete(key);
    };
    run.then(settle, settle);
    return run;
  }

  load(owner: Address): Promise<SessionKeyState> {
    try {
      validateSessionKeyOwner(owner);
    } catch (error) {
      return Promise.reject(error);
    }
    const generation = this.beginLifecycleTransition();
    return this.enqueue(async () => {
      const record = await this.readRecord(owner, generation, "load");
      if (record) this.setAccount(record, generation);
      this.assertCurrentLifecycle(generation, "load");
      return this.getState();
    });
  }

  async importPrivateKey(owner: Address, privateKey: Hex, options?: SessionKeyImportOptions): Promise<SessionKeyState> {
    validateSessionKeyOwner(owner);
    validateSessionKeyPrivateKey(privateKey);
    resolveSessionKeyExpiry(this.now(), this.defaultTtlMs, options);
    const generation = this.beginLifecycleTransition();
    return this.enqueue(() => this.persistAndLoad(owner, privateKey, generation, "importPrivateKey", options));
  }

  async rotate(owner: Address, options?: { ttlMs?: number }): Promise<SessionKeyState> {
    validateSessionKeyOwner(owner);
    resolveSessionKeyExpiry(this.now(), this.defaultTtlMs, options);
    const generation = this.beginLifecycleTransition();
    return this.enqueue(() => this.persistAndLoad(owner, generatePrivateKey(), generation, "rotate", options));
  }

  destroy(owner?: Address): Promise<void> {
    this.beginLifecycleTransition();
    return this.enqueue(async () => {
      if (owner) {
        await this.options.storage.remove(owner);
      }
    });
  }

  async sign(message: string): Promise<SessionKeySignature> {
    const generation = this.lifecycleGeneration;
    this.assertCanSign(generation, "sign");
    const account = this.account;
    if (!account) {
      throw new Error("Session key not initialized.");
    }

    const start = getNowForDuration();
    let signature: Hex;
    try {
      signature = await account.signMessage({ message });
    } finally {
      this.assertCanSign(generation, "sign");
    }

    return {
      signature,
      sessionKeyAddress: account.address,
      durationMs: getNowForDuration() - start,
    };
  }

  async signTypedData(parameters: SessionKeyTypedDataParameters): Promise<Hex> {
    const generation = this.lifecycleGeneration;
    this.assertCanSign(generation, "signTypedData");
    const account = this.account;
    if (!account) {
      throw new Error("Session key not initialized.");
    }

    try {
      return await account.signTypedData(parameters as Parameters<PrivateKeyAccount["signTypedData"]>[0]);
    } finally {
      this.assertCanSign(generation, "signTypedData");
    }
  }

  getState(): SessionKeyState {
    this.expireAccount();
    return this.state;
  }

  isReady(): boolean {
    return this.getState().isReady;
  }

  getAddress(): Address | null {
    this.expireAccount();
    return this.account?.address ?? null;
  }

  /**
   * Return the loaded session key as a viem account.
   *
   * Hand this to viem's `createWalletClient` or to an SDK wallet-client resolver.
   * Strictly preferred over {@link DefaultSessionKeyManager.getPrivateKey}: only
   * the signing capability leaves the manager, never the raw private key.
   *
   * @returns The session key account, or `null` when no key is loaded.
   */
  getAccount(): LocalAccount | null {
    this.expireAccount();
    return this.account;
  }

  /**
   * Return the current raw private key, if loaded.
   *
   * Device-transfer/export flows only. For signing use
   * {@link DefaultSessionKeyManager.getAccount}.
   *
   * @returns The raw private key, or `null` when no key is loaded.
   */
  getPrivateKey(): Hex | null {
    this.expireAccount();
    return this.rawPrivateKey;
  }

  async getMetadata(owner: Address) {
    return this.options.storage.getMetadata(owner);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): Address | null {
    return this.getAddress();
  }

  /** Run a lifecycle task after every earlier one settles, whatever its outcome. */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.lifecycle.then(task, task);
    this.lifecycle = run.catch(() => undefined);
    return run;
  }

  /** Revoke the current in-memory capability before any asynchronous work starts. */
  private beginLifecycleTransition(): number {
    const generation = ++this.lifecycleGeneration;
    this.initializing.clear();
    this.clearAccount();
    return generation;
  }

  private clearAccount(): void {
    if (this.account === null && this.rawPrivateKey === null && this.state === EMPTY_STATE) return;
    this.account = null;
    this.rawPrivateKey = null;
    this.state = EMPTY_STATE;
    this.notify();
  }

  private assertCurrentLifecycle(generation: number, operation: SessionKeyOperationSupersededError["operation"]): void {
    if (generation !== this.lifecycleGeneration) {
      throw new SessionKeyOperationSupersededError(operation);
    }
  }

  private expireAccount(): void {
    if (!this.state.isReady || this.state.expiresAt === null || this.state.expiresAt > this.now()) return;
    this.account = null;
    this.rawPrivateKey = null;
    this.state = Object.freeze({ ...this.state, isReady: false, isExpired: true });
    this.notify();
  }

  private assertCanSign(generation: number, operation: SessionKeyOperationSupersededError["operation"]): void {
    this.assertCurrentLifecycle(generation, operation);
    this.expireAccount();
    // Expiry notification can itself start a lifecycle transition.
    this.assertCurrentLifecycle(generation, operation);
    if (this.state.isExpired && this.state.publicAddress && this.state.expiresAt !== null) {
      throw new SessionKeyExpiredError(this.state.publicAddress, this.state.expiresAt);
    }
  }

  private async readRecord(
    owner: Address,
    generation: number,
    operation: SessionKeyOperationSupersededError["operation"],
  ): Promise<SessionKeyRecord | null> {
    this.assertCurrentLifecycle(generation, operation);
    let record: SessionKeyRecord | null;
    try {
      record = await this.options.storage.load(owner);
      if (record) validateSessionKeyRecord(owner, record);
    } catch (cause) {
      this.assertCurrentLifecycle(generation, operation);
      throw new SessionKeyLoadError(owner, { cause });
    }
    this.assertCurrentLifecycle(generation, operation);
    return record;
  }

  /**
   * Load the stored key for `owner`, or generate and persist one. Runs inside
   * the lifecycle queue, so it calls {@link persistAndLoad} directly: going
   * through the public `rotate` would queue behind itself and never run.
   */
  private async initializeNow(
    owner: Address,
    generation: number,
    options?: { ttlMs?: number },
  ): Promise<SessionKeyState> {
    this.assertCurrentLifecycle(generation, "initialize");
    let loaded: SessionKeyRecord | null = null;

    try {
      loaded = await this.readRecord(owner, generation, "initialize");
    } catch (error) {
      this.assertCurrentLifecycle(generation, "initialize");
      if (this.onLoadError === "throw") {
        throw error;
      }
      await this.options.storage.remove(owner);
      this.assertCurrentLifecycle(generation, "initialize");
    }
    this.assertCurrentLifecycle(generation, "initialize");

    if (loaded) {
      if (loaded.expiresAt <= this.now()) {
        await this.options.storage.remove(owner);
        this.assertCurrentLifecycle(generation, "initialize");
        return this.persistAndLoad(owner, generatePrivateKey(), generation, "initialize", options);
      }

      this.setAccount(loaded, generation);
      this.assertCurrentLifecycle(generation, "initialize");
      return this.state;
    }

    return this.persistAndLoad(owner, generatePrivateKey(), generation, "initialize", options);
  }

  /**
   * Persist `privateKey` for `owner`, then make a best-effort reconciliation
   * with a competing writer before publishing. A writer that lands after the
   * final metadata read can still supersede this tab; strict cross-context
   * coordination belongs in the consumer-owned storage adapter.
   */
  private async persistAndLoad(
    owner: Address,
    privateKey: Hex,
    generation: number,
    operation: SessionKeyOperationSupersededError["operation"],
    options?: SessionKeyImportOptions,
  ): Promise<SessionKeyState> {
    this.assertCurrentLifecycle(generation, operation);
    const account = validateSessionKeyPrivateKey(privateKey);
    const createdAt = this.now();
    const expiresAt = resolveSessionKeyExpiry(createdAt, this.defaultTtlMs, options);

    const record: SessionKeyRecord = {
      owner,
      privateKey,
      address: account.address,
      createdAt,
      expiresAt,
    };
    await this.options.storage.save(owner, record);
    this.assertCurrentLifecycle(generation, operation);

    const stored = await this.options.storage.getMetadata(owner);
    this.assertCurrentLifecycle(generation, operation);
    if (
      stored &&
      (!isSameAddress(stored.address, account.address) ||
        !isSameAddress(stored.owner, owner) ||
        stored.createdAt !== createdAt ||
        stored.expiresAt !== expiresAt)
    ) {
      const winner = await this.readRecord(owner, generation, operation);
      if (winner && isSameAddress(winner.address, stored.address)) {
        this.setAccount(winner, generation);
        this.assertCurrentLifecycle(generation, operation);
        return this.state;
      }
      throw new SessionKeyLoadError(owner, { cause: new Error("Stored session key changed during reconciliation.") });
    }

    this.setAccount(record, generation);
    this.assertCurrentLifecycle(generation, operation);

    return this.state;
  }

  private setAccount(record: SessionKeyRecord, generation: number): void {
    const expired = record.expiresAt <= this.now();
    this.account = expired
      ? null
      : createSessionKeyAccount(privateKeyToAccount(record.privateKey), (operation) =>
          this.assertCanSign(generation, operation),
        );
    this.rawPrivateKey = expired ? null : record.privateKey;
    this.state = Object.freeze({
      isReady: !expired,
      isExpired: expired,
      publicAddress: record.address,
      expiresAt: record.expiresAt,
    });
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

function isSameAddress(a: Address, b: Address): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function getNowForDuration(): number {
  if (globalThis.performance?.now) {
    return globalThis.performance.now();
  }

  return Date.now();
}
