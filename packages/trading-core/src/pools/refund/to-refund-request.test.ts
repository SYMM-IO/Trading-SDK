import { describe, expect, it } from "vitest";
import { ListingDepositChainId } from "../types";
import { toRefundRequest } from "./to-refund-request";

describe("toRefundRequest", () => {
  it("maps the market, deposit chain and recipient onto the request body", () => {
    const body = toRefundRequest({
      accessToken: "t",
      marketAddress: "0xToken",
      depositChain: ListingDepositChainId.HYPER_EVM,
      recipientAddress: "0xRecipient",
    });

    expect(body).toEqual({
      market_address: "0xToken",
      deposit_chain: ListingDepositChainId.HYPER_EVM,
      recipient_address: "0xRecipient",
    });
  });
});
