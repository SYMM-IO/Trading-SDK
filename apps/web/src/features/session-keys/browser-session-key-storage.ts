"use client";

import type { SessionKeyMetadata, SessionKeyStorage } from "@symmio/session-key";
import { getAddress, type Address } from "viem";
import { decryptSessionPrivateKey, encryptSessionPrivateKey } from "./session-key-crypto";

const SESSION_KEY_STORAGE_PREFIX = "symm-frontier-session-key";

interface SessionKeyStringStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

interface BrowserSessionKeyStorageOptions {
  storagePrefix?: string;
  storage?: SessionKeyStringStorage;
}

interface StoredBrowserSessionKey {
  encryptedPrivateKey: string;
  iv: string;
  publicAddress: Address;
  walletAddress: Address;
  createdAt: number;
  expiresAt: number;
  label?: string;
}

export function createBrowserSessionKeyStorage(options: BrowserSessionKeyStorageOptions = {}): SessionKeyStorage {
  const storagePrefix = options.storagePrefix ?? SESSION_KEY_STORAGE_PREFIX;

  return {
    async load(owner) {
      const storage = options.storage ?? getBrowserLocalStorage();
      const key = getSessionKeyStorageKey(owner, storagePrefix);
      const stored = await readStoredSessionKey(storage, key);

      if (!stored) return null;
      if (stored.expiresAt <= Date.now()) {
        await storage.removeItem(key);
        return null;
      }

      const privateKey = await decryptSessionPrivateKey(stored, owner);
      const record = {
        owner: getAddress(stored.walletAddress),
        privateKey,
        address: getAddress(stored.publicAddress),
        createdAt: stored.createdAt,
        expiresAt: stored.expiresAt,
      };
      if (stored.label !== undefined) {
        return { ...record, label: stored.label };
      }
      return record;
    },

    async save(owner, record) {
      const storage = options.storage ?? getBrowserLocalStorage();
      const key = getSessionKeyStorageKey(owner, storagePrefix);
      const encrypted = await encryptSessionPrivateKey(record.privateKey, owner);
      const stored: StoredBrowserSessionKey = {
        encryptedPrivateKey: encrypted.encryptedPrivateKey,
        iv: encrypted.iv,
        publicAddress: getAddress(record.address),
        walletAddress: getAddress(record.owner),
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
      };
      if (record.label !== undefined) {
        stored.label = record.label;
      }

      await storage.setItem(key, JSON.stringify(stored));
    },

    async remove(owner) {
      const storage = options.storage ?? getBrowserLocalStorage();
      await storage.removeItem(getSessionKeyStorageKey(owner, storagePrefix));
    },

    async getMetadata(owner) {
      const storage = options.storage ?? getBrowserLocalStorage();
      const key = getSessionKeyStorageKey(owner, storagePrefix);
      const stored = await readStoredSessionKey(storage, key);

      if (!stored) return null;
      if (stored.expiresAt <= Date.now()) {
        await storage.removeItem(key);
        return null;
      }

      return storedToMetadata(stored);
    },
  };
}

function getSessionKeyStorageKey(owner: Address, prefix = SESSION_KEY_STORAGE_PREFIX): string {
  return `${prefix}:${owner.toLowerCase()}`;
}

async function readStoredSessionKey(
  storage: SessionKeyStringStorage,
  key: string,
): Promise<StoredBrowserSessionKey | null> {
  try {
    const raw = await storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredBrowserSessionKey>;

    if (
      typeof parsed.encryptedPrivateKey !== "string" ||
      typeof parsed.iv !== "string" ||
      typeof parsed.publicAddress !== "string" ||
      typeof parsed.walletAddress !== "string" ||
      typeof parsed.createdAt !== "number" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }

    const stored: StoredBrowserSessionKey = {
      encryptedPrivateKey: parsed.encryptedPrivateKey,
      iv: parsed.iv,
      publicAddress: getAddress(parsed.publicAddress),
      walletAddress: getAddress(parsed.walletAddress),
      createdAt: parsed.createdAt,
      expiresAt: parsed.expiresAt,
    };
    if (typeof parsed.label === "string") {
      stored.label = parsed.label;
    }
    return stored;
  } catch {
    return null;
  }
}

function storedToMetadata(stored: StoredBrowserSessionKey): SessionKeyMetadata {
  return {
    address: stored.publicAddress,
    owner: stored.walletAddress,
    createdAt: stored.createdAt,
    expiresAt: stored.expiresAt,
  };
}

function getBrowserLocalStorage(): SessionKeyStringStorage {
  if (!globalThis.localStorage) {
    throw new Error("localStorage is not available in this runtime.");
  }

  return globalThis.localStorage;
}
