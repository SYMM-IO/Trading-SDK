import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockConfig, TEST_USER } from "../../shared/test/mock-config";
import { PositionType } from "../../symmio-contracts/symmio/types";
import { setQuoteTpSl, type SetQuoteTpSlParameters } from "./set-quote-tpsl";

// Synthetic schema: transport/signing contract coverage, not a deployed schema assertion.
const spec = {
  domain: { name: "ConditionalOrders", version: "1", chainId: 42161, verifyingContract: TEST_USER },
  primaryType: "Order",
  types: { Order: [{ name: "quoteId", type: "int256" }] },
};
const parameters: SetQuoteTpSlParameters = {
  chainId: 42161,
  from: TEST_USER,
  virtualAccount: TEST_USER,
  subAccount: TEST_USER,
  quoteId: -123n,
  symbolId: 1n,
  positionType: PositionType.LONG,
  quantity: "5.123456",
  pricePrecision: 6,
  tp: { triggerPrice: "12.345678", priceType: "markPrice" },
};

describe("setQuoteTpSl acceptance", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([true, "true"])("requires explicit acceptance: %s", async (successful) => {
    const { config, signTypedData } = mockConfig();
    vi.spyOn(axios, "get").mockResolvedValue({ data: spec });
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { successful, coh_quote_id: "coh1" } });
    await expect(setQuoteTpSl(config, parameters)).resolves.toEqual({ success: true, cohQuoteId: "coh1" });
    expect(signTypedData).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0]?.[1]).toMatchObject({
      typedData: {
        message: {
          quoteId: -123,
          takeProfit: { quantity: "5.123456", conditionalPrice: "12.345678" },
        },
      },
    });
  });

  it.each([undefined, {}, { successful: "0" }, { successful: 1 }])(
    "does not accept malformed response %j",
    async (body) => {
      vi.spyOn(axios, "get").mockResolvedValue({ data: spec });
      vi.spyOn(axios, "post").mockResolvedValue({ data: body });
      await expect(setQuoteTpSl(mockConfig().config, parameters)).rejects.toMatchObject({
        code: "SET_TPSL_INVALID_RESPONSE",
      });
    },
  );

  it.each([false, "false"])("distinguishes rejection %s from an unknown outcome", async (successful) => {
    vi.spyOn(axios, "get").mockResolvedValue({ data: spec });
    vi.spyOn(axios, "post").mockResolvedValue({ data: { successful } });
    await expect(setQuoteTpSl(mockConfig().config, parameters)).rejects.toMatchObject({ code: "SET_TPSL_REJECTED" });
  });

  it("retains an explicit rejection's recovery message", async () => {
    vi.spyOn(axios, "get").mockResolvedValue({ data: spec });
    vi.spyOn(axios, "post").mockResolvedValue({
      data: { successful: false, error_message: "Session key is not authorized" },
    });
    await expect(setQuoteTpSl(mockConfig().config, parameters)).rejects.toMatchObject({
      code: "SET_TPSL_REJECTED",
      message: "Session key is not authorized",
    });
  });

  it.each([0n, 9007199254740993n, -9007199254740993n])(
    "rejects unsafe or missing quote %s before signing",
    async (quoteId) => {
      const { config, signTypedData } = mockConfig();
      const get = vi.spyOn(axios, "get");
      await expect(setQuoteTpSl(config, { ...parameters, quoteId })).rejects.toMatchObject({
        code: "SET_TPSL_INVALID_ID",
      });
      expect(get).not.toHaveBeenCalled();
      expect(signTypedData).not.toHaveBeenCalled();
    },
  );
});
