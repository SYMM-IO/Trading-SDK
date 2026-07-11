import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { createConfig } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import { OrderType, PositionType } from "../../../symmio-contracts/symmio/types";

const getInstantOpenAccountAddress = vi.hoisted(() => vi.fn());

vi.mock("../../types/generated/enigma-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../types/generated/enigma-solver")>();
  return {
    ...actual,
    getInstantOpenAccountAddress,
  };
});

import { getInstantOpens } from "./get-instant-opens";

const SOLVER_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).solver.url;
const PARTY_A = "0x00000000000000000000000000000000000000a1" as const;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 999: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
});

describe("getInstantOpens", () => {
  beforeEach(() => {
    getInstantOpenAccountAddress.mockReset();
  });

  it("fetches and normalizes records with the configured solver base URL", async () => {
    getInstantOpenAccountAddress.mockResolvedValue({
      data: [
        {
          temp_quote_id: -1001,
          symbol_id: 7,
          position_type: PositionType.SHORT,
          order_type: OrderType.MARKET,
          party_a_address: PARTY_A,
          requested_open_price: "1.5",
          quantity: "100",
          cva: "2",
          lf: "0.5",
          partyAmm: "1",
          partyBmm: "0",
        },
      ],
    });

    await expect(getInstantOpens(config, { partyA: PARTY_A })).resolves.toEqual([
      {
        tempQuoteId: -1001,
        marketId: 7,
        positionType: PositionType.SHORT,
        orderType: OrderType.MARKET,
        partyA: PARTY_A,
        requestedOpenPrice: "1.5",
        quantity: "100",
        cva: "2",
        lf: "0.5",
        partyAmm: "1",
        partyBmm: "0",
      },
    ]);
    expect(getInstantOpenAccountAddress).toHaveBeenCalledWith(PARTY_A, { baseURL: SOLVER_URL });
  });

  it("prefers an explicit baseUrl over the chain config solver url", async () => {
    getInstantOpenAccountAddress.mockResolvedValue({ data: [] });
    const baseUrl = "https://custom-hedger.example.com";

    await getInstantOpens(config, { partyA: PARTY_A, baseUrl });

    expect(getInstantOpenAccountAddress).toHaveBeenCalledWith(PARTY_A, { baseURL: baseUrl });
  });

  it("falls back to zero values when wire fields are absent", async () => {
    getInstantOpenAccountAddress.mockResolvedValue({ data: [{}] });

    await expect(getInstantOpens(config, { partyA: PARTY_A })).resolves.toEqual([
      {
        tempQuoteId: 0,
        marketId: 0,
        positionType: PositionType.LONG,
        orderType: OrderType.LIMIT,
        partyA: "0x0000000000000000000000000000000000000000",
        requestedOpenPrice: "0",
        quantity: "0",
        cva: "0",
        lf: "0",
        partyAmm: "0",
        partyBmm: "0",
      },
    ]);
  });

  it("wraps request failures in a SymmError", async () => {
    getInstantOpenAccountAddress.mockRejectedValue(new Error("Network error"));

    await expect(getInstantOpens(config, { partyA: PARTY_A })).rejects.toBeInstanceOf(SymmError);
    await expect(getInstantOpens(config, { partyA: PARTY_A })).rejects.toThrow("Failed to fetch instant opens");
  });
});
