import { encodeFunctionData, type Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_TX_HASH } from "../../../shared/test/mock-config";
import { symmioAbi } from "../../abi/v0.8.5/symmio";
import { requestCancelWithdraw } from "./request-cancel-withdraw";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("requestCancelWithdraw", () => {
  it("wraps the core requestCancelWithdraw call in AccountLayer `_call`", async () => {
    const { config, writeContract } = mockConfig();

    const hash = await requestCancelWithdraw(config, { account: SUB_ACCOUNT, requestId: 1n });

    const expectedData = encodeFunctionData({
      abi: symmioAbi,
      functionName: "requestCancelWithdraw",
      args: [1n],
    });

    expect(hash).toBe(TEST_TX_HASH);
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "_call",
        args: [SUB_ACCOUNT, [expectedData]],
      }),
    );
  });

  it("throws when the config has no wallet resolver", async () => {
    const { config } = mockConfig({ withWallet: false });

    await expect(requestCancelWithdraw(config, { account: SUB_ACCOUNT, requestId: 1n })).rejects.toThrow(SymmError);
  });
});
