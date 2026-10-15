import type { Address, Hex } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { findUndelegatedGaslessSelectors } from "../../gasless/delegation-preflight";
import { delegationReads, programDelegationReads, readFunctionNames } from "../../shared/test/delegation-reads";
import { mockConfig } from "../../shared/test/mock-config";
import {
  ADD_MARGIN_TO_NEXT_VA_SELECTOR,
  REQUEST_TO_CLOSE_POSITION_SELECTOR,
  SEND_QUOTE_SELECTOR,
} from "../instant-open/shared/selectors";
import { assertInstantSignerDelegated } from "./instant-delegation-preflight";

vi.mock("../../gasless/delegation-preflight", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../gasless/delegation-preflight")>();
  return { ...actual, findUndelegatedGaslessSelectors: vi.fn(actual.findUndelegatedGaslessSelectors) };
});

const SUB_ACCOUNT: Address = "0x0000000000000000000000000000000000005ab1";
const OTHER_SUB_ACCOUNT: Address = "0x0000000000000000000000000000000000005ab2";
const VA_A: Address = "0x00000000000000000000000000000000000000aa";
const VA_B: Address = "0x00000000000000000000000000000000000000bb";
const VA_OTHER: Address = "0x00000000000000000000000000000000000000cc";
const OWNER: Address = "0x0000000000000000000000000000000000000a11";
const SESSION_KEY: Address = "0x0000000000000000000000000000000000005e55";

/** An operation as the check sees it: a signer, the account it signs under, and calldata led by `selector`. */
function operation(signer: Address, account: Address, selector: Hex) {
  return {
    signer,
    signerAccount: { addr: account, isPartyB: false },
    callData: `${selector}${"00".repeat(32)}` as Hex,
  };
}

