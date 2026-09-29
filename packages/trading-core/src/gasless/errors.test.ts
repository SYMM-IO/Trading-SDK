import { describe, expect, it } from "vitest";
import { SymmApiError } from "../shared/errors/symm-error";
import { parseGaslessErrorDetail } from "./errors";

function apiError(responseData: unknown, status = 400): SymmApiError {
  return new SymmApiError({
    code: "GASLESS_RELAY_SUBMIT_FAILED",
    message: "failed",
    status,
    statusText: "Bad Request",
    responseData,
    url: "https://gasless.test",
    method: "POST",
  });
}

describe("parseGaslessErrorDetail", () => {
  it("unwraps the vendor detail envelope with a decoded contract revert", () => {
    const detail = parseGaslessErrorDetail(
      apiError({
        detail: {
          code: "SIMULATION_REVERTED",
          message: "preflight failed",
          details: {
            contract_revert: {
              selector: "0x12345678",
              error: "InvalidWalletOperationTarget",
              signature: "InvalidWalletOperationTarget()",
              arguments: [],
            },
          },
        },
      }),
    );

    expect(detail?.code).toBe("SIMULATION_REVERTED");
    expect(detail?.message).toBe("preflight failed");
    expect(detail?.contractRevert?.error).toBe("InvalidWalletOperationTarget");
  });

  it("understands the flat error_code / error_message record shape", () => {
    const detail = parseGaslessErrorDetail(apiError({ error_code: "INSUFFICIENT_ALLOWANCE", error_message: "nope" }));

    expect(detail?.code).toBe("INSUFFICIENT_ALLOWANCE");
    expect(detail?.message).toBe("nope");
    expect(detail?.contractRevert).toBeNull();
  });

  it("returns null when nothing error-shaped can be extracted", () => {
    expect(parseGaslessErrorDetail(apiError("plain text body"))).toBeNull();
    expect(parseGaslessErrorDetail(new Error("boom"))).toBeNull();
    expect(parseGaslessErrorDetail(undefined)).toBeNull();
    expect(parseGaslessErrorDetail(apiError({ error: 42 }))).toBeNull();
    expect(parseGaslessErrorDetail(apiError({ detail: [] }, 422))).toBeNull();
  });

  it("leaves the gateway and validation fields null for a service error", () => {
    const detail = parseGaslessErrorDetail(
      apiError({ detail: { code: "NOT_FOUND", message: "operation request not found" } }, 404),
    );

    expect(detail).toEqual({
      code: "NOT_FOUND",
      message: "operation request not found",
      details: null,
      contractRevert: null,
      gatewayError: null,
      validationErrors: null,
      revertMessage: null,
      decodedRevert: undefined,
      rpcError: null,
      failedOperation: null,
    });
  });

  it("reads the gateway's own { error } envelope", () => {
    const detail = parseGaslessErrorDetail(
      apiError({ error: "Unknown or disabled protocol instance: does-not-exist" }, 404),
    );

    expect(detail).toEqual({
      code: null,
      message: null,
      details: null,
      contractRevert: null,
      gatewayError: "Unknown or disabled protocol instance: does-not-exist",
      validationErrors: null,
      revertMessage: null,
      decodedRevert: undefined,
      rpcError: null,
      failedOperation: null,
    });
  });

  it("reads a FastAPI 422 detail array into validation issues, without echoing inputs", () => {
    const detail = parseGaslessErrorDetail(
      apiError(
        {
          detail: [
            {
              type: "uuid_parsing",
              loc: ["path", "request_id"],
              msg: "Input should be a valid UUID, invalid character: found `n` at 1",
              input: "not-a-uuid",
              ctx: { error: "invalid character: found `n` at 1" },
            },
            { type: "missing", loc: ["body", "signedOps", 0, "target"], msg: "Field required" },
          ],
        },
        422,
      ),
    );

    expect(detail?.code).toBeNull();
    expect(detail?.gatewayError).toBeNull();
    expect(detail?.validationErrors).toEqual([
      {
        loc: ["path", "request_id"],
        msg: "Input should be a valid UUID, invalid character: found `n` at 1",
        type: "uuid_parsing",
      },
      { loc: ["body", "signedOps", 0, "target"], msg: "Field required", type: "missing" },
    ]);
  });

  it("keeps what it can from malformed validation entries", () => {
    const detail = parseGaslessErrorDetail(
      apiError({ detail: ["bare message", { loc: ["body", null, 2], msg: 7 }, 42] }, 422),
    );

    expect(detail?.validationErrors).toEqual([
      { loc: [], msg: "bare message", type: "" },
      { loc: ["body", 2], msg: "", type: "" },
    ]);
  });
});

