import { describe, expect, it } from "vitest";
import { generateGaslessIdempotencyKey, resolveGaslessIdempotencyKey } from "./idempotency-key";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("generateGaslessIdempotencyKey", () => {
  it("creates a fresh random UUID for every user action", () => {
    const first = generateGaslessIdempotencyKey();

    expect(first).toMatch(UUID_V4);
    expect(generateGaslessIdempotencyKey()).not.toBe(first);
  });
});

describe("resolveGaslessIdempotencyKey", () => {
  it("generates a key when the caller passed none", () => {
    expect(resolveGaslessIdempotencyKey()).toMatch(UUID_V4);
  });

  it("returns the caller's key unchanged, including a readable prefix", () => {
    const key = `create-subaccount:${generateGaslessIdempotencyKey()}`;
    expect(resolveGaslessIdempotencyKey(key)).toBe(key);
    expect(resolveGaslessIdempotencyKey("k".repeat(128))).toBe("k".repeat(128));
  });

  it.each([
    { label: "an empty key", key: "" },
    { label: "a blank key", key: "   " },
    { label: "a key longer than 128 characters", key: "k".repeat(129) },
  ])("rejects $label before anything is signed", ({ key }) => {
    expect(() => resolveGaslessIdempotencyKey(key)).toThrow(
      expect.objectContaining({ code: "GASLESS_IDEMPOTENCY_KEY_INVALID" }),
    );
  });
});
