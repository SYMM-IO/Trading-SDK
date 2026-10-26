import { zeroAddress, type Address } from "viem";
import { vi, type Mock } from "vitest";
import { mockConfig, TEST_TX_HASH, TEST_USER } from "../../shared/test/mock-config";
import type { TimelockApprovalCapability } from "../approval";

export const ROOT: Address = "0x2222222222222222222222222222222222222222";
export const VA: Address = "0x3333333333333333333333333333333333333333";
export const UNLOCKER: Address = "0x4444444444444444444444444444444444444444";
export const NOW = 1_900_000_000n;

export function timelockRig(): ReturnType<typeof mockConfig> & {
  state: { unlocker: Address; delay: bigint; minimum: bigint };
  capability: TimelockApprovalCapability;
  getBlock: Mock;
  waitForTransactionReceipt: Mock;
} {
  const rig = mockConfig();
  const state = { unlocker: zeroAddress, delay: 0n, minimum: 300n };
  const getBlock = vi.fn().mockResolvedValue({ timestamp: NOW });
  const waitForTransactionReceipt = vi.fn().mockResolvedValue({ status: "success", transactionHash: TEST_TX_HASH });
  Object.assign(rig.config.getClient(), { getBlock, waitForTransactionReceipt });
  rig.readContract.mockImplementation(({ functionName, args }) => {
    if (functionName === "getVirtualAccount") return { isExists: args[0] === VA, parentAccount: ROOT };
    if (functionName === "getSubAccount") return { owner: TEST_USER, isExists: true };
    if (functionName === "minTimelockDelay") return state.minimum;
    if (functionName === "getSelectorTimelock") return { unlocker: state.unlocker, delay: state.delay };
    if (functionName === "getSchedule") return { scheduledAt: NOW, nonce: 1 };
    if (functionName === "scheduleGracePeriod") return 60n;
    throw new Error(`Unexpected read ${functionName}`);
  });
  const capability: TimelockApprovalCapability = {
    unlocker: UNLOCKER,
    minTimelockDelaySeconds: 600,
    validitySeconds: 60,
    requestDomain: {
      name: "SymmioTimelockApprovalRequest",
      version: "1",
      chainId: "42161",
      verifyingContract: rig.config.getChainConfig().addresses.accountLayerAddress,
    },
  };
  return { ...rig, state, capability, getBlock, waitForTransactionReceipt };
}
