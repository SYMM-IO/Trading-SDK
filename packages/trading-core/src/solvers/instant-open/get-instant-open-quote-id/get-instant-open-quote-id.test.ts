import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { createConfig } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";

const getInstantQuoteIdTempQuoteId = vi.hoisted(() => vi.fn());

vi.mock("../../types/generated/enigma-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../types/generated/enigma-solver")>();
  return {
    ...actual,
    getInstantQuoteIdTempQuoteId,
  };
});

import { getInstantOpenQuoteId } from "./get-instant-open-quote-id";

const SOLVER_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).solver.url;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 999: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
});

describe("getInstantOpenQuoteId", () => {
  beforeEach(() => {
    getInstantQuoteIdTempQuoteId.mockReset();
  });

  it("returns the on-chain quote id with the configured solver base URL", async () => {
    getInstantQuoteIdTempQuoteId.mockResolvedValue({ data: { quote_id: 4567 } });

    await expect(getInstantOpenQuoteId(config, { tempQuoteId: -1001 })).resolves.toBe(4567);
    expect(getInstantQuoteIdTempQuoteId).toHaveBeenCalledWith(-1001, { baseURL: SOLVER_URL });
  });

  it("returns null when the temp id is not yet anchored on-chain", async () => {
    getInstantQuoteIdTempQuoteId.mockResolvedValue({ data: {} });

    await expect(getInstantOpenQuoteId(config, { tempQuoteId: -1001 })).resolves.toBeNull();
  });

  it("wraps request failures in a SymmError", async () => {
    getInstantQuoteIdTempQuoteId.mockRejectedValue(new Error("Network error"));

    await expect(getInstantOpenQuoteId(config, { tempQuoteId: -1001 })).rejects.toBeInstanceOf(SymmError);
    await expect(getInstantOpenQuoteId(config, { tempQuoteId: -1001 })).rejects.toThrow(
      "Failed to fetch instant-open quote id",
    );
  });
});
