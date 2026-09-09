import type { Account, Address, Chain, Hash, Hex, PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { createConfig, type SymmioWalletClient } from "../../../core/config";
import { maybeRelayAsGasless } from "../../../gasless/dispatch/maybe-relay-as-gasless";
import { SymmError } from "../../../shared/errors/symm-error";
import { TEST_AFFILIATE_ADDRESS, TEST_TX_HASH, TEST_USER } from "../../../shared/test/mock-config";
import { callAsSubAccount } from "./call-as-sub-account";

vi.mock("../../../gasless/dispatch/maybe-relay-as-gasless", () => ({
  maybeRelayAsGasless: vi.fn(),
}));

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
/** The sub-account's owner EOA — the only signer `AccountLayer._call` accepts. */
const OWNER: Address = TEST_USER;
/** A delegated session key: authorized through the relay, never on the wallet path. */
const SESSION_KEY: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const RELAYED_HASH: Hash = `0x${"cd".repeat(32)}`;
const CALL_DATA: Hex = "0x1234567800000000000000000000000000000000000000000000000000000000";

/**
 * A config whose wallet resolver honors `from` (the real resolvers do; the shared
 * `mockConfig` stub always returns the same account, which would hide the guard).
 */
function buildConfig(options?: { owner?: Address; isExists?: boolean }) {
  const readContract = vi.fn().mockResolvedValue({
    accountAddress: SUB_ACCOUNT,
    owner: options?.owner ?? OWNER,
    isExists: options?.isExists ?? true,
  });
  const writeContract = vi.fn().mockResolvedValue(TEST_TX_HASH);
  const simulateContract = vi.fn().mockResolvedValue({ result: undefined, request: {} });
  const publicClient = { readContract, simulateContract } as unknown as PublicClient;

  const config = createConfig({
    symmioConfig: { [SymmioSupportedChainId.HYPER_EVM]: { addresses: { affiliatesAddress: TEST_AFFILIATE_ADDRESS } } },
    getClient: () => publicClient,
    getWalletClient: async ({ from }) =>
      ({
        account: { address: from ?? OWNER, type: "json-rpc" } as Account,
        chain: { id: SymmioSupportedChainId.HYPER_EVM } as Chain,
        writeContract,
      }) as unknown as SymmioWalletClient,
  });

  return { config, readContract, writeContract };
}

describe("callAsSubAccount", () => {
  beforeEach(() => {
    vi.mocked(maybeRelayAsGasless).mockReset().mockResolvedValue(null);
  });

  it("routes the calldata through AccountLayer `_call` on the wallet path", async () => {
    const { config, writeContract } = buildConfig();

    const hash = await callAsSubAccount(config, {
      account: SUB_ACCOUNT,
      data: CALL_DATA,
      simulateBeforeWrite: false,
    });

    expect(hash).toBe(TEST_TX_HASH);
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "_call",
        args: [SUB_ACCOUNT, [CALL_DATA]],
      }),
    );
  });

  describe("wallet-path owner guard", () => {
    it("costs no owner read when `from` is omitted", async () => {
      const { config, readContract, writeContract } = buildConfig();

      await callAsSubAccount(config, { account: SUB_ACCOUNT, data: CALL_DATA, simulateBeforeWrite: false });

      expect(readContract).not.toHaveBeenCalled();
      expect(writeContract).toHaveBeenCalled();
    });

    it("throws WALLET_PATH_REQUIRES_OWNER when the resolved signer is not the owner", async () => {
      const { config, writeContract } = buildConfig({ owner: OWNER });

      const error = await callAsSubAccount(config, {
        account: SUB_ACCOUNT,
        data: CALL_DATA,
        from: SESSION_KEY,
        simulateBeforeWrite: false,
      }).catch((err: unknown) => err);

      expect(error).toBeInstanceOf(SymmError);
      expect(error).toMatchObject({ kind: "validation", code: "WALLET_PATH_REQUIRES_OWNER" });
      expect((error as SymmError).message).toContain(SESSION_KEY);
      expect(writeContract).not.toHaveBeenCalled();
    });

    it("lets an explicit owner `from` through unchanged", async () => {
      const { config, writeContract } = buildConfig({ owner: OWNER });

      const hash = await callAsSubAccount(config, {
        account: SUB_ACCOUNT,
        data: CALL_DATA,
        from: OWNER,
        simulateBeforeWrite: false,
      });

      expect(hash).toBe(TEST_TX_HASH);
      expect(writeContract).toHaveBeenCalled();
    });

    it("defers to the contract's own guard for an address the AccountLayer does not know", async () => {
      const { config, writeContract } = buildConfig({ isExists: false });

      const hash = await callAsSubAccount(config, {
        account: SUB_ACCOUNT,
        data: CALL_DATA,
        from: SESSION_KEY,
        simulateBeforeWrite: false,
      });

      expect(hash).toBe(TEST_TX_HASH);
      expect(writeContract).toHaveBeenCalled();
    });

    it("never runs for a relayed write — the gasless hash short-circuits first", async () => {
      const { config, readContract, writeContract } = buildConfig({ owner: OWNER });
      vi.mocked(maybeRelayAsGasless).mockResolvedValueOnce(RELAYED_HASH);

      const hash = await callAsSubAccount(config, {
        account: SUB_ACCOUNT,
        data: CALL_DATA,
        from: SESSION_KEY,
        gasless: true,
        simulateBeforeWrite: false,
      });

      expect(hash).toBe(RELAYED_HASH);
      expect(readContract).not.toHaveBeenCalled();
      expect(writeContract).not.toHaveBeenCalled();
    });
  });
});
