import type { Address, Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { SESSION_KEY_EXPIRY_MS } from "./constants";
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

  constructor(private readonly options: CreateSessionKeyManagerOptions) {
    this.defaultTtlMs = options.defaultTtlMs ?? SESSION_KEY_EXPIRY_MS;
    this.now = options.now ?? Date.now;
  }

  async initialize(owner: Address, options?: { ttlMs?: number }): Promise<SessionKeyState> {
    let loaded: Awaited<ReturnType<CreateSessionKeyManagerOptions["storage"]["load"]>> = null;

    try {
      loaded = await this.options.storage.load(owner);
    } catch {
      await this.options.storage.remove(owner);
    }

    if (loaded) {
      if (loaded.expiresAt <= this.now()) {
        await this.options.storage.remove(owner);
        this.state = {
          isReady: false,
          isExpired: true,
          publicAddress: loaded.address,
          expiresAt: loaded.expiresAt,
        };
        this.notify();
        return this.rotate(owner, options);
      }

      this.setAccount(loaded.privateKey, {
        isReady: true,
        isExpired: false,
        publicAddress: loaded.address,
        expiresAt: loaded.expiresAt,
      });
      return this.state;
    }

    return this.rotate(owner, options);
  }

  async importPrivateKey(owner: Address, privateKey: Hex, options?: { ttlMs?: number }): Promise<SessionKeyState> {
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

    this.setAccount(privateKey, {
      isReady: true,
      isExpired: false,
      publicAddress: account.address,
      expiresAt,
    });

    return this.state;
  }

  async rotate(owner: Address, options?: { ttlMs?: number }): Promise<SessionKeyState> {
    const privateKey = generatePrivateKey();
    return this.importPrivateKey(owner, privateKey, options);
  }

  async sign(message: string): Promise<SessionKeySignature> {
    if (!this.account) {
      throw new Error("Session key not initialized.");
    }

    const start = getNowForDuration();
    const signature = await this.account.signMessage({ message });

    return {
      signature,
      sessionKeyAddress: this.account.address,
      durationMs: getNowForDuration() - start,
    };
  }

  async signTypedData(parameters: SessionKeyTypedDataParameters): Promise<Hex> {
    if (!this.account) {
      throw new Error("Session key not initialized.");
    }

    return this.account.signTypedData(parameters as Parameters<PrivateKeyAccount["signTypedData"]>[0]);
  }

  async destroy(owner?: Address): Promise<void> {
    if (owner) {
      await this.options.storage.remove(owner);
    }

    this.account = null;
    this.rawPrivateKey = null;
    this.state = EMPTY_STATE;
    this.notify();
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

function getNowForDuration(): number {
  if (globalThis.performance?.now) {
    return globalThis.performance.now();
  }

  return Date.now();
}
