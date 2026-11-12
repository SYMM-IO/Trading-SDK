import { getAddress, isAddress, recoverMessageAddress, recoverTypedDataAddress, type Address } from "viem";
import { mainnet } from "viem/chains";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionKeyLoadError, SessionKeyOperationSupersededError } from "./errors";
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
    expect(manager.getAccount()).toBeNull();
  });

  it("exposes the loaded session key as a viem account", async () => {
    const manager = createSessionKeyManager({ storage });

    expect(manager.getAccount()).toBeNull();

    const state = await manager.initialize(OWNER);
    const account = manager.getAccount();

    expect(account).not.toBeNull();
    expect(account?.address).toBe(state.publicAddress);
    expect(account?.address).toBe(manager.getAddress());

    await manager.destroy();

    expect(manager.getAccount()).toBeNull();
  });

  it("signs typed data through the exposed account exactly as the manager does", async () => {
    const manager = createSessionKeyManager({ storage });
    await manager.initialize(OWNER);
    const account = manager.getAccount();
    expect(account).not.toBeNull();

    const accountSignature = await account!.signTypedData({ ...TYPED_DATA, primaryType: "Session" });
    const managerSignature = await manager.signTypedData(TYPED_DATA);
    const recovered = await recoverTypedDataAddress({
      ...TYPED_DATA,
      primaryType: "Session",
      signature: accountSignature,
    });

    expect(accountSignature).toBe(managerSignature);
    expect(recovered).toBe(account!.address);
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

describe("session key manager lifecycle guarantees", () => {
  it("shares one initialize between concurrent callers, generating a single key", async () => {
    const storage = createMemorySessionKeyStorage();
    const save = vi.spyOn(storage, "save");
    const manager = createSessionKeyManager({ storage });

    const [first, second] = await Promise.all([manager.initialize(OWNER), manager.initialize(OWNER)]);

    expect(first.publicAddress).toBe(second.publicAddress);
    expect(save).toHaveBeenCalledTimes(1);
    expect(storage.raw.get(OWNER.toLowerCase())?.address).toBe(first.publicAddress);
  });

  it("keeps the loaded signer when initialize runs again for the same owner", async () => {
    const storage = createMemorySessionKeyStorage();
    const manager = createSessionKeyManager({ storage });
    const first = await manager.initialize(OWNER);
    const account = manager.getAccount()!;
    const load = vi.spyOn(storage, "load");
    const snapshots: (Address | null)[] = [];
    manager.subscribe(() => snapshots.push(manager.getSnapshot()));

    const again = await manager.initialize(getAddress(OWNER));

    expect(again).toEqual(first);
    expect(snapshots).toEqual([]);
    expect(load).not.toHaveBeenCalled();
    const signature = await account.signMessage({ message: "still loaded" });
    expect(await recoverMessageAddress({ message: "still loaded", signature })).toBe(first.publicAddress);
  });

  it("lets a signature in progress finish when initialize runs again for the same owner", async () => {
    const storage = createMemorySessionKeyStorage();
    const manager = createSessionKeyManager({ storage });
    const state = await manager.initialize(OWNER);
    const account = manager.getAccount()!;
    const signTypedData = account.signTypedData.bind(account);
    let markSigningStarted!: () => void;
    let releaseSigning!: () => void;
    const signingStarted = new Promise<void>((resolve) => {
      markSigningStarted = resolve;
    });
    const signingGate = new Promise<void>((resolve) => {
      releaseSigning = resolve;
    });
    vi.spyOn(account, "signTypedData").mockImplementation(async (parameters) => {
      markSigningStarted();
      await signingGate;
      return signTypedData(parameters);
    });

    const signing = manager.signTypedData(TYPED_DATA);
    await signingStarted;
    await manager.initialize(OWNER);
    releaseSigning();

    const signature = await signing;
    expect(await recoverTypedDataAddress({ ...TYPED_DATA, primaryType: "Session", signature })).toBe(
      state.publicAddress,
    );
  });

  it("starts over when initialize runs again after the loaded key expired", async () => {
    const storage = createMemorySessionKeyStorage();
    let now = 1_000;
    const manager = createSessionKeyManager({ storage, now: () => now, defaultTtlMs: 1_000 });
    const first = await manager.initialize(OWNER);
    const account = manager.getAccount()!;
    now = 2_000;

    const next = await manager.initialize(OWNER);

    expect(next.isReady).toBe(true);
    expect(next.publicAddress).not.toBe(first.publicAddress);
    await expect(account.signMessage({ message: "expired" })).rejects.toBeInstanceOf(
      SessionKeyOperationSupersededError,
    );
  });

  it("keeps the loaded signer when load runs for the same owner", async () => {
    const storage = createMemorySessionKeyStorage();
    const manager = createSessionKeyManager({ storage });
    const first = await manager.initialize(OWNER);
    const account = manager.getAccount()!;
    const load = vi.spyOn(storage, "load");
    const snapshots: (Address | null)[] = [];
    manager.subscribe(() => snapshots.push(manager.getSnapshot()));

    const restored = await manager.load(getAddress(OWNER));

    expect(restored).toEqual(first);
    expect(snapshots).toEqual([]);
    expect(load).not.toHaveBeenCalled();
    const signature = await account.signMessage({ message: "still loaded" });
    expect(await recoverMessageAddress({ message: "still loaded", signature })).toBe(first.publicAddress);
  });

  it("lets a signature in progress finish when load runs for the loaded owner", async () => {
    const storage = createMemorySessionKeyStorage();
    const manager = createSessionKeyManager({ storage });
    const state = await manager.initialize(OWNER);
    const account = manager.getAccount()!;
    const signTypedData = account.signTypedData.bind(account);
    let markSigningStarted!: () => void;
    let releaseSigning!: () => void;
    const signingStarted = new Promise<void>((resolve) => {
      markSigningStarted = resolve;
    });
    const signingGate = new Promise<void>((resolve) => {
      releaseSigning = resolve;
    });
    vi.spyOn(account, "signTypedData").mockImplementation(async (parameters) => {
      markSigningStarted();
      await signingGate;
      return signTypedData(parameters);
    });

    const signing = manager.signTypedData(TYPED_DATA);
    await signingStarted;
    await manager.load(OWNER);
    releaseSigning();

    const signature = await signing;
    expect(await recoverTypedDataAddress({ ...TYPED_DATA, primaryType: "Session", signature })).toBe(
      state.publicAddress,
    );
  });

  it("shares one load between concurrent callers", async () => {
    const storage = createMemorySessionKeyStorage();
    const stored = createSessionKey();
    storage.raw.set(OWNER.toLowerCase(), { ...stored, owner: OWNER, createdAt: 1_000, expiresAt: 3_000 });
    const load = vi.spyOn(storage, "load");
    const manager = createSessionKeyManager({ storage, now: () => 2_000 });

    const [first, second] = await Promise.all([manager.load(OWNER), manager.load(OWNER)]);

    expect(first).toEqual(second);
    expect(first.publicAddress).toBe(stored.address);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("adopts a competing key it observes before publishing its own", async () => {
    const shared = createMemorySessionKeyStorage();
    const otherTab = createSessionKey();
    const racing: SessionKeyStorage = {
      ...shared,
      async save(owner, record) {
        await shared.save(owner, record);
        /** Another tab stores its own key right after this one. */
        await shared.save(owner, { ...record, privateKey: otherTab.privateKey, address: otherTab.address });
      },
    };
    const manager = createSessionKeyManager({ storage: racing });

    const state = await manager.initialize(OWNER);

    expect(state.publicAddress).toBe(otherTab.address);
    expect(manager.getAddress()).toBe(otherTab.address);
  });

  it('keeps the stored record and rejects when load fails under `onLoadError: "throw"`', async () => {
    const save = vi.fn();
    const remove = vi.fn();
    const failing: SessionKeyStorage = {
      async load() {
        throw new Error("Cannot decrypt.");
      },
      save,
      remove,
      async getMetadata() {
        return null;
      },
    };
    const manager = createSessionKeyManager({ storage: failing, onLoadError: "throw" });

    const failure = manager.initialize(OWNER);

    await expect(failure).rejects.toBeInstanceOf(SessionKeyLoadError);
    await expect(failure).rejects.toMatchObject({
      owner: OWNER,
      cause: expect.objectContaining({ message: "Cannot decrypt." }),
    });
    expect(remove).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(manager.isReady()).toBe(false);
  });

  it("does not leave the previous owner's key usable when the next owner's load fails", async () => {
    const storage = createMemorySessionKeyStorage();
    const failsForOther: SessionKeyStorage = {
      ...storage,
      async load(owner) {
        if (owner === OTHER_OWNER) throw new Error("Cannot decrypt.");
        return storage.load(owner);
      },
    };
    const manager = createSessionKeyManager({ storage: failsForOther, onLoadError: "throw" });
    await manager.initialize(OWNER);

    const failure = manager.initialize(OTHER_OWNER);

    expect(manager.getAddress()).toBeNull();
    await expect(failure).rejects.toBeInstanceOf(SessionKeyLoadError);
    expect(manager.getAddress()).toBeNull();
    expect(manager.getState().isReady).toBe(false);
  });

  it("keeps running queued calls after one of them fails", async () => {
    const storage = createMemorySessionKeyStorage();
    const failsOnce: SessionKeyStorage = {
      ...storage,
      load: vi.fn().mockRejectedValueOnce(new Error("Cannot decrypt.")).mockImplementation(storage.load),
    };
    const manager = createSessionKeyManager({ storage: failsOnce, onLoadError: "throw" });

    await expect(manager.initialize(OWNER)).rejects.toBeInstanceOf(SessionKeyLoadError);
    const rotated = await manager.rotate(OWNER);

    expect(rotated.publicAddress).toBe(storage.raw.get(OWNER.toLowerCase())?.address);
    expect(manager.getAddress()).toBe(rotated.publicAddress);
  });

  it("revokes the in-memory signer synchronously when destroy is called", async () => {
    const storage = createMemorySessionKeyStorage();
    const manager = createSessionKeyManager({ storage });
    await manager.initialize(OWNER);

    const destroying = manager.destroy();

    expect(manager.getAccount()).toBeNull();
    expect(manager.getAddress()).toBeNull();
    expect(manager.getPrivateKey()).toBeNull();
    expect(manager.isReady()).toBe(false);
    await destroying;
  });

  it("does not return a signature when the signer is revoked while signing", async () => {
    const storage = createMemorySessionKeyStorage();
    const manager = createSessionKeyManager({ storage });
    await manager.initialize(OWNER);
    const account = manager.getAccount()!;
    const signMessage = account.signMessage.bind(account);
    let markSigningStarted!: () => void;
    let releaseSigning!: () => void;
    const signingStarted = new Promise<void>((resolve) => {
      markSigningStarted = resolve;
    });
    const signingGate = new Promise<void>((resolve) => {
      releaseSigning = resolve;
    });
    vi.spyOn(account, "signMessage").mockImplementation(async (parameters) => {
      markSigningStarted();
      await signingGate;
      return signMessage(parameters);
    });

    const signing = manager.sign("revoke while signing");
    await signingStarted;
    const destroying = manager.destroy();
    releaseSigning();

    await expect(signing).rejects.toMatchObject({
      operation: "sign",
      name: "SessionKeyOperationSupersededError",
    });
    await destroying;
  });

  it("revokes the previous owner as soon as another initialize starts", async () => {
    const storage = createMemorySessionKeyStorage();
    const originalLoad = storage.load.bind(storage);
    let releaseLoad!: () => void;
    const loadGate = new Promise<void>((resolve) => {
      releaseLoad = resolve;
    });
    const delayed: SessionKeyStorage = {
      ...storage,
      async load(owner) {
        if (owner === OTHER_OWNER) await loadGate;
        return originalLoad(owner);
      },
    };
    const manager = createSessionKeyManager({ storage: delayed });
    await manager.initialize(OWNER);

    const switching = manager.initialize(OTHER_OWNER);

    expect(manager.getAddress()).toBeNull();
    expect(manager.getAccount()).toBeNull();
    releaseLoad();
    const next = await switching;
    expect(manager.getAddress()).toBe(next.publicAddress);
  });

  it("prevents an older initialize from publishing after destroy", async () => {
    const storage = createMemorySessionKeyStorage();
    const originalLoad = storage.load.bind(storage);
    let markLoadStarted!: () => void;
    let releaseLoad!: () => void;
    const loadStarted = new Promise<void>((resolve) => {
      markLoadStarted = resolve;
    });
    const loadGate = new Promise<void>((resolve) => {
      releaseLoad = resolve;
    });
    const delayed: SessionKeyStorage = {
      ...storage,
      async load(owner) {
        markLoadStarted();
        await loadGate;
        return originalLoad(owner);
      },
    };
    const manager = createSessionKeyManager({ storage: delayed });
    const initialization = manager.initialize(OWNER);
    await loadStarted;

    const destroying = manager.destroy();
    releaseLoad();

    await expect(initialization).rejects.toMatchObject({
      operation: "initialize",
      name: "SessionKeyOperationSupersededError",
    });
    await expect(initialization).rejects.toBeInstanceOf(SessionKeyOperationSupersededError);
    await destroying;
    expect(manager.getAddress()).toBeNull();
    expect(storage.raw.size).toBe(0);
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
