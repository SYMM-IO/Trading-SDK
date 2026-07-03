import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig } from "../../../shared/test/mock-config";
import { createClassicWithdrawPart } from "../parts";
import { simulateInitiateWithdraw } from "./simulate-initiate-withdraw";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const RECEIVER: Address = "0xcccccccccccccccccccccccccccccccccccccccc";
const FROM: Address = "0x1111111111111111111111111111111111111111";

describe("simulateInitiateWithdraw", () => {
  it("simulates the routed AccountLayer `_call` carrying the encoded initiateWithdraw", async () => {
    const { config, simulateContract } = mockConfig();
    simulateContract.mockResolvedValueOnce({ result: ["0x"], request: {} });

    const part = createClassicWithdrawPart({ id: 0n, amount: 1_000000n, receiver: RECEIVER, chainId: 999n });
    await simulateInitiateWithdraw(config, { account: ACCOUNT, parts: [part], from: FROM });

    const call = simulateContract.mock.calls[0]?.[0] as {
      address: Address;
      functionName: string;
      args: readonly [Address, readonly `0x${string}`[]];
      account?: Address;
    };
    expect(call.address).toBe(DEFAULT.addresses.accountLayerAddress);
    expect(call.functionName).toBe("_call");
    expect(call.args[0]).toBe(ACCOUNT);
    expect(call.args[1]).toHaveLength(1);
    expect(call.account).toBe(FROM);
  });
});
