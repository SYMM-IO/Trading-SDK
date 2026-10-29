import { decodeFunctionData, zeroAddress } from "viem";
import { describe, expect, it } from "vitest";
import { accountLayerAbi } from "../symmio-contracts/abi/v0.8.6/account-layer";
import { getTimelockPolicy } from "./get-timelock-policy/get-timelock-policy";
import { getTimelockPolicyChange } from "./policy-change";
import { ROOT, UNLOCKER, VA, timelockRig } from "./test/fixture";

describe("policy-change requirements", () => {
  it.each([0n, 300n, 600n])(
    "does not require authorization for new, strengthened or unchanged delay %s",
    async (delay) => {
      const { config, capability, state } = timelockRig();
      Object.assign(state, { unlocker: delay === 0n ? zeroAddress : UNLOCKER, delay });
      const policy = await getTimelockPolicy(config, { account: VA, capability });
      expect(getTimelockPolicyChange(policy)).toMatchObject({
        account: ROOT,
        delay: 600n,
        requiresAuthorization: false,
        requiredUnlockers: [],
        affectedSelectors: [],
        scheduleDelaySeconds: 0n,
      });
    },
  );

  it("reports all weakened locks, distinct current unlockers and the longest affected delay", async () => {
    const { config, capability } = timelockRig();
    const policy = await getTimelockPolicy(config, { account: VA, capability });
    policy.selectors = [
      { selector: "0x11111111", unlocker: UNLOCKER, delay: 1200n, status: "ok" },
      { selector: "0x22222222", unlocker: UNLOCKER, delay: 900n, status: "ok" },
      { selector: "0x33333333", unlocker: ROOT, delay: 300n, status: "wrong-unlocker" },
      { selector: "0x44444444", unlocker: zeroAddress, delay: 0n, status: "missing" },
      { selector: "0x55555555", unlocker: UNLOCKER, delay: 600n, status: "ok" },
    ];
    const change = getTimelockPolicyChange(policy, { delay: 600n });
    expect(change).toMatchObject({
      delay: 600n,
      requiresAuthorization: true,
      affectedSelectors: policy.selectors
        .slice(0, 3)
        .map(({ selector, unlocker, delay }) => ({ selector, unlocker, delay })),
      requiredUnlockers: [UNLOCKER, ROOT],
      scheduleDelaySeconds: 1200n,
    });
    expect(decodeFunctionData({ abi: accountLayerAbi, data: change.callData })).toEqual({
      functionName: "setupTimelocks",
      args: [ROOT, UNLOCKER, 600n, policy.selectors.map((item) => item.selector)],
    });
  });

  it("preserves longer existing protection when the minimum increases", async () => {
    const { config, capability } = timelockRig();
    const policy = await getTimelockPolicy(config, { account: VA, capability });
    policy.requiredDelay = 900n;
    policy.selectors = [
      { selector: "0x11111111", unlocker: UNLOCKER, delay: 300n, status: "delay-too-short" },
      { selector: "0x22222222", unlocker: UNLOCKER, delay: 1200n, status: "ok" },
    ];
    expect(getTimelockPolicyChange(policy)).toMatchObject({ delay: 1200n, requiresAuthorization: false });
  });

  it("requires the old unlocker even when rotation increases the delay", async () => {
    const { config, capability, state } = timelockRig();
    Object.assign(state, { unlocker: ROOT, delay: 300n });
    const policy = await getTimelockPolicy(config, { account: VA, capability });
    expect(getTimelockPolicyChange(policy, { delay: 900n })).toMatchObject({
      delay: 900n,
      requiresAuthorization: true,
      requiredUnlockers: [ROOT],
      scheduleDelaySeconds: 300n,
    });
  });
});
