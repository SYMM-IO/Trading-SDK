import { toFunctionSelector } from "viem";
import { describe, expect, it } from "vitest";
import { INSTANT_OPEN_TIMELOCK_SELECTORS } from "./policy";

describe("instant-open timelock policy", () => {
  it("derives the exact 22 deployed selectors and excludes AccountLayer._call", () => {
    expect(INSTANT_OPEN_TIMELOCK_SELECTORS).toEqual([
      "0x2e1a7d4d",
      "0x205c2878",
      "0xb48c2317",
      "0x3e7ba166",
      "0x90ca796b",
      "0x5d6d370b",
      "0xd45c30de",
      "0x4760bc29",
      "0xea002a7b",
      "0xe9c236cc",
      "0x527628b5",
      "0x924c2be4",
      "0xe3b6de98",
      "0xcf70cb69",
      "0xa6d66852",
      "0x5ce56265",
      "0xd3462ab4",
      "0x3279017f",
      "0xf083c834",
      "0xaac271ed",
      "0xea534d2a",
      "0x247bca56",
    ]);
    expect(INSTANT_OPEN_TIMELOCK_SELECTORS).not.toContain(toFunctionSelector("_call(address,bytes[])"));
  });
});
