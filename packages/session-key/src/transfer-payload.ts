import { getAddress, isAddress, isHex, type Hex } from "viem";
import { SESSION_KEY_TRANSFER_MAX_AGE_MS, SESSION_KEY_TRANSFER_PAYLOAD_VERSION } from "./constants";
import type { SessionKeyTransferPayload } from "./types";

/**
 * Encode a short-lived session-key transfer payload.
 *
 * This is intended for explicit device-transfer flows such as QR handoff. The
 * private key is included only when the caller passes it.
 *
 * @example
 * ```ts
 * const payload = encodeSessionKeyTransferPayload({
 *   version: SESSION_KEY_TRANSFER_PAYLOAD_VERSION,
 *   owner,
 *   sessionPrivateKey,
 *   createdAt: Date.now(),
 * });
 * ```
 *
 * @param payload - Payload to serialize.
 * @returns JSON string suitable for QR or deep-link transport.
 */
export function encodeSessionKeyTransferPayload(payload: SessionKeyTransferPayload): string {
  return JSON.stringify(payload);
}

/**
 * Decode and validate a session-key transfer payload.
 *
 * Returns `null` for malformed, unsupported, or expired payloads. By default a
 * payload expires two minutes after `createdAt`.
 *
 * @param raw - Raw JSON payload.
 * @param options - Optional age and clock controls.
 */
export function decodeSessionKeyTransferPayload(
  raw: string,
  options: { maxAgeMs?: number; now?: number } = {},
): SessionKeyTransferPayload | null {
  try {
    const data = JSON.parse(raw) as Partial<SessionKeyTransferPayload>;
    const now = options.now ?? Date.now();
    const maxAgeMs = options.maxAgeMs ?? SESSION_KEY_TRANSFER_MAX_AGE_MS;

    if (
      data.version !== SESSION_KEY_TRANSFER_PAYLOAD_VERSION ||
      typeof data.owner !== "string" ||
      !isAddress(data.owner) ||
      !isValidTransferPrivateKey(data.sessionPrivateKey) ||
      typeof data.createdAt !== "number" ||
      now - data.createdAt > maxAgeMs
    ) {
      return null;
    }

    if (data.sessionAddress !== undefined && !isAddress(data.sessionAddress)) {
      return null;
    }

    if (data.expiresAt !== undefined && typeof data.expiresAt !== "number") {
      return null;
    }

    return {
      version: data.version,
      owner: getAddress(data.owner),
      sessionPrivateKey: data.sessionPrivateKey,
      sessionAddress: data.sessionAddress ? getAddress(data.sessionAddress) : undefined,
      createdAt: data.createdAt,
      expiresAt: data.expiresAt,
    };
  } catch {
    return null;
  }
}

function isValidTransferPrivateKey(value: unknown): value is Hex | null {
  return value === null || (typeof value === "string" && isHex(value) && value.length === 66);
}
