import { encodeFunctionData, type Hex } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig } from "../../core/chains";
import { symmioAbi } from "../../symmio-contracts/abi/v0.8.6/symmio";
import { addMargin } from "../../symmio-contracts/account-layer/actions/add-margin";
import { createSubAccounts } from "../../symmio-contracts/account-layer/actions/create-sub-accounts";
import { depositForAccount } from "../../symmio-contracts/account-layer/actions/deposit-for-account";
import { SubAccountIsolationType } from "../../symmio-contracts/account-layer/types";
import { deallocateAndInitiateWithdraw } from "../../symmio-contracts/symmio/actions/deallocate-and-initiate-withdraw";
import { initiateWithdraw } from "../../symmio-contracts/symmio/actions/initiate-withdraw";
import { createClassicWithdrawPart } from "../../symmio-contracts/symmio/parts";
import { GASLESS_RELAYABLE_WRITES } from "../relayable-writes";
import { GASLESS_TEST_CHAIN, TEST_GASLESS_SIGNER, TEST_GASLESS_TX_HASH, gaslessWriteTestConfig } from "../test/config";
import type { GaslessRelayEvent } from "../types";
import { maybeRelayAsGasless, type GaslessDispatchCall } from "./maybe-relay-as-gasless";

const post = vi.hoisted(() => vi.fn());
const get = vi.hoisted(() => vi.fn());

vi.mock("axios", () => ({
  default: { post, get },
  isAxiosError: (err: unknown) => Boolean((err as { isAxiosError?: boolean })?.isAxiosError),
}));

const SUB_ACCOUNT = "0x3333333333333333333333333333333333333333" as const;
const VIRTUAL_ACCOUNT = "0x4444444444444444444444444444444444444444" as const;
const RELAY_TX_HASH = `0x${"ef".repeat(32)}` as const;
const HEADERS = { "x-gaslessq-protocol-instance": "arbitrum-42161-vibe" };
const PARTS = [
  createClassicWithdrawPart({ id: 1n, amount: 1_000_000n, receiver: TEST_GASLESS_SIGNER, chainId: 42_161n }),
];
/** A delegated session key — never the sub-account's owner. */
const SESSION_KEY = "0x5555555555555555555555555555555555555555" as const;
const UPNL_SIG = {
  reqId: "0x",
  timestamp: 0n,
  upnl: 0n,
  gatewaySignature: "0x",
  sigs: { signature: 0n, owner: TEST_GASLESS_SIGNER, nonce: TEST_GASLESS_SIGNER },
} as const;

/** The selector of a relayable write, taken from the canonical SDK map (never hardcoded). */
function relayableSelector(operationType: string): Hex {
  for (const [selector, write] of GASLESS_RELAYABLE_WRITES) {
    if (write.operationType === operationType) return selector;
  }
  throw new Error(`no relayable write is labelled "${operationType}"`);
}

const DEALLOCATE_SELECTOR = relayableSelector("deallocate");
const INITIATE_WITHDRAW_SELECTOR = relayableSelector("initiateWithdraw");

/** The `isDelegationActive` reads the stub was asked for, in order, as `[account, delegate, selector]`. */
function delegationReads(readContract: ReturnType<typeof vi.fn>): unknown[][] {
  return readContract.mock.calls
    .map(([read]) => read as StubRead)
    .filter((read) => read.functionName === "isDelegationActive")
    .map((read) => [...(read.args ?? [])]);
}

/** One read the public-client stub is asked to serve. */
interface StubRead {
  functionName: string;
  args?: readonly unknown[];
}

/**
 * Program the public-client stub per contract function name. An override value
 * is returned as-is; an override **function** is called with the read, so a test
 * can answer per-argument (which selector, which account).
 */
