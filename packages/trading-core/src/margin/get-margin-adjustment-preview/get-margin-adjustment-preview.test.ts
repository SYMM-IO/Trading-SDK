import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createConfig } from "../../core/config";
import { rawFeeQuote } from "../../gasless/test/fee-quote";
import { PositionType } from "../../symmio-contracts/symmio/types";
import { getMarginAdjustmentPreview, type GetMarginAdjustmentPreviewParameters } from "./get-margin-adjustment-preview";

const mocked = vi.hoisted(() => ({ muon: vi.fn(), symbols: vi.fn() }));
vi.mock("../../muon/deallocate-upnl-sig", () => ({ getDeallocateUpnlSig: mocked.muon }));
vi.mock("../../solvers/symbols/get-symbols", () => ({ getSymbols: mocked.symbols }));
const owner = "0x1111111111111111111111111111111111111111";
const sub = "0x2222222222222222222222222222222222222222";
const va = "0x3333333333333333333333333333333333333333";
const W = 10n ** 18n;
const balance = {
  allocatedBalance: 100n * W,
  lockedCVA: 5n * W,
  lockedLF: 5n * W,
  lockedPartyAMM: 10n * W,
  lockedPartyBMM: 0n,
  pendingLockedCVA: W,
  pendingLockedLF: W,
  pendingLockedPartyAMM: W,
  pendingLockedPartyBMM: 0n,
};
const sig = {
  reqId: "0x",
  timestamp: 1n,
  upnl: 0n,
  gatewaySignature: "0x",
  sigs: { signature: 1n, owner, nonce: owner },
};

function setup() {
  const readContract = vi.fn(async ({ functionName }: { functionName: string }) => {
    switch (functionName) {
      case "getSubAccount":
        return { owner, isExists: true, symmioCore: owner };
      case "getVirtualAccount":
        return {
          accountAddress: va,
          parentAccount: sub,
          symbolId: 1n,
          isolationType: 2,
          metadata: "0x",
          isExists: true,
        };
      case "balanceInfoOfPartyA":
        return [
          balance.allocatedBalance,
          balance.lockedCVA,
          balance.lockedLF,
          balance.lockedPartyAMM,
          balance.lockedPartyBMM,
          balance.pendingLockedCVA,
          balance.pendingLockedLF,
          balance.pendingLockedPartyAMM,
          balance.pendingLockedPartyBMM,
        ];
      case "balanceOf":
        return 500n * W;
      case "getPartyAOpenPositions":
        return [
          {
            id: 1n,
            partyA: va,
            symbolId: 1n,
            quantity: W,
            closedAmount: 0n,
            openedPrice: 100n * W,
            positionType: PositionType.LONG,
          },
        ];
      case "getFeeForUser":
        return { openFee: 0n, closeFee: W / 100n, isSet: true };
      case "getQuoteFundingDebts":
        return [2n * W];
      case "isPartyALiquidated":
        return false;
      case "previewFeeQuote":
        return rawFeeQuote(sub);
      default:
        throw new Error(`Unexpected read ${functionName}`);
    }
  });
  const simulateContract = vi.fn(async () => ({ request: {}, result: undefined }));
  const config = createConfig({
    defaultChainId: 42161,
    getClient: () => ({ readContract, simulateContract }) as unknown as PublicClient,
    symmioConfig: { 42161: { addresses: { affiliatesAddress: owner, symmioAddress: owner } } },
  });
  const parameters: GetMarginAdjustmentPreviewParameters = {
    chainId: 42161,
    owner,
    signer: owner,
    subAccount: sub,
    virtualAccount: va,
    direction: "remove",
    amount: W,
    mark: { price: 100n * W, updatedAt: Date.now() },
    maxPriceAgeMs: 30_000,
    closeFeeReserveBufferBps: 10,
  };
  return { config, readContract, simulateContract, parameters };
}

