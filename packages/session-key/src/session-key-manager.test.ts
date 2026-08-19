import { isAddress, recoverMessageAddress, recoverTypedDataAddress, type Address } from "viem";
import { mainnet } from "viem/chains";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionKey, createSessionKeyManager, sessionKeyFromPrivateKey } from "./session-key-manager";
import type { SessionKeyMetadata, SessionKeyRecord, SessionKeyStorage, SessionKeyTypedDataParameters } from "./types";

const OWNER = "0x1234567890abcdef1234567890abcdef12345678" as Address;
const OTHER_OWNER = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address;

function createMemorySessionKeyStorage(): SessionKeyStorage & {
  clear: () => void;
  raw: Map<string, SessionKeyRecord>;
} {
  const raw = new Map<string, SessionKeyRecord>();
  return {
    raw,
    async load(owner) {
      return raw.get(owner.toLowerCase()) ?? null;
    },
    async save(owner, record) {
      raw.set(owner.toLowerCase(), record);
    },
    async remove(owner) {
      raw.delete(owner.toLowerCase());
    },
    async getMetadata(owner) {
      const record = raw.get(owner.toLowerCase());
      if (!record) return null;
      return recordToMetadata(record);
    },
    clear() {
      raw.clear();
    },
  };
}

const TYPED_DATA = {
  domain: {
    name: "SYMMIO Session Key",
    version: "1",
    chainId: mainnet.id,
    verifyingContract: OWNER,
  },
  types: {
    Session: [
      { name: "owner", type: "address" },
      { name: "nonce", type: "uint256" },
    ],
  },
  primaryType: "Session",
  message: { owner: OWNER, nonce: 1n },
} satisfies SessionKeyTypedDataParameters;

describe("session key material", () => {
  it("generates a fresh key pair on every call", () => {
    const first = createSessionKey();
    const second = createSessionKey();

    expect(isAddress(first.address)).toBe(true);
    expect(first.privateKey).toMatch(/^0x[0-9a-f]{64}$/i);
    expect(second.address).not.toBe(first.address);
    expect(sessionKeyFromPrivateKey(first.privateKey).address).toBe(first.address);
  });
});

