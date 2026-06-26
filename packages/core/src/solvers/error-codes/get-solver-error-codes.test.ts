import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";

const getErrorCodes = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/enigma-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/enigma-solver")>();
  return {
    ...actual,
    getErrorCodes,
  };
});

import { getSolverErrorCodes } from "./get-solver-error-codes";

const SOLVER_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).solver.url;
const config = createConfig({ getClient: () => ({}) as PublicClient });
const SAMPLE_RESPONSE: { data: Record<string, string> } = {
  data: {
    "2000": "Insufficient balance",
    "3001": "Market closed",
  },
};

describe("getSolverErrorCodes", () => {
  beforeEach(() => {
    getErrorCodes.mockReset();
  });

  it("requests the config's solver base URL and returns the error-code map", async () => {
    getErrorCodes.mockResolvedValue(SAMPLE_RESPONSE);

    const codes = await getSolverErrorCodes(config, {});

    expect(getErrorCodes).toHaveBeenCalledWith({ baseURL: SOLVER_URL });
    expect(codes).toEqual(SAMPLE_RESPONSE.data);
    expect(codes[2000]).toBe("Insufficient balance");
  });

  it("wraps request failures in a SymmError", async () => {
    getErrorCodes.mockRejectedValue(new Error("Network error"));
    await expect(getSolverErrorCodes(config, {})).rejects.toBeInstanceOf(SymmError);
    await expect(getSolverErrorCodes(config, {})).rejects.toThrow("Failed to fetch solver error codes");
  });
});