describe("assertInstantSignerDelegated", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("skips every delegation read when the signer owns the sub-account", async () => {
    const { config, readContract } = mockConfig();
    programDelegationReads(readContract, { owners: { [SUB_ACCOUNT]: OWNER } });

    await assertInstantSignerDelegated(config, {
      action: "instantOpen",
      operations: [
        operation(OWNER, SUB_ACCOUNT, ADD_MARGIN_TO_NEXT_VA_SELECTOR),
        operation(OWNER, SUB_ACCOUNT, SEND_QUOTE_SELECTOR),
      ],
    });

    expect(readFunctionNames(readContract)).toEqual(["getVirtualAccount", "getSubAccount"]);
  });

  it("resolves a session key through the gasless delegation pre-flight, one read per selector", async () => {
    const { config, readContract } = mockConfig();
    programDelegationReads(readContract, { owners: { [SUB_ACCOUNT]: OWNER } });

    await assertInstantSignerDelegated(config, {
      action: "instantOpen",
      operations: [
        operation(SESSION_KEY, SUB_ACCOUNT, ADD_MARGIN_TO_NEXT_VA_SELECTOR),
        operation(SESSION_KEY, SUB_ACCOUNT, SEND_QUOTE_SELECTOR),
      ],
    });

    expect(findUndelegatedGaslessSelectors).toHaveBeenCalledOnce();
    expect(findUndelegatedGaslessSelectors).toHaveBeenCalledWith(config, {
      chainId: config.getChainConfig().chainId,
      signer: SESSION_KEY,
      signerAccount: SUB_ACCOUNT,
      selectors: [ADD_MARGIN_TO_NEXT_VA_SELECTOR, SEND_QUOTE_SELECTOR],
    });
    expect(delegationReads(readContract)).toEqual([
      [SUB_ACCOUNT, SESSION_KEY, ADD_MARGIN_TO_NEXT_VA_SELECTOR],
      [SUB_ACCOUNT, SESSION_KEY, SEND_QUOTE_SELECTOR],
    ]);
  });

  it("throws INSTANT_SIGNER_NOT_DELEGATED naming the action, signer, sub-account and missing selector", async () => {
    const { config, readContract } = mockConfig();
    programDelegationReads(readContract, {
      owners: { [SUB_ACCOUNT]: OWNER },
      isDelegationActive: (_delegator, _delegate, selector) => selector !== SEND_QUOTE_SELECTOR,
    });

    const check = assertInstantSignerDelegated(config, {
      action: "instantOpen",
      operations: [
        operation(SESSION_KEY, SUB_ACCOUNT, ADD_MARGIN_TO_NEXT_VA_SELECTOR),
        operation(SESSION_KEY, SUB_ACCOUNT, SEND_QUOTE_SELECTOR),
      ],
    });

    await expect(check).rejects.toMatchObject({ kind: "validation", code: "INSTANT_SIGNER_NOT_DELEGATED" });
    await expect(check).rejects.toThrowError(
      `instantOpen: signer ${SESSION_KEY} holds no active InstantLayer delegation from sub-account ${SUB_ACCOUNT} for selector(s) ${SEND_QUOTE_SELECTOR}.`,
    );
  });

  it("checks a virtual account's close against its parent sub-account", async () => {
    const { config, readContract } = mockConfig();
    programDelegationReads(readContract, { parents: { [VA_A]: SUB_ACCOUNT }, owners: { [SUB_ACCOUNT]: OWNER } });

    await assertInstantSignerDelegated(config, {
      action: "instantClose",
      operations: [operation(SESSION_KEY, VA_A, REQUEST_TO_CLOSE_POSITION_SELECTOR)],
    });

    /** The InstantLayer enforces a VA's delegation on its parent, so the VA itself is never probed. */
    expect(delegationReads(readContract)).toEqual([[SUB_ACCOUNT, SESSION_KEY, REQUEST_TO_CLOSE_POSITION_SELECTOR]]);
  });

  it("checks a bulk close across one sub-account's virtual accounts once", async () => {
    const { config, readContract } = mockConfig();
    programDelegationReads(readContract, {
      parents: { [VA_A]: SUB_ACCOUNT, [VA_B]: SUB_ACCOUNT },
      owners: { [SUB_ACCOUNT]: OWNER },
    });

    await assertInstantSignerDelegated(config, {
      action: "instantCloseBulk",
      operations: [
        operation(SESSION_KEY, VA_A, REQUEST_TO_CLOSE_POSITION_SELECTOR),
        operation(SESSION_KEY, VA_B, REQUEST_TO_CLOSE_POSITION_SELECTOR),
      ],
    });

    expect(readFunctionNames(readContract).filter((name) => name === "getSubAccount")).toHaveLength(1);
    expect(delegationReads(readContract)).toEqual([[SUB_ACCOUNT, SESSION_KEY, REQUEST_TO_CLOSE_POSITION_SELECTOR]]);
  });

  it("names only the sub-account that lacks the delegation when a bulk close spans two", async () => {
    const { config, readContract } = mockConfig();
    programDelegationReads(readContract, {
      parents: { [VA_A]: SUB_ACCOUNT, [VA_OTHER]: OTHER_SUB_ACCOUNT },
      owners: { [SUB_ACCOUNT]: OWNER, [OTHER_SUB_ACCOUNT]: OWNER },
      isDelegationActive: (delegator) => delegator === SUB_ACCOUNT,
    });

    const check = assertInstantSignerDelegated(config, {
      action: "instantCloseBulk",
      operations: [
        operation(SESSION_KEY, VA_A, REQUEST_TO_CLOSE_POSITION_SELECTOR),
        operation(SESSION_KEY, VA_OTHER, REQUEST_TO_CLOSE_POSITION_SELECTOR),
      ],
    });

    await expect(check).rejects.toThrowError(`from sub-account ${OTHER_SUB_ACCOUNT}`);
    await expect(check).rejects.not.toThrowError(`from sub-account ${SUB_ACCOUNT}`);
  });

  it("skips the delegation reads when the AccountLayer knows no such sub-account", async () => {
    const { config, readContract } = mockConfig();
    programDelegationReads(readContract, { isDelegationActive: () => false });

    await assertInstantSignerDelegated(config, {
      action: "instantClose",
      operations: [operation(SESSION_KEY, SUB_ACCOUNT, REQUEST_TO_CLOSE_POSITION_SELECTOR)],
    });

    /** No owner to compare against: the contract gives the accurate error, not a guessed one. */
    expect(delegationReads(readContract)).toEqual([]);
  });

  it("reads nothing when the check is disabled", async () => {
    const { config, readContract } = mockConfig();
    programDelegationReads(readContract, { owners: { [SUB_ACCOUNT]: OWNER }, isDelegationActive: () => false });

    await assertInstantSignerDelegated(config, {
      action: "instantClose",
      operations: [operation(SESSION_KEY, SUB_ACCOUNT, REQUEST_TO_CLOSE_POSITION_SELECTOR)],
      enabled: false,
    });

    expect(readContract).not.toHaveBeenCalled();
  });

  it("propagates a failed read instead of letting the trade through unchecked", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockRejectedValue(new Error("RPC unavailable"));

    await expect(
      assertInstantSignerDelegated(config, {
        action: "instantClose",
        operations: [operation(SESSION_KEY, SUB_ACCOUNT, REQUEST_TO_CLOSE_POSITION_SELECTOR)],
      }),
    ).rejects.toThrowError("RPC unavailable");
  });
});
