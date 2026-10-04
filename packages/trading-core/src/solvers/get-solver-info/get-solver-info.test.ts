import { AxiosError, AxiosHeaders } from "axios";
import type { PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";
import { getDefaultSolver, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";

const genFn = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/enigma-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/enigma-solver")>();
  return { ...actual, getInfo: genFn };
});

import { getSolverInfo } from "./get-solver-info";

const ARBITRUM = SymmioSupportedChainId.ARBITRUM;
const BASE = SymmioSupportedChainId.BASE;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: {
    [SymmioSupportedChainId.ARBITRUM]: {
      addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" },
    },
  },
});

describe("getSolverInfo", () => {
  it("fetches from the solver base URL and maps the wire fields to camelCase", async () => {
    genFn.mockResolvedValue({ data: { static_solver_fee_open: "0.5", static_solver_fee_close: "0.25" } });

    const info = await getSolverInfo(config, { chainId: ARBITRUM });

    expect(genFn).toHaveBeenCalledWith({ baseURL: getDefaultSolver(ARBITRUM).url });
    expect(info).toEqual({ staticSolverFeeOpen: "0.5", staticSolverFeeClose: "0.25" });
  });

  it("keeps omitted wire fields undefined", async () => {
    genFn.mockResolvedValue({ data: {} });

    const info = await getSolverInfo(config, { chainId: ARBITRUM });

    expect(info.staticSolverFeeOpen).toBeUndefined();
    expect(info.staticSolverFeeClose).toBeUndefined();
  });

  it("throws UNSUPPORTED_BY_SOLVER for a non-enigma solver before hitting the wire", async () => {
    genFn.mockClear();

    await expect(getSolverInfo(config, { chainId: BASE, solverId: "rasa" })).rejects.toMatchObject({
      code: "UNSUPPORTED_BY_SOLVER",
    });
    expect(genFn).not.toHaveBeenCalled();
  });

  it("wraps axios failures in SymmApiError with FETCH_SOLVER_INFO_FAILED", async () => {
    genFn.mockRejectedValue(
      new AxiosError("boom", "ERR_BAD_RESPONSE", { headers: new AxiosHeaders() }, undefined, undefined),
    );

    const err = await getSolverInfo(config, { chainId: ARBITRUM }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(SymmApiError);
    expect((err as SymmApiError).code).toBe("FETCH_SOLVER_INFO_FAILED");
  });

  it("wraps non-axios failures in SymmError with FETCH_SOLVER_INFO_FAILED", async () => {
    genFn.mockRejectedValue(new Error("parse exploded"));

    const err = await getSolverInfo(config, { chainId: ARBITRUM }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(SymmError);
    expect((err as SymmError).code).toBe("FETCH_SOLVER_INFO_FAILED");
  });
});
