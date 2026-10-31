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

  it.each(["tp", "sl", "both"])("submits supported best-effort close legs for %s", async (sides) => {
    const { config, signTypedData } = mockConfig();
    vi.spyOn(axios, "get").mockResolvedValue({ data: spec });
    const post = vi.spyOn(axios, "post").mockImplementation(async (_url, payload) => {
      const message = (
        payload as {
          typedData: {
            message: {
              takeProfit: { quantity: string; orderType: number };
              stopLoss: { quantity: string; orderType: number };
            };
          };
        }
      ).typedData.message;
      // Absent legs are signed with the existing zero-value sentinel.
      const legs = [message.takeProfit, message.stopLoss].filter((leg) => leg.quantity !== "0");
      return {
        data: legs.every((leg) => leg.orderType === 2)
          ? { successful: true }
          : {
              successful: false,
              message:
                "Market orders are not available for take-profit or stop-loss. Choose market-best-effort or limit instead.",
            },
      };
    });
    await expect(
      setQuoteTpSl(config, {
        ...parameters,
        tp: sides === "sl" ? undefined : parameters.tp,
        sl: sides === "tp" ? undefined : { triggerPrice: "8", priceType: "lastPrice" },
      }),
    ).resolves.toEqual({ success: true, cohQuoteId: undefined });
    expect(post).toHaveBeenCalledTimes(1);
    expect(signTypedData).toHaveBeenCalledTimes(1);
    const message = (post.mock.calls[0]![1] as { typedData: { message: { takeProfit: unknown; stopLoss: unknown } } })
      .typedData.message;
    if (sides !== "sl") expect(message.takeProfit).toMatchObject({ orderType: 2, conditionalPriceType: "market" });
    if (sides !== "tp") expect(message.stopLoss).toMatchObject({ orderType: 2, conditionalPriceType: "last_close" });
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
