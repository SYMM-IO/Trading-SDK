import { encodeFunctionData, getAddress, type Address } from "viem";
import { describe, expect, it } from "vitest";
import { symmioAbi } from "../../symmio-contracts/abi/v0.8.6/symmio";
import { TEST_GASLESS } from "../test/config";
import { FUNDING_ACCOUNT as ACCOUNT } from "../test/funding";
import { batchFeeApprovals } from "./batch-fee-approvals";

const charger = TEST_GASLESS.gaslessLayerAddress;
const other: Address = "0x9999999999999999999999999999999999999999";
const approve = (amount: bigint, approved: Address = charger) => ({
  functionName: "approveOperationalFee",
  args: [[approved], [amount]],
});

describe("batchFeeApprovals", () => {
  it("returns nothing for a batch without fee approvals", () => {
    expect(batchFeeApprovals(ACCOUNT, [{ functionName: "allocate", args: [1n] }], charger).size).toBe(0);
  });

  it("keys the batch account's approval by lowercase address, matching the charger case-insensitively", () => {
    const upperAccount = getAddress(ACCOUNT);
    const approvals = batchFeeApprovals(
      upperAccount,
      [approve(7n, getAddress(charger))],
      charger.toLowerCase() as Address,
    );
    expect([...approvals]).toEqual([[ACCOUNT.toLowerCase(), 7n]]);
  });

  it("reads approvals given as raw calldata", () => {
    const data = encodeFunctionData({ abi: symmioAbi, functionName: "approveOperationalFee", args: [[charger], [9n]] });
    expect(batchFeeApprovals(ACCOUNT, [{ data }], charger).get(ACCOUNT.toLowerCase() as Address)).toBe(9n);
  });

  it("uses the charger's own entry when one approval names several chargers", () => {
    const call = {
      functionName: "approveOperationalFee",
      args: [
        [other, charger],
        [1n, 5n],
      ],
    };
    expect(batchFeeApprovals(ACCOUNT, [call], charger).get(ACCOUNT.toLowerCase() as Address)).toBe(5n);
  });

  it("lets the last approval win", () => {
    expect(
      batchFeeApprovals(ACCOUNT, [approve(100n), approve(3n)], charger).get(ACCOUNT.toLowerCase() as Address),
    ).toBe(3n);
  });

  it("skips GaslessWallet calls, which run as the wallet rather than the account", () => {
    const walletCall = {
      walletCalls: [
        {
          target: other,
          data: encodeFunctionData({ abi: symmioAbi, functionName: "approveOperationalFee", args: [[charger], [50n]] }),
        },
      ],
    };
    const approvals = batchFeeApprovals(ACCOUNT, [walletCall, approve(2n)], charger);
    expect([...approvals]).toEqual([[ACCOUNT.toLowerCase(), 2n]]);
  });

  it("ignores an approval for another charger", () => {
    expect(batchFeeApprovals(ACCOUNT, [approve(100n, other)], charger).size).toBe(0);
  });
});

describe("batchFeeApprovals with an unusual charger address", () => {
  it("does not throw on a charger whose mixed case is not a valid checksum", () => {
    const badChecksum = `0x${charger.slice(2).toUpperCase()}` as Address;
    expect(() => batchFeeApprovals(ACCOUNT, [approve(4n)], badChecksum)).not.toThrow();
    expect(batchFeeApprovals(ACCOUNT, [approve(4n)], badChecksum).get(ACCOUNT.toLowerCase() as Address)).toBe(4n);
  });
});
