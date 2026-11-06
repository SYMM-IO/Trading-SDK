import axios, { AxiosError, AxiosHeaders, CanceledError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchEnigmaOhlcv, type FetchEnigmaOhlcvParameters } from "./fetch-enigma-ohlcv";
import { PriceTimeframe } from "./generated/enigma-price-service-ohlcv";

const get = vi.spyOn(axios, "get");
const PARAMETERS: FetchEnigmaOhlcvParameters = {
  baseURL: "https://prices.example",
  symbolAddress: "AbCdEf123",
  timeframe: PriceTimeframe["1m"],
  fromDate: 1_700_000_000,
  toDate: 1_700_003_600,
  limit: 200,
};
const BAR = { timestamp: 1_700_000_040, open: 2, high: 4, low: 1, close: 3, volume: 12.75 };

describe("fetchEnigmaOhlcv", () => {
  beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue({ data: { result: [BAR] } });
  });

  it("calls the public OHLCV route with version 2 and flat candles included by default", async () => {
    const controller = new AbortController();
    const candles = await fetchEnigmaOhlcv({ ...PARAMETERS, signal: controller.signal });

    expect(get).toHaveBeenCalledExactlyOnceWith("/api/v1/prices/AbCdEf123/ohlcv", {
      baseURL: "https://prices.example",
      signal: controller.signal,
      params: {
        timeframe: "1m",
        from_date: 1_700_000_000,
        to_date: 1_700_003_600,
        limit: 200,
        version: 2,
        flat_enable: true,
      },
    });
    expect(candles).toEqual([{ time: 1_700_000_040_000, open: 2, high: 4, low: 1, close: 3, volume: 12.75 }]);
  });

  it.each([true, false])("sends an explicit boolean flat_enable=%s", async (includeFlat) => {
    await fetchEnigmaOhlcv({ ...PARAMETERS, includeFlat });
    expect(get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ params: expect.objectContaining({ flat_enable: includeFlat }) }),
    );
  });

  it.each([null, 0, 1, "true", "false", "yes", {}, []])(
    "rejects a nonboolean flat option %j before HTTP",
    async (includeFlat) => {
      await expect(
        fetchEnigmaOhlcv({ ...PARAMETERS, includeFlat } as FetchEnigmaOhlcvParameters),
      ).rejects.toMatchObject({
        kind: "validation",
        code: "INVALID_ENIGMA_OHLCV_FLAT_ENABLE",
      });
      expect(get).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, null, 0, -1, 201, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "2"])(
    "rejects an invalid interval limit %j before HTTP",
    async (limit) => {
      await expect(fetchEnigmaOhlcv({ ...PARAMETERS, limit } as FetchEnigmaOhlcvParameters)).rejects.toMatchObject({
        code: "INVALID_ENIGMA_OHLCV_LIMIT",
      });
      expect(get).not.toHaveBeenCalled();
    },
  );

  it("preserves inclusive ISO boundaries without truncating or changing the request", async () => {
    const fromDate = "2026-11-01T00:00:00.123Z";
    const toDate = "2026-11-01T04:30:00.999+03:30";
    await fetchEnigmaOhlcv({ ...PARAMETERS, fromDate, toDate, limit: 1 });

    expect(get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ params: expect.objectContaining({ from_date: fromDate, to_date: toDate, limit: 1 }) }),
    );
  });

  it("accepts a single inclusive instant", async () => {
    await fetchEnigmaOhlcv({ ...PARAMETERS, toDate: PARAMETERS.fromDate });
    expect(get).toHaveBeenCalledOnce();
  });

  it.each([
    { fromDate: 20, toDate: 10 },
    { fromDate: "2026-11-02T00:00:00Z", toDate: "2026-11-01T00:00:00Z" },
    { fromDate: Number.NaN },
    { toDate: Number.POSITIVE_INFINITY },
    { fromDate: 1.5 },
    { toDate: Number.MAX_SAFE_INTEGER },
    { fromDate: "1" },
    { fromDate: "2026-11-01T00:00:00" },
    { toDate: "not-a-date" },
  ])("rejects invalid dates %j before HTTP", async (dates) => {
    await expect(fetchEnigmaOhlcv({ ...PARAMETERS, ...dates })).rejects.toMatchObject({
      code: "INVALID_ENIGMA_OHLCV_RANGE",
    });
    expect(get).not.toHaveBeenCalled();
  });

  it.each(["3m", "1d", "1w", "2h"])("rejects unsupported wire timeframe %s before HTTP", async (timeframe) => {
    await expect(fetchEnigmaOhlcv({ ...PARAMETERS, timeframe: timeframe as PriceTimeframe })).rejects.toMatchObject({
      code: "UNSUPPORTED_CANDLE_RESOLUTION",
    });
    expect(get).not.toHaveBeenCalled();
  });

  it("encodes the address as one path segment without changing its case", async () => {
    await fetchEnigmaOhlcv({ ...PARAMETERS, symbolAddress: "AbC/DeF?x=1" });
    expect(get).toHaveBeenCalledWith("/api/v1/prices/AbC%2FDeF%3Fx%3D1/ohlcv", expect.any(Object));
  });

  it("rejects an empty address before HTTP", async () => {
    await expect(fetchEnigmaOhlcv({ ...PARAMETERS, symbolAddress: " " })).rejects.toMatchObject({
      code: "UNMAPPED_CANDLE_MARKET",
    });
    expect(get).not.toHaveBeenCalled();
  });

  it("returns an empty window without inventing an exhaustion flag", async () => {
    get.mockResolvedValue({ data: { result: [] } });
    await expect(fetchEnigmaOhlcv(PARAMETERS)).resolves.toEqual([]);
    expect(get).toHaveBeenCalledOnce();
  });

  it("refetches the same range so recent corrections reach the caller", async () => {
    get.mockResolvedValueOnce({ data: { result: [BAR] } });
    get.mockResolvedValueOnce({ data: { result: [{ ...BAR, close: 4, volume: 15 }] } });

    const first = await fetchEnigmaOhlcv(PARAMETERS);
    const second = await fetchEnigmaOhlcv(PARAMETERS);

    expect(get).toHaveBeenCalledTimes(2);
    expect(first[0]?.close).toBe(3);
    expect(second[0]).toMatchObject({ close: 4, volume: 15 });
  });

  it("keeps cancellation recognizable", async () => {
    const cancellation = new CanceledError("aborted");
    get.mockRejectedValue(cancellation);
    await expect(fetchEnigmaOhlcv(PARAMETERS)).rejects.toBe(cancellation);
  });

  it("preserves HTTP status and Retry-After for the caller", async () => {
    const config = {
      headers: new AxiosHeaders(),
      url: "/api/v1/prices/AbCdEf123/ohlcv",
      method: "get",
    };
    get.mockRejectedValue(
      new AxiosError("Too Many Requests", "ERR_BAD_REQUEST", config, undefined, {
        config,
        status: 429,
        statusText: "Too Many Requests",
        headers: { "retry-after": "30" },
        data: { detail: "rate limited" },
      }),
    );
    await expect(fetchEnigmaOhlcv(PARAMETERS)).rejects.toMatchObject({
      kind: "api",
      code: "FETCH_ENIGMA_OHLCV_FAILED",
      status: 429,
      retryAfterMs: 30_000,
      url: "https://prices.example/api/v1/prices/AbCdEf123/ohlcv",
    });
  });

  it("preserves response-validation errors", async () => {
    get.mockResolvedValue({ data: { result: null } });
    await expect(fetchEnigmaOhlcv(PARAMETERS)).rejects.toMatchObject({
      code: "INVALID_ENIGMA_OHLCV_RESPONSE",
    });
  });
});
