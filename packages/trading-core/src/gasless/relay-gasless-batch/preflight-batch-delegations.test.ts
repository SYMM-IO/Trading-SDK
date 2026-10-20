import { erc20Abi, toFunctionSelector, zeroAddress, type Address, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig } from "../../core/chains";
import { getGaslessBatchSelectors, type GaslessBatchCall } from "../batch/calls";
import { resolveGaslessBatchEntries } from "../batch/resolve-gasless-batch";
import { GASLESS_TEST_CHAIN, TEST_GASLESS_SIGNER as OWNER, gaslessWriteTestConfig } from "../test/config";
import { preflightBatchDelegations } from "./preflight-batch-delegations";

const ACCOUNT: Address = "0x3333333333333333333333333333333333333333";
const KEY: Address = "0x5555555555555555555555555555555555555555";
const OTHER_KEY: Address = "0x7777777777777777777777777777777777777777";
const VIRTUAL_ACCOUNT: Address = "0x8888888888888888888888888888888888888888";
const ALLOCATE = toFunctionSelector("allocate(uint256)");
const TIMESTAMP = 2_000_000_000n;
const allocate = { functionName: "allocate", args: [1n] } as const;
const wallet = {
  walletCalls: [{ target: OTHER_KEY, abi: erc20Abi, functionName: "transfer", args: [OTHER_KEY, 1n] }],
} as const;

interface GrantInfo {
  account: { addr: Address; isPartyB: boolean };
  delegatedSigner: Address;
  selectors: readonly Hex[];
  expiryTimestamp: bigint;
}

function grantInfo(overrides: Partial<GrantInfo> = {}): GrantInfo {
  return {
    account: { addr: ACCOUNT, isPartyB: false },
    delegatedSigner: KEY,
    selectors: [ALLOCATE],
    expiryTimestamp: TIMESTAMP + 100n,
    ...overrides,
  };
}

function grant(info = grantInfo()): GaslessBatchCall {
  return { functionName: "grantDelegation", args: [info] };
}

function fixture(options: { account?: Address; liveVirtualAccount?: boolean; owner?: Address; active?: boolean } = {}) {
  const { config, readContract, getBlock } = gaslessWriteTestConfig();
  const account = options.account ?? ACCOUNT;
  const canonicalAccount = options.liveVirtualAccount ? ACCOUNT : account;
  const owner = options.owner ?? OWNER;
  readContract.mockImplementation(async ({ functionName }: { functionName: string }) => {
    if (functionName === "ownerOf") return owner;
    if (functionName === "getVirtualAccount")
      return {
        accountAddress: account,
        parentAccount: ACCOUNT,
        symbolId: 0n,
        isExists: options.liveVirtualAccount ?? false,
      };
    if (functionName === "isDelegationActive") return options.active ?? false;
    throw new Error(`Unexpected read: ${functionName}`);
  });
  async function check(calls: readonly GaslessBatchCall[], entrySigners: readonly Address[]) {
    const entries = resolveGaslessBatchEntries(getChainConfig(GASLESS_TEST_CHAIN).addresses, calls);
    return preflightBatchDelegations(config, {
      chainId: GASLESS_TEST_CHAIN,
      account,
      entries,
      entrySigners,
      identities: entries.some((entry) => entry.type === "wallet")
        ? { canonicalAccount, ownerWallet: owner === zeroAddress ? canonicalAccount : owner }
        : null,
    });
  }
  return { check, readContract, getBlock };
}

