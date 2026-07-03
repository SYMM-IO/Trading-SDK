import { SymmError } from "@symmio/trading-core";
import {
  BaseError,
  ContractFunctionRevertedError,
  HttpRequestError,
  InsufficientFundsError,
  TransactionExecutionError,
  UserRejectedRequestError,
} from "viem";
import { describe, expect, it } from "vitest";
import { normalizeSymmError } from "./normalize-symm-error";
import { SymmioRequestError } from "./symmio-request-error";

describe("normalizeSymmError", () => {
  it("returns the same instance when already a SymmioRequestError", () => {
    const original = new SymmioRequestError({ kind: "user-rejected", message: "x" });
    expect(normalizeSymmError(original)).toBe(original);
  });

  it("classifies SymmError as kind 'sdk'", () => {
    const err = new SymmError("config", "NO_CHAIN_BOUND", "no chain bound");
    const out = normalizeSymmError(err);
    expect(out.kind).toBe("sdk");
    expect(out.message).toBe("no chain bound");
    expect(out.cause).toBe(err);
  });

  it("classifies a wrapped UserRejectedRequestError as 'user-rejected'", () => {
    const inner = new UserRejectedRequestError(new Error("popup dismissed"));
    const wrapper = new TransactionExecutionError(inner, {
      account: null,
      chain: undefined,
      docsPath: undefined,
    });
    const out = normalizeSymmError(wrapper);
    expect(out.kind).toBe("user-rejected");
  });

  it("classifies a wrapped ContractFunctionRevertedError as 'contract-revert' with reason", () => {
    const inner = new ContractFunctionRevertedError({
      abi: [],
      data: undefined,
      functionName: "editAccountName",
      message: "OwnerOnly()",
    });
    const out = normalizeSymmError(inner);
    expect(out.kind).toBe("contract-revert");
    expect(out.message).toMatch(/revert/i);
  });

  it("classifies InsufficientFundsError as 'insufficient-funds'", () => {
    const err = new InsufficientFundsError({ cause: new BaseError("not enough gas") });
    const out = normalizeSymmError(err);
    expect(out.kind).toBe("insufficient-funds");
  });

  it("classifies HttpRequestError as 'rpc'", () => {
    const err = new HttpRequestError({
      url: "https://rpc.example.com",
      details: "ECONNRESET",
    });
    const out = normalizeSymmError(err);
    expect(out.kind).toBe("rpc");
    expect(out.shortMessage).toBeDefined();
  });

  it("classifies an unrecognized viem BaseError as 'rpc' fallback", () => {
    const err = new BaseError("strange", { docsPath: undefined });
    const out = normalizeSymmError(err);
    expect(out.kind).toBe("rpc");
  });

  it("classifies a plain Error as 'unknown'", () => {
    const out = normalizeSymmError(new Error("kaboom"));
    expect(out.kind).toBe("unknown");
    expect(out.message).toBe("kaboom");
  });

  it("classifies a string throw as 'unknown'", () => {
    const out = normalizeSymmError("oops");
    expect(out.kind).toBe("unknown");
    expect(out.message).toBe("oops");
  });

  it("classifies non-Error, non-string values as 'unknown' with a default message", () => {
    const out = normalizeSymmError({ weird: true });
    expect(out.kind).toBe("unknown");
    expect(out.message).toBe("An unknown error occurred.");
  });
});