function programReads(readContract: ReturnType<typeof vi.fn>, overrides?: Partial<Record<string, unknown>>): void {
  const registryInstantLayer = getChainConfig(GASLESS_TEST_CHAIN).addresses.instantLayerAddress;
  readContract.mockImplementation((read: StubRead) => {
    const { functionName } = read;
    if (functionName in (overrides ?? {})) {
      const override = overrides![functionName];
      return Promise.resolve(
        typeof override === "function" ? (override as (read: StubRead) => unknown)(read) : override,
      );
    }
    switch (functionName) {
      case "instantLayer":
        return Promise.resolve(registryInstantLayer);
      case "getSubAccount":
        return Promise.resolve({
          accountAddress: SUB_ACCOUNT,
          owner: TEST_GASLESS_SIGNER,
          name: "Main",
          isExists: true,
          singleVAMode: false,
          affiliate: SUB_ACCOUNT,
          symmioCore: SUB_ACCOUNT,
        });
      case "isDelegationActive":
        return Promise.resolve(true);
      case "nonces":
        return Promise.resolve(5n);
      case "getAccountOperationalFee":
        return Promise.resolve([0n, 1n, false]);
      case "getVirtualAccount":
        return Promise.resolve({
          accountAddress: VIRTUAL_ACCOUNT,
          parentAccount: SUB_ACCOUNT,
          symbolId: 1n,
          isExists: true,
        });
      default:
        return Promise.reject(new Error(`unprogrammed read: ${functionName}`));
    }
  });
}

function programRelaySuccess(): void {
  post.mockResolvedValue({
    headers: HEADERS,
    data: { request_id: "req-1", status: "queued", paid_fee: "0", remaining_fee_allowance: "0" },
  });
  get.mockResolvedValue({
    headers: HEADERS,
    data: {
      id: "req-1",
      user_address: TEST_GASLESS_SIGNER,
      operation_type: "initiateWithdraw",
      payload: {},
      status: "submitted",
      tx_hash: RELAY_TX_HASH,
    },
  });
}

/** The relay body the assertions below read back out of the mocked POST. */
interface RelayBody {
  operationType: string;
  signedOps: { signer: string; signerAccount: { addr: string }; replayAttackHeader: { nonce: number } }[];
  signatures: string[];
}

/**
 * The two core calls a deallocate-then-withdraw batch hands the dispatcher,
 * built exactly as `callAsSubAccount` builds them (core diamond target, real
 * encoded calldata) so the selectors are the ones the relayable map carries.
 */
function batchCalls(): GaslessDispatchCall[] {
  const target = getChainConfig(GASLESS_TEST_CHAIN).addresses.symmioAddress;
  return [
    {
      target,
      callData: encodeFunctionData({
        abi: symmioAbi,
        functionName: "deallocate",
        args: [1_000_000_000_000_000_000n, UPNL_SIG],
      }),
    },
    {
      target,
      callData: encodeFunctionData({ abi: symmioAbi, functionName: "initiateWithdraw", args: [PARTS, false, "0x"] }),
    },
  ];
}

