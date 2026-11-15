import { AxiosError, AxiosHeaders } from "axios";
import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultSolver, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import { PositionType } from "../../symmio-contracts/symmio/types";

const estimatedPriceRequest = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/enigma-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/enigma-solver")>();
  return { ...actual, getEstimatedPrice: estimatedPriceRequest };
});

import { getEstimatedPrice } from "./get-estimated-price";

const SOLVER_URL = getDefaultSolver(SymmioSupportedChainId.ARBITRUM).url;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: {
    [SymmioSupportedChainId.ARBITRUM]: {
      addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" },
    },
  },
});

const OPEN_LONG = { symbolId: 1, quantity: "1", positionType: PositionType.LONG, entry: "open" as const, price: "1" };

function httpError(status: number, data: unknown) {
  return new AxiosError("request failed", "ERR_BAD_RESPONSE", undefined, undefined, {
    status,
    statusText: "Failure",
    data,
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
}

describe("getEstimatedPrice", () => {
  beforeEach(() => {
    estimatedPriceRequest.mockReset();
  });

  it("sends symbol/quantity/side/entry/price to the solver and returns the estimated price", async () => {
    estimatedPriceRequest.mockResolvedValue({ data: { price: "0.0925" } });

    const result = await getEstimatedPrice(config, {
      symbolId: 1,
      quantity: "1000",
      positionType: PositionType.LONG,
      entry: "open",
      price: "0.09",
    });

    expect(estimatedPriceRequest).toHaveBeenCalledWith(
      { symbol_id: 1, quantity: "1000", position_type: "long", entry: "open", price: "0.09" },
      expect.objectContaining({ baseURL: SOLVER_URL }),
    );
    expect(result).toEqual({ estimatedPrice: "0.0925" });
  });

  it.each(["open", "close"] as const)(
    "returns the optional no-shadow price without replacing the %s fill",
    async (entry) => {
      estimatedPriceRequest.mockResolvedValue({
        data: { price: "2000.000000", price_without_shadow: "1900.123457" },
      });

      expect(await getEstimatedPrice(config, { ...OPEN_LONG, entry })).toEqual({
        estimatedPrice: "2000.000000",
        estimatedPriceWithoutShadow: "1900.123457",
      });
      expect(estimatedPriceRequest).toHaveBeenCalledTimes(1);
    },
  );

  it.each([undefined, null, "", 1900])("does not invent a no-shadow price for %s", async (priceWithoutShadow) => {
    estimatedPriceRequest.mockResolvedValue({ data: { price: "2000", price_without_shadow: priceWithoutShadow } });
    expect(await getEstimatedPrice(config, OPEN_LONG)).toEqual({ estimatedPrice: "2000" });
  });

  it("does not substitute the no-shadow price when the primary price is unavailable", async () => {
    estimatedPriceRequest.mockResolvedValue({ data: { price_without_shadow: "1900.123457" } });
    expect(await getEstimatedPrice(config, OPEN_LONG)).toEqual({
      estimatedPrice: "0",
      estimatedPriceWithoutShadow: "1900.123457",
    });
  });

  it("encodes short + close on the wire", async () => {
    estimatedPriceRequest.mockResolvedValue({ data: { price: "1" } });
    await getEstimatedPrice(config, {
      symbolId: 2,
      quantity: "5",
      positionType: PositionType.SHORT,
      entry: "close",
      price: "1",
    });
    expect(estimatedPriceRequest).toHaveBeenCalledWith(
      expect.objectContaining({ position_type: "short", entry: "close" }),
      expect.anything(),
    );
  });

  it("defaults a missing price to '0'", async () => {
    estimatedPriceRequest.mockResolvedValue({ data: {} });
    expect(await getEstimatedPrice(config, OPEN_LONG)).toEqual({ estimatedPrice: "0" });
  });

  it("throws a SymmError for an unsupported chain", async () => {
    await expect(getEstimatedPrice(config, { ...OPEN_LONG, chainId: 1 })).rejects.toBeInstanceOf(SymmError);
  });

  it.each([200, 400, 503])("preserves a coded solver refusal returned with HTTP %s", async (status) => {
    const data = { code: 3401, error_detail: "Slippage Too Low" };
    if (status === 200) estimatedPriceRequest.mockResolvedValue({ status, data });
    else estimatedPriceRequest.mockRejectedValue(httpError(status, data));
    await expect(getEstimatedPrice(config, OPEN_LONG)).rejects.toMatchObject({
      code: "OPEN_ESTIMATE_REJECTED",
      status,
      responseData: data,
    });
  });

  it.each([408, 429, 500, 503])("classifies an uncoded HTTP %s failure as unavailable", async (status) => {
    estimatedPriceRequest.mockRejectedValue(httpError(status, "upstream unavailable"));
    await expect(getEstimatedPrice(config, OPEN_LONG)).rejects.toMatchObject({ code: "OPEN_ESTIMATE_UNAVAILABLE" });
  });

  it.each([401, 403, 422])("preserves HTTP %s input and permission failures", async (status) => {
    estimatedPriceRequest.mockRejectedValue(httpError(status, {}));
    await expect(getEstimatedPrice(config, OPEN_LONG)).rejects.toMatchObject({ code: "OPEN_ESTIMATE_REJECTED" });
  });

  it.each(["internal", "unavailable", "timeout", "rate_limit"])(
    "recognizes the documented temporary category %s",
    async (error_category) => {
      estimatedPriceRequest.mockResolvedValue({
        status: 200,
        data: { code: 3000, error_category, error_message: "unavailable" },
      });
      await expect(getEstimatedPrice(config, OPEN_LONG)).rejects.toMatchObject({ code: "OPEN_ESTIMATE_UNAVAILABLE" });
    },
  );

  it("classifies network failures without treating cancellation as fallback", async () => {
    estimatedPriceRequest.mockRejectedValue(new AxiosError("network unavailable", "ERR_NETWORK"));
    await expect(getEstimatedPrice(config, OPEN_LONG)).rejects.toMatchObject({ code: "OPEN_ESTIMATE_UNAVAILABLE" });
    estimatedPriceRequest.mockRejectedValue(new AxiosError("cancelled", "ERR_CANCELED"));
    await expect(getEstimatedPrice(config, OPEN_LONG)).rejects.toMatchObject({ code: "ESTIMATED_PRICE_CANCELLED" });
    const controller = new AbortController();
    controller.abort();
    await expect(getEstimatedPrice(config, { ...OPEN_LONG, signal: controller.signal })).rejects.toMatchObject({
      code: "ESTIMATED_PRICE_CANCELLED",
    });
  });

  it.each(["ERR_INVALID_URL", "ERR_BAD_OPTION", "ERR_BAD_OPTION_VALUE", "ERR_NOT_SUPPORT", undefined])(
    "does not turn a response-less adapter/configuration failure %s into fallback",
    async (code) => {
      estimatedPriceRequest.mockRejectedValue(new AxiosError("Invalid adapter configuration", code));
      await expect(getEstimatedPrice(config, OPEN_LONG)).rejects.toMatchObject({ code: "OPEN_ESTIMATE_REJECTED" });
    },
  );

  it("preserves the existing close-estimate response contract", async () => {
    estimatedPriceRequest.mockResolvedValue({ status: 200, data: { code: 3401, error_detail: "Slippage Too Low" } });
    await expect(getEstimatedPrice(config, { ...OPEN_LONG, entry: "close" })).resolves.toEqual({ estimatedPrice: "0" });
  });
});