describe("batch delegation preflight", () => {
  it.each([
    ["wrong account", { account: { addr: OTHER_KEY, isPartyB: false } }],
    ["PartyB account", { account: { addr: ACCOUNT, isPartyB: true } }],
    ["self delegation", { delegatedSigner: OWNER }],
    ["empty selectors", { selectors: [] }],
    ["expired grant", { expiryTimestamp: TIMESTAMP - 1n }],
    ["expiry at the current block", { expiryTimestamp: TIMESTAMP }],
  ] satisfies [string, Partial<GrantInfo>][])("rejects %s", async (_, overrides) => {
    const { check } = fixture();
    await expect(check([grant(grantInfo(overrides)), allocate], [OWNER, KEY])).rejects.toMatchObject({
      code: "GASLESS_INVALID_DELEGATION_GRANT",
    });
  });

  it("validates every multi-grant entry and rejects empty arrays", async () => {
    const { check } = fixture();
    for (const infos of [[], [grantInfo(), grantInfo({ account: { addr: OTHER_KEY, isPartyB: false } })]]) {
      await expect(check([{ functionName: "grantDelegations", args: [infos] }], [OWNER])).rejects.toMatchObject({
        code: "GASLESS_INVALID_DELEGATION_GRANT",
      });
    }
  });

  it("does not let an existing grant-selector delegation authorize another grant", async () => {
    const { check } = fixture({ active: true });
    await expect(check([grant()], [KEY])).rejects.toMatchObject({ code: "GASLESS_INVALID_DELEGATION_GRANT" });
  });

  it("does not mistake the bare-account wallet owner fallback for grant authority", async () => {
    const { check } = fixture({ owner: zeroAddress });
    await expect(check([wallet], [ACCOUNT])).resolves.toBe(zeroAddress);
    await expect(check([grant(), wallet], [ACCOUNT, KEY])).rejects.toMatchObject({
      code: "GASLESS_INVALID_DELEGATION_GRANT",
    });
  });

  it("accepts duplicate selectors and a zero delegate as the contract does", async () => {
    const { check } = fixture();
    await expect(check([grant(grantInfo({ selectors: [ALLOCATE, ALLOCATE] })), allocate], [OWNER, KEY])).resolves.toBe(
      OWNER,
    );
    await expect(check([grant(grantInfo({ delegatedSigner: zeroAddress }))], [OWNER])).resolves.toBe(OWNER);
  });

  it("uses one block timestamp for multiple grants", async () => {
    const { check, getBlock } = fixture();
    await check([grant(), grant(grantInfo({ delegatedSigner: OTHER_KEY }))], [OWNER, OWNER]);
    expect(getBlock).toHaveBeenCalledExactlyOnceWith({ blockTag: "latest" });
  });

  it("keeps grants separate per delegate across instant and wallet entries", async () => {
    const { check } = fixture();
    const grants: GaslessBatchCall = {
      functionName: "grantDelegations",
      args: [[grantInfo(), grantInfo({ delegatedSigner: OTHER_KEY, selectors: getGaslessBatchSelectors([wallet]) })]],
    };
    await expect(check([grants, allocate, wallet], [OWNER, KEY, OTHER_KEY])).resolves.toBe(OWNER);
    await expect(check([grants, allocate, wallet], [OWNER, KEY, KEY])).rejects.toMatchObject({
      code: "GASLESS_SIGNER_NOT_DELEGATED",
    });
  });

  it("does not retroactively authorize an earlier wallet entry", async () => {
    const { check } = fixture();
    await expect(
      check([wallet, grant(grantInfo({ selectors: getGaslessBatchSelectors([wallet]) })), wallet], [KEY, OWNER, KEY]),
    ).rejects.toMatchObject({ code: "GASLESS_SIGNER_NOT_DELEGATED" });
  });

  it("requires both the wallet sentinel and every inner selector", async () => {
    const { check } = fixture();
    for (const selector of getGaslessBatchSelectors([wallet])) {
      await expect(check([grant(grantInfo({ selectors: [selector] })), wallet], [OWNER, KEY])).rejects.toMatchObject({
        code: "GASLESS_SIGNER_NOT_DELEGATED",
      });
    }
  });

  it("deduplicates active-delegation reads per signer and selector", async () => {
    const { check, readContract, getBlock } = fixture({ active: true });
    await check([allocate, allocate, wallet, wallet], [KEY, KEY, KEY, KEY]);
    const probes = readContract.mock.calls.filter(([read]) => read.functionName === "isDelegationActive");
    expect(probes.map(([read]) => read.args)).toEqual(
      getGaslessBatchSelectors([allocate, wallet]).map((selector) => [ACCOUNT, KEY, selector]),
    );
    expect(readContract.mock.calls.filter(([read]) => read.functionName === "ownerOf")).toHaveLength(1);
    expect(getBlock).not.toHaveBeenCalled();
  });

  it.each([true, false])("uses the parent only for a live virtual account (live=%s)", async (liveVirtualAccount) => {
    const { check, readContract } = fixture({ account: VIRTUAL_ACCOUNT, liveVirtualAccount, active: true });
    await check([allocate, wallet], [KEY, KEY]);
    const probes = readContract.mock.calls.filter(([read]) => read.functionName === "isDelegationActive");
    expect(probes.every(([read]) => read.args[0] === (liveVirtualAccount ? ACCOUNT : VIRTUAL_ACCOUNT))).toBe(true);
    const instant = fixture({ account: VIRTUAL_ACCOUNT, liveVirtualAccount, active: true });
    await instant.check([allocate], [KEY]);
    expect(
      instant.readContract.mock.calls.find(([read]) => read.functionName === "isDelegationActive")?.[0].args,
    ).toEqual([liveVirtualAccount ? ACCOUNT : VIRTUAL_ACCOUNT, KEY, ALLOCATE]);
  });

  it("requires a grant to name the exact operation account even when it shares a canonical parent", async () => {
    const { check } = fixture({ account: VIRTUAL_ACCOUNT, liveVirtualAccount: true });
    await expect(check([grant(), allocate], [OWNER, KEY])).rejects.toMatchObject({
      code: "GASLESS_INVALID_DELEGATION_GRANT",
    });
    await expect(
      check([grant(grantInfo({ account: { addr: VIRTUAL_ACCOUNT, isPartyB: false } })), allocate], [OWNER, KEY]),
    ).resolves.toBe(OWNER);
  });
});
