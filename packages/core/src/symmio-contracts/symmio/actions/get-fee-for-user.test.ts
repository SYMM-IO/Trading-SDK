import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { mockConfig } from "../../../shared/test/mock-config";
import { getFeeForUser } from "./get-fee-for-user";

const USER: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const AFFILIATE: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("getFeeForUser", () => {
  it("uses the chain config affiliate when none is provided", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce({ openFee: 1n, closeFee: 2n, isSet: true });

    const fee = await getFeeForUser(config, { user: USER, symbolId: 7 });

    expect(fee).toEqual({ openFee: 1n, closeFee: 2n, isSet: true });
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: config.getChainConfig().addresses.symmioAddress,
        functionName: "getFeeForUser",
        args: [config.getChainConfig().addresses.affiliatesAddress, USER, 7n],
      }),
    );
  });

  it("uses an explicit affiliate override", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce({ openFee: 3n, closeFee: 4n, isSet: false });

    const fee = await getFeeForUser(config, { affiliate: AFFILIATE, user: USER, symbolId: 9n });

    expect(fee).toEqual({ openFee: 3n, closeFee: 4n, isSet: false });
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "getFeeForUser",
        args: [AFFILIATE, USER, 9n],
      }),
    );
  });
});
