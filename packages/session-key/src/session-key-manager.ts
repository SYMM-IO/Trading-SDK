import type { Address, Hex, LocalAccount } from "viem";
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { SESSION_KEY_EXPIRY_MS } from "./constants";
import { SessionKeyLoadError, SessionKeyOperationSupersededError } from "./errors";
import type {
  CreateSessionKeyManagerOptions,
  SessionKeyManager,
  SessionKeyMaterial,
  SessionKeySignature,
  SessionKeyState,
  SessionKeyTypedDataParameters,
} from "./types";

const EMPTY_STATE: SessionKeyState = {
  isReady: false,
  isExpired: false,
  publicAddress: null,
  expiresAt: null,
};

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
   * Tail of the lifecycle queue. Every `initialize`, `importPrivateKey`,
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
  }

  initialize(owner: Address, options?: { ttlMs?: number }): Promise<SessionKeyState> {
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

  importPrivateKey(owner: Address, privateKey: Hex, options?: { ttlMs?: number }): Promise<SessionKeyState> {
    const generation = this.beginLifecycleTransition();
    return this.enqueue(() => this.persistAndLoad(owner, privateKey, generation, "importPrivateKey", options));
  }

  rotate(owner: Address, options?: { ttlMs?: number }): Promise<SessionKeyState> {
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
    const account = this.account;
    if (!account) {
      throw new Error("Session key not initialized.");
    }

    const generation = this.lifecycleGeneration;
    const start = getNowForDuration();
    const signature = await account.signMessage({ message });
    this.assertCurrentLifecycle(generation, "sign");

    return {
      signature,
      sessionKeyAddress: account.address,
      durationMs: getNowForDuration() - start,
    };
  }

  async signTypedData(parameters: SessionKeyTypedDataParameters): Promise<Hex> {
    const account = this.account;
    if (!account) {
      throw new Error("Session key not initialized.");
    }

    const generation = this.lifecycleGeneration;
    const signature = await account.signTypedData(parameters as Parameters<PrivateKeyAccount["signTypedData"]>[0]);
    this.assertCurrentLifecycle(generation, "signTypedData");
    return signature;
  }

  getState(): SessionKeyState {
    return this.state;
  }

  isReady(): boolean {
    return this.state.isReady;
  }

  getAddress(): Address | null {
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
    let loaded: Awaited<ReturnType<CreateSessionKeyManagerOptions["storage"]["load"]>> = null;

    try {
      loaded = await this.options.storage.load(owner);
    } catch (error) {
      this.assertCurrentLifecycle(generation, "initialize");
      if (this.onLoadError === "throw") {
        throw new SessionKeyLoadError(owner, { cause: error });
      }
      await this.options.storage.remove(owner);
      this.assertCurrentLifecycle(generation, "initialize");
    }
    this.assertCurrentLifecycle(generation, "initialize");

    if (loaded) {
      if (loaded.expiresAt <= this.now()) {
        await this.options.storage.remove(owner);
        this.assertCurrentLifecycle(generation, "initialize");
        this.state = {
          isReady: false,
          isExpired: true,
          publicAddress: loaded.address,
          expiresAt: loaded.expiresAt,
        };
        this.notify();
        return this.persistAndLoad(owner, generatePrivateKey(), generation, "initialize", options);
      }

      this.setAccount(loaded.privateKey, {
        isReady: true,
        isExpired: false,
        publicAddress: loaded.address,
        expiresAt: loaded.expiresAt,
      });
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
    options?: { ttlMs?: number },
  ): Promise<SessionKeyState> {
    this.assertCurrentLifecycle(generation, operation);
    const account = privateKeyToAccount(privateKey);
    const createdAt = this.now();
    const expiresAt = createdAt + (options?.ttlMs ?? this.defaultTtlMs);

    await this.options.storage.save(owner, {
      owner,
      privateKey,
      address: account.address,
      createdAt,
      expiresAt,
    });
    this.assertCurrentLifecycle(generation, operation);

    const stored = await this.options.storage.getMetadata(owner);
    this.assertCurrentLifecycle(generation, operation);
    if (stored && !isSameAddress(stored.address, account.address)) {
      const winner = await this.options.storage.load(owner);
      this.assertCurrentLifecycle(generation, operation);
      if (winner && isSameAddress(winner.address, stored.address)) {
        this.setAccount(winner.privateKey, {
          isReady: true,
          isExpired: false,
          publicAddress: winner.address,
          expiresAt: winner.expiresAt,
        });
        this.assertCurrentLifecycle(generation, operation);
        return this.state;
      }
    }

    this.setAccount(privateKey, {
      isReady: true,
      isExpired: false,
      publicAddress: account.address,
      expiresAt,
    });
    this.assertCurrentLifecycle(generation, operation);

    return this.state;
  }

  private setAccount(privateKey: Hex, state: SessionKeyState): void {
    this.account = privateKeyToAccount(privateKey);
    this.rawPrivateKey = privateKey;
    this.state = state;
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