describe("session key manager", () => {
  const storage = createMemorySessionKeyStorage();

  beforeEach(() => {
    storage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("generates a new key and stores a session-key record", async () => {
    const manager = createSessionKeyManager({ storage });
    const state = await manager.initialize(OWNER);
    const record = storage.raw.get(OWNER.toLowerCase());

    expect(state.isReady).toBe(true);
    expect(state.isExpired).toBe(false);
    expect(state.publicAddress && isAddress(state.publicAddress)).toBe(true);
    expect(record).not.toBeNull();
    expect(record?.owner).toBe(OWNER);
    expect(record?.address).toBe(state.publicAddress);
    expect(record?.privateKey).toMatch(/^0x[0-9a-f]{64}$/i);
  });

  it("loads an existing key from storage", async () => {
    const firstManager = createSessionKeyManager({ storage });
    const first = await firstManager.initialize(OWNER);
    const secondManager = createSessionKeyManager({ storage });
    const second = await secondManager.initialize(OWNER);

    expect(second.publicAddress).toBe(first.publicAddress);
  });

  it("replaces expired stored keys", async () => {
    const manager = createSessionKeyManager({ storage, now: () => 2_000 });
    const first = await manager.initialize(OWNER, { ttlMs: 1_000 });
    const record = storage.raw.get(OWNER.toLowerCase())!;
    storage.raw.set(OWNER.toLowerCase(), { ...record, expiresAt: 1_999 });

    const nextManager = createSessionKeyManager({ storage, now: () => 2_000 });
    const next = await nextManager.initialize(OWNER);

    expect(next.publicAddress).not.toBe(first.publicAddress);
  });

  it("recovers from storage that cannot load for the owner", async () => {
    const failingStorage: SessionKeyStorage = {
      async load() {
        throw new Error("Cannot load record.");
      },
      async save(owner, record) {
        storage.raw.set(owner.toLowerCase(), record);
      },
      async remove(owner) {
        storage.raw.delete(owner.toLowerCase());
      },
      async getMetadata() {
        return null;
      },
    };
    const manager = createSessionKeyManager({ storage: failingStorage });
    const state = await manager.initialize(OTHER_OWNER);

    expect(state.isReady).toBe(true);
    expect(isAddress(state.publicAddress ?? "")).toBe(true);
  });

  it("signs messages with the loaded session key", async () => {
    const manager = createSessionKeyManager({ storage });
    await manager.initialize(OWNER);
    const message = "verify this";
    const result = await manager.sign(message);
    const recovered = await recoverMessageAddress({ message, signature: result.signature });

    expect(recovered.toLowerCase()).toBe(result.sessionKeyAddress.toLowerCase());
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("imports an existing private key", async () => {
    const source = createSessionKeyManager({ storage });
    await source.initialize(OWNER);
    const privateKey = source.getPrivateKey();
    expect(privateKey).not.toBeNull();

    const target = createSessionKeyManager({ storage });
    const state = await target.importPrivateKey(OTHER_OWNER, privateKey!);

    expect(state.publicAddress).toBe(source.getAddress());
  });

  it("derives session key material from a private key", async () => {
    const manager = createSessionKeyManager({ storage });
    await manager.initialize(OWNER);
    const privateKey = manager.getPrivateKey();
    expect(privateKey).not.toBeNull();

    const material = sessionKeyFromPrivateKey(privateKey!);

    expect(material.address).toBe(manager.getAddress());
    expect(material.privateKey).toBe(privateKey);
  });

  it("signs typed data with the loaded session key", async () => {
    const manager = createSessionKeyManager({ storage });
    await manager.initialize(OWNER);
    const signature = await manager.signTypedData(TYPED_DATA);
    const recovered = await recoverTypedDataAddress({ ...TYPED_DATA, primaryType: "Session", signature });

    expect(recovered).toBe(manager.getAddress());
  });

  it("falls back to the wall clock when performance timing is unavailable", async () => {
    const manager = createSessionKeyManager({ storage });
    await manager.initialize(OWNER);
    vi.stubGlobal("performance", undefined);
    const result = await manager.sign("no performance api");

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("refuses to sign before initialization", async () => {
    const manager = createSessionKeyManager({ storage });

    await expect(manager.sign("too early")).rejects.toThrow("Session key not initialized.");
    await expect(manager.signTypedData(TYPED_DATA)).rejects.toThrow("Session key not initialized.");
  });

  it("reports empty state before initialization", () => {
    const manager = createSessionKeyManager({ storage });

    expect(manager.getState()).toEqual({
      isReady: false,
      isExpired: false,
      publicAddress: null,
      expiresAt: null,
    });
    expect(manager.getAddress()).toBeNull();
    expect(manager.getSnapshot()).toBeNull();
    expect(manager.getPrivateKey()).toBeNull();
  });

  it("exposes the loaded key through state and snapshot accessors", async () => {
    const manager = createSessionKeyManager({ storage, now: () => 5_000, defaultTtlMs: 1_000 });
    const state = await manager.initialize(OWNER);

    expect(manager.getState()).toEqual(state);
    expect(manager.getSnapshot()).toBe(state.publicAddress);
    expect(state.expiresAt).toBe(6_000);
  });

  it("returns stored metadata for the owner", async () => {
    const manager = createSessionKeyManager({ storage, now: () => 5_000 });
    const state = await manager.initialize(OWNER, { ttlMs: 1_000 });

    expect(await manager.getMetadata(OWNER)).toEqual({
      address: state.publicAddress,
      owner: OWNER,
      createdAt: 5_000,
      expiresAt: 6_000,
    });
    expect(await manager.getMetadata(OTHER_OWNER)).toBeNull();
  });

  it("notifies subscribers until they unsubscribe", async () => {
    const manager = createSessionKeyManager({ storage });
    const listener = vi.fn();
    const unsubscribe = manager.subscribe(listener);

    await manager.initialize(OWNER);
    expect(listener).toHaveBeenCalled();

    unsubscribe();
    listener.mockClear();
    await manager.destroy();

    expect(listener).not.toHaveBeenCalled();
  });

  it("keeps persisted data when destroy receives no owner", async () => {
    const manager = createSessionKeyManager({ storage });
    await manager.initialize(OWNER);
    await manager.destroy();

    expect(manager.isReady()).toBe(false);
    expect(manager.getAddress()).toBeNull();
    expect(storage.raw.get(OWNER.toLowerCase())).toBeDefined();
  });

  it("removes persisted data when destroy receives an owner", async () => {
    const manager = createSessionKeyManager({ storage });
    await manager.initialize(OWNER);
    await manager.destroy(OWNER);

    expect(manager.isReady()).toBe(false);
    expect(storage.raw.get(OWNER.toLowerCase()) ?? null).toBeNull();
  });

  it("rotates the stored key on demand", async () => {
    const manager = createSessionKeyManager({ storage });
    const first = await manager.initialize(OWNER);
    const rotated = await manager.rotate(OWNER);

    expect(rotated.publicAddress).not.toBe(first.publicAddress);
    expect(storage.raw.get(OWNER.toLowerCase())?.address).toBe(rotated.publicAddress);
  });
});

function recordToMetadata(record: SessionKeyRecord): SessionKeyMetadata {
  return {
    address: record.address,
    owner: record.owner,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
  };
}
