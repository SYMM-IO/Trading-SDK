import axios, { AxiosError, type AxiosRequestConfig, type AxiosResponse } from "axios";
import type { PublicClient } from "viem";
import { mainnet } from "viem/chains";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import { mockConfig, TEST_AFFILIATE_ADDRESS, TEST_USER } from "../../shared/test/mock-config";
import {
  ConditionalOrdersState,
  ConditionalOrderType,
  OrderType,
  PositionType,
  PriceActionType,
  type ConditionalOrderResponseSchema,
  type GetConditionalOrdersV5ApiV5GetParams,
} from "../types/generated/tpsl-handler";
import { getQuoteTpSl } from "./get-quote-tpsl";

const TPSL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).solvers.enigma!.tpsl!;

/** Two rows of the handler's live (unwrapped) `GET /api/v5/?quote_id=…` payload. */
const TAKE_PROFIT_ROW: ConditionalOrderResponseSchema = {
  quote_id: 128,
  coh_quote_id: "coh128",
  party_a_address: TEST_USER,
  symbol_id: 4,
  conditional_order_type: ConditionalOrderType.take_profit,
  quantity: 12.5,
  price: null,
  conditional_order_price: 71234.5,
  order_type: OrderType.NUMBER_1,
  state: ConditionalOrdersState.new,
  action_price_type: PriceActionType.market,
  close_status: null,
  position_type: PositionType.NUMBER_0,
  leverage: 5,
  create_time: 1_750_000_000,
  modify_time: 1_750_000_100,
};

const STOP_LOSS_ROW: ConditionalOrderResponseSchema = {
  ...TAKE_PROFIT_ROW,
  conditional_order_type: ConditionalOrderType.stop_loss,
  conditional_order_price: 61234.5,
  state: ConditionalOrdersState.pending,
  action_price_type: PriceActionType.last_close,
  create_time: 1_750_000_200,
  modify_time: 1_750_000_300,
};

function okResponse<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config: { headers: {} } as AxiosResponse["config"],
  } as AxiosResponse<T>;
}

/** An axios rejection carrying the request/response context `SymmApiError.fromAxios` reads. */
function axiosFailure(): AxiosError {
  return Object.assign(new AxiosError("Request failed with status code 500"), {
    isAxiosError: true,
    config: { url: "/api/v5/", method: "get" },
    response: { status: 500, statusText: "Internal Server Error", data: { detail: "handler exploded" } },
  }) as AxiosError;
}

/**
 * A `404` rejection carrying `data` verbatim — the seam between the handler's
 * "no conditional orders" answer and an infrastructure 404 on the same status.
 */
function notFoundFailure(data: unknown): AxiosError {
  return Object.assign(new AxiosError("Request failed with status code 404"), {
    isAxiosError: true,
    config: { url: "/api/v5/", method: "get" },
    response: { status: 404, statusText: "Not Found", data },
  }) as AxiosError;
}

/** The request config recorded by the axios spy for call `index`. */
function recordedRequest(get: ReturnType<typeof vi.spyOn>, index = 0): AxiosRequestConfig {
  return get.mock.calls[index]![1] as AxiosRequestConfig;
}

