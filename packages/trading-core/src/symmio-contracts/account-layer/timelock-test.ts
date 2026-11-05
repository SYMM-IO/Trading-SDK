import type { Address, Hex } from "viem";
import { mockConfig } from "../../shared/test/mock-config";

export const TIMELOCK_TEST_ROOT: Address = "0x2222222222222222222222222222222222222222";
export const TIMELOCK_TEST_VA: Address = "0x3333333333333333333333333333333333333333";
export const TIMELOCK_TEST_UNLOCKER: Address = "0x4444444444444444444444444444444444444444";
export const TIMELOCK_TEST_CALL_DATA: Hex = "0xb48c2317aabb";

export function timelockActionRig() {
  const rig = mockConfig();
  rig.readContract.mockImplementation(({ functionName }: { functionName: string }) => {
    if (functionName === "getVirtualAccount") return { isExists: false, parentAccount: TIMELOCK_TEST_ROOT };
    if (functionName === "minTimelockDelay") return 300n;
    throw new Error(`unexpected read ${functionName}`);
  });
  return rig;
}
