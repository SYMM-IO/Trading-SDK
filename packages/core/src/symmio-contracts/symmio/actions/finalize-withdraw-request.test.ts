import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_TX_HASH } from "../../../shared/test/mock-config";
import { finalizeWithdrawRequest } from "./finalize-withdraw-request";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("finalizeWithdrawRequest", () => {
  it("calls finalizeWithdrawRequest directly on the SYMMIO core", async () => {
    const { config, writeContract } = mockConfig();

    const hash = await finalizeWithdrawRequest(config, { user: SUB_ACCOUNT, requestId: 1n });

    expect(hash).toBe(TEST_TX_HASH);
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.symmioAddress,
        functionName: "finalizeWithdrawRequest",
        args: [SUB_ACCOUNT, 1n],
      }),
    );
  });

  it("throws when the config has no wallet resolver", async () => {
    const { config } = mockConfig({ withWallet: false });

    await expect(finalizeWithdrawRequest(config, { user: SUB_ACCOUNT, requestId: 1n })).rejects.toThrow(SymmError);
  });
});
