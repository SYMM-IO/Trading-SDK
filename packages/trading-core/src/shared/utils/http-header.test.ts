import { AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { readHttpHeader } from "./http-header";

describe("readHttpHeader", () => {
  it("reads a header from a plain object regardless of casing", () => {
    expect(readHttpHeader({ "Retry-After": "5" }, "retry-after")).toBe("5");
    expect(readHttpHeader({ "retry-after": "5" }, "Retry-After")).toBe("5");
  });

  it("reads a header from an AxiosHeaders instance", () => {
    const headers = AxiosHeaders.from("Retry-After: 7\r\nX-GasLessQ-Protocol-Instance: arbitrum-42161-test");

    expect(readHttpHeader(headers, "retry-after")).toBe("7");
    expect(readHttpHeader(headers, "x-gaslessq-protocol-instance")).toBe("arbitrum-42161-test");
  });

  it("takes the first value of a repeated header and stringifies a finite number", () => {
    expect(readHttpHeader({ "retry-after": ["3", "9"] }, "retry-after")).toBe("3");
    expect(readHttpHeader({ "retry-after": 12 }, "retry-after")).toBe("12");
  });

  it("returns undefined for an absent header, an unusable value, or no headers at all", () => {
    expect(readHttpHeader({ other: "1" }, "retry-after")).toBeUndefined();
    expect(readHttpHeader({ "retry-after": { nested: true } }, "retry-after")).toBeUndefined();
    expect(readHttpHeader({ "retry-after": Number.NaN }, "retry-after")).toBeUndefined();
    expect(readHttpHeader(undefined, "retry-after")).toBeUndefined();
    expect(readHttpHeader("retry-after: 5", "retry-after")).toBeUndefined();
  });
});
