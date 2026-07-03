import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_TX_HASH } from "../../../shared/test/mock-config";
import type { SingleUpnlSig } from "../types";
import { removeMargin } from "./remove-margin";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const VIRTUAL_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const AMOUNT = 50_000000000000000000n;
const UPNL_SIG: SingleUpnlSig = {
  reqId: "0x1234",
  timestamp: 1_700_000_000n,
  upnl: -25_000000000000000000n,
  gatewaySignature: "0xabcd",
  sigs: {
    signature: 99n,
    owner: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    nonce: "0xcccccccccccccccccccccccccccccccccccccccc",
  },
};

describe("removeMargin", () => {
  it("writes removeMargin to the AccountLayer with the uPnL signature", async () => {
    const { config, writeContract } = mockConfig();

    const hash = await removeMargin(config, { virtualAccount: VIRTUAL_ACCOUNT, amount: AMOUNT, upnlSig: UPNL_SIG });

    expect(hash).toBe(TEST_TX_HASH);
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "removeMargin",
        args: [VIRTUAL_ACCOUNT, AMOUNT, UPNL_SIG],
      }),
    );
  });

  it("throws when the config has no wallet resolver", async () => {
    const { config } = mockConfig({ withWallet: false });

    await expect(
      removeMargin(config, { virtualAccount: VIRTUAL_ACCOUNT, amount: AMOUNT, upnlSig: UPNL_SIG }),
    ).rejects.toThrow(SymmError);
  });

  describe("pre-flight simulation", () => {
    it("dry-runs the call before writing by default", async () => {
      const { config, writeContract, simulateContract } = mockConfig();

      await removeMargin(config, { virtualAccount: VIRTUAL_ACCOUNT, amount: AMOUNT, upnlSig: UPNL_SIG });

      expect(simulateContract).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "removeMargin", args: [VIRTUAL_ACCOUNT, AMOUNT, UPNL_SIG] }),
      );
      expect(simulateContract.mock.invocationCallOrder[0]!).toBeLessThan(writeContract.mock.invocationCallOrder[0]!);
    });

    it("skips the dry-run when `simulateBeforeWrite` is false on the call", async () => {
      const { config, writeContract, simulateContract } = mockConfig();

      await removeMargin(config, {
        virtualAccount: VIRTUAL_ACCOUNT,
        amount: AMOUNT,
        upnlSig: UPNL_SIG,
        simulateBeforeWrite: false,
      });

      expect(simulateContract).not.toHaveBeenCalled();
      expect(writeContract).toHaveBeenCalled();
    });

    it("aborts the write when the dry-run would revert", async () => {
      const { config, writeContract, simulateContract } = mockConfig();
      simulateContract.mockRejectedValueOnce(new Error("would revert"));

      await expect(
        removeMargin(config, { virtualAccount: VIRTUAL_ACCOUNT, amount: AMOUNT, upnlSig: UPNL_SIG }),
      ).rejects.toThrow("would revert");
      expect(writeContract).not.toHaveBeenCalled();
    });
  });
});
