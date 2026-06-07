import { getAddress, isAddress, recoverMessageAddress, type Address } from "viem";
import { beforeEach, describe, expect, it } from "vitest";
import { SESSION_KEY_TRANSFER_PAYLOAD_VERSION } from "./constants";
import { createSessionKeyManager, sessionKeyFromPrivateKey } from "./session-key-manager";
import { decodeSessionKeyTransferPayload, encodeSessionKeyTransferPayload } from "./transfer-payload";
import type { SessionKeyMetadata, SessionKeyRecord, SessionKeyStorage } from "./types";

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

describe("session key manager", () => {
  const storage = createMemorySessionKeyStorage();

  beforeEach(() => {
    storage.clear();
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

  it("removes persisted data when destroy receives an owner", async () => {
    const manager = createSessionKeyManager({ storage });
    await manager.initialize(OWNER);
    await manager.destroy(OWNER);

    expect(manager.isReady()).toBe(false);
    expect(storage.raw.get(OWNER.toLowerCase()) ?? null).toBeNull();
  });
});

describe("session key transfer payloads", () => {
  it("encodes and decodes a valid transfer payload", () => {
    const manager = createSessionKeyManager({
      storage: createMemorySessionKeyStorage(),
      now: () => 1_000,
    });
    const raw = encodeSessionKeyTransferPayload({
      version: SESSION_KEY_TRANSFER_PAYLOAD_VERSION,
      owner: OWNER,
      sessionPrivateKey: null,
      createdAt: 1_000,
    });
    const decoded = decodeSessionKeyTransferPayload(raw, { now: 2_000 });

    expect(manager.isReady()).toBe(false);
    expect(decoded?.owner).toBe(getAddress(OWNER));
  });

  it("rejects expired transfer payloads", () => {
    const raw = encodeSessionKeyTransferPayload({
      version: SESSION_KEY_TRANSFER_PAYLOAD_VERSION,
      owner: OWNER,
      sessionPrivateKey: null,
      createdAt: 1_000,
    });

    expect(decodeSessionKeyTransferPayload(raw, { now: 200_000 })).toBeNull();
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
