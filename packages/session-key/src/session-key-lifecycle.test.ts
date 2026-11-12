import { recoverMessageAddress, type Address, type LocalAccount } from "viem";
import { describe, expect, it, vi } from "vitest";
import { SessionKeyExpiredError, SessionKeyLoadError, SessionKeyOperationSupersededError } from "./errors";
import { createSessionKey, createSessionKeyManager } from "./session-key-manager";
import type { SessionKeyImportOptions, SessionKeyRecord, SessionKeyStorage } from "./types";

const OWNER: Address = "0x1234567890abcdef1234567890abcdef12345678";
const OTHER_OWNER: Address = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
const TYPED_DATA = {
  domain: { name: "Session", version: "1", chainId: 1, verifyingContract: OWNER },
  types: { Request: [{ name: "nonce", type: "uint256" }] },
  primaryType: "Request",
  message: { nonce: 1n },
} as const;

function createStorage(record?: SessionKeyRecord): SessionKeyStorage {
  const records = new Map<string, SessionKeyRecord>();
  if (record) records.set(OWNER.toLowerCase(), record);
  return {
    load: vi.fn(async (owner) => records.get(owner.toLowerCase()) ?? null),
    save: vi.fn(async (owner, saved) => {
      records.set(owner.toLowerCase(), saved);
    }),
    remove: vi.fn(async (owner) => {
      records.delete(owner.toLowerCase());
    }),
    getMetadata: vi.fn(async (owner) => {
      const saved = records.get(owner.toLowerCase());
      return saved
        ? { owner: saved.owner, address: saved.address, createdAt: saved.createdAt, expiresAt: saved.expiresAt }
        : null;
    }),
  };
}

function createRecord(): SessionKeyRecord {
  return { ...createSessionKey(), owner: OWNER, createdAt: 1_000, expiresAt: 3_000 };
}

const signingMethods: Array<[string, (account: LocalAccount) => Promise<unknown>]> = [
  ["sign", (account) => account.sign!({ hash: `0x${"11".repeat(32)}` })],
  ["signMessage", (account) => account.signMessage({ message: "hello" })],
  ["signTypedData", (account) => account.signTypedData(TYPED_DATA)],
  [
    "signTransaction",
    (account) => account.signTransaction({ chainId: 1, nonce: 0, to: OWNER, gas: 21_000n, gasPrice: 1n, value: 0n }),
  ],
  ["signAuthorization", (account) => account.signAuthorization!({ address: OWNER, chainId: 1, nonce: 0 })],
];