describe("margin adjustment preview", () => {
  beforeEach(() => {
    mocked.muon.mockResolvedValue(sig);
    mocked.symbols.mockResolvedValue([{ symbolId: 1, hedgerFeeClose: "0.01" }]);
  });
  it("deducts funding and pending locks once, reserves 10bps, and simulates as owner", async () => {
    const { config, parameters, simulateContract } = setup();
    const result = await getMarginAdjustmentPreview(config, parameters);
    expect(result.closeFeeReserve).toBe(2_002_000_000_000_000_000n);
    expect(result.maxRemovable).toBe(72_998_000_000_000_000_000n);
    expect(result.currentMargin).toBe(100n * W);
    expect(result.resultingMargin).toBe(99n * W);
    expect(result.simulation).toBe("success");
    expect(simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({ account: owner, functionName: "removeMargin", args: [va, W, sig] }),
    );
  });
  it("does not simulate zero or an out-of-bounds amount", async () => {
    const { config, parameters, simulateContract } = setup();
    expect((await getMarginAdjustmentPreview(config, { ...parameters, amount: 0n })).simulation).toBe("not-requested");
    expect((await getMarginAdjustmentPreview(config, { ...parameters, amount: 100n * W })).simulation).toBe(
      "out-of-bounds",
    );
    expect(simulateContract).not.toHaveBeenCalled();
  });
  it("does not turn simulation or fee failures into usable figures", async () => {
    const { config, parameters, simulateContract } = setup();
    simulateContract.mockRejectedValue(new Error("simulation reverted"));
    await expect(getMarginAdjustmentPreview(config, parameters)).rejects.toThrow("simulation reverted");
    mocked.symbols.mockRejectedValueOnce(new Error("fee unavailable"));
    await expect(getMarginAdjustmentPreview(config, parameters)).rejects.toThrow("fee unavailable");
  });
  it("rejects owner changes before financial reads and rejects stale marks", async () => {
    const { config, parameters, readContract, simulateContract } = setup();
    await expect(getMarginAdjustmentPreview(config, { ...parameters, owner: va })).rejects.toThrow("ownership");
    expect(readContract).toHaveBeenCalledTimes(2);
    await expect(
      getMarginAdjustmentPreview(config, { ...parameters, mark: { price: W, updatedAt: 0 } }),
    ).rejects.toThrow("fresh mark");
    expect(simulateContract).not.toHaveBeenCalled();
  });
  it("rejects a subaccount bound to another diamond on the same chain", async () => {
    const { config, parameters, readContract, simulateContract } = setup();
    const original = readContract.getMockImplementation()!;
    readContract.mockImplementation(async (call) =>
      call.functionName === "getSubAccount" ? { owner, isExists: true, symmioCore: va } : original(call),
    );
    await expect(getMarginAdjustmentPreview(config, parameters)).rejects.toThrow("deployment");
    expect(readContract).toHaveBeenCalledTimes(2);
    expect(simulateContract).not.toHaveBeenCalled();
  });
  it.each([
    [10n, 68n],
    [-10n, 68n],
    [-35n, 53n],
    [80n, 68n],
    [-150n, 0n],
  ])("preserves the conservative modal limit at signed uPnL %s", async (upnl, expected) => {
    const { config, parameters, readContract } = setup();
    const original = readContract.getMockImplementation()!;
    readContract.mockImplementation(async (call) =>
      call.functionName === "balanceInfoOfPartyA"
        ? [100n * W, 5n * W, 3n * W, 20n * W, 0n, 4n * W, 0n, 0n, 0n]
        : call.functionName === "getQuoteFundingDebts"
          ? [0n]
          : call.functionName === "getFeeForUser"
            ? { closeFee: 0n, openFee: 0n, isSet: true }
            : original(call),
    );
    mocked.muon.mockResolvedValue({ ...sig, upnl: upnl * W });
    mocked.symbols.mockResolvedValue([{ symbolId: 1, hedgerFeeClose: "0" }]);
    const result = await getMarginAdjustmentPreview(config, { ...parameters, amount: 0n });
    expect(result.maxRemovable).toBe(expected * W);
  });
});

it("rejects a VA with a different parent and missing funding rows", async () => {
  const { config, parameters, readContract } = setup();
  await expect(getMarginAdjustmentPreview(config, { ...parameters, subAccount: owner })).rejects.toThrow("ownership");
  const original = readContract.getMockImplementation()!;
  readContract.mockImplementation(async (call) => (call.functionName === "getQuoteFundingDebts" ? [] : original(call)));
  await expect(getMarginAdjustmentPreview(config, parameters)).rejects.toThrow("Funding snapshot is incomplete");
});
it("does not subtract funding again from the Muon loss branch", async () => {
  const { config, parameters } = setup();
  mocked.muon.mockResolvedValue({ ...sig, upnl: -80n * W });
  const result = await getMarginAdjustmentPreview(config, { ...parameters, amount: 0n });
  expect(result.maxRemovable).toBe(7n * W - result.closeFeeReserve);
});