describe("getQuoteTpSl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hits `/api/v5/` with the handler baseURL, `App-Name`/`Accept` headers and the quote id param", async () => {
    const { config } = mockConfig();
    const get = vi.spyOn(axios, "get").mockResolvedValue(okResponse([TAKE_PROFIT_ROW]));

    await getQuoteTpSl(config, { quoteId: 128n });

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith("/api/v5/", {
      baseURL: TPSL.url,
      headers: { "App-Name": TPSL.appName, Accept: "application/json" },
      params: { quote_id: 128 },
    });
  });

  it("converts the bigint `quoteId` with `Number(…)` — the param is a number, not a bigint or string", async () => {
    const { config } = mockConfig();
    const get = vi.spyOn(axios, "get").mockResolvedValue(okResponse([]));

    await getQuoteTpSl(config, { quoteId: 9007199254740991n });

    const params = recordedRequest(get).params as GetConditionalOrdersV5ApiV5GetParams;
    expect(typeof params.quote_id).toBe("number");
    expect(params.quote_id).toBe(9007199254740991);
  });

  it("passes a negative hedger `tempQuoteId` through unchanged", async () => {
    const { config } = mockConfig();
    const get = vi.spyOn(axios, "get").mockResolvedValue(okResponse([]));

    await getQuoteTpSl(config, { quoteId: -42n });

    const params = recordedRequest(get).params as GetConditionalOrdersV5ApiV5GetParams;
    expect(params.quote_id).toBe(-42);
    expect(typeof params.quote_id).toBe("number");
  });

  it("returns the handler's unwrapped array verbatim, preserving order and row fields", async () => {
    const { config } = mockConfig();
    const rows = [TAKE_PROFIT_ROW, STOP_LOSS_ROW];
    vi.spyOn(axios, "get").mockResolvedValue(okResponse(rows));

    const result = await getQuoteTpSl(config, { quoteId: 128n });

    /**
     * Identity, not deep equality: the action only casts the body, so the exact
     * array instance the handler returned must come back untouched.
     */
    expect(result).toBe(rows);
    expect(result).toHaveLength(2);
  });

  it("falls back to an empty array when the body is undefined", async () => {
    const { config } = mockConfig();
    vi.spyOn(axios, "get").mockResolvedValue(okResponse(undefined));

    await expect(getQuoteTpSl(config, { quoteId: 128n })).resolves.toEqual([]);
  });

  it("falls back to an empty array when the body is null", async () => {
    const { config } = mockConfig();
    vi.spyOn(axios, "get").mockResolvedValue(okResponse(null));

    await expect(getQuoteTpSl(config, { quoteId: 128n })).resolves.toEqual([]);
  });

  it("resolves to an empty array for the handler's `404` — a quote that has never had a TP/SL", async () => {
    const { config } = mockConfig();
    vi.spyOn(axios, "get").mockRejectedValue(
      notFoundFailure({ successful: false, message: "Not found", error_code: 4, error_detail: [] }),
    );

    await expect(getQuoteTpSl(config, { quoteId: 128n })).resolves.toEqual([]);
  });

  it("still throws on a `404` without the handler's envelope — a decommissioned route is not an empty result", async () => {
    const { config } = mockConfig();
    vi.spyOn(axios, "get").mockRejectedValue(notFoundFailure({ detail: "Not Found" }));

    const error = await getQuoteTpSl(config, { quoteId: 128n }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SymmApiError);
    expect(error).toMatchObject({ code: "FETCH_QUOTE_TPSL_FAILED", status: 404 });
  });

  it("still throws on a `404` whose body is not an object at all", async () => {
    const { config } = mockConfig();
    vi.spyOn(axios, "get").mockRejectedValue(notFoundFailure("<html>404 not found</html>"));

    await expect(getQuoteTpSl(config, { quoteId: 128n })).rejects.toBeInstanceOf(SymmApiError);
  });

  it("wraps an axios rejection as SymmApiError tagged FETCH_QUOTE_TPSL_FAILED", async () => {
    const { config } = mockConfig();
    vi.spyOn(axios, "get").mockRejectedValue(axiosFailure());

    const error = await getQuoteTpSl(config, { quoteId: 128n }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SymmApiError);
    expect(error).toMatchObject({
      kind: "api",
      code: "FETCH_QUOTE_TPSL_FAILED",
      status: 500,
      statusText: "Internal Server Error",
      method: "GET",
      url: `${TPSL.url}/api/v5/`,
      responseData: { detail: "handler exploded" },
    });
    expect((error as SymmApiError).message).toBe(
      `FETCH_QUOTE_TPSL_FAILED: Request failed with status code 500 (GET ${TPSL.url}/api/v5/ → 500 Internal Server Error)`,
    );
  });

  it("wraps a non-axios rejection as a SymmError of kind `api` with the composed message", async () => {
    const { config } = mockConfig();
    const cause = new Error("socket hang up");
    vi.spyOn(axios, "get").mockRejectedValue(cause);

    const error = await getQuoteTpSl(config, { quoteId: 128n }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SymmError);
    expect(error).not.toBeInstanceOf(SymmApiError);
    expect(error).toMatchObject({
      kind: "api",
      code: "FETCH_QUOTE_TPSL_FAILED",
      message: "TP/SL request failed: socket hang up",
    });
    expect((error as SymmError).cause).toBe(cause);
  });

  it("stringifies a thrown non-Error value into the message and leaves `cause` unset", async () => {
    const { config } = mockConfig();
    vi.spyOn(axios, "get").mockRejectedValue("socket closed");

    const error = await getQuoteTpSl(config, { quoteId: 128n }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SymmError);
    expect(error).toMatchObject({
      kind: "api",
      code: "FETCH_QUOTE_TPSL_FAILED",
      message: "TP/SL request failed: socket closed",
    });
    expect((error as SymmError).cause).toBeUndefined();
  });

  it("falls back to status 0 / `Unknown` / the bare baseURL for a response-less network error", async () => {
    const { config } = mockConfig();
    vi.spyOn(axios, "get").mockRejectedValue(new AxiosError("Network Error"));

    const error = await getQuoteTpSl(config, { quoteId: 128n }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SymmApiError);
    expect(error).toMatchObject({
      code: "FETCH_QUOTE_TPSL_FAILED",
      status: 0,
      statusText: "Unknown",
      method: "GET",
      url: TPSL.url,
      responseData: undefined,
    });
    expect((error as SymmApiError).message).toBe(
      `FETCH_QUOTE_TPSL_FAILED: Network Error (GET ${TPSL.url} → 0 Unknown)`,
    );
  });

  it("throws a SymmError for an unsupported chain without issuing a request", async () => {
    const { config } = mockConfig();
    const get = vi.spyOn(axios, "get").mockResolvedValue(okResponse([]));

    const error = await getQuoteTpSl(config, { chainId: mainnet.id, quoteId: 128n }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SymmError);
    expect(error).toMatchObject({ kind: "config", code: "UNSUPPORTED_CHAIN" });
    expect(get).not.toHaveBeenCalled();
  });

  it("targets the resolved chain config, so a `solver.tpsl` override re-points the request", async () => {
    const overridden = createConfig({
      getClient: () => ({}) as PublicClient,
      symmioConfig: {
        [SymmioSupportedChainId.HYPER_EVM]: {
          addresses: { affiliatesAddress: TEST_AFFILIATE_ADDRESS },
          solvers: { enigma: { tpsl: { url: "https://tpsl.override.test", appName: "Override-App" } } },
        },
      },
    });
    const get = vi.spyOn(axios, "get").mockResolvedValue(okResponse([]));

    await getQuoteTpSl(overridden, { quoteId: 128n });

    expect(get).toHaveBeenCalledWith("/api/v5/", {
      baseURL: "https://tpsl.override.test",
      headers: { "App-Name": "Override-App", Accept: "application/json" },
      params: { quote_id: 128 },
    });
  });
});
