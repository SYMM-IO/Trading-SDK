import { describe, expect, it } from "vitest";
import { SymmApiError, SymmError } from "../shared/errors/symm-error";
import { GASLESS_TEST_CHAIN } from "./test/config";
import {
  GASLESS_SUBMIT_UNCONFIRMED_CODE,
  getGaslessUnconfirmedSubmit,
  isGaslessIdempotencyConflictError,
  type GaslessUnconfirmedSubmit,
} from "./unconfirmed-submit";

const SUBMIT: GaslessUnconfirmedSubmit = {
  chainId: GASLESS_TEST_CHAIN,
  service: "operations",
  path: "/gateway/relay-instant",
  body: { idempotencyKey: "key-1", signatures: ["0xabc"] },
  idempotencyKey: "key-1",
};

function unconfirmed(responseData: unknown): SymmApiError {
  return new SymmApiError({
    code: GASLESS_SUBMIT_UNCONFIRMED_CODE,
    message: "unconfirmed",
    status: 0,
    statusText: "",
    responseData,
    url: "https://gasless.test/gateway/relay-instant",
    method: "POST",
  });
}

describe("getGaslessUnconfirmedSubmit", () => {
  it("returns the replayable submit, body included", () => {
    expect(getGaslessUnconfirmedSubmit(unconfirmed(SUBMIT))).toEqual(SUBMIT);
  });

  it("reads it through a framework layer's re-wrapped error", () => {
    const rewrapped = Object.assign(new Error("unconfirmed"), {
      code: GASLESS_SUBMIT_UNCONFIRMED_CODE,
      status: 0,
      responseData: SUBMIT,
    });

    expect(getGaslessUnconfirmedSubmit(rewrapped)).toEqual(SUBMIT);
  });

  it("returns null for any other error", () => {
    expect(getGaslessUnconfirmedSubmit(new SymmError("api", "GASLESS_RELAY_SUBMIT_FAILED", "nope"))).toBeNull();
    expect(getGaslessUnconfirmedSubmit(new Error("boom"))).toBeNull();
    expect(getGaslessUnconfirmedSubmit(undefined)).toBeNull();
  });

  it("returns null for a record that is not a submit this SDK produced", () => {
    expect(getGaslessUnconfirmedSubmit(unconfirmed({ ...SUBMIT, path: "/gateway/whatever" }))).toBeNull();
    expect(getGaslessUnconfirmedSubmit(unconfirmed({ ...SUBMIT, service: "pools" }))).toBeNull();
    expect(getGaslessUnconfirmedSubmit(unconfirmed({ ...SUBMIT, chainId: String(GASLESS_TEST_CHAIN) }))).toBeNull();
    expect(getGaslessUnconfirmedSubmit(unconfirmed({ ...SUBMIT, idempotencyKey: "" }))).toBeNull();
    expect(getGaslessUnconfirmedSubmit(unconfirmed("not a record"))).toBeNull();
  });

  it("accepts a submit whose body is absent — the record is still the handle on it", () => {
    expect(getGaslessUnconfirmedSubmit(unconfirmed({ ...SUBMIT, body: undefined }))?.body).toBeUndefined();
  });
});

describe("isGaslessIdempotencyConflictError", () => {
  function conflict(status: number): SymmApiError {
    return new SymmApiError({
      code: "GASLESS_RELAY_SUBMIT_FAILED",
      message: "conflict",
      status,
      statusText: "Conflict",
      responseData: { detail: { code: "IDEMPOTENCY_KEY_CONFLICT", message: "key already used" } },
      url: "https://gasless.test",
      method: "POST",
    });
  }

  it("matches the vendor's 409", () => {
    expect(isGaslessIdempotencyConflictError(conflict(409))).toBe(true);
  });

  it("matches through a framework layer's re-wrapped error", () => {
    const rewrapped = Object.assign(new Error("conflict"), {
      code: "GASLESS_RELAY_SUBMIT_FAILED",
      status: 409,
      responseData: { detail: { code: "IDEMPOTENCY_KEY_CONFLICT" } },
    });

    expect(isGaslessIdempotencyConflictError(rewrapped)).toBe(true);
  });

  it("refuses the code on another status, and any other failure", () => {
    expect(isGaslessIdempotencyConflictError(conflict(400))).toBe(false);
    expect(isGaslessIdempotencyConflictError(unconfirmed(SUBMIT))).toBe(false);
    expect(isGaslessIdempotencyConflictError(new Error("boom"))).toBe(false);
  });
});
