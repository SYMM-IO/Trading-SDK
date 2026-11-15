import { decodeFunctionData, encodeFunctionData, zeroAddress, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import { accountLayerAbi } from "../../symmio-contracts/abi/v0.8.6/account-layer";
import { gaslessLayerAbi } from "../../symmio-contracts/abi/v0.8.6/gasless-layer";
import { GASLESS_TEST_CHAIN } from "../test/config";
import { FUNDING_ACCOUNT as ACCOUNT, FUNDING_VA as VA, fundingQuote, fundingTestConfig } from "../test/funding";
import { getGaslessMarginFunding } from "./get-gasless-margin-funding";

function input(amount18 = 100n, direction: "add" | "remove" = "add") {
  return {
    chainId: GASLESS_TEST_CHAIN,
    account: ACCOUNT,
    parentAccount: ACCOUNT,
    virtualAccount: VA,
    direction,
    amount18,
    calls: [
      direction === "add"
        ? { functionName: "addMargin", args: [VA, amount18] }
        : {
            functionName: "removeMargin",
            args: [
              VA,
              amount18,
              {
                reqId: "0x",
                timestamp: 0n,
                upnl: 0n,
                gatewaySignature: "0x",
                sigs: { signature: 0n, owner: zeroAddress, nonce: zeroAddress },
              },
            ],
          },
    ],
  };
}

describe("getGaslessMarginFunding", () => {
  it("reserves the parent fee after adding margin and returns an exact-unit Max", async () => {
    const { config } = fundingTestConfig();
    const result = await getGaslessMarginFunding(config, input());
    expect(result.hasSufficientBalance).toBe(false);
    expect(result.payers[0]).toMatchObject({ payer: ACCOUNT, projectedBalance18: 0n, shortfall18: 5n });
    expect(result.maxAddAmount18).toBe(95n);
    expect((await getGaslessMarginFunding(config, input(95n))).hasSufficientBalance).toBe(true);
  });

  it("includes allocated funding without promising more than the parent's free balance", async () => {
    const { config } = fundingTestConfig(fundingQuote(), { [ACCOUNT]: { free: 100n, allocated: 10n } });
    const result = await getGaslessMarginFunding(config, input(106n));
    expect(result.hasSufficientBalance).toBe(false);
    expect(result.maxAddAmount18).toBe(100n);
  });

  it("clamps the fee-safe Max to zero and retains bigint precision", async () => {
    const poor = fundingTestConfig(fundingQuote(), { [ACCOUNT]: { free: 4n, allocated: 0n } });
    expect((await getGaslessMarginFunding(poor.config, input(4n))).maxAddAmount18).toBe(0n);
    const huge = 100000000000000000000001n;
    const rich = fundingTestConfig(fundingQuote(), { [ACCOUNT]: { free: huge, allocated: 0n } });
    expect((await getGaslessMarginFunding(rich.config, input(huge))).maxAddAmount18).toBe(huge - 5n);
  });

  it("credits the virtual account on add when the quote names it as payer", async () => {
    const row = fundingQuote().payments[0]!;
    const { config } = fundingTestConfig(fundingQuote([{ ...row, payer: VA }]), { [VA]: { free: 0n, allocated: 0n } });
    const result = await getGaslessMarginFunding(config, input(5n));
    expect(result.hasSufficientBalance).toBe(true);
    expect(result.payers[0]).toMatchObject({ payer: VA, projectedBalance18: 5n });
    expect(result.maxAddAmount18).toBeNull();
  });

  it("credits the parent on removal and does not offer an add Max", async () => {
    const { config } = fundingTestConfig(fundingQuote(), { [ACCOUNT]: { free: 0n, allocated: 0n } });
    const result = await getGaslessMarginFunding(config, input(5n, "remove"));
    expect(result.hasSufficientBalance).toBe(true);
    expect(result.payers[0]).toMatchObject({ projectedBalance18: 5n });
    expect(result.maxAddAmount18).toBeNull();
  });

  it("debits a fee-paying virtual account on removal", async () => {
    const row = fundingQuote().payments[0]!;
    const { config } = fundingTestConfig(fundingQuote([{ ...row, payer: VA }]));
    const result = await getGaslessMarginFunding(config, input(100n, "remove"));
    expect(result.hasSufficientBalance).toBe(false);
    expect(result.payers[0]).toMatchObject({ projectedBalance18: 0n });
    expect(result.maxAddAmount18).toBeNull();
  });

  it("quotes the exact supplied raw timelock batch using its relay account", async () => {
    const inner = encodeFunctionData({ abi: accountLayerAbi, functionName: "addMargin", args: [VA, 100n] });
    const data = encodeFunctionData({ abi: accountLayerAbi, functionName: "executeTimelockOp", args: [[], inner] });
    const { config, readContract, signTypedData } = fundingTestConfig();
    await getGaslessMarginFunding(config, { ...input(), account: VA, calls: [{ data }] });
    const read = readContract.mock.calls.find(([call]) => call.functionName === "previewFeeQuote")![0];
    const decoded = decodeFunctionData({ abi: gaslessLayerAbi, data: read.args[0] as Hex });
    expect(decoded.functionName).toBe("relayInstantBatch");
    if (decoded.functionName !== "relayInstantBatch") throw new Error("Unexpected preview");
    expect(decoded.args[0][0]!.callData).toBe(data);
    expect(decoded.args[0][0]!.signerAccount.addr.toLowerCase()).toBe(VA);
    expect(signTypedData).not.toHaveBeenCalled();
  });

  it("rejects identical accounts and invalid runtime directions before RPC", async () => {
    const { config, readContract } = fundingTestConfig();
    await expect(getGaslessMarginFunding(config, { ...input(), virtualAccount: ACCOUNT })).rejects.toMatchObject({
      code: "GASLESS_MARGIN_FUNDING_INVALID",
    });
    await expect(getGaslessMarginFunding(config, { ...input(), direction: "transfer" as "add" })).rejects.toMatchObject(
      { code: "GASLESS_MARGIN_FUNDING_INVALID" },
    );
    expect(readContract).not.toHaveBeenCalled();
  });

  it.each([0n, -1n])("rejects a nonpositive amount (%s) before RPC", async (amount18) => {
    const { config, readContract } = fundingTestConfig();
    await expect(getGaslessMarginFunding(config, input(amount18))).rejects.toMatchObject({
      code: "GASLESS_MARGIN_FUNDING_INVALID",
    });
    expect(readContract).not.toHaveBeenCalled();
  });
});
