import { readFileSync } from "node:fs";
import { join } from "node:path";
import { toFunctionSelector, type AbiFunction } from "viem";
import { describe, expect, it } from "vitest";
import { instantLayerAbi } from "../symmio-contracts/abi/v0.8.6/instant-layer";
import {
  GASLESS_RELAYABLE_SELECTORS,
  GASLESS_RELAYABLE_WRITES,
  GASLESS_SESSION_KEY_SELECTORS,
  GASLESS_SESSION_KEY_WITHDRAW_SELECTORS,
  isGaslessRelayableSelector,
  type GaslessRelayableTarget,
  type GaslessRelayableWrite,
} from "./relayable-writes";

const GRANT_DELEGATION_SELECTOR = toFunctionSelector(
  instantLayerAbi.find((item) => item.type === "function" && item.name === "grantDelegation") as AbiFunction,
);

describe("gasless selector sets", () => {
  it("relays grantDelegation, so onboarding a session key needs no gas", () => {
    expect(GASLESS_RELAYABLE_SELECTORS).toContain(GRANT_DELEGATION_SELECTOR);
    expect(isGaslessRelayableSelector(GRANT_DELEGATION_SELECTOR)).toBe(true);
  });

  it("never offers grantDelegation as a session-key grant", () => {
    /**
     * Not an escalation guard — the contract already forbids the escalation.
     * The InstantLayer routes a self-targeted operation to
     * `_verifyGrantOperation`, which reverts unless the signer is the account
     * owner, and `grantDelegation` is `onlyOwner` on top of that, so a
     * delegate-signed grant never lands. Granting the selector would buy a key
     * nothing and turn a clear "the owner must sign this" into an opaque relay
     * rejection.
     */
    expect(GASLESS_SESSION_KEY_SELECTORS).not.toContain(GRANT_DELEGATION_SELECTOR);
    expect(GASLESS_SESSION_KEY_WITHDRAW_SELECTORS).not.toContain(GRANT_DELEGATION_SELECTOR);
  });

  it("only offers selectors the relayer will actually carry", () => {
    for (const selector of [...GASLESS_SESSION_KEY_SELECTORS, ...GASLESS_SESSION_KEY_WITHDRAW_SELECTORS]) {
      expect(isGaslessRelayableSelector(selector)).toBe(true);
    }
  });

  it("is enumerated deliberately, so a newly relayable write never joins it", () => {
    /**
     * The set is written out by hand rather than derived from the relayable map.
     * If it were derived, registering any new relayable write would silently
     * widen what a browser-held session key may sign. This assertion is the
     * guard: adding a selector here has to be a deliberate edit to both files.
     */
    const delegable = GASLESS_SESSION_KEY_SELECTORS.map(
      (selector) => GASLESS_RELAYABLE_WRITES.get(selector)?.operationType,
    );
    expect(delegable).toEqual([
      "allocate",
      "deallocate",
      "requestCancelWithdraw",
      "finalizeWithdrawRequest",
      "requestToCancelQuote",
      "requestToCancelCloseRequest",
      "forceCancelQuote",
      "forceCancelCloseRequest",
      "forceClosePosition",
      "approveOperationalFee",
      "addMargin",
      "removeMargin",
      "editAccountName",
    ]);
  });

  it("keeps the relayable-but-owner-signed writes out of a session key's reach", () => {
    /**
     * These relay without native gas, but each still costs one wallet signature.
     * `createSubAccounts` is the one relayable AccountLayer write with no
     * `onlyAccountOwner` guard, so the delegation scope never confines it;
     * `deleteSubAccount` destroys the account the delegation is scoped to; and
     * the two deposit writes move the owner's own token balance, collateral that
     * has not entered the sub-account yet — not something a bounded session key
     * gets to do unattended. Withdrawals are a separate, narrower boundary: only
     * `initiateWithdraw` names a destination, and it lives in
     * {@link GASLESS_SESSION_KEY_WITHDRAW_SELECTORS} behind an explicit opt-in.
     */
    const ownerSigned = ["createSubAccounts", "deleteSubAccount", "depositForAccount", "depositAndAllocateForAccount"];
    const delegable = new Set(
      GASLESS_SESSION_KEY_SELECTORS.map((selector) => GASLESS_RELAYABLE_WRITES.get(selector)?.operationType),
    );
    for (const operationType of ownerSigned) {
      expect(delegable.has(operationType), `${operationType} must stay owner-signed`).toBe(false);
    }
  });

  it("splits the withdrawal boundary at the one write that names a receiver", () => {
    /**
     * `initiateWithdraw(WithdrawPart[] parts, bool speedUp, bytes data)` carries
     * a caller-supplied `receiver` in every part, so delegating it hands the key
     * authority over the sub-account's collateral. `finalizeWithdrawRequest` and
     * `requestCancelWithdraw` take no receiver and can only settle or unwind a
     * request whose destination an owner-signed initiate already fixed.
     */
    const withdrawOnly = GASLESS_SESSION_KEY_WITHDRAW_SELECTORS.map(
      (selector) => GASLESS_RELAYABLE_WRITES.get(selector)?.operationType,
    );
    expect(withdrawOnly).toEqual(["initiateWithdraw"]);

    const delegable = new Set(
      GASLESS_SESSION_KEY_SELECTORS.map((selector) => GASLESS_RELAYABLE_WRITES.get(selector)?.operationType),
    );
    expect(delegable.has("initiateWithdraw")).toBe(false);
    expect(delegable.has("finalizeWithdrawRequest")).toBe(true);
    expect(delegable.has("requestCancelWithdraw")).toBe(true);
  });

  it("keeps the two session-key sets disjoint", () => {
    const base = new Set<string>(GASLESS_SESSION_KEY_SELECTORS);
    for (const selector of GASLESS_SESSION_KEY_WITHDRAW_SELECTORS) {
      expect(base.has(selector), `${selector} must live in exactly one session-key set`).toBe(false);
    }
  });

  it("matches selectors case-insensitively, as calldata slices arrive", () => {
    expect(
      isGaslessRelayableSelector(GRANT_DELEGATION_SELECTOR.toUpperCase().replace("0X", "0x") as `0x${string}`),
    ).toBe(true);
  });
});

