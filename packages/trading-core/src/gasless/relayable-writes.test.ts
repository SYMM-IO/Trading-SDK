import { readFileSync } from "node:fs";
import { join } from "node:path";
import { toFunctionSelector, type AbiFunction } from "viem";
import { describe, expect, it } from "vitest";
import { instantLayerAbi } from "../symmio-contracts/abi/v0.8.6/instant-layer";
import {
  GASLESS_RELAYABLE_SELECTORS,
  GASLESS_RELAYABLE_WRITES,
  GASLESS_SESSION_KEY_SELECTORS,
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
     * The escalation this guard exists for: a key holding this selector could
     * mint itself further delegations over any selector and any expiry, which
     * makes the bounded session key unbounded.
     */
    expect(GASLESS_SESSION_KEY_SELECTORS).not.toContain(GRANT_DELEGATION_SELECTOR);
  });

  it("only offers selectors the relayer will actually carry", () => {
    for (const selector of GASLESS_SESSION_KEY_SELECTORS) {
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
      "initiateWithdraw",
      "requestCancelWithdraw",
      "finalizeWithdrawRequest",
      "requestToCancelQuote",
      "requestToCancelCloseRequest",
      "forceCancelQuote",
      "forceCancelCloseRequest",
      "approveOperationalFee",
      "addMargin",
      "removeMargin",
    ]);
  });

  it("keeps the relayable-but-owner-signed writes out of a session key's reach", () => {
    /**
     * These relay without native gas, but each still costs one wallet signature:
     * account creation, deletion, renaming, moving the owner's own collateral and
     * force-closing are not things a bounded session key gets to do unattended.
     */
    const ownerSigned = [
      "createSubAccounts",
      "deleteSubAccount",
      "editAccountName",
      "depositForAccount",
      "depositAndAllocateForAccount",
      "forceClosePosition",
    ];
    const delegable = new Set(
      GASLESS_SESSION_KEY_SELECTORS.map((selector) => GASLESS_RELAYABLE_WRITES.get(selector)?.operationType),
    );
    for (const operationType of ownerSigned) {
      expect(delegable.has(operationType), `${operationType} must stay owner-signed`).toBe(false);
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
