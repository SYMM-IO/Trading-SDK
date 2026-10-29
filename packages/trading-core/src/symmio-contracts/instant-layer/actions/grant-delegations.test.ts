import type { Address, Hex } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig, TEST_TX_HASH } from "../../../shared/test/mock-config";
import { grantDelegations } from "./grant-delegations";

const DEFAULT = getChainConfig(SymmioSupportedChainId.ARBITRUM);
const ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SESSION_KEY: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const EXECUTOR: Address = "0xcccccccccccccccccccccccccccccccccccccccc";
const SESSION_SELECTOR: Hex = "0x12345678";
const EXECUTOR_SELECTOR: Hex = "0x87654321";

const GRANT = {
  account: { addr: ACCOUNT, isPartyB: false },
  delegations: [
    { delegatedSigner: SESSION_KEY, selectors: [SESSION_SELECTOR], expiryTimestamp: 456n },
    { delegatedSigner: EXECUTOR, selectors: [EXECUTOR_SELECTOR], expiryTimestamp: 789n },
  ],
};

/** The `DelegationInfo[]` the contract receives: every entry pinned to the granting account. */
const INFOS = [
  {
    account: { addr: ACCOUNT, isPartyB: false },
    delegatedSigner: SESSION_KEY,
    selectors: [SESSION_SELECTOR],
    expiryTimestamp: 456n,
  },
  {
    account: { addr: ACCOUNT, isPartyB: false },
    delegatedSigner: EXECUTOR,
    selectors: [EXECUTOR_SELECTOR],
    expiryTimestamp: 789n,
  },
];

describe("grantDelegations", () => {
  it("writes one grantDelegations call carrying every delegate", async () => {
    const { config, writeContract } = mockConfig();

    const hash = await grantDelegations(config, GRANT);

    expect(hash).toBe(TEST_TX_HASH);
    expect(writeContract).toHaveBeenCalledOnce();
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.instantLayerAddress,
        functionName: "grantDelegations",
        args: [INFOS],
      }),
    );
  });

  it("rejects an empty list before any wallet work", async () => {
    const { config, writeContract, simulateContract } = mockConfig();

    await expect(grantDelegations(config, { ...GRANT, delegations: [] })).rejects.toMatchObject({
      kind: "validation",
      code: "GRANT_DELEGATIONS_EMPTY",
    });
    expect(simulateContract).not.toHaveBeenCalled();
    expect(writeContract).not.toHaveBeenCalled();
  });

  it("rejects a PartyB account, which the contract always refuses", async () => {
    const { config, writeContract } = mockConfig();

    await expect(
      grantDelegations(config, { ...GRANT, account: { addr: ACCOUNT, isPartyB: true } }),
    ).rejects.toMatchObject({ kind: "validation", code: "GRANT_DELEGATIONS_PARTYB_UNSUPPORTED" });
    expect(writeContract).not.toHaveBeenCalled();
  });

  it("throws when the config has no wallet resolver", async () => {
    const { config } = mockConfig({ withWallet: false });

    await expect(grantDelegations(config, GRANT)).rejects.toThrow("no `getWalletClient` resolver");
  });

  describe("pre-flight simulation", () => {
    it("dry-runs the call before writing by default", async () => {
      const { config, writeContract, simulateContract } = mockConfig();

      await grantDelegations(config, GRANT);

      expect(simulateContract).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "grantDelegations", args: [INFOS] }),
      );
      expect(simulateContract.mock.invocationCallOrder[0]!).toBeLessThan(writeContract.mock.invocationCallOrder[0]!);
    });

    it("skips the dry-run when `simulateBeforeWrite` is false on the call", async () => {
      const { config, writeContract, simulateContract } = mockConfig();

      await grantDelegations(config, { ...GRANT, simulateBeforeWrite: false });

      expect(simulateContract).not.toHaveBeenCalled();
      expect(writeContract).toHaveBeenCalled();
    });

    it("aborts the write when the dry-run would revert", async () => {
      const { config, writeContract, simulateContract } = mockConfig();
      simulateContract.mockRejectedValueOnce(new Error("would revert"));

      await expect(grantDelegations(config, GRANT)).rejects.toThrow("would revert");
      expect(writeContract).not.toHaveBeenCalled();
    });
  });
});