describe("captured session accounts", () => {
  it("cannot extend the signing lifetime by changing a returned state snapshot", async () => {
    let now = 1_000;
    const manager = createSessionKeyManager({ storage: createStorage(), now: () => now });
    const state = await manager.initialize(OWNER, { ttlMs: 100 });
    const account = manager.getAccount()!;
    expect(Reflect.set(state, "expiresAt", Infinity)).toBe(false);
    expect(Reflect.set(manager.getState(), "isReady", false)).toBe(false);
    now = 1_100;
    await expect(account.signMessage({ message: "expired" })).rejects.toBeInstanceOf(SessionKeyExpiredError);
  });

  it.each(signingMethods)("revokes %s on an already captured account", async (_name, sign) => {
    const manager = createSessionKeyManager({ storage: createStorage() });
    await manager.initialize(OWNER);
    const account = manager.getAccount()!;
    await expect(sign(account)).resolves.toBeDefined();
    const destroying = manager.destroy();
    await expect(sign(account)).rejects.toBeInstanceOf(SessionKeyOperationSupersededError);
    await destroying;
  });

  it.each(signingMethods)("rejects %s already in flight when destroyed", async (_name, sign) => {
    const manager = createSessionKeyManager({ storage: createStorage() });
    await manager.initialize(OWNER);
    const signature = sign(manager.getAccount()!);
    const destroying = manager.destroy();
    await expect(signature).rejects.toBeInstanceOf(SessionKeyOperationSupersededError);
    await destroying;
  });

  it.each(signingMethods)("enforces expiry before %s", async (_name, sign) => {
    let now = 1_000;
    const manager = createSessionKeyManager({ storage: createStorage(), now: () => now });
    await manager.initialize(OWNER, { ttlMs: 100 });
    const account = manager.getAccount()!;
    now = 1_100;
    await expect(sign(account)).rejects.toMatchObject({
      name: "SessionKeyExpiredError",
      address: account.address,
      expiresAt: 1_100,
    });
    // Moving the clock backwards cannot revive a capability already revoked by expiry.
    now = 1_000;
    await expect(sign(account)).rejects.toBeInstanceOf(SessionKeyExpiredError);
  });

  it.each(signingMethods)("enforces expiry while %s is in flight", async (_name, sign) => {
    let now = 1_000;
    const manager = createSessionKeyManager({ storage: createStorage(), now: () => now });
    await manager.initialize(OWNER, { ttlMs: 100 });
    const signature = sign(manager.getAccount()!);
    now = 1_100;
    await expect(signature).rejects.toBeInstanceOf(SessionKeyExpiredError);
  });

  it.each(["rotate", "import", "owner change"])("revokes the captured signer on %s", async (transition) => {
    const manager = createSessionKeyManager({ storage: createStorage() });
    await manager.initialize(OWNER);
    const account = manager.getAccount()!;
    const next =
      transition === "rotate"
        ? manager.rotate(OWNER)
        : transition === "import"
          ? manager.importPrivateKey(OWNER, createSessionKey().privateKey)
          : manager.initialize(OTHER_OWNER);
    await expect(account.signMessage({ message: "stale" })).rejects.toBeInstanceOf(SessionKeyOperationSupersededError);
    await next;
    const result = await manager.sign("current");
    expect(await recoverMessageAddress({ message: "current", signature: result.signature })).toBe(manager.getAddress());
  });

  it("revokes the captured signer when load restores another owner", async () => {
    const manager = createSessionKeyManager({ storage: createStorage() });
    await manager.initialize(OWNER);
    const account = manager.getAccount()!;
    const next = manager.load(OTHER_OWNER);
    await expect(account.signMessage({ message: "stale" })).rejects.toBeInstanceOf(SessionKeyOperationSupersededError);
    expect((await next).isReady).toBe(false);
    expect(manager.getAccount()).toBeNull();
  });

  it("stops exposing an expired key through every accessor without deleting its record", async () => {
    let now = 1_000;
    const storage = createStorage();
    const manager = createSessionKeyManager({ storage, now: () => now });
    const loaded = await manager.initialize(OWNER, { ttlMs: 100 });
    now = 1_100;
    expect(manager.getState()).toEqual({ ...loaded, isReady: false, isExpired: true });
    expect(manager.isReady()).toBe(false);
    expect(manager.getAddress()).toBeNull();
    expect(manager.getSnapshot()).toBeNull();
    expect(manager.getAccount()).toBeNull();
    expect(manager.getPrivateKey()).toBeNull();
    await expect(manager.sign("expired")).rejects.toBeInstanceOf(SessionKeyExpiredError);
    await expect(
      manager.signTypedData({ ...TYPED_DATA, types: { Request: [...TYPED_DATA.types.Request] } }),
    ).rejects.toBeInstanceOf(SessionKeyExpiredError);
    expect(storage.remove).not.toHaveBeenCalled();
  });
});