/**
 * The registry claims relayability is "a compile-time truth". It is only true
 * if every registered selector's action actually accepts `gasless` and routes
 * through a seam — `finalizeWithdrawRequest` was registered here (and listed in
 * the docs) for a while with neither, so the selector was unreachable.
 */
describe("every relayable write has a real seam", () => {
  const ACTION_DIRECTORY: Record<GaslessRelayableTarget, string> = {
    symmio: "symmio-contracts/symmio/actions",
    accountLayer: "symmio-contracts/account-layer/actions",
    instantLayer: "symmio-contracts/instant-layer/actions",
  };

  /** Writes whose action does not live under its target's action directory. */
  const ACTION_PATH_OVERRIDES: Record<string, string> = {
    forceClosePosition: "solvers/force-close/force-close-position.ts",
  };

  function actionSourcePath(write: GaslessRelayableWrite): string {
    const override = ACTION_PATH_OVERRIDES[write.operationType];
    if (override) return join(import.meta.dirname, "..", override);
    const fileName = write.operationType.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    return join(import.meta.dirname, "..", ACTION_DIRECTORY[write.target], `${fileName}.ts`);
  }

  for (const [selector, write] of GASLESS_RELAYABLE_WRITES) {
    it(`${write.operationType} accepts \`gasless\` and dispatches through a seam`, () => {
      const source = readFileSync(actionSourcePath(write), "utf8");

      expect(source, `${write.operationType} (${selector}) does not accept the \`gasless\` parameter`).toContain(
        "GaslessWriteParameter",
      );
      /**
       * Either the action calls the dispatcher itself (a direct-to-contract
       * write) or it goes through `callAsSubAccount`, whose `_call` proxy
       * carries the seam for it.
       */
      const dispatches = source.includes("maybeRelayAsGasless") || source.includes("callAsSubAccount");
      expect(dispatches, `${write.operationType} (${selector}) never reaches the gasless dispatcher`).toBe(true);
    });
  }
});
