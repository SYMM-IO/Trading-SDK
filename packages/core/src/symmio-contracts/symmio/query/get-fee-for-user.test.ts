import type { Address } from "viem";
import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig } from "../../../shared/test/mock-config";
import { getFeeForUserQueryKey, getFeeForUserQueryOptions } from "./get-fee-for-user";

const USER: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const AFFILIATE: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("getFeeForUserQueryOptions", () => {
  it("respects an explicit query.enabled override", () => {
    const { config } = mockConfig();
    expect(getFeeForUserQueryOptions(config, { user: USER, symbolId: 7, query: { enabled: false } }).enabled).toBe(
      false,
    );
  });

  it("is enabled by default when parameters are provided", () => {
    const { config } = mockConfig();
    expect(getFeeForUserQueryOptions(config, { user: USER, symbolId: 7 }).enabled).toBe(true);
  });

  it("queryFn delegates to the contract read", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce({ openFee: 1n, closeFee: 2n, isSet: true });

    const options = getFeeForUserQueryOptions(config, { affiliate: AFFILIATE, user: USER, symbolId: 7 });

    await expect(options.queryFn()).resolves.toEqual({ openFee: 1n, closeFee: 2n, isSet: true });
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "getFeeForUser",
        args: [AFFILIATE, USER, 7n],
      }),
    );
  });

  it("queryFn surfaces a SymmError for an unsupported chain", async () => {
    const { config } = mockConfig();
    const options = getFeeForUserQueryOptions(config, { user: USER, symbolId: 7, chainId: mainnet.id });
    await expect(options.queryFn()).rejects.toThrow(SymmError);
  });

  it("builds a stable key", () => {
    const key = getFeeForUserQueryKey({
      chainId: SymmioSupportedChainId.HYPER_EVM,
      affiliate: AFFILIATE,
      user: USER,
      symbolId: 7,
    });

    expect(key).toEqual([
      "getFeeForUser",
      {
        chainId: SymmioSupportedChainId.HYPER_EVM,
        affiliate: AFFILIATE,
        user: USER,
        symbolId: 7,
      },
    ]);
  });
});
