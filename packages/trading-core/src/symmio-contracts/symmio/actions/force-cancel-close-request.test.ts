import { encodeFunctionData, type Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_TX_HASH } from "../../../shared/test/mock-config";
import { symmioAbi } from "../../abi/v0.8.5/symmio";
import { forceCancelCloseRequest } from "./force-cancel-close-request";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const QUOTE_ID = 42n;

describe("forceCancelCloseRequest", () => {
  it("wraps the core forceCancelCloseRequest call in AccountLayer `_call`", async () => {
    const { config, writeContract } = mockConfig();

    const hash = await forceCancelCloseRequest(config, { account: SUB_ACCOUNT, quoteId: QUOTE_ID });

    const expectedData = encodeFunctionData({
      abi: symmioAbi,
      functionName: "forceCancelCloseRequest",
      args: [QUOTE_ID],
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

    await expect(forceCancelCloseRequest(config, { account: SUB_ACCOUNT, quoteId: QUOTE_ID })).rejects.toThrow(
      SymmError,
    );
  });
});
