import { encodeFunctionData } from "viem";
import { describe, expect, it } from "vitest";
import { accountLayerAbi } from "../symmio-contracts/abi/v0.8.6/account-layer";
import { matchesScheduledCall } from "./scheduled-call-match";

const ACCOUNT = "0x1111111111111111111111111111111111111111";
const OTHER = "0x2222222222222222222222222222222222222222";
const RAW = "0x12345678";
function wrapped(account: typeof ACCOUNT | typeof OTHER, calls: readonly `0x${string}`[]) {
  return encodeFunctionData({ abi: accountLayerAbi, functionName: "_call", args: [account, calls] });
}

describe("matchesScheduledCall", () => {
  it("accepts the exact direct call", () => expect(matchesScheduledCall(ACCOUNT, RAW, RAW)).toBe(true));
  it("accepts the original account and exact single Core call", () =>
    expect(matchesScheduledCall(ACCOUNT, RAW, wrapped(ACCOUNT, [RAW]))).toBe(true));
  it("rejects an altered account", () => expect(matchesScheduledCall(ACCOUNT, RAW, wrapped(OTHER, [RAW]))).toBe(false));
  it("rejects a batch containing additional operations", () =>
    expect(matchesScheduledCall(ACCOUNT, RAW, wrapped(ACCOUNT, [RAW, RAW]))).toBe(false));
  it("rejects malformed empty calls", () => expect(matchesScheduledCall(ACCOUNT, "0x", "0x")).toBe(false));
});
