import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_TX_HASH } from "../../../shared/test/mock-config";
import { cancelRegistration } from "./cancel-registration";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const AFFILIATE: Address = "0xaff1aff1aff1aff1aff1aff1aff1aff1aff1aff1";

describe("cancelRegistration", () => {
  it("writes cancelRegistration to the AccountLayer", async () => {
    const { config, writeContract } = mockConfig();

    const hash = await cancelRegistration(config, { affiliate: AFFILIATE });

    expect(hash).toBe(TEST_TX_HASH);
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "cancelRegistration",
        args: [AFFILIATE],
      }),
    );
  });

  it("throws when the config has no wallet resolver", async () => {
    const { config } = mockConfig({ withWallet: false });

    await expect(cancelRegistration(config, { affiliate: AFFILIATE })).rejects.toThrow(SymmError);
  });

  it("dry-runs the call before writing by default", async () => {
    const { config, writeContract, simulateContract } = mockConfig();

    await cancelRegistration(config, { affiliate: AFFILIATE });

    expect(simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "cancelRegistration", args: [AFFILIATE] }),
    );
    expect(simulateContract.mock.invocationCallOrder[0]!).toBeLessThan(writeContract.mock.invocationCallOrder[0]!);
  });
});
