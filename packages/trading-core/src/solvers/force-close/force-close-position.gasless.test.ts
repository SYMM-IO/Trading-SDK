import { decodeFunctionData, type Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { mockConfig, TEST_TX_HASH } from "../../shared/test/mock-config";
import { symmioAbi } from "../../symmio-contracts/abi/v0.8.6/symmio";
import type { HighLowPriceSig } from "../../symmio-contracts/symmio/types";

const maybeRelayAsGasless = vi.hoisted(() => vi.fn());

vi.mock("../../gasless/dispatch/maybe-relay-as-gasless", () => ({ maybeRelayAsGasless }));

import { forceClosePosition } from "./force-close-position";

const CHAIN = SymmioSupportedChainId.ARBITRUM;
const ARBITRUM = getChainConfig(CHAIN);
const ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const RELAYED_HASH = `0x${"ee".repeat(32)}` as const;

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
  sigs: { signature: 0n, owner: ACCOUNT, nonce: ACCOUNT },
};

const CLOSE = { chainId: CHAIN, account: ACCOUNT, quoteId: 42n, sig: SIG } as const;

describe("forceClosePosition — gasless seam", () => {
  beforeEach(() => {
    maybeRelayAsGasless.mockReset();
  });

  it("returns the relayer's broadcast hash, indistinguishable from a wallet submit", async () => {
    maybeRelayAsGasless.mockResolvedValue(RELAYED_HASH);
    const { config, writeContract } = mockConfig();

    await expect(forceClosePosition(config, { ...CLOSE, gasless: true })).resolves.toBe(RELAYED_HASH);
    expect(writeContract).not.toHaveBeenCalled();
  });

  it("relays through the `_call` proxy, billed to the position's own sub-account", async () => {
    maybeRelayAsGasless.mockResolvedValue(RELAYED_HASH);
    const { config } = mockConfig();

    await forceClosePosition(config, { ...CLOSE, gasless: true });

    const parameters = maybeRelayAsGasless.mock.calls[0]?.[1];
    expect(parameters.signerAccount).toBe(ACCOUNT);
    expect(parameters.calls).toHaveLength(1);
    /** `_call`-proxied writes target the core diamond, not the AccountLayer. */
    expect(parameters.calls[0].target).toBe(ARBITRUM.addresses.symmioAddress);

    const decoded = decodeFunctionData({ abi: symmioAbi, data: parameters.calls[0].callData });
    expect(decoded.functionName).toBe("forceClosePosition");
    expect(decoded.args?.[0]).toBe(42n);
  });

  it("falls through to the wallet path when the dispatcher declines", async () => {
    maybeRelayAsGasless.mockResolvedValue(null);
    const { config, writeContract } = mockConfig();

    await expect(forceClosePosition(config, { ...CLOSE, simulateBeforeWrite: false })).resolves.toBe(TEST_TX_HASH);
    expect(writeContract).toHaveBeenCalledOnce();
  });
});
