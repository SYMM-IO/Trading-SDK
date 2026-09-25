import { decodeFunctionData, type Address, type Hex } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_TX_HASH } from "../../../shared/test/mock-config";
import { instantLayerAbi } from "../../abi/v0.8.6/instant-layer";

const maybeRelayAsGasless = vi.hoisted(() => vi.fn());

vi.mock("../../../gasless/dispatch/maybe-relay-as-gasless", () => ({ maybeRelayAsGasless }));

import { grantDelegation } from "./grant-delegation";

const CHAIN = SymmioSupportedChainId.ARBITRUM;
const ARBITRUM = getChainConfig(CHAIN);
const ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const DELEGATE: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SELECTOR: Hex = "0x12345678";
const RELAYED_HASH = `0x${"ee".repeat(32)}` as const;

const GRANT = {
  chainId: CHAIN,
  account: { addr: ACCOUNT, isPartyB: false },
  delegatedSigner: DELEGATE,
  selectors: [SELECTOR],
  expiryTimestamp: 456n,
} as const;

describe("grantDelegation — gasless seam", () => {
  beforeEach(() => {
    maybeRelayAsGasless.mockReset();
  });

  it("returns the relayer's broadcast hash, indistinguishable from a wallet submit", async () => {
    maybeRelayAsGasless.mockResolvedValue(RELAYED_HASH);
    const { config, writeContract } = mockConfig();

    const hash = await grantDelegation(config, { ...GRANT, gasless: true });

    expect(hash).toBe(RELAYED_HASH);
    expect(writeContract).not.toHaveBeenCalled();
  });

  it("relays the grant under the granting sub-account itself", async () => {
    maybeRelayAsGasless.mockResolvedValue(RELAYED_HASH);
    const { config } = mockConfig();

    await grantDelegation(config, { ...GRANT, gasless: true });

    const parameters = maybeRelayAsGasless.mock.calls[0]?.[1];
    /** A grant is always owner-signed: calldata account and signerAccount agree. */
    expect(parameters.signerAccount).toBe(ACCOUNT);
    expect(parameters.calls).toHaveLength(1);
    expect(parameters.calls[0].target).toBe(ARBITRUM.addresses.instantLayerAddress);

    const decoded = decodeFunctionData({ abi: instantLayerAbi, data: parameters.calls[0].callData });
    expect(decoded.functionName).toBe("grantDelegation");
    /** viem decodes addresses checksummed; compare on value, not casing. */
    const info = decoded.args?.[0] as { delegatedSigner: Address; expiryTimestamp: bigint; selectors: readonly Hex[] };
    expect(info.delegatedSigner.toLowerCase()).toBe(DELEGATE);
    expect(info.expiryTimestamp).toBe(456n);
    expect(info.selectors).toEqual([SELECTOR]);
  });

  it("falls through to the wallet path when the dispatcher declines", async () => {
    maybeRelayAsGasless.mockResolvedValue(null);
    const { config, writeContract } = mockConfig();

    const hash = await grantDelegation(config, { ...GRANT, simulateBeforeWrite: false });

    expect(hash).toBe(TEST_TX_HASH);
    expect(writeContract).toHaveBeenCalledOnce();
  });

  it("skips the local dry-run when relayed — the relayer simulates its own bundle", async () => {
    maybeRelayAsGasless.mockResolvedValue(RELAYED_HASH);
    const { config, simulateContract } = mockConfig();

    await grantDelegation(config, { ...GRANT, gasless: true });

    expect(simulateContract).not.toHaveBeenCalled();
  });

  it("refuses to relay a PartyB grant rather than signing for the wrong identity", async () => {
    const { config } = mockConfig();

    await expect(
      grantDelegation(config, { ...GRANT, account: { addr: ACCOUNT, isPartyB: true }, gasless: true }),
    ).rejects.toBeInstanceOf(SymmError);
    expect(maybeRelayAsGasless).not.toHaveBeenCalled();
  });

  it("lets a PartyB grant take the wallet path when gasless was never demanded", async () => {
    const { config, writeContract } = mockConfig();

    const hash = await grantDelegation(config, {
      ...GRANT,
      account: { addr: ACCOUNT, isPartyB: true },
      simulateBeforeWrite: false,
    });

    expect(hash).toBe(TEST_TX_HASH);
    expect(maybeRelayAsGasless).not.toHaveBeenCalled();
    expect(writeContract).toHaveBeenCalledOnce();
  });
});
