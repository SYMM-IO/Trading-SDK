import { decodeFunctionData, type Address, type Hex } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig, TEST_TX_HASH } from "../../../shared/test/mock-config";
import { instantLayerAbi } from "../../abi/v0.8.6/instant-layer";

const maybeRelayAsGasless = vi.hoisted(() => vi.fn());

vi.mock("../../../gasless/dispatch/maybe-relay-as-gasless", () => ({ maybeRelayAsGasless }));

import { grantDelegations } from "./grant-delegations";

const CHAIN = SymmioSupportedChainId.ARBITRUM;
const ARBITRUM = getChainConfig(CHAIN);
const ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SESSION_KEY: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const EXECUTOR: Address = "0xcccccccccccccccccccccccccccccccccccccccc";
const SELECTOR: Hex = "0x12345678";
const RELAYED_HASH = `0x${"ee".repeat(32)}` as const;

const GRANT = {
  chainId: CHAIN,
  account: { addr: ACCOUNT, isPartyB: false },
  delegations: [
    { delegatedSigner: SESSION_KEY, selectors: [SELECTOR], expiryTimestamp: 456n },
    { delegatedSigner: EXECUTOR, selectors: [SELECTOR], expiryTimestamp: 789n },
  ],
} as const;

describe("grantDelegations — gasless seam", () => {
  beforeEach(() => {
    maybeRelayAsGasless.mockReset();
  });

  it("returns the relayer's broadcast hash, indistinguishable from a wallet submit", async () => {
    maybeRelayAsGasless.mockResolvedValue(RELAYED_HASH);
    const { config, writeContract } = mockConfig();

    const hash = await grantDelegations(config, { ...GRANT, gasless: true });

    expect(hash).toBe(RELAYED_HASH);
    expect(writeContract).not.toHaveBeenCalled();
  });

  it("relays every delegate as one operation under the granting sub-account", async () => {
    maybeRelayAsGasless.mockResolvedValue(RELAYED_HASH);
    const { config } = mockConfig();

    await grantDelegations(config, { ...GRANT, gasless: true });

    const parameters = maybeRelayAsGasless.mock.calls[0]?.[1];
    /** A grant is always owner-signed: calldata account and signerAccount agree. */
    expect(parameters.signerAccount).toBe(ACCOUNT);
    expect(parameters.calls).toHaveLength(1);
    expect(parameters.calls[0].target).toBe(ARBITRUM.addresses.instantLayerAddress);

    const decoded = decodeFunctionData({ abi: instantLayerAbi, data: parameters.calls[0].callData });
    expect(decoded.functionName).toBe("grantDelegations");
    /** viem decodes addresses checksummed; compare on value, not casing. */
    const infos = decoded.args?.[0] as readonly { delegatedSigner: Address; expiryTimestamp: bigint }[];
    expect(infos.map((info) => info.delegatedSigner.toLowerCase())).toEqual([SESSION_KEY, EXECUTOR]);
    expect(infos.map((info) => info.expiryTimestamp)).toEqual([456n, 789n]);
  });

  it("falls through to the wallet path when the dispatcher declines", async () => {
    maybeRelayAsGasless.mockResolvedValue(null);
    const { config, writeContract } = mockConfig();

    const hash = await grantDelegations(config, { ...GRANT, simulateBeforeWrite: false });

    expect(hash).toBe(TEST_TX_HASH);
    expect(writeContract).toHaveBeenCalledOnce();
  });

  it("skips the local dry-run when relayed — the relayer simulates its own bundle", async () => {
    maybeRelayAsGasless.mockResolvedValue(RELAYED_HASH);
    const { config, simulateContract } = mockConfig();

    await grantDelegations(config, { ...GRANT, gasless: true });

    expect(simulateContract).not.toHaveBeenCalled();
  });

  it("validates before reaching the dispatcher, so an invalid grant never prompts a signature", async () => {
    const { config } = mockConfig();

    await expect(grantDelegations(config, { ...GRANT, delegations: [], gasless: true })).rejects.toMatchObject({
      code: "GRANT_DELEGATIONS_EMPTY",
    });
    expect(maybeRelayAsGasless).not.toHaveBeenCalled();
  });
});
