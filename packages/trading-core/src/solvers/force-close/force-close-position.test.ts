import { encodeFunctionData, type Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmError } from "../../shared/errors/symm-error";
import { mockConfig, TEST_TX_HASH } from "../../shared/test/mock-config";
import { symmioAbi } from "../../symmio-contracts/abi/v0.8.6/symmio";
import type { HighLowPriceSig } from "../../symmio-contracts/symmio/types";
import { forceClosePosition } from "./force-close-position";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const QUOTE_ID = 42n;

const SIG: HighLowPriceSig = {
  reqId: "0x",
  timestamp: 1n,
  symbolId: 1n,
  highest: 105n,
  lowest: 95n,
  averagePrice: 100n,
  startTime: 10n,
  endTime: 20n,
  upnlPartyB: 0n,
  upnlPartyA: 0n,
  currentPrice: 100n,
  gatewaySignature: "0x",
  sigs: { signature: 0n, owner: SUB_ACCOUNT, nonce: SUB_ACCOUNT },
};

describe("forceClosePosition", () => {
  it("wraps forceClosePosition(quoteId, sig) in AccountLayer `_call`", async () => {
    const { config, writeContract } = mockConfig();

    const hash = await forceClosePosition(config, { account: SUB_ACCOUNT, quoteId: QUOTE_ID, sig: SIG });

    const expectedData = encodeFunctionData({
      abi: symmioAbi,
      functionName: "forceClosePosition",
      args: [QUOTE_ID, SIG],
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
    await expect(forceClosePosition(config, { account: SUB_ACCOUNT, quoteId: QUOTE_ID, sig: SIG })).rejects.toThrow(
      SymmError,
    );
  });
});
