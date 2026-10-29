import { SymmError } from "../shared/errors/symm-error";

/** The longest idempotency key the GaslessQ service accepts. */
const GASLESS_IDEMPOTENCY_KEY_MAX_LENGTH = 128;

/**
 * Create a key for one user action: a random UUID (122 random bits).
 *
 * You may put your own readable label in front (`${flow}:${key}`), keeping the
 * total at most 128 characters. Never build a key only from the action's
 * inputs, never reuse one for another action, and never put secrets or personal
 * data in it: the service stores the key and returns it in status responses.
 * Keys are global to the deployment, so a key must be unique across all users;
 * a random UUID is.
 *
 * @returns A new random key.
 *
 * @example
 * ```ts
 * import { generateGaslessIdempotencyKey } from "@symmio/trading-core";
 *
 * const key = `create-subaccount:${generateGaslessIdempotencyKey()}`;
 * ```
 */
export function generateGaslessIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * The key a gasless submit is sent under: the caller's own key, validated, or a
 * new one. Every submit entry point calls it before any prompt, so an invalid
 * key never costs a signature.
 *
 * @param key - The caller's key, when it passed one.
 * @returns The key to send.
 * @throws {SymmError} `GASLESS_IDEMPOTENCY_KEY_INVALID` when the key is blank or longer than 128 characters.
 *
 * @internal
 */
export function resolveGaslessIdempotencyKey(key?: string): string {
  if (key === undefined) return generateGaslessIdempotencyKey();
  if (typeof key !== "string" || key.trim().length === 0 || key.length > GASLESS_IDEMPOTENCY_KEY_MAX_LENGTH) {
    throw new SymmError(
      "validation",
      "GASLESS_IDEMPOTENCY_KEY_INVALID",
      `Gasless: an idempotency key must be 1–${GASLESS_IDEMPOTENCY_KEY_MAX_LENGTH} non-blank characters. Create one per user action with generateGaslessIdempotencyKey().`,
    );
  }
  return key;
}