describe("restore without creating a session key", () => {
  it.each(["missing", "expired", "valid"])("restores a %s record without storage mutations", async (kind) => {
    const record = createRecord();
    const storage = createStorage(kind === "missing" ? undefined : record);
    const manager = createSessionKeyManager({ storage, now: () => (kind === "expired" ? 3_000 : 2_000) });
    const state = await manager.load(OWNER);
    expect(state.isReady).toBe(kind === "valid");
    expect(state.isExpired).toBe(kind === "expired");
    expect(manager.getPrivateKey()).toBe(kind === "valid" ? record.privateKey : null);
    expect(storage.save).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it("never applies initialize's rotate-on-load-error policy", async () => {
    const storage = createStorage();
    vi.mocked(storage.load).mockRejectedValue(new Error("Cannot decrypt"));
    const manager = createSessionKeyManager({ storage });
    await expect(manager.load(OWNER)).rejects.toBeInstanceOf(SessionKeyLoadError);
    expect(storage.save).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it.each([
    ["owner", { owner: OTHER_OWNER }],
    ["address", { address: OTHER_OWNER }],
    ["private key", { privateKey: "0x00" }],
    ["non-finite expiry", { expiresAt: NaN }],
    ["creation time", { createdAt: -1 }],
    ["inverted lifetime", { createdAt: 4_000 }],
  ])("refuses invalid stored %s", async (_label, invalid) => {
    const storage = createStorage({ ...createRecord(), ...invalid } as SessionKeyRecord);
    const manager = createSessionKeyManager({ storage, now: () => 2_000, onLoadError: "throw" });
    await expect(manager.load(OWNER)).rejects.toBeInstanceOf(SessionKeyLoadError);
    await expect(manager.initialize(OWNER)).rejects.toBeInstanceOf(SessionKeyLoadError);
    expect(manager.getAccount()).toBeNull();
    expect(storage.save).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it("cannot publish a pending restore after destruction", async () => {
    const storage = createStorage();
    let finish!: (value: SessionKeyRecord) => void;
    vi.mocked(storage.load).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const manager = createSessionKeyManager({ storage });
    const loading = manager.load(OWNER);
    await Promise.resolve();
    const destroyed = manager.destroy();
    finish(createRecord());
    await expect(loading).rejects.toBeInstanceOf(SessionKeyOperationSupersededError);
    await destroyed;
    expect(manager.getAccount()).toBeNull();
  });
});

describe("imported session lifetime", () => {
  it("preserves the absolute expiry of a transferred key through reload", async () => {
    const storage = createStorage();
    const manager = createSessionKeyManager({ storage, now: () => 2_000 });
    const state = await manager.importPrivateKey(OWNER, createSessionKey().privateKey, { expiresAt: 3_000 });
    expect(state.expiresAt).toBe(3_000);
    const reloaded = createSessionKeyManager({ storage, now: () => 2_500 });
    expect(await reloaded.load(OWNER)).toEqual(state);
  });

  it.each([
    { expiresAt: null },
    { ttlMs: null },
    { expiresAt: 2_000 },
    { expiresAt: NaN },
    { expiresAt: Infinity },
    { expiresAt: 2_000.5 },
    { expiresAt: 3_000, ttlMs: 1_000 },
    { ttlMs: 0 },
    { ttlMs: -1 },
    { ttlMs: Infinity },
  ])("rejects invalid lifetime %j before revoking or persisting", async (options) => {
    const storage = createStorage();
    const manager = createSessionKeyManager({ storage, now: () => 2_000 });
    await manager.initialize(OWNER);
    const account = manager.getAccount();
    vi.mocked(storage.save).mockClear();
    await expect(
      manager.importPrivateKey(OWNER, createSessionKey().privateKey, options as SessionKeyImportOptions),
    ).rejects.toThrow();
    expect(manager.getAccount()).toBe(account);
    expect(storage.save).not.toHaveBeenCalled();
  });

  it("validates a competing writer before adopting its record", async () => {
    const storage = createStorage();
    const save = vi.mocked(storage.save).getMockImplementation()!;
    vi.mocked(storage.save).mockImplementation((owner, record) => save(owner, { ...record, owner: OTHER_OWNER }));
    const manager = createSessionKeyManager({ storage });
    await expect(manager.initialize(OWNER)).rejects.toBeInstanceOf(SessionKeyLoadError);
    expect(manager.getAccount()).toBeNull();
  });
});
