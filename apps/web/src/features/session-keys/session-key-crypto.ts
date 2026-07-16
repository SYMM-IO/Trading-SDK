"use client";

import type { Address, Hex } from "viem";
import { base64ToBytes, bytesToBase64, toArrayBuffer } from "./session-key-base64";

const SESSION_KEY_SALT = "session-key-salt-v1";
const SESSION_KEY_PBKDF2_ITERATIONS = 100_000;

interface EncryptionOptions {
  salt?: string;
  iterations?: number;
}

interface EncryptedPrivateKey {
  encryptedPrivateKey: string;
  iv: string;
}

/**
 * Encrypt a session private key for browser storage.
 */
export async function encryptSessionPrivateKey(
  privateKey: Hex,
  owner: Address,
  options: EncryptionOptions = {},
): Promise<EncryptedPrivateKey> {
  const subtle = getSubtleCrypto();
  const encryptionKey = await deriveSessionKeyEncryptionKey(owner, options);
  const iv = getCrypto().getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(privateKey);
  const ciphertext = await subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    encryptionKey,
    toArrayBuffer(encoded),
  );

  return {
    encryptedPrivateKey: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
  };
}

/**
 * Decrypt a browser-stored session private key.
 */
export async function decryptSessionPrivateKey(
  stored: EncryptedPrivateKey,
  owner: Address,
  options: EncryptionOptions = {},
): Promise<Hex> {
  const subtle = getSubtleCrypto();
  const encryptionKey = await deriveSessionKeyEncryptionKey(owner, options);
  const decrypted = await subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(base64ToBytes(stored.iv)) },
    encryptionKey,
    toArrayBuffer(base64ToBytes(stored.encryptedPrivateKey)),
  );

  return new TextDecoder().decode(decrypted) as Hex;
}

async function deriveSessionKeyEncryptionKey(owner: Address, options: EncryptionOptions = {}): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const encoder = new TextEncoder();
  const keyMaterial = await subtle.importKey(
    "raw",
    toArrayBuffer(encoder.encode(owner.toLowerCase())),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(encoder.encode(options.salt ?? SESSION_KEY_SALT)),
      iterations: options.iterations ?? SESSION_KEY_PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function getCrypto(): Crypto {
  if (!globalThis.crypto) {
    throw new Error("Web Crypto is not available in this runtime.");
  }

  return globalThis.crypto;
}

function getSubtleCrypto(): SubtleCrypto {
  const crypto = getCrypto();
  if (!crypto.subtle) {
    throw new Error("SubtleCrypto is not available in this runtime.");
  }

  return crypto.subtle;
}
