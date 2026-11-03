import { QueryClient } from "@tanstack/query-core";
import axios, { AxiosError } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockConfig, TEST_USER } from "../shared/test/mock-config";
import { PositionType } from "../symmio-contracts/symmio/types";
import { deleteQuoteTpSlMutationOptions } from "./delete-quote-tpsl/query";
import { setQuoteTpSlMutationOptions } from "./set-quote-tpsl/query";

const spec = {
  domain: { name: "ConditionalOrders", version: "1", chainId: 42161, verifyingContract: TEST_USER },
  primaryType: "Order",
  types: { Order: [{ name: "salt", type: "uint256" }] },
};
const setVariables = {
  chainId: 42161,
  from: TEST_USER,
  virtualAccount: TEST_USER,
  subAccount: TEST_USER,
  quoteId: -123n,
  symbolId: 1n,
  positionType: PositionType.LONG,
  quantity: "5",
  pricePrecision: 4,
  tp: { triggerPrice: "12", priceType: "markPrice" as const },
};
const deleteVariables = {
  chainId: 42161,
  from: TEST_USER,
  virtualAccount: TEST_USER,
  quoteId: -123n,
  cohQuoteId: "coh1",
  conditionalOrderType: "take_profit" as const,
};

describe.each(["set", "delete"] as const)("%s TP/SL mutation retries", (operation) => {
  afterEach(() => vi.restoreAllMocks());

  it.each(["malformed", "network", "timeout"])(
    "does not replay an ambiguous %s outcome with global retries",
    async (outcome) => {
      const { config, signTypedData } = mockConfig();
      const client = new QueryClient({ defaultOptions: { mutations: { retry: 3, retryDelay: 0, gcTime: 0 } } });
      vi.spyOn(axios, "get").mockResolvedValue({ data: spec });
      const write = vi.spyOn(axios, operation === "set" ? "post" : "delete");
      if (outcome === "malformed") write.mockResolvedValue({ data: {} });
      else
        write.mockRejectedValue(
          new AxiosError("Response lost", outcome === "timeout" ? "ECONNABORTED" : "ERR_NETWORK"),
        );
      const execution =
        operation === "set"
          ? client.getMutationCache().build(client, setQuoteTpSlMutationOptions(config)).execute(setVariables)
          : client.getMutationCache().build(client, deleteQuoteTpSlMutationOptions(config)).execute(deleteVariables);
      try {
        await expect(execution).rejects.toMatchObject({
          code: `${operation.toUpperCase()}_TPSL_${outcome === "malformed" ? "INVALID_RESPONSE" : "FAILED"}`,
        });
        expect(write).toHaveBeenCalledTimes(1);
        expect(signTypedData).toHaveBeenCalledTimes(1);
      } finally {
        client.clear();
      }
    },
  );
});
