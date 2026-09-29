import { describe, expect, it } from "vitest";
import { SymmApiError } from "../shared/errors/symm-error";
import { isConfirmedGaslessFeeLimitError, isConfirmedGaslessUnavailableError } from "./fallback";
import { GASLESS_TEST_CHAIN } from "./test/config";
import { GASLESS_SUBMIT_UNCONFIRMED_CODE, type GaslessUnconfirmedSubmit } from "./unconfirmed-submit";

function apiError(status: number, responseData?: unknown, code = "GASLESS_RELAY_SUBMIT_FAILED"): SymmApiError {
  return new SymmApiError({
    code,
    message: "failed",
    status,
    statusText: "err",
    responseData,
    url: "https://gasless.test",
    method: "POST",
  });
}

/** The gateway's own envelope, which is what separates its 503 from an upstream one. */
const GATEWAY_ENVELOPE = { error: "Gateway configuration not ready" };

const UNCONFIRMED: GaslessUnconfirmedSubmit = {
  chainId: GASLESS_TEST_CHAIN,
  service: "operations",
  path: "/gateway/relay-instant",
  body: { idempotencyKey: "key-1" },
  idempotencyKey: "key-1",
};

describe("isConfirmedGaslessFeeLimitError", () => {
  it.each([409, 400, 402, 422])("confirms a fee code on a pre-acceptance %i", (status) => {
    expect(isConfirmedGaslessFeeLimitError(apiError(status, { detail: { code: "FEE_POLICY_WOULD_REVERT" } }))).toBe(
      true,
    );
  });

  it("confirms a 400 SIMULATION_REVERTED whose revert is billing-specific", () => {
    const balance = apiError(400, {
      detail: {
        code: "SIMULATION_REVERTED",
        message: "simulation reverted",
        details: { revert_message: "OperationalFee: Insufficient balance" },
      },
    });
    const quota = apiError(400, {
      detail: { code: "SIMULATION_REVERTED", details: { contract_revert: { error: "DailyFreeOpsLimitExceeded" } } },
    });

    expect(isConfirmedGaslessFeeLimitError(balance)).toBe(true);
    expect(isConfirmedGaslessFeeLimitError(quota)).toBe(true);
  });

  it("refuses a 400 SIMULATION_REVERTED whose revert is the operation's own", () => {
    const err = apiError(400, {
      detail: { code: "SIMULATION_REVERTED", details: { contract_revert: { error: "InvalidWalletOperationTarget" } } },
    });

    expect(isConfirmedGaslessFeeLimitError(err)).toBe(false);
  });

  it("confirms a rejected workflow record carrying a fee-limit code", () => {
    expect(
      isConfirmedGaslessFeeLimitError(apiError(200, { status: "rejected", error_code: "INSUFFICIENT_ALLOWANCE" })),
    ).toBe(true);
  });

  it("refuses a rejected record whose cause is not billing — a wallet retry would revert the same way", () => {
    expect(
      isConfirmedGaslessFeeLimitError(apiError(200, { status: "rejected", error_code: "SIMULATION_REVERTED" })),
    ).toBe(false);
  });

  it("refuses a fee code on an ambiguous transport failure", () => {
    expect(isConfirmedGaslessFeeLimitError(apiError(500, { detail: { code: "FEE_POLICY_WOULD_REVERT" } }))).toBe(false);
    expect(isConfirmedGaslessFeeLimitError(apiError(0, { detail: { code: "FEE_POLICY_WOULD_REVERT" } }))).toBe(false);
  });

  it("refuses an unconfirmed submit, whatever its last status was", () => {
    const err = apiError(503, UNCONFIRMED, GASLESS_SUBMIT_UNCONFIRMED_CODE);

    expect(isConfirmedGaslessFeeLimitError(err)).toBe(false);
  });

  it("refuses unrelated codes and non-errors", () => {
    expect(isConfirmedGaslessFeeLimitError(apiError(409, { detail: { code: "IDEMPOTENCY_KEY_CONFLICT" } }))).toBe(
      false,
    );
    expect(isConfirmedGaslessFeeLimitError(new Error("boom"))).toBe(false);
  });
});

describe("isConfirmedGaslessUnavailableError", () => {
  it("confirms a 429 and a 503 that carries the gateway envelope", () => {
    expect(isConfirmedGaslessUnavailableError(apiError(429, { error: "Rate limit exceeded" }))).toBe(true);
    expect(isConfirmedGaslessUnavailableError(apiError(503, GATEWAY_ENVELOPE))).toBe(true);
  });

  /**
   * The double-execution hole: every one of these may have reached the service
   * and been accepted, so a wallet-paid retry of the same intent would execute
   * it twice.
   */
  it.each([
    { label: "a network failure or timeout", err: apiError(0) },
    { label: "a 502", err: apiError(502, "error code: 502") },
    { label: "a 504", err: apiError(504) },
    { label: "a 500", err: apiError(500) },
    { label: "a 503 without the gateway envelope", err: apiError(503) },
  ])("refuses $label", ({ err }) => {
    expect(isConfirmedGaslessUnavailableError(err)).toBe(false);
  });

  it("refuses a gateway 404 — an unknown instance is a config error, not an outage", () => {
    expect(
      isConfirmedGaslessUnavailableError(apiError(404, { error: "Unknown or disabled protocol instance: x" })),
    ).toBe(false);
  });

  it("refuses an unconfirmed submit and anything without a status", () => {
    expect(isConfirmedGaslessUnavailableError(apiError(429, UNCONFIRMED, GASLESS_SUBMIT_UNCONFIRMED_CODE))).toBe(false);
    expect(isConfirmedGaslessUnavailableError(new Error("timeout"))).toBe(false);
  });

  it("classifies the same way through a framework layer's re-wrapped error", () => {
    /** Structurally what `@symmio/trading-react`'s `SymmioRequestError` carries. */
    const rewrapped = Object.assign(new Error("Request failed with status code 429"), {
      code: "GASLESS_RELAY_SUBMIT_FAILED",
      status: 429,
      responseData: { error: "Rate limit exceeded" },
    });

    expect(isConfirmedGaslessUnavailableError(rewrapped)).toBe(true);
  });
});
