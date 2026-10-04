import { encodeErrorResult } from "viem";
import { describe, expect, it } from "vitest";
import { SymmApiError, SymmError } from "../shared/errors/symm-error";
import { instantLayerAbi } from "../symmio-contracts/abi/v0.8.6/instant-layer";
import { classifyGaslessFailure, decodeGaslessOperationFailure } from "./classify-gasless-failure";
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

/** A vendor `400 SIMULATION_REVERTED` whose detail carries `revert_message`. */
function reverted(revertMessage: string): SymmApiError {
  return apiError(400, { detail: { code: "SIMULATION_REVERTED", details: { revert_message: revertMessage } } });
}

const UNCONFIRMED: GaslessUnconfirmedSubmit = {
  chainId: GASLESS_TEST_CHAIN,
  service: "operations",
  path: "/gateway/relay-instant",
  body: {},
  idempotencyKey: "key-1",
};

/** The real inner revert of a failing batch entry, encoded as the node would. */
const INNER_REVERT = encodeErrorResult({
  abi: instantLayerAbi,
  errorName: "InvalidNonce",
  args: ["0x1111111111111111111111111111111111111111", 7n, 9n],
});

describe("classifyGaslessFailure", () => {
  it.each([
    {
      label: "an unconfirmed submit",
      err: apiError(0, UNCONFIRMED, GASLESS_SUBMIT_UNCONFIRMED_CODE),
      expected: "submit-unconfirmed",
    },
    {
      label: "an idempotency conflict",
      err: apiError(409, { detail: { code: "IDEMPOTENCY_KEY_CONFLICT" } }),
      expected: "idempotency-conflict",
    },
    {
      label: "a payer balance shortfall",
      err: reverted("OperationalFee: Insufficient balance"),
      expected: "payer-balance",
    },
    { label: "an allowance shortfall", err: reverted("OperationalFee: Allowance exceeded"), expected: "fee-allowance" },
    { label: "an exhausted free quota", err: reverted("DailyFreeOpsLimitExceeded(0x11, 5)"), expected: "free-quota" },
    { label: "a fee cap", err: reverted("FeeLimitExceeded(10, 5)"), expected: "fee-limit" },
    { label: "a stale signature", err: reverted("DeadlineExpired(1726000000)"), expected: "nonce-or-deadline" },
    {
      label: "a deposit below minimum",
      err: reverted("DepositAmountBelowMinimum(1, 2)"),
      expected: "deposit-below-minimum",
    },
    {
      label: "a deposit that does not cover the fees",
      err: reverted("DepositAmountNotAboveFees(1, 2)"),
      expected: "deposit-not-above-fees",
    },
    {
      label: "the vendor's allowance code with no revert text",
      err: apiError(400, { detail: { code: "INSUFFICIENT_ALLOWANCE" } }),
      expected: "fee-allowance",
    },
    { label: "a 422", err: apiError(422, { detail: [] }), expected: "client-schema" },
    { label: "a 429", err: apiError(429, { error: "Rate limit exceeded" }), expected: "rate-limited" },
    { label: "a 401", err: apiError(401, { error: "Missing API key" }), expected: "unauthorized" },
    { label: "a 403", err: apiError(403, { error: "Forbidden" }), expected: "forbidden" },
    {
      label: "a gateway 404",
      err: apiError(404, { error: "Unknown or disabled protocol instance: x" }),
      expected: "unknown-instance",
    },
    { label: "a gateway 503", err: apiError(503, { error: "not ready" }), expected: "gateway-unavailable" },
    {
      label: "an unexplained simulation revert",
      err: apiError(400, { detail: { code: "SIMULATION_REVERTED", message: "reverted" } }),
      expected: "simulation-reverted",
    },
    { label: "anything else", err: new Error("boom"), expected: "unknown" },
  ])("classifies $label as $expected", ({ err, expected }) => {
    expect(classifyGaslessFailure(err)).toBe(expected);
  });

  it("classifies a failing batch entry ahead of the generic simulation message", () => {
    const err = apiError(400, {
      detail: {
        code: "SIMULATION_REVERTED",
        message: "The signed operation could not be executed in gateway simulation.",
        details: { failed_operation: { index: 1, revert_data: INNER_REVERT } },
      },
    });

    expect(classifyGaslessFailure(err)).toBe("failed-operation");
  });

  it("classifies the SDK's own free-quota error, which carries no vendor detail", () => {
    const err = new SymmError("api", "GASLESS_FREE_QUOTA_EXHAUSTED", "quota spent");

    expect(classifyGaslessFailure(err)).toBe("free-quota");
  });

  it("classifies through a framework layer's re-wrapped error", () => {
    const rewrapped = Object.assign(new Error("Request failed with status code 400"), {
      code: "GASLESS_RELAY_SUBMIT_FAILED",
      status: 400,
      responseData: {
        detail: { code: "SIMULATION_REVERTED", details: { revert_message: "OperationalFee: Allowance exceeded" } },
      },
    });

    expect(classifyGaslessFailure(rewrapped)).toBe("fee-allowance");
  });
});

describe("decodeGaslessOperationFailure", () => {
  it("names the failing entry and decodes its inner revert", () => {
    const err = apiError(400, {
      detail: {
        code: "SIMULATION_REVERTED",
        details: { contract_revert: { error: "OperationFailed", arguments: [1, INNER_REVERT] } },
      },
    });

    const failure = decodeGaslessOperationFailure(err, instantLayerAbi);

    expect(failure?.index).toBe(1);
    expect(failure?.revertData).toBe(INNER_REVERT);
    expect(failure?.decoded?.errorName).toBe("InvalidNonce");
  });

  it("keeps the index when the ABI does not describe the inner revert", () => {
    const err = apiError(400, {
      detail: { code: "SIMULATION_REVERTED", details: { failed_operation: { index: 0, revert_data: "0xdeadbeef" } } },
    });

    const failure = decodeGaslessOperationFailure(err, instantLayerAbi);

    expect(failure).toEqual({ index: 0, revertData: "0xdeadbeef", decoded: null });
  });

  it("returns null when the failure was not an OperationFailed", () => {
    expect(decodeGaslessOperationFailure(reverted("DeadlineExpired(1)"), instantLayerAbi)).toBeNull();
    expect(decodeGaslessOperationFailure(new Error("boom"), instantLayerAbi)).toBeNull();
  });
});
