"use client";

import type { SessionKeyMetadata, SessionKeyRecord, SessionKeyStorage } from "@symmio/session-key";
import { getAddress, type Address, type Hex } from "viem";

const STORAGE_PREFIX = "prism.session-key";
const PBKDF2_SALT = "prism-session-key-v1";
const PBKDF2_ITERATIONS = 100_000;

interface StoredRecord {
  ciphertext: string;
  iv: string;
  address: Address;
  owner: Address;
  createdAt: number;
  expiresAt: number;
}

/**
 * Durable, encrypted browser storage for the session key.
 *
 * The SDK deliberately leaves persistence to the consumer, and the docs are
 * blunt about the consequence of getting it wrong: a key that lives only in
 * memory is re-minted on every reload, which **drops every delegation** and
 * forces the user to sign another `grantDelegation` just to trade again.
 *
 * The private key is encrypted with AES-GCM under a PBKDF2 key derived from the
 * owner address before it touches `localStorage`. That is not a secret — the
 * address is public — so it is obfuscation against casual inspection and
 * cross-owner leakage, not a vault. A production app should derive the key from
 * something only the user holds (a wallet signature, a passphrase); this is a
 * showcase, and it says so rather than pretending otherwise.
 */
export function createPrismSessionKeyStorage(): SessionKeyStorage {
  return {
    async load(owner: Address): Promise<SessionKeyRecord | null> {
      const stored = read(owner);
      if (!stored) return null;

      /* An expired record is worse than none: it would load a key whose
         delegations the contract already rejects. */
      if (stored.expiresAt <= Date.now()) {
        window.localStorage.removeItem(keyFor(owner));
        return null;
      }

      try {
        const privateKey = await decrypt(stored, owner);
        return {
          owner: getAddress(stored.owner),
          address: getAddress(stored.address),
          privateKey,
          createdAt: stored.createdAt,
          expiresAt: stored.expiresAt,
        };
      } catch {
        /* A record we cannot decrypt is unusable; drop it so the next
           `initialize` mints a fresh key instead of failing forever. */
        window.localStorage.removeItem(keyFor(owner));
        return null;
      }
    },

    async save(owner: Address, record: SessionKeyRecord): Promise<void> {
      const { ciphertext, iv } = await encrypt(record.privateKey, owner);
      const stored: StoredRecord = {
        ciphertext,
        iv,
        address: record.address,
        owner: record.owner,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
      };
      window.localStorage.setItem(keyFor(owner), JSON.stringify(stored));
    },

    async remove(owner: Address): Promise<void> {
      window.localStorage.removeItem(keyFor(owner));
    },

    async getMetadata(owner: Address): Promise<SessionKeyMetadata | null> {
      const stored = read(owner);
      if (!stored) return null;
      return {
        address: getAddress(stored.address),
        owner: getAddress(stored.owner),
        createdAt: stored.createdAt,
        expiresAt: stored.expiresAt,
      };
    },
  };
}

function keyFor(owner: Address): string {
  return `${STORAGE_PREFIX}.${owner.toLowerCase()}`;
}

function read(owner: Address): StoredRecord | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(keyFor(owner));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredRecord;
  } catch {
    return null;
  }
}

async function deriveKey(owner: Address): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const material = await crypto.subtle.importKey(
    "raw",
    toBuffer(encoder.encode(owner.toLowerCase())),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: toBuffer(encoder.encode(PBKDF2_SALT)), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encrypt(privateKey: Hex, owner: Address): Promise<{ ciphertext: string; iv: string }> {
  const key = await deriveKey(owner);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toBuffer(iv) },
    key,
    toBuffer(new TextEncoder().encode(privateKey)),
  );
  return { ciphertext: toBase64(new Uint8Array(bytes)), iv: toBase64(iv) };
}

async function decrypt(stored: StoredRecord, owner: Address): Promise<Hex> {
  const key = await deriveKey(owner);
  const bytes = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toBuffer(fromBase64(stored.iv)) },
    key,
    toBuffer(fromBase64(stored.ciphertext)),
  );
  return new TextDecoder().decode(bytes) as Hex;
}

/**
 * A standalone `ArrayBuffer` copy of a view.
 *
 * WebCrypto's `BufferSource` will not accept a `Uint8Array` whose backing buffer
 * could be a `SharedArrayBuffer`, which is what `TextEncoder.encode` returns
 * under modern lib types.
 */
function toBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return window.btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
