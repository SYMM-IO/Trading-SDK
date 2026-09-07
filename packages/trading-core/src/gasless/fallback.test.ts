import { describe, expect, it } from "vitest";
import { SymmApiError } from "../shared/errors/symm-error";
import { isConfirmedGaslessFeeLimitError, isConfirmedGaslessUnavailableError } from "./fallback";

function apiError(status: number, responseData?: unknown): SymmApiError {
  return new SymmApiError({
    code: "GASLESS_RELAY_SUBMIT_FAILED",
    message: "failed",
    status,
    statusText: "err",
    responseData,
    url: "https://gasless.test",
    method: "POST",
  });
}

describe("isConfirmedGaslessFeeLimitError", () => {
  it("confirms a 409 with a fee-limit vendor code", () => {
    const err = apiError(409, { detail: { code: "FEE_POLICY_WOULD_REVERT", message: "quota" } });
    expect(isConfirmedGaslessFeeLimitError(err)).toBe(true);
  });

  it("confirms a rejected workflow record carrying a fee-limit code", () => {
    const err = apiError(200, { status: "rejected", error_code: "INSUFFICIENT_ALLOWANCE" });
    expect(isConfirmedGaslessFeeLimitError(err)).toBe(true);
  });

  it("rejects a fee-limit code on an ambiguous transport failure", () => {
    const err = apiError(500, { detail: { code: "FEE_POLICY_WOULD_REVERT" } });
    expect(isConfirmedGaslessFeeLimitError(err)).toBe(false);
  });

  it("rejects unrelated codes and non-errors", () => {
    expect(isConfirmedGaslessFeeLimitError(apiError(409, { detail: { code: "SIMULATION_REVERTED" } }))).toBe(false);
    expect(isConfirmedGaslessFeeLimitError(new Error("boom"))).toBe(false);
  });
});

describe("isConfirmedGaslessUnavailableError", () => {
  it("confirms pre-acceptance 404 / 502 / 503", () => {
    expect(isConfirmedGaslessUnavailableError(apiError(404))).toBe(true);
    expect(isConfirmedGaslessUnavailableError(apiError(502))).toBe(true);
    expect(isConfirmedGaslessUnavailableError(apiError(503))).toBe(true);
  });

  it("rejects everything else — timeouts and 5xx are ambiguous", () => {
    expect(isConfirmedGaslessUnavailableError(apiError(500))).toBe(false);
    expect(isConfirmedGaslessUnavailableError(apiError(0))).toBe(false);
    expect(isConfirmedGaslessUnavailableError(new Error("timeout"))).toBe(false);
  });
});
