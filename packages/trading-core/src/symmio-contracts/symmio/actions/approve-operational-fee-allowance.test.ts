import { decodeFunctionData, toFunctionSelector, type Abi, type AbiFunction, type Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { GASLESS_RELAYABLE_WRITES } from "../../../gasless/relayable-writes";
import { mockConfig, TEST_TX_HASH } from "../../../shared/test/mock-config";
import { symmioAbi } from "../../abi/v0.8.6/symmio";
import { approveOperationalFeeAllowance } from "./approve-operational-fee-allowance";

const DEFAULT = getChainConfig(SymmioSupportedChainId.ARBITRUM);
const ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const CHARGER: Address = "0x386EF97D913acf02B3C9452da4Cd4aaEc82eFBca";

function selectorOf(name: string) {
  const fragment = (symmioAbi as Abi).find((item) => item.type === "function" && item.name === name) as AbiFunction;
  return toFunctionSelector(fragment);
}

describe("approveOperationalFeeAllowance", () => {
  it("routes the two-argument approveOperationalFee through the AccountLayer _call proxy", async () => {
    const { config, writeContract } = mockConfig({ simulateBeforeWrite: false });

    const hash = await approveOperationalFeeAllowance(config, {
      account: ACCOUNT,
      chargers: [CHARGER],
      amounts: [5n * 10n ** 18n],
    });

    expect(hash).toBe(TEST_TX_HASH);
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({ address: DEFAULT.addresses.accountLayerAddress, functionName: "_call" }),
    );

    const callArgs = writeContract.mock.calls[0]?.[0].args as [Address, readonly `0x${string}`[]];
    expect(callArgs[0]).toBe(ACCOUNT);
    const inner = decodeFunctionData({ abi: symmioAbi, data: callArgs[1][0]! });
    /** The multiplier is left alone: no third argument reaches the diamond. */
    expect(inner.functionName).toBe("approveOperationalFee");
    expect(inner.args).toEqual([[CHARGER], [5n * 10n ** 18n]]);
  });

  it("rejects mismatched array lengths", async () => {
    const { config } = mockConfig({ simulateBeforeWrite: false });

    await expect(
      approveOperationalFeeAllowance(config, { account: ACCOUNT, chargers: [CHARGER], amounts: [1n, 2n] }),
    ).rejects.toMatchObject({ code: "OPERATIONAL_FEE_APPROVAL_MISMATCH" });
  });

  it("requires explicit chargers when the chain has no gasless block to default from", async () => {
    const { config } = mockConfig({ simulateBeforeWrite: false });

    const rejection = approveOperationalFeeAllowance(config, {
      chainId: SymmioSupportedChainId.BASE,
      account: ACCOUNT,
      amounts: [1n],
    });

    await expect(rejection).rejects.toMatchObject({ code: "GASLESS_CHARGER_REQUIRED" });
    await expect(rejection).rejects.toThrow("approveOperationalFeeAllowance");
  });

  it("is relayable under its own selector, separate from the multiplier variant", () => {
    const allowanceOnly = selectorOf("approveOperationalFee");
    const withMultiplier = selectorOf("approveOperationalFeeWithMultiplier");

    expect(allowanceOnly).not.toBe(withMultiplier);
    expect(GASLESS_RELAYABLE_WRITES.get(allowanceOnly)).toEqual({
      target: "symmio",
      operationType: "approveOperationalFeeAllowance",
    });
  });
});
