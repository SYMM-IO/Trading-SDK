import { getAddress, type Address } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import { SESSION_KEY_TRANSFER_MAX_AGE_MS, SESSION_KEY_TRANSFER_PAYLOAD_VERSION } from "./constants";
import { decodeSessionKeyTransferPayload, encodeSessionKeyTransferPayload } from "./transfer-payload";

const OWNER = "0x1234567890abcdef1234567890abcdef12345678" as Address;
const SESSION_PRIVATE_KEY = generatePrivateKey();
const SESSION_ADDRESS = privateKeyToAccount(SESSION_PRIVATE_KEY).address;
const CREATED_AT = 1_000;

/** Minimal payload every decode assertion mutates one field of. */
function baseRawPayload(): Record<string, unknown> {
  return {
    version: SESSION_KEY_TRANSFER_PAYLOAD_VERSION,
    owner: OWNER,
    sessionPrivateKey: SESSION_PRIVATE_KEY,
    createdAt: CREATED_AT,
  };
}

function decodeRaw(payload: Record<string, unknown>, now = CREATED_AT) {
  return decodeSessionKeyTransferPayload(JSON.stringify(payload), { now });
}

describe("encodeSessionKeyTransferPayload", () => {
  it("round-trips a full payload", () => {
    const raw = encodeSessionKeyTransferPayload({
      version: SESSION_KEY_TRANSFER_PAYLOAD_VERSION,
      owner: OWNER,
      sessionPrivateKey: SESSION_PRIVATE_KEY,
      sessionAddress: SESSION_ADDRESS,
      createdAt: CREATED_AT,
      expiresAt: 60_000,
    });

    expect(decodeSessionKeyTransferPayload(raw, { now: CREATED_AT })).toEqual({
      version: SESSION_KEY_TRANSFER_PAYLOAD_VERSION,
      owner: getAddress(OWNER),
      sessionPrivateKey: SESSION_PRIVATE_KEY,
      sessionAddress: getAddress(SESSION_ADDRESS),
      createdAt: CREATED_AT,
      expiresAt: 60_000,
    });
  });
});

describe("decodeSessionKeyTransferPayload", () => {
  it("accepts a metadata-only payload without a private key", () => {
    const decoded = decodeRaw({ ...baseRawPayload(), sessionPrivateKey: null });

    expect(decoded?.sessionPrivateKey).toBeNull();
    expect(decoded?.sessionAddress).toBeUndefined();
    expect(decoded?.expiresAt).toBeUndefined();
  });

  it("uses the current clock when no `now` is supplied", () => {
    const raw = JSON.stringify({ ...baseRawPayload(), createdAt: Date.now() });

    expect(decodeSessionKeyTransferPayload(raw)).not.toBeNull();
  });

  it("honours a custom max age", () => {
    const raw = JSON.stringify(baseRawPayload());

    expect(decodeSessionKeyTransferPayload(raw, { now: CREATED_AT + 5_000, maxAgeMs: 10_000 })).not.toBeNull();
    expect(decodeSessionKeyTransferPayload(raw, { now: CREATED_AT + 5_000, maxAgeMs: 1_000 })).toBeNull();
  });

  it("rejects payloads older than the default max age", () => {
    expect(decodeRaw(baseRawPayload(), CREATED_AT + SESSION_KEY_TRANSFER_MAX_AGE_MS + 1)).toBeNull();
  });

  it("rejects malformed json", () => {
    expect(decodeSessionKeyTransferPayload("{ not json")).toBeNull();
  });

  it("rejects an unsupported schema version", () => {
    expect(decodeRaw({ ...baseRawPayload(), version: SESSION_KEY_TRANSFER_PAYLOAD_VERSION + 1 })).toBeNull();
  });

  it("rejects a non-string owner", () => {
    expect(decodeRaw({ ...baseRawPayload(), owner: 42 })).toBeNull();
  });

  it("rejects an owner that is not an address", () => {
    expect(decodeRaw({ ...baseRawPayload(), owner: "0xnope" })).toBeNull();
  });

  it("rejects a non-string session private key", () => {
    expect(decodeRaw({ ...baseRawPayload(), sessionPrivateKey: 42 })).toBeNull();
  });

  it("rejects a session private key that is not hex", () => {
    expect(decodeRaw({ ...baseRawPayload(), sessionPrivateKey: "not-hex" })).toBeNull();
  });

  it("rejects a session private key of the wrong length", () => {
    expect(decodeRaw({ ...baseRawPayload(), sessionPrivateKey: "0x1234" })).toBeNull();
  });

  it("rejects a non-number createdAt", () => {
    expect(decodeRaw({ ...baseRawPayload(), createdAt: "1000" })).toBeNull();
  });

  it("rejects a session address that is not an address", () => {
    expect(decodeRaw({ ...baseRawPayload(), sessionAddress: "0xnope" })).toBeNull();
  });

  it("rejects a non-number expiresAt", () => {
    expect(decodeRaw({ ...baseRawPayload(), expiresAt: "later" })).toBeNull();
  });
});
