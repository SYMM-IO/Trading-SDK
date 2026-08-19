import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { mainnet } from "viem/chains";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { SymmApiError, SymmError } from "../../../shared/errors/symm-error";
import { mockConfig } from "../../../shared/test/mock-config";

const healthCheckHealthGet = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/enigma-price-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/enigma-price-service")>();
  return {
    ...actual,
    healthCheckHealthGet,
  };
});

import { getEnigmaPriceServiceHealth } from "./get-enigma-price-service-health";

const PRICE_SERVICE_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).priceService.url;

/** Build a real `AxiosError` (so `isAxiosError` is true) carrying request + response context. */
function axiosFailure(): AxiosError {
  const requestConfig = { url: "/health", method: "get", headers: {} } as InternalAxiosRequestConfig;
  const response = {
    status: 503,
    statusText: "Service Unavailable",
    data: { detail: "price service unavailable" },
    headers: {},
    config: requestConfig,
  } as AxiosResponse;
  return new AxiosError(
    "Request failed with status code 503",
    AxiosError.ERR_BAD_RESPONSE,
    requestConfig,
    {},
    response,
  );
}

describe("getEnigmaPriceServiceHealth", () => {
  beforeEach(() => {
    healthCheckHealthGet.mockReset();
  });

  it("calls the generated client with the configured price-service base URL and returns the payload verbatim", async () => {
    /** The return type is `unknown`; a nested payload proves it is handed back untouched. */
    const data = { status: "ok", uptime: 1234, details: { exchanges: ["binance", "bybit"], degraded: false } };
    healthCheckHealthGet.mockResolvedValue({ data });

    const { config } = mockConfig();
    const result = await getEnigmaPriceServiceHealth(config, { chainId: SymmioSupportedChainId.HYPER_EVM });

    expect(healthCheckHealthGet).toHaveBeenCalledTimes(1);
    expect(healthCheckHealthGet).toHaveBeenCalledWith({ baseURL: PRICE_SERVICE_URL });
    expect(result).toBe(data);
  });

  it("defaults `parameters` to `{}` so the config's default chain is used", async () => {
    healthCheckHealthGet.mockResolvedValue({ data: "healthy" });

    const { config } = mockConfig();

    await expect(getEnigmaPriceServiceHealth(config)).resolves.toBe("healthy");
    expect(healthCheckHealthGet).toHaveBeenCalledTimes(1);
    expect(healthCheckHealthGet).toHaveBeenCalledWith({ baseURL: PRICE_SERVICE_URL });
  });

  it("wraps an axios rejection in a SymmApiError carrying the request coordinates", async () => {
    const err = axiosFailure();
    healthCheckHealthGet.mockRejectedValue(err);

    const { config } = mockConfig();
    const rejection = await getEnigmaPriceServiceHealth(config).catch((thrown: unknown) => thrown);

    expect(rejection).toBeInstanceOf(SymmApiError);
    const apiError = rejection as SymmApiError;
    expect(apiError.kind).toBe("api");
    expect(apiError.code).toBe("FETCH_ENIGMA_PRICE_SERVICE_HEALTH_FAILED");
    expect(apiError.status).toBe(503);
    expect(apiError.statusText).toBe("Service Unavailable");
    expect(apiError.url).toBe(`${PRICE_SERVICE_URL}/health`);
    expect(apiError.method).toBe("GET");
    expect(apiError.responseData).toEqual({ detail: "price service unavailable" });
    expect(apiError.cause).toBe(err);
    expect(apiError.message).toBe(
      `FETCH_ENIGMA_PRICE_SERVICE_HEALTH_FAILED: Request failed with status code 503 (GET ${PRICE_SERVICE_URL}/health → 503 Service Unavailable)`,
    );
  });

  it("falls back to the base URL and unknown status when the axios error carries no response or request config", async () => {
    /** A transport-level failure (DNS/refused connection): no `response`, no `config`. */
    const err = new AxiosError("connect ECONNREFUSED", AxiosError.ERR_NETWORK);
    healthCheckHealthGet.mockRejectedValue(err);

    const { config } = mockConfig();
    const rejection = (await getEnigmaPriceServiceHealth(config).catch((thrown: unknown) => thrown)) as SymmApiError;

    expect(rejection).toBeInstanceOf(SymmApiError);
    expect(rejection.status).toBe(0);
    expect(rejection.statusText).toBe("Unknown");
    expect(rejection.url).toBe(PRICE_SERVICE_URL);
    expect(rejection.method).toBe("GET");
    expect(rejection.responseData).toBeUndefined();
    expect(rejection.message).toBe(
      `FETCH_ENIGMA_PRICE_SERVICE_HEALTH_FAILED: connect ECONNREFUSED (GET ${PRICE_SERVICE_URL} → 0 Unknown)`,
    );
  });

  it("wraps a non-axios rejection in a SymmError that keeps the original as `cause`", async () => {
    const err = new Error("Network error");
    healthCheckHealthGet.mockRejectedValue(err);

    const { config } = mockConfig();
    const rejection = await getEnigmaPriceServiceHealth(config).catch((thrown: unknown) => thrown);

    expect(rejection).toBeInstanceOf(SymmError);
    expect(rejection).not.toBeInstanceOf(SymmApiError);
    const symmError = rejection as SymmError;
    expect(symmError.kind).toBe("api");
    expect(symmError.code).toBe("FETCH_ENIGMA_PRICE_SERVICE_HEALTH_FAILED");
    expect(symmError.message).toBe("Failed to fetch Enigma price-service health: Network error");
    expect(symmError.cause).toBe(err);
  });

  it("stringifies a thrown non-Error value into the message and leaves `cause` unset", async () => {
    healthCheckHealthGet.mockRejectedValue("price service exploded");

    const { config } = mockConfig();
    const rejection = (await getEnigmaPriceServiceHealth(config).catch((thrown: unknown) => thrown)) as SymmError;

    expect(rejection).toBeInstanceOf(SymmError);
    expect(rejection).not.toBeInstanceOf(SymmApiError);
    expect(rejection.kind).toBe("api");
    expect(rejection.code).toBe("FETCH_ENIGMA_PRICE_SERVICE_HEALTH_FAILED");
    expect(rejection.message).toBe("Failed to fetch Enigma price-service health: price service exploded");
    expect(rejection.cause).toBeUndefined();
  });

  it("rethrows an existing SymmError by identity", async () => {
    const err = new SymmError("api", "UPSTREAM_ALREADY_WRAPPED", "already wrapped");
    healthCheckHealthGet.mockRejectedValue(err);

    const { config } = mockConfig();

    await expect(getEnigmaPriceServiceHealth(config)).rejects.toBe(err);
  });

  it("throws a config-kind UNSUPPORTED_CHAIN error before any request is made", async () => {
    const { config } = mockConfig();

    const rejection = (await getEnigmaPriceServiceHealth(config, { chainId: mainnet.id }).catch(
      (thrown: unknown) => thrown,
    )) as SymmError;

    expect(rejection).toBeInstanceOf(SymmError);
    expect(rejection).not.toBeInstanceOf(SymmApiError);
    expect(rejection.kind).toBe("config");
    expect(rejection.code).toBe("UNSUPPORTED_CHAIN");
    expect(rejection.message).toBe(`Unsupported chain id: ${mainnet.id}.`);
    expect(healthCheckHealthGet).not.toHaveBeenCalled();
  });
});
