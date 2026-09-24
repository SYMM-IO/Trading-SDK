import type { PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";
import { SymmioSupportedChainId } from "../../../../core/chains";
import { createConfig } from "../../../../core/config";

const getSolverInfo = vi.hoisted(() => vi.fn());

vi.mock("../../../get-solver-info", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../get-solver-info")>();
  return { ...actual, getSolverInfo };
});

import { resolveSolverInfo } from "./resolve-solver-info";

const ARBITRUM = SymmioSupportedChainId.ARBITRUM;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: {
    [SymmioSupportedChainId.ARBITRUM]: {
      addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" },
    },
  },
});

describe("resolveSolverInfo", () => {
  it("short-circuits on a caller-supplied solverInfo without fetching", async () => {
    getSolverInfo.mockClear();

    const resolved = await resolveSolverInfo(config, {
      chainId: ARBITRUM,
      solverInfo: { staticSolverFeeOpen: "0.5", staticSolverFeeClose: "0.25" },
    });

    expect(resolved).toEqual({ staticSolverFeeOpen: "0.5", staticSolverFeeClose: "0.25" });
    expect(getSolverInfo).not.toHaveBeenCalled();
  });

  it("fetches via getSolverInfo when no solverInfo is supplied", async () => {
    getSolverInfo.mockResolvedValue({ staticSolverFeeOpen: "1", staticSolverFeeClose: "2" });

    const resolved = await resolveSolverInfo(config, { chainId: ARBITRUM, solverId: "enigma" });

    expect(getSolverInfo).toHaveBeenCalledWith(config, { chainId: ARBITRUM, solverId: "enigma" });
    expect(resolved).toEqual({ staticSolverFeeOpen: "1", staticSolverFeeClose: "2" });
  });

  it("defaults omitted wire fields to '0'", async () => {
    getSolverInfo.mockResolvedValue({});

    const resolved = await resolveSolverInfo(config, { chainId: ARBITRUM });

    expect(resolved).toEqual({ staticSolverFeeOpen: "0", staticSolverFeeClose: "0" });
  });

  it("fails soft to zero legs when the fetch throws", async () => {
    getSolverInfo.mockRejectedValue(new Error("info endpoint not deployed"));

    const resolved = await resolveSolverInfo(config, { chainId: ARBITRUM });

    expect(resolved).toEqual({ staticSolverFeeOpen: "0", staticSolverFeeClose: "0" });
  });
});