describe("parseGaslessErrorDetail through a framework re-wrap", () => {
  /**
   * `@symmio/trading-react` re-wraps `SymmApiError` into its own `Error`
   * subclass that keeps `responseData`. The detail has to survive that hop, or
   * the gateway's decoded revert is unreachable from every hook.
   */
  it("recovers the vendor detail from an error that merely carries responseData", () => {
    class ReWrapped extends Error {
      readonly responseData: unknown;
      constructor(responseData: unknown) {
        super("Request failed with status code 400");
        this.responseData = responseData;
      }
    }

    const detail = parseGaslessErrorDetail(
      new ReWrapped({
        detail: {
          code: "SIMULATION_REVERTED",
          message: "The signed operation could not be executed in gateway simulation.",
          details: {
            contract_revert: {
              selector: "0x08c379a0",
              error: "Error",
              signature: "Error(string)",
              arguments: { message: "OperationalFee: Allowance exceeded" },
              decoded: "Error(message=OperationalFee: Allowance exceeded)",
            },
          },
        },
      }),
    );

    expect(detail?.code).toBe("SIMULATION_REVERTED");
    expect(detail?.contractRevert?.decoded).toBe("Error(message=OperationalFee: Allowance exceeded)");
  });

  it("recovers the gateway envelope and validation issues through the same re-wrap", () => {
    class ReWrapped extends Error {
      readonly responseData: unknown;
      constructor(responseData: unknown) {
        super("Request failed");
        this.responseData = responseData;
      }
    }

    expect(parseGaslessErrorDetail(new ReWrapped({ error: "Rate limit exceeded" }))?.gatewayError).toBe(
      "Rate limit exceeded",
    );
    expect(
      parseGaslessErrorDetail(new ReWrapped({ detail: [{ loc: ["body"], msg: "bad", type: "value_error" }] }))
        ?.validationErrors,
    ).toEqual([{ loc: ["body"], msg: "bad", type: "value_error" }]);
  });
});

describe("parseGaslessErrorDetail diagnostics", () => {
  it("keeps keyed revert arguments instead of dropping them for not being an array", () => {
    const detail = parseGaslessErrorDetail(
      apiError({
        detail: {
          code: "SIMULATION_REVERTED",
          details: {
            contract_revert: {
              selector: "0x08c379a0",
              error: "Error",
              arguments: { message: "OperationalFee: Allowance exceeded" },
            },
          },
        },
      }),
    );

    expect(detail?.contractRevert?.arguments).toEqual({ message: "OperationalFee: Allowance exceeded" });
  });

  it("reads revert_message, decoded_revert and rpc_error from details", () => {
    const detail = parseGaslessErrorDetail(
      apiError({
        detail: {
          code: "CHAIN_EXECUTION_ERROR",
          message: "call failed",
          details: {
            revert_message: "OperationalFee: Insufficient balance",
            decoded_revert: { name: "Error", args: ["OperationalFee: Insufficient balance"] },
            rpc_error: { code: -32000, message: "execution reverted" },
          },
        },
      }),
    );

    expect(detail?.revertMessage).toBe("OperationalFee: Insufficient balance");
    expect(detail?.decodedRevert).toEqual({ name: "Error", args: ["OperationalFee: Insufficient balance"] });
    expect(detail?.rpcError).toEqual({ code: -32000, message: "execution reverted" });
  });

  it("reads the same diagnostics when the vendor puts them directly on detail", () => {
    const detail = parseGaslessErrorDetail(
      apiError({
        detail: {
          code: "SIMULATION_REVERTED",
          revert_message: "OperationalFee: Allowance exceeded",
          rpc_error: { code: 3 },
        },
      }),
    );

    expect(detail?.revertMessage).toBe("OperationalFee: Allowance exceeded");
    expect(detail?.rpcError).toEqual({ code: 3 });
  });

  it("finds the failing batch entry in an explicit failed_operation bag", () => {
    const detail = parseGaslessErrorDetail(
      apiError({
        detail: {
          code: "SIMULATION_REVERTED",
          details: { failed_operation: { index: 2, revert_data: "0x1f2a3b4c" } },
        },
      }),
    );

    expect(detail?.failedOperation).toEqual({ index: 2, revertData: "0x1f2a3b4c" });
  });

  it("finds it in a decoded OperationFailed revert, positional or keyed", () => {
    const positional = parseGaslessErrorDetail(
      apiError({
        detail: {
          code: "SIMULATION_REVERTED",
          details: { contract_revert: { error: "OperationFailed", arguments: [1, "0xdeadbeef"] } },
        },
      }),
    );
    const keyed = parseGaslessErrorDetail(
      apiError({
        detail: {
          code: "SIMULATION_REVERTED",
          details: {
            contract_revert: { error: "OperationFailed", arguments: { operationIndex: "3", revertData: "0xbadc0ffe" } },
          },
        },
      }),
    );

    expect(positional?.failedOperation).toEqual({ index: 1, revertData: "0xdeadbeef" });
    expect(keyed?.failedOperation).toEqual({ index: 3, revertData: "0xbadc0ffe" });
  });

  it("leaves failedOperation null when the revert is not an OperationFailed", () => {
    const detail = parseGaslessErrorDetail(
      apiError({
        detail: {
          code: "SIMULATION_REVERTED",
          details: { contract_revert: { error: "InvalidNonce", arguments: [1] } },
        },
      }),
    );

    expect(detail?.failedOperation).toBeNull();
  });
});
