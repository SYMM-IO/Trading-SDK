import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import type { PublicClient } from "viem";
import { mainnet } from "viem/chains";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { createConfig } from "../../../core/config";
import { SymmApiError, SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_AFFILIATE_ADDRESS } from "../../../shared/test/mock-config";
import { SymbolStatus, type SymbolInfo } from "../types/generated/enigma-price-service";

const getSymbolsInfoApiV1SymbolsInfoGet = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/enigma-price-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/enigma-price-service")>();
  return {
    ...actual,
    getSymbolsInfoApiV1SymbolsInfoGet,
  };
});

import { getEnigmaPriceServiceSymbolsInfo } from "./get-enigma-price-service-symbols-info";

const PRICE_SERVICE_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).priceService.url;
const SYMBOLS_INFO_PATH = "/api/v1/symbols/info";

/**
 * Fixture typed as the generated `SymbolInfo` so a change to the generated shape
 * breaks this test instead of silently passing.
 */
const SYMBOLS: SymbolInfo[] = [
  { name: "BTCUSDT", status: SymbolStatus.TRADING, address: "0x0000000000000000000000000000000000000b71" },
  { name: "ETHUSDT", status: SymbolStatus.SETTLING, address: "0x0000000000000000000000000000000000000e74" },
];

/** Build a real `AxiosError` (so `isAxiosError` is true) carrying request + response context. */
function axiosFailure(): AxiosError {
  const requestConfig = { url: SYMBOLS_INFO_PATH, method: "get", headers: {} } as InternalAxiosRequestConfig;
  const response = {
    status: 503,
    statusText: "Service Unavailable",
    data: { detail: "symbol registry unavailable" },
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

describe("getEnigmaPriceServiceSymbolsInfo", () => {
  beforeEach(() => {
    getSymbolsInfoApiV1SymbolsInfoGet.mockReset();
  });

  it("calls the generated client exactly once with only the configured price-service base URL", async () => {
    getSymbolsInfoApiV1SymbolsInfoGet.mockResolvedValue({ data: SYMBOLS });

    const { config } = mockConfig();
    await getEnigmaPriceServiceSymbolsInfo(config, { chainId: SymmioSupportedChainId.HYPER_EVM });

    expect(getSymbolsInfoApiV1SymbolsInfoGet).toHaveBeenCalledTimes(1);
    expect(getSymbolsInfoApiV1SymbolsInfoGet).toHaveBeenCalledWith({ baseURL: PRICE_SERVICE_URL });
  });

  it("returns `response.data` verbatim, preserving row order", async () => {
    const data: SymbolInfo[] = [
      { name: "ZETAUSDT", status: SymbolStatus.SETTLING, address: "0x00000000000000000000000000000000000005a1" },
      { name: "ALPHAUSDT", status: SymbolStatus.TRADING, address: "0x00000000000000000000000000000000000004d2" },
    ];
    getSymbolsInfoApiV1SymbolsInfoGet.mockResolvedValue({ data });

    const { config } = mockConfig();
    const result = await getEnigmaPriceServiceSymbolsInfo(config, {});

    /**
     * Identity, not deep-equality: the action must not copy, sort, or re-map the listing.
     * `toBe` subsumes any per-field re-assertion, so nothing else is checked here.
     */
    expect(result).toBe(data);
  });

  it("passes an empty listing through as an empty array", async () => {
    getSymbolsInfoApiV1SymbolsInfoGet.mockResolvedValue({ data: [] });

    const { config } = mockConfig();

    await expect(getEnigmaPriceServiceSymbolsInfo(config, {})).resolves.toEqual([]);
    expect(getSymbolsInfoApiV1SymbolsInfoGet).toHaveBeenCalledTimes(1);
  });

  it("defaults `parameters` to `{}` so the config alone is a valid call", async () => {
    getSymbolsInfoApiV1SymbolsInfoGet.mockResolvedValue({ data: SYMBOLS });

    const { config } = mockConfig();

    await expect(getEnigmaPriceServiceSymbolsInfo(config)).resolves.toEqual(SYMBOLS);
    expect(getSymbolsInfoApiV1SymbolsInfoGet).toHaveBeenCalledTimes(1);
    expect(getSymbolsInfoApiV1SymbolsInfoGet).toHaveBeenCalledWith({ baseURL: PRICE_SERVICE_URL });
  });

  it("reads the base URL from the resolved chain config, so a per-chain override is honored", async () => {
    const overriddenUrl = `${PRICE_SERVICE_URL}/alternate`;
    const overridden = createConfig({
      getClient: () => ({}) as PublicClient,
      symmioConfig: {
        [SymmioSupportedChainId.HYPER_EVM]: {
          addresses: { affiliatesAddress: TEST_AFFILIATE_ADDRESS },
          priceService: { url: overriddenUrl },
        },
      },
    });
    getSymbolsInfoApiV1SymbolsInfoGet.mockResolvedValue({ data: SYMBOLS });

    await getEnigmaPriceServiceSymbolsInfo(overridden, {});

    expect(getSymbolsInfoApiV1SymbolsInfoGet).toHaveBeenCalledTimes(1);
    expect(getSymbolsInfoApiV1SymbolsInfoGet).toHaveBeenCalledWith({ baseURL: overriddenUrl });
  });

  it("wraps an axios rejection in a SymmApiError carrying the request coordinates", async () => {
    const err = axiosFailure();
    getSymbolsInfoApiV1SymbolsInfoGet.mockRejectedValue(err);

    const { config } = mockConfig();
    const rejection = await getEnigmaPriceServiceSymbolsInfo(config, {}).catch((thrown: unknown) => thrown);

    expect(rejection).toBeInstanceOf(SymmApiError);
    const apiError = rejection as SymmApiError;
    expect(apiError.kind).toBe("api");
    expect(apiError.code).toBe("FETCH_ENIGMA_PRICE_SERVICE_SYMBOLS_INFO_FAILED");
    expect(apiError.status).toBe(503);
    expect(apiError.statusText).toBe("Service Unavailable");
    expect(apiError.url).toBe(`${PRICE_SERVICE_URL}${SYMBOLS_INFO_PATH}`);
    expect(apiError.method).toBe("GET");
    expect(apiError.responseData).toEqual({ detail: "symbol registry unavailable" });
    expect(apiError.cause).toBe(err);
    expect(apiError.message).toBe(
      `FETCH_ENIGMA_PRICE_SERVICE_SYMBOLS_INFO_FAILED: Request failed with status code 503 (GET ${PRICE_SERVICE_URL}${SYMBOLS_INFO_PATH} → 503 Service Unavailable)`,
    );
  });

  it("falls back to the module's own base URL when the axios error carries no response or request config", async () => {
    /** A transport-level failure (DNS/refused connection): no `response`, no `config`. */
    const err = new AxiosError("connect ECONNREFUSED", AxiosError.ERR_NETWORK);
    getSymbolsInfoApiV1SymbolsInfoGet.mockRejectedValue(err);

    const { config } = mockConfig();
    const rejection = (await getEnigmaPriceServiceSymbolsInfo(config, {}).catch(
      (thrown: unknown) => thrown,
    )) as SymmApiError;

    expect(rejection).toBeInstanceOf(SymmApiError);
    expect(rejection.code).toBe("FETCH_ENIGMA_PRICE_SERVICE_SYMBOLS_INFO_FAILED");
    expect(rejection.status).toBe(0);
    expect(rejection.statusText).toBe("Unknown");
    expect(rejection.url).toBe(PRICE_SERVICE_URL);
    expect(rejection.method).toBe("GET");
    expect(rejection.responseData).toBeUndefined();
    expect(rejection.cause).toBe(err);
    expect(rejection.message).toBe(
      `FETCH_ENIGMA_PRICE_SERVICE_SYMBOLS_INFO_FAILED: connect ECONNREFUSED (GET ${PRICE_SERVICE_URL} → 0 Unknown)`,
    );
  });

  it("wraps a non-axios Error in a SymmError that keeps the original as `cause`", async () => {
    const err = new Error("Network error");
    getSymbolsInfoApiV1SymbolsInfoGet.mockRejectedValue(err);

    const { config } = mockConfig();
    const rejection = await getEnigmaPriceServiceSymbolsInfo(config, {}).catch((thrown: unknown) => thrown);

    expect(rejection).toBeInstanceOf(SymmError);
    expect(rejection).not.toBeInstanceOf(SymmApiError);
    const symmError = rejection as SymmError;
    expect(symmError.kind).toBe("api");
    expect(symmError.code).toBe("FETCH_ENIGMA_PRICE_SERVICE_SYMBOLS_INFO_FAILED");
    expect(symmError.message).toBe("Failed to fetch Enigma price-service symbols info: Network error");
    expect(symmError.cause).toBe(err);
  });

  it("stringifies a thrown non-Error value into the message and leaves `cause` unset", async () => {
    getSymbolsInfoApiV1SymbolsInfoGet.mockRejectedValue("symbol registry exploded");

    const { config } = mockConfig();
    const rejection = (await getEnigmaPriceServiceSymbolsInfo(config, {}).catch(
      (thrown: unknown) => thrown,
    )) as SymmError;

    expect(rejection).toBeInstanceOf(SymmError);
    expect(rejection).not.toBeInstanceOf(SymmApiError);
    expect(rejection.kind).toBe("api");
    expect(rejection.code).toBe("FETCH_ENIGMA_PRICE_SERVICE_SYMBOLS_INFO_FAILED");
    expect(rejection.message).toBe("Failed to fetch Enigma price-service symbols info: symbol registry exploded");
    expect(rejection.cause).toBeUndefined();
  });

  it("rethrows an existing SymmError by identity", async () => {
    const err = new SymmError("api", "UPSTREAM_ALREADY_WRAPPED", "already wrapped");
    getSymbolsInfoApiV1SymbolsInfoGet.mockRejectedValue(err);

    const { config } = mockConfig();

    await expect(getEnigmaPriceServiceSymbolsInfo(config, {})).rejects.toBe(err);
  });

  it("throws a config-kind UNSUPPORTED_CHAIN error before any request is made", async () => {
    const { config } = mockConfig();

    const rejection = (await getEnigmaPriceServiceSymbolsInfo(config, { chainId: mainnet.id }).catch(
      (thrown: unknown) => thrown,
    )) as SymmError;

    expect(rejection).toBeInstanceOf(SymmError);
    expect(rejection).not.toBeInstanceOf(SymmApiError);
    expect(rejection.kind).toBe("config");
    expect(rejection.code).toBe("UNSUPPORTED_CHAIN");
    expect(rejection.message).toBe(`Unsupported chain id: ${mainnet.id}.`);
    expect(getSymbolsInfoApiV1SymbolsInfoGet).not.toHaveBeenCalled();
  });
});
