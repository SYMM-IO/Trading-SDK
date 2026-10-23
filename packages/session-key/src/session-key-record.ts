import { isAddress, type Address, type Hex } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import type { SessionKeyImportOptions, SessionKeyRecord } from "./types";

export function validateSessionKeyOwner(owner: Address): void {
  if (!isAddress(owner, { strict: false })) throw new Error("Invalid session-key owner address.");
}

export function validateSessionKeyPrivateKey(privateKey: Hex): PrivateKeyAccount {
  if (!/^0x[0-9a-f]{64}$/i.test(privateKey)) throw new Error("Invalid session private key.");
  return privateKeyToAccount(privateKey);
}

/** Validate decrypted storage before trusting its identity or lifetime. */
export function validateSessionKeyRecord(owner: Address, record: SessionKeyRecord): void {
  validateSessionKeyOwner(record.owner);
  if (record.owner.toLowerCase() !== owner.toLowerCase()) throw new Error("Session-key record owner mismatch.");
  const account = validateSessionKeyPrivateKey(record.privateKey);
  if (!isAddress(record.address, { strict: false }) || account.address.toLowerCase() !== record.address.toLowerCase()) {
    throw new Error("Session-key record address does not match its private key.");
  }
  validateTimestamp(record.createdAt);
  validateTimestamp(record.expiresAt);
  if (record.expiresAt <= record.createdAt) throw new Error("Session-key expiry must follow its creation time.");
}

export function resolveSessionKeyExpiry(now: number, defaultTtlMs: number, options?: SessionKeyImportOptions): number {
  validateTimestamp(now);
  if (options?.expiresAt !== undefined && options.ttlMs !== undefined) {
    throw new Error("Use either expiresAt or ttlMs for a session key, not both.");
  }
  if (options?.ttlMs !== undefined) validateTimestamp(options.ttlMs);
  const expiresAt = options?.expiresAt !== undefined ? options.expiresAt : now + (options?.ttlMs ?? defaultTtlMs);
  validateTimestamp(expiresAt);
  if (expiresAt <= now) throw new Error("Session-key expiry must be in the future.");
  return expiresAt;
}

function validateTimestamp(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error("Session-key timestamps must be non-negative safe integers in milliseconds.");
}
