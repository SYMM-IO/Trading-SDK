import { encodeFunctionData, type Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_TX_HASH } from "../../../shared/test/mock-config";
import { symmioAbi } from "../../abi/v0.8.5/symmio";
import { requestToCancelCloseRequest } from "./request-to-cancel-close-request";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const QUOTE_ID = 42n;

describe("requestToCancelCloseRequest", () => {
  it("wraps the core requestToCancelCloseRequest call in AccountLayer `_call`", async () => {
    const { config, writeContract } = mockConfig();

    const hash = await requestToCancelCloseRequest(config, { account: SUB_ACCOUNT, quoteId: QUOTE_ID });

    const expectedData = encodeFunctionData({
      abi: symmioAbi,
      functionName: "requestToCancelCloseRequest",
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

    await expect(requestToCancelCloseRequest(config, { account: SUB_ACCOUNT, quoteId: QUOTE_ID })).rejects.toThrow(
      SymmError,
    );
  });
});
