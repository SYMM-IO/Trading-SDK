import axios, { AxiosError, type AxiosResponse } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmApiError } from "../../shared/errors/symm-error";
import { mockConfig, TEST_USER } from "../../shared/test/mock-config";
import {
  ConditionalOrdersState,
  ConditionalOrderType,
  OrderType,
  PositionType,
  PriceActionType,
  type ConditionalOrderResponseSchema,
  type ConditionalOrderSearchRequestSchemaV3,
} from "../types/generated/tpsl-handler";
import { searchTpSlOrders, TPSL_LIVE_ORDER_STATES } from "./search-tpsl-orders";

const TPSL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).solver.tpsl!;

/** A row in the live wire shape — verified against the running handler. */
function row(overrides: Partial<ConditionalOrderResponseSchema> = {}): ConditionalOrderResponseSchema {
  return {
    quote_id: 16611,
    coh_quote_id: "coh1223",
    party_a_address: TEST_USER,
    symbol_id: 1,
    conditional_order_type: ConditionalOrderType.take_profit,
    quantity: 136.291885,
    price: 0.095,
    conditional_order_price: 0.1,
    order_type: OrderType.NUMBER_1,
    state: ConditionalOrdersState.new,
    action_price_type: PriceActionType.last_close,
    close_status: null,
    position_type: PositionType.NUMBER_0,
    leverage: null,
    create_time: 1_786_655_595,
    modify_time: 1_786_655_595,
    ...overrides,
  };
}

function okResponse<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config: { headers: {} } as AxiosResponse["config"],
  } as AxiosResponse<T>;
}

function axiosFailure(): AxiosError {
  return Object.assign(new AxiosError("Request failed with status code 500"), {
    isAxiosError: true,
    config: { url: "/api/v5/search/", method: "post" },
    response: { status: 500, statusText: "Internal Server Error", data: { detail: "handler exploded" } },
  }) as AxiosError;
}

/** The body recorded by the axios spy for call `index`. */
function recordedBody(post: ReturnType<typeof vi.spyOn>, index = 0): ConditionalOrderSearchRequestSchemaV3 {
  return post.mock.calls[index]![1] as ConditionalOrderSearchRequestSchemaV3;
}

describe("searchTpSlOrders", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts to `/api/v5/search/` with the handler baseURL and all three body-request headers", async () => {
    const { config } = mockConfig();
    const post = vi.spyOn(axios, "post").mockResolvedValue(okResponse({ data: [row()], count: 1 }));

    await searchTpSlOrders(config, { account: TEST_USER });

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0]![0]).toBe("/api/v5/search/");
    expect(post.mock.calls[0]![2]).toEqual({
      baseURL: TPSL.url,
      headers: { "App-Name": TPSL.appName, "Content-Type": "application/json", Accept: "application/json" },
    });
  });

  it("filters to the live order states by default, so absence means `no live order`", async () => {
    const { config } = mockConfig();
    const post = vi.spyOn(axios, "post").mockResolvedValue(okResponse({ data: [], count: 0 }));

    await searchTpSlOrders(config, { account: TEST_USER });

    const body = recordedBody(post);
    expect(body.party_a_address).toBe(TEST_USER);
    expect(body.state).toEqual([...TPSL_LIVE_ORDER_STATES]);
    // `triggered` states are in the filter: an order that fired between submit
    // and search must not read as "gone".
    expect(body.state).toContain(ConditionalOrdersState.triggered);
    expect(body.state).toContain(ConditionalOrdersState.triggered_pending);
    expect(body.state).not.toContain(ConditionalOrdersState.canceled);
    expect(body.start).toBe(0);
    expect(body.size).toBe(200);
  });

  it("omits optional filters entirely rather than sending nulls", async () => {
    const { config } = mockConfig();
    const post = vi.spyOn(axios, "post").mockResolvedValue(okResponse({ data: [], count: 0 }));

    await searchTpSlOrders(config, { account: TEST_USER });

    const body = recordedBody(post);
    expect("symbol_id" in body).toBe(false);
    expect("conditional_order_type" in body).toBe(false);
    expect("conditional_price_type" in body).toBe(false);
  });

  it("forwards the optional filters when given", async () => {
    const { config } = mockConfig();
    const post = vi.spyOn(axios, "post").mockResolvedValue(okResponse({ data: [], count: 0 }));

    await searchTpSlOrders(config, {
      account: TEST_USER,
      symbolId: 4,
      conditionalOrderType: ConditionalOrderType.stop_loss,
      conditionalPriceType: PriceActionType.market,
      start: 200,
      size: 50,
    });

    expect(recordedBody(post)).toEqual({
      party_a_address: TEST_USER,
      state: [...TPSL_LIVE_ORDER_STATES],
      start: 200,
      size: 50,
      symbol_id: 4,
      conditional_order_type: ConditionalOrderType.stop_loss,
      conditional_price_type: PriceActionType.market,
    });
  });

  it("unwraps the live `{ data, count }` envelope", async () => {
    const { config } = mockConfig();
    const rows = [row(), row({ quote_id: 16612, coh_quote_id: "coh1224" })];
    vi.spyOn(axios, "post").mockResolvedValue(okResponse({ data: rows, count: 2 }));

    const result = await searchTpSlOrders(config, { account: TEST_USER });

    expect(result.orders).toBe(rows);
    expect(result.count).toBe(2);
  });

  it("also accepts a bare array, the shape the sibling GET returns", async () => {
    const { config } = mockConfig();
    const rows = [row()];
    vi.spyOn(axios, "post").mockResolvedValue(okResponse(rows));

    const result = await searchTpSlOrders(config, { account: TEST_USER });

    expect(result.orders).toBe(rows);
    expect(result.count).toBe(1);
  });

  it("falls back to an empty page when the body is undefined", async () => {
    const { config } = mockConfig();
    vi.spyOn(axios, "post").mockResolvedValue(okResponse(undefined));

    const result = await searchTpSlOrders(config, { account: TEST_USER });

    expect(result.orders).toEqual([]);
    expect(result.count).toBe(0);
  });

  it("reports a short page as complete — absence may be trusted", async () => {
    const { config } = mockConfig();
    vi.spyOn(axios, "post").mockResolvedValue(okResponse({ data: [row()], count: 1 }));

    const result = await searchTpSlOrders(config, { account: TEST_USER, size: 10 });

    expect(result.isComplete).toBe(true);
  });

  it("reports a full page as incomplete, ignoring an agreeable `count`", async () => {
    const { config } = mockConfig();
    const rows = [row(), row({ quote_id: 2 })];
    // `count` says the page is the whole result set; the page length says it
    // may have been truncated. The page length wins — `count` is unverified on
    // this endpoint, and trusting it would falsely confirm cancels.
    vi.spyOn(axios, "post").mockResolvedValue(okResponse({ data: rows, count: 2 }));

    const result = await searchTpSlOrders(config, { account: TEST_USER, size: 2 });

    expect(result.isComplete).toBe(false);
    expect(result.count).toBe(2);
  });

  it("wraps a handler failure as a tagged SymmApiError", async () => {
    const { config } = mockConfig();
    vi.spyOn(axios, "post").mockRejectedValue(axiosFailure());

    const error = await searchTpSlOrders(config, { account: TEST_USER }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SymmApiError);
    expect(error).toMatchObject({
      kind: "api",
      code: "SEARCH_TPSL_FAILED",
      status: 500,
      method: "POST",
      url: `${TPSL.url}/api/v5/search/`,
      responseData: { detail: "handler exploded" },
    });
  });
});
