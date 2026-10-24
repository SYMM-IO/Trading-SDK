import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { toAddressOrNull, toBigIntOrNull, toBigIntOrZero, toNumberOrNull } from "./subgraph-decode";

describe("subgraph decoders", () => {
  it("keep a missing value missing", () => {
    expect(toBigIntOrNull(null)).toBeNull();
    expect(toBigIntOrNull("")).toBeNull();
    expect(toNumberOrNull(undefined)).toBeNull();
    expect(toAddressOrNull(null)).toBeNull();
  });

  it("decode present values, signed ones included", () => {
    expect(toBigIntOrNull("-15")).toBe(-15n);
    expect(toBigIntOrZero(null)).toBe(0n);
    expect(toNumberOrNull("1782000000")).toBe(1782000000);
    expect(toAddressOrNull("0xf55534bbf9011ca7ad84b804fda9e7f4be18fe8a")).toBe(
      getAddress("0xf55534bbf9011ca7ad84b804fda9e7f4be18fe8a"),
    );
  });
});
