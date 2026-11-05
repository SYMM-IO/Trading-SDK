import { zeroAddress } from "viem";
import { describe, expect, it } from "vitest";
import { resolveTimelockFamilyAccount } from "./root-account";

const ACCOUNT = "0x1111111111111111111111111111111111111111" as const;
const ROOT = "0x2222222222222222222222222222222222222222" as const;

describe("resolveTimelockFamilyAccount", () => {
  it("keeps a root account when no parent mapping exists", () => {
    expect(resolveTimelockFamilyAccount(ACCOUNT, { parentAccount: zeroAddress })).toBe(ACCOUNT);
  });

  it("uses a retained parent mapping even after the virtual account is deleted", () => {
    expect(resolveTimelockFamilyAccount(ACCOUNT, { parentAccount: ROOT })).toBe(ROOT);
  });
});
