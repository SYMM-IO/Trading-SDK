import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultSolver, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import type { ApiRevenueRecordsResponse } from "../types/generated/enigma-solver";

const getRevenueRecords = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/enigma-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/enigma-solver")>();
  return {
    ...actual,
    getRevenueRecords,
  };
});

import { getRevenueRecords as readRevenueRecords } from "./get-revenue-records";

const SOLVER_URL = getDefaultSolver(SymmioSupportedChainId.HYPER_EVM).url;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 999: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
});

const SAMPLE_RESPONSE: { data: ApiRevenueRecordsResponse } = {
  data: {
    count: 42,
    records: [{ id: 7, symbol_id: 3, amount: "12.5", created_at: "2026-08-24T00:00:00Z" }],
  },
};

describe("getRevenueRecords", () => {
  beforeEach(() => {
    getRevenueRecords.mockReset();
  });

  it("requests the config's solver base URL and normalizes the response", async () => {
    getRevenueRecords.mockResolvedValue(SAMPLE_RESPONSE);

    const result = await readRevenueRecords(config, {});

    expect(getRevenueRecords).toHaveBeenCalledWith(
      expect.objectContaining({ id: undefined, symbolIds: undefined, offset: undefined, limit: undefined }),
      expect.objectContaining({ baseURL: SOLVER_URL }),
    );
    expect(result.records).toEqual([{ id: 7, symbolId: 3, amount: "12.5", createdAt: "2026-08-24T00:00:00Z" }]);
    expect(result.count).toBe(42);
  });

  it("forwards the cursor, symbol filter, and paging to the solver", async () => {
    getRevenueRecords.mockResolvedValue(SAMPLE_RESPONSE);

    await readRevenueRecords(config, { id: 10, symbolIds: [1, 2], offset: 5, limit: 100 });

    expect(getRevenueRecords).toHaveBeenCalledWith(
      { id: 10, symbolIds: [1, 2], offset: 5, limit: 100 },
      expect.objectContaining({ baseURL: SOLVER_URL }),
    );
  });

  it("defaults missing records and count", async () => {
    getRevenueRecords.mockResolvedValue({ data: {} });
    expect(await readRevenueRecords(config, {})).toEqual({ records: [], count: 0 });
  });

  it("wraps request failures in a SymmError", async () => {
    getRevenueRecords.mockRejectedValue(new Error("Network error"));
    await expect(readRevenueRecords(config, {})).rejects.toBeInstanceOf(SymmError);
    await expect(readRevenueRecords(config, {})).rejects.toThrow("Failed to fetch revenue records");
  });

  it("throws UNSUPPORTED_BY_SOLVER when the resolved solver is not enigma", async () => {
    await expect(readRevenueRecords(config, { chainId: SymmioSupportedChainId.BASE })).rejects.toMatchObject({
      code: "UNSUPPORTED_BY_SOLVER",
    });
    expect(getRevenueRecords).not.toHaveBeenCalled();
  });
});