describe("transparent gasless dispatch", () => {
  beforeEach(() => {
    post.mockReset();
    get.mockReset();
  });

  it("stays on the wallet path when gasless is off (the default)", async () => {
    const { config, readContract, writeContract } = gaslessWriteTestConfig();
    programReads(readContract);

    const hash = await initiateWithdraw(config, { account: SUB_ACCOUNT, parts: PARTS });

    expect(hash).toBe(TEST_GASLESS_TX_HASH);
    expect(writeContract).toHaveBeenCalledTimes(1);
    expect(post).not.toHaveBeenCalled();
  });

  it("relays a _call-proxied write when the config mode is gasless, returning the broadcast hash", async () => {
    const { config, readContract, writeContract, signTypedData } = gaslessWriteTestConfig({
      execution: { mode: "gasless" },
    });
    programReads(readContract);
    programRelaySuccess();

    const hash = await initiateWithdraw(config, { account: SUB_ACCOUNT, parts: PARTS });

    expect(hash).toBe(RELAY_TX_HASH);
    expect(writeContract).not.toHaveBeenCalled();
    expect(signTypedData).toHaveBeenCalledTimes(1);

    const body = post.mock.calls[0]?.[1] as {
      operationType: string;
      signedOps: { signerAccount: { addr: string }; replayAttackHeader: { nonce: number } }[];
    };
    expect(body.operationType).toBe("initiateWithdraw");
    expect(body.signedOps[0]?.signerAccount.addr).toBe(SUB_ACCOUNT);
    expect(body.signedOps[0]?.replayAttackHeader.nonce).toBe(6);
  });

  it("relays an atomic two-call batch with strictly sequential nonces", async () => {
    const { config, readContract } = gaslessWriteTestConfig({ execution: { mode: "gasless" } });
    programReads(readContract);
    programRelaySuccess();

    await deallocateAndInitiateWithdraw(config, {
      account: SUB_ACCOUNT,
      amount: 1_000_000_000_000_000_000n,
      parts: PARTS,
      upnlSig: UPNL_SIG,
    });

    const body = post.mock.calls[0]?.[1] as {
      signedOps: { replayAttackHeader: { nonce: number } }[];
      signatures: string[];
    };
    expect(body.signedOps).toHaveLength(2);
    expect(body.signedOps.map((op) => op.replayAttackHeader.nonce)).toEqual([6, 7]);
    expect(body.signatures).toHaveLength(2);
  });

  it("resolves a margin write's billing account to the VA's parent sub-account", async () => {
    const { config, readContract } = gaslessWriteTestConfig({ execution: { mode: "gasless" } });
    programReads(readContract);
    programRelaySuccess();

    const hash = await addMargin(config, { virtualAccount: VIRTUAL_ACCOUNT, amount: 1n, gasless: true });

    expect(hash).toBe(RELAY_TX_HASH);
    const body = post.mock.calls[0]?.[1] as { signedOps: { signerAccount: { addr: string } }[] };
    expect(body.signedOps[0]?.signerAccount.addr).toBe(SUB_ACCOUNT);
  });

  it("bills a deposit to the sub-account itself when the target is not a virtual account", async () => {
    const { config, readContract } = gaslessWriteTestConfig({ execution: { mode: "gasless" } });
    /** A plain sub-account: `getVirtualAccount` finds no VA record for it. */
    programReads(readContract, {
      getVirtualAccount: { accountAddress: SUB_ACCOUNT, parentAccount: SUB_ACCOUNT, symbolId: 0n, isExists: false },
    });
    programRelaySuccess();

    const hash = await depositForAccount(config, { account: SUB_ACCOUNT, amount: 1_000_000n, gasless: true });

    expect(hash).toBe(RELAY_TX_HASH);
    const body = post.mock.calls[0]?.[1] as { signedOps: { signerAccount: { addr: string } }[] };
    expect(body.signedOps[0]?.signerAccount.addr).toBe(SUB_ACCOUNT);
  });

  it("bills a deposit into a virtual account to that VA's parent", async () => {
    const { config, readContract } = gaslessWriteTestConfig({ execution: { mode: "gasless" } });
    programReads(readContract);
    programRelaySuccess();

    await depositForAccount(config, { account: VIRTUAL_ACCOUNT, amount: 1_000_000n, gasless: true });

    const body = post.mock.calls[0]?.[1] as { signedOps: { signerAccount: { addr: string } }[] };
    expect(body.signedOps[0]?.signerAccount.addr).toBe(SUB_ACCOUNT);
  });

  it("refuses to relay createSubAccounts without an account to bill and sign under", async () => {
    const { config, readContract } = gaslessWriteTestConfig({ execution: { mode: "gasless" } });
    programReads(readContract);
    programRelaySuccess();

    /**
     * The subaccounts being created do not exist yet, and the action carries no
     * account of its own, so the caller has to name an existing one.
     */
    await expect(
      createSubAccounts(config, {
        affiliate: SUB_ACCOUNT,
        accountsData: [
          {
            name: "Main",
            metadata: "0x",
            symmioCore: SUB_ACCOUNT,
            isolationType: SubAccountIsolationType.MARKET,
            singleVAMode: true,
          },
        ],
        gasless: true,
      }),
    ).rejects.toThrowError(/GASLESS_ACCOUNT_UNRESOLVED|sub-account to relay under/);
    expect(post).not.toHaveBeenCalled();
  });

  it("relays createSubAccounts under the existing sub-account named by gasless.account", async () => {
    const { config, readContract } = gaslessWriteTestConfig({ execution: { mode: "gasless" } });
    programReads(readContract);
    programRelaySuccess();

    await createSubAccounts(config, {
      affiliate: SUB_ACCOUNT,
      accountsData: [
        {
          name: "Main",
          metadata: "0x",
          symmioCore: SUB_ACCOUNT,
          isolationType: SubAccountIsolationType.MARKET,
          singleVAMode: true,
        },
      ],
      gasless: { enabled: true, account: SUB_ACCOUNT },
    });

    const body = post.mock.calls[0]?.[1] as { signedOps: { signerAccount: { addr: string } }[] };
    expect(body.signedOps[0]?.signerAccount.addr).toBe(SUB_ACCOUNT);
  });

  it("throws the typed config error on an explicit gasless: true for an unconfigured chain", async () => {
    const { config, readContract } = gaslessWriteTestConfig();
    programReads(readContract);
    /** HyperEVM in this config has no gasless block and runs 0.8.5. */
    await expect(
      initiateWithdraw(config, { account: SUB_ACCOUNT, parts: PARTS, chainId: 999, gasless: true }),
    ).rejects.toThrowError(/GASLESS|gasless/);
  });

  it("falls back to the wallet path on a definitive fee-limit rejection under fallback: wallet", async () => {
    const { config, readContract, writeContract } = gaslessWriteTestConfig({
      execution: { mode: "gasless", fallback: "wallet" },
    });
    programReads(readContract);
    post.mockRejectedValue({
      isAxiosError: true,
      message: "conflict",
      response: { status: 409, statusText: "Conflict", data: { detail: { code: "FEE_POLICY_WOULD_REVERT" } } },
      config: { url: "/gateway/relay-instant", method: "post" },
    });

    const hash = await initiateWithdraw(config, { account: SUB_ACCOUNT, parts: PARTS });

    expect(hash).toBe(TEST_GASLESS_TX_HASH);
    expect(writeContract).toHaveBeenCalledTimes(1);
  });

  it("throws (no fallback) on the same rejection under the default fallback: error", async () => {
    const { config, readContract, writeContract } = gaslessWriteTestConfig({ execution: { mode: "gasless" } });
    programReads(readContract);
    post.mockRejectedValue({
      isAxiosError: true,
      message: "conflict",
      response: { status: 409, statusText: "Conflict", data: { detail: { code: "INSUFFICIENT_ALLOWANCE" } } },
      config: { url: "/gateway/relay-instant", method: "post" },
    });

    await expect(initiateWithdraw(config, { account: SUB_ACCOUNT, parts: PARTS })).rejects.toThrowError(
      /GASLESS_RELAY_SUBMIT_FAILED|INSUFFICIENT/,
    );
    expect(writeContract).not.toHaveBeenCalled();
  });

  it("stops before any signature when the daily quota would block", async () => {
    const { config, readContract, signTypedData } = gaslessWriteTestConfig({ execution: { mode: "gasless" } });
    programReads(readContract, { getAccountOperationalFee: [1_000_000n, 0n, true] });

    await expect(initiateWithdraw(config, { account: SUB_ACCOUNT, parts: PARTS })).rejects.toThrowError(
      /GASLESS_FEE_UNAFFORDABLE|quota/,
    );
    expect(signTypedData).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it("refuses to relay when the gateway verifies against a different InstantLayer", async () => {
    const { config, readContract } = gaslessWriteTestConfig({ execution: { mode: "gasless" } });
    programReads(readContract, { instantLayer: "0x9999999999999999999999999999999999999999" });

    await expect(initiateWithdraw(config, { account: SUB_ACCOUNT, parts: PARTS })).rejects.toThrowError(
      /GASLESS_CONFIG_INCOHERENT|InstantLayer/,
    );
  });

  it("emits accepted and broadcast events with the request id", async () => {
    const events: { type: string; requestId?: string }[] = [];
    const { config, readContract } = gaslessWriteTestConfig({
      execution: { mode: "gasless", onEvent: (event: GaslessRelayEvent) => events.push(event) },
    });
    programReads(readContract);
    programRelaySuccess();

    await initiateWithdraw(config, { account: SUB_ACCOUNT, parts: PARTS });

    expect(events.map((event) => event.type)).toEqual(["accepted", "broadcast"]);
    expect(events[0]?.requestId).toBe("req-1");
  });
  describe("delegation pre-flight", () => {
    it("skips every delegation read when the signer is the sub-account's owner", async () => {
      const { config, readContract, signTypedData } = gaslessWriteTestConfig({ execution: { mode: "gasless" } });
      programReads(readContract);
      programRelaySuccess();

      const hash = await maybeRelayAsGasless(config, {
        gasless: true,
        signerAccount: SUB_ACCOUNT,
        calls: batchCalls(),
      });

      expect(hash).toBe(RELAY_TX_HASH);
      /** The owner needs no delegation: the cached owner read is the only extra call. */
      expect(delegationReads(readContract)).toEqual([]);
      expect(signTypedData).toHaveBeenCalledTimes(2);
      const body = post.mock.calls[0]?.[1] as RelayBody;
      expect(body.signedOps.map((op) => op.signer)).toEqual([TEST_GASLESS_SIGNER, TEST_GASLESS_SIGNER]);
    });

    it("relays for a delegated session key, signing as the key under the sub-account's authority", async () => {
      const { config, readContract, signTypedData } = gaslessWriteTestConfig(
        { execution: { mode: "gasless" } },
        { signersByFrom: { [SESSION_KEY]: SESSION_KEY } },
      );
      programReads(readContract);
      programRelaySuccess();

      const hash = await maybeRelayAsGasless(config, {
        gasless: true,
        from: SESSION_KEY,
        signerAccount: SUB_ACCOUNT,
        calls: batchCalls(),
      });

      expect(hash).toBe(RELAY_TX_HASH);
      /** One `isDelegationActive` read per distinct selector, for this key under this sub-account. */
      expect(delegationReads(readContract)).toEqual([
        [SUB_ACCOUNT, SESSION_KEY, DEALLOCATE_SELECTOR],
        [SUB_ACCOUNT, SESSION_KEY, INITIATE_WITHDRAW_SELECTOR],
      ]);
      expect(signTypedData).toHaveBeenCalledTimes(2);

      /**
       * The assertion the whole session-key feature rests on: the operation is
       * SIGNED BY THE SESSION KEY while its authority — `signerAccount`, the
       * account the InstantLayer runs the call under — stays the SUB-ACCOUNT.
       */
      const body = post.mock.calls[0]?.[1] as RelayBody;
      expect(body.signedOps.map((op) => op.signer)).toEqual([SESSION_KEY, SESSION_KEY]);
      expect(body.signedOps.map((op) => op.signerAccount.addr)).toEqual([SUB_ACCOUNT, SUB_ACCOUNT]);
      expect(SESSION_KEY).not.toBe(TEST_GASLESS_SIGNER);
    });

    it("throws GASLESS_SIGNER_NOT_DELEGATED before any signature prompt when a selector is missing", async () => {
      const { config, readContract, signTypedData } = gaslessWriteTestConfig(
        { execution: { mode: "gasless" } },
        { signersByFrom: { [SESSION_KEY]: SESSION_KEY } },
      );
      programReads(readContract, {
        isDelegationActive: (read: StubRead) => read.args?.[2] !== INITIATE_WITHDRAW_SELECTOR,
      });
      programRelaySuccess();

      const relay = maybeRelayAsGasless(config, {
        gasless: true,
        from: SESSION_KEY,
        signerAccount: SUB_ACCOUNT,
        calls: batchCalls(),
      });

      await expect(relay).rejects.toThrowError(/GASLESS_SIGNER_NOT_DELEGATED|no active InstantLayer delegation/);
      await expect(relay).rejects.toThrowError(new RegExp(INITIATE_WITHDRAW_SELECTOR));
      /** The point of the pre-flight: the user is never prompted for a signature that cannot land. */
      expect(signTypedData).not.toHaveBeenCalled();
      expect(post).not.toHaveBeenCalled();
    });

    it("returns null instead of throwing for a missing delegation under fallback: wallet", async () => {
      const { config, readContract, signTypedData } = gaslessWriteTestConfig(
        { execution: { mode: "gasless" } },
        { signersByFrom: { [SESSION_KEY]: SESSION_KEY } },
      );
      programReads(readContract, {
        isDelegationActive: (read: StubRead) => read.args?.[2] !== INITIATE_WITHDRAW_SELECTOR,
      });

      const hash = await maybeRelayAsGasless(config, {
        gasless: { enabled: true, fallback: "wallet" },
        from: SESSION_KEY,
        signerAccount: SUB_ACCOUNT,
        calls: batchCalls(),
      });

      expect(hash).toBeNull();
      expect(signTypedData).not.toHaveBeenCalled();
      expect(post).not.toHaveBeenCalled();
    });

    it("issues no delegation reads at all when preflightDelegation is false", async () => {
      const { config, readContract } = gaslessWriteTestConfig(
        { execution: { mode: "gasless", preflightDelegation: false } },
        { signersByFrom: { [SESSION_KEY]: SESSION_KEY } },
      );
      /** Every delegation would read as inactive — the relay proceeds only because the pre-flight is off. */
      programReads(readContract, { isDelegationActive: false });
      programRelaySuccess();

      const hash = await maybeRelayAsGasless(config, {
        gasless: true,
        from: SESSION_KEY,
        signerAccount: SUB_ACCOUNT,
        calls: batchCalls(),
      });

      expect(hash).toBe(RELAY_TX_HASH);
      expect(delegationReads(readContract)).toEqual([]);
      expect(readContract.mock.calls.some(([read]) => (read as StubRead).functionName === "getSubAccount")).toBe(false);
    });
  });
});
