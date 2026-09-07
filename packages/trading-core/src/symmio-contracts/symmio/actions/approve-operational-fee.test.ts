import { decodeFunctionData, maxUint256, type Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig, TEST_TX_HASH } from "../../../shared/test/mock-config";
import { symmioAbi } from "../../abi/v0.8.6/symmio";
import { approveOperationalFee, OPERATIONAL_FEE_LIST_PRICE_MULTIPLIER } from "./approve-operational-fee";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const CHARGER: Address = "0x8347953D80037b8d82827246f37EC7442AD188B4";

describe("approveOperationalFee", () => {
  it("routes approveOperationalFeeWithMultiplier through the AccountLayer _call proxy", async () => {
    const { config, writeContract } = mockConfig({ simulateBeforeWrite: false });

    const hash = await approveOperationalFee(config, {
      account: ACCOUNT,
      chargers: [CHARGER],
      amounts: [maxUint256],
    });

    expect(hash).toBe(TEST_TX_HASH);
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "_call",
      }),
    );

    const callArgs = writeContract.mock.calls[0]?.[0].args as [Address, readonly `0x${string}`[]];
    expect(callArgs[0]).toBe(ACCOUNT);
    const inner = decodeFunctionData({ abi: symmioAbi, data: callArgs[1][0]! });
    expect(inner.functionName).toBe("approveOperationalFeeWithMultiplier");
    expect(inner.args).toEqual([[CHARGER], [maxUint256], [OPERATIONAL_FEE_LIST_PRICE_MULTIPLIER]]);
  });

  it("rejects mismatched array lengths", async () => {
    const { config } = mockConfig({ simulateBeforeWrite: false });

    await expect(
      approveOperationalFee(config, { account: ACCOUNT, chargers: [CHARGER], amounts: [1n, 2n] }),
    ).rejects.toThrowError(/OPERATIONAL_FEE_APPROVAL_MISMATCH|same length/);
  });

  it("requires explicit chargers when the chain has no gasless block to default from", async () => {
    const { config } = mockConfig({ simulateBeforeWrite: false });

    await expect(approveOperationalFee(config, { account: ACCOUNT, amounts: [maxUint256] })).rejects.toThrowError(
      /GASLESS_CHARGER_REQUIRED|chargers/,
    );
  });
});
