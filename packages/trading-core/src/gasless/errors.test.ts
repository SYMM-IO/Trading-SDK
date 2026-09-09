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
});
