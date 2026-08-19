import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import type { PublicClient } from "viem";
import { mainnet } from "viem/chains";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { createConfig } from "../../../core/config";
import { SymmApiError, SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_AFFILIATE_ADDRESS } from "../../../shared/test/mock-config";
import { DataSourceDTO, type MetadataResponse } from "../types/generated/enigma-price-service";

const getMetadataApiV1MetadataGet = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/enigma-price-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/enigma-price-service")>();
  return {
    ...actual,
    getMetadataApiV1MetadataGet,
  };
});

import { getEnigmaPriceServiceMetadata, type EnigmaMetadataByAddress } from "./get-enigma-price-service-metadata";

const PRICE_SERVICE_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).priceService.url;

/** Arbitrary symbol addresses — the price service treats them as opaque strings. */
const SYMBOL_A = "0x0000000000000000000000000000000000000a11";
const SYMBOL_B = "0x0000000000000000000000000000000000000b22";

/**
 * Build a fixture typed as the generated `MetadataResponse` so a change to the
 * generated shape breaks this test instead of silently passing.
 */
function metadata(name: string, pairAddress: string): MetadataResponse {
  return {
    name,
    chain_id: "solana",
    dex_id: "raydium",
    pair_address: pairAddress,
    base_token: { address: pairAddress, name, symbol: name },
    price_native: "0.0001",
    price_usd: "0.42",
    decimal: 6,
    liquidity: { usd: 125_000 },
    price_change: { h24: -3.5 },
    market_cap: 9_000_000,
    pair_created_at: 1_700_000_000,
    updated_at: 1_700_000_500,
    source: DataSourceDTO.DEXSCREENER,
  };
}

/** A config whose HYPER_EVM entry points the price service at a non-default host. */
function configWithPriceServiceUrl(url: string) {
  return createConfig({
    getClient: () => ({}) as PublicClient,
    symmioConfig: {
      [SymmioSupportedChainId.HYPER_EVM]: {
        addresses: { affiliatesAddress: TEST_AFFILIATE_ADDRESS },
        priceService: { url },
      },
    },
  });
}

/** Build a real `AxiosError` (so `isAxiosError` is true) carrying request + response context. */
function axiosFailure(): AxiosError {
  const requestConfig = { url: "/api/v1/metadata", method: "get", headers: {} } as InternalAxiosRequestConfig;
  const response = {
    status: 422,
    statusText: "Unprocessable Entity",
    data: { detail: [{ loc: ["query", "addresses"], msg: "too many addresses", type: "value_error" }] },
    headers: {},
    config: requestConfig,
  } as AxiosResponse;
  return new AxiosError("Request failed with status code 422", AxiosError.ERR_BAD_REQUEST, requestConfig, {}, response);
}

describe("getEnigmaPriceServiceMetadata", () => {
  beforeEach(() => {
    getMetadataApiV1MetadataGet.mockReset();
  });

  it("joins the addresses into one comma-separated param and targets the configured price-service base URL", async () => {
    const data: EnigmaMetadataByAddress = {
      [SYMBOL_A]: metadata("AAA", SYMBOL_A),
      [SYMBOL_B]: metadata("BBB", SYMBOL_B),
    };
    getMetadataApiV1MetadataGet.mockResolvedValue({ data });

    const { config } = mockConfig();
    const result = await getEnigmaPriceServiceMetadata(config, {
      chainId: SymmioSupportedChainId.HYPER_EVM,
      addresses: [SYMBOL_A, SYMBOL_B],
    });

    expect(getMetadataApiV1MetadataGet).toHaveBeenCalledTimes(1);
    expect(getMetadataApiV1MetadataGet).toHaveBeenCalledWith(
      { addresses: `${SYMBOL_A},${SYMBOL_B}` },
      { baseURL: PRICE_SERVICE_URL },
    );
    /** The by-address map is handed back by identity — the action never reshapes it. */
    expect(result).toBe(data);
  });

  it("omits the chainId to fall back on the config's default chain", async () => {
    getMetadataApiV1MetadataGet.mockResolvedValue({ data: {} });

    const { config } = mockConfig();
    await getEnigmaPriceServiceMetadata(config, { addresses: [SYMBOL_A] });

    expect(getMetadataApiV1MetadataGet).toHaveBeenCalledTimes(1);
    expect(getMetadataApiV1MetadataGet).toHaveBeenCalledWith({ addresses: SYMBOL_A }, { baseURL: PRICE_SERVICE_URL });
  });

  it("joins the addresses verbatim, without sorting or de-duplicating them", async () => {
    /**
     * The action does a bare `join(",")`, so the caller's order survives and a repeated
     * address is sent twice. Pinning this keeps a future "normalize the list" change from
     * silently diverging the request from the query key, which hashes the raw array.
     */
    getMetadataApiV1MetadataGet.mockResolvedValue({ data: {} });

    const { config } = mockConfig();
    await getEnigmaPriceServiceMetadata(config, { addresses: [SYMBOL_B, SYMBOL_A, SYMBOL_B] });

    expect(getMetadataApiV1MetadataGet).toHaveBeenCalledTimes(1);
    expect(getMetadataApiV1MetadataGet).toHaveBeenCalledWith(
      { addresses: `${SYMBOL_B},${SYMBOL_A},${SYMBOL_B}` },
      { baseURL: PRICE_SERVICE_URL },
    );
  });

  it("does not mutate the caller's address array", async () => {
    getMetadataApiV1MetadataGet.mockResolvedValue({ data: {} });

    const { config } = mockConfig();
    const addresses = [SYMBOL_A, SYMBOL_B];
    await getEnigmaPriceServiceMetadata(config, { addresses });

    expect(addresses).toEqual([SYMBOL_A, SYMBOL_B]);
  });

  it("sends an empty string for an empty `addresses` array instead of skipping the param", async () => {
    /**
     * Documents the literal current behavior: `[].join(",")` is `""`, so the request
     * still carries `addresses=""` rather than omitting the param (which the generated
     * endpoint would treat as the deprecated "fetch everything" call).
     */
    getMetadataApiV1MetadataGet.mockResolvedValue({ data: {} });

    const { config } = mockConfig();
    await expect(getEnigmaPriceServiceMetadata(config, { addresses: [] })).resolves.toEqual({});

    expect(getMetadataApiV1MetadataGet).toHaveBeenCalledTimes(1);
    expect(getMetadataApiV1MetadataGet).toHaveBeenCalledWith({ addresses: "" }, { baseURL: PRICE_SERVICE_URL });
  });

  it("returns an array-shaped response untouched, because the return is a bare cast", async () => {
    /**
     * The generated 200 union is `MetadataResponse[] | Record<string, MetadataResponse>`.
     * The action casts to the map arm without normalizing, so the array arm survives and a
     * consumer treating the result as a by-address map reads numeric indices as "addresses".
     */
    const data = [metadata("AAA", SYMBOL_A), metadata("BBB", SYMBOL_B)];
    getMetadataApiV1MetadataGet.mockResolvedValue({ data });

    const { config } = mockConfig();
    const result = await getEnigmaPriceServiceMetadata(config, { addresses: [SYMBOL_A, SYMBOL_B] });

    expect(result).toBe(data);
    expect(Object.keys(result)).toEqual(["0", "1"]);
    expect(result[SYMBOL_A]).toBeUndefined();
  });

  it("uses a per-chain `priceService.url` override as the request base URL", async () => {
    const overriddenUrl = `${PRICE_SERVICE_URL}/alternate`;
    const overridden = configWithPriceServiceUrl(overriddenUrl);
    getMetadataApiV1MetadataGet.mockResolvedValue({ data: {} });

    await getEnigmaPriceServiceMetadata(overridden, { addresses: [SYMBOL_A] });

    expect(getMetadataApiV1MetadataGet).toHaveBeenCalledTimes(1);
    expect(getMetadataApiV1MetadataGet).toHaveBeenCalledWith({ addresses: SYMBOL_A }, { baseURL: overriddenUrl });
  });

  it("wraps an axios rejection in a SymmApiError carrying the request coordinates", async () => {
    const err = axiosFailure();
    getMetadataApiV1MetadataGet.mockRejectedValue(err);

    const { config } = mockConfig();
    const rejection = await getEnigmaPriceServiceMetadata(config, { addresses: [SYMBOL_A] }).catch(
      (thrown: unknown) => thrown,
    );

    expect(rejection).toBeInstanceOf(SymmApiError);
    const apiError = rejection as SymmApiError;
    expect(apiError.kind).toBe("api");
    expect(apiError.code).toBe("FETCH_ENIGMA_PRICE_SERVICE_METADATA_FAILED");
    expect(apiError.status).toBe(422);
    expect(apiError.statusText).toBe("Unprocessable Entity");
    expect(apiError.url).toBe(`${PRICE_SERVICE_URL}/api/v1/metadata`);
    expect(apiError.method).toBe("GET");
    expect(apiError.responseData).toEqual({
      detail: [{ loc: ["query", "addresses"], msg: "too many addresses", type: "value_error" }],
    });
    expect(apiError.cause).toBe(err);
    expect(apiError.message).toBe(
      `FETCH_ENIGMA_PRICE_SERVICE_METADATA_FAILED: Request failed with status code 422 (GET ${PRICE_SERVICE_URL}/api/v1/metadata → 422 Unprocessable Entity)`,
    );
  });

  it("falls back to the module's own baseURL when the axios error carries no response or request config", async () => {
    /**
     * A transport-level failure (DNS/refused connection): no `response`, no `config`.
     * `SymmApiError.fromAxios` has nothing but the `baseURL` the module handed it, so
     * this is the case that proves the action forwards the resolved price-service URL.
     */
    const overriddenUrl = `${PRICE_SERVICE_URL}/alternate`;
    const overridden = configWithPriceServiceUrl(overriddenUrl);
    const err = new AxiosError("connect ECONNREFUSED", AxiosError.ERR_NETWORK);
    getMetadataApiV1MetadataGet.mockRejectedValue(err);

    const rejection = (await getEnigmaPriceServiceMetadata(overridden, { addresses: [SYMBOL_A] }).catch(
      (thrown: unknown) => thrown,
    )) as SymmApiError;

    expect(rejection).toBeInstanceOf(SymmApiError);
    expect(rejection.code).toBe("FETCH_ENIGMA_PRICE_SERVICE_METADATA_FAILED");
    expect(rejection.status).toBe(0);
    expect(rejection.statusText).toBe("Unknown");
    expect(rejection.url).toBe(overriddenUrl);
    expect(rejection.method).toBe("GET");
    expect(rejection.responseData).toBeUndefined();
    expect(rejection.cause).toBe(err);
    expect(rejection.message).toBe(
      `FETCH_ENIGMA_PRICE_SERVICE_METADATA_FAILED: connect ECONNREFUSED (GET ${overriddenUrl} → 0 Unknown)`,
    );
  });

  it("still composes the full path when the axios error has a request config but no response", async () => {
    /**
     * A timeout/abort after the request was built: `config` is present, `response` is not.
     * Exercises the `url` and `status`/`statusText` fallbacks independently of each other.
     */
    const requestConfig = { url: "/api/v1/metadata", method: "get", headers: {} } as InternalAxiosRequestConfig;
    const err = new AxiosError("timeout of 0ms exceeded", AxiosError.ECONNABORTED, requestConfig);
    getMetadataApiV1MetadataGet.mockRejectedValue(err);

    const { config } = mockConfig();
    const rejection = (await getEnigmaPriceServiceMetadata(config, { addresses: [SYMBOL_A] }).catch(
      (thrown: unknown) => thrown,
    )) as SymmApiError;

    expect(rejection).toBeInstanceOf(SymmApiError);
    expect(rejection.kind).toBe("api");
    expect(rejection.code).toBe("FETCH_ENIGMA_PRICE_SERVICE_METADATA_FAILED");
    expect(rejection.status).toBe(0);
    expect(rejection.statusText).toBe("Unknown");
    expect(rejection.url).toBe(`${PRICE_SERVICE_URL}/api/v1/metadata`);
    expect(rejection.responseData).toBeUndefined();
    expect(rejection.message).toBe(
      `FETCH_ENIGMA_PRICE_SERVICE_METADATA_FAILED: timeout of 0ms exceeded (GET ${PRICE_SERVICE_URL}/api/v1/metadata → 0 Unknown)`,
    );
  });

  it("wraps a non-axios Error in a SymmError that keeps the original as `cause`", async () => {
    const err = new Error("Network error");
    getMetadataApiV1MetadataGet.mockRejectedValue(err);

    const { config } = mockConfig();
    const rejection = await getEnigmaPriceServiceMetadata(config, { addresses: [SYMBOL_A] }).catch(
      (thrown: unknown) => thrown,
    );

    expect(rejection).toBeInstanceOf(SymmError);
    expect(rejection).not.toBeInstanceOf(SymmApiError);
    const symmError = rejection as SymmError;
    expect(symmError.kind).toBe("api");
    expect(symmError.code).toBe("FETCH_ENIGMA_PRICE_SERVICE_METADATA_FAILED");
    expect(symmError.message).toBe("Failed to fetch Enigma price-service metadata: Network error");
    expect(symmError.cause).toBe(err);
  });

  it("stringifies a thrown non-Error value into the message and leaves `cause` unset", async () => {
    getMetadataApiV1MetadataGet.mockRejectedValue("metadata service exploded");

    const { config } = mockConfig();
    const rejection = (await getEnigmaPriceServiceMetadata(config, { addresses: [SYMBOL_A] }).catch(
      (thrown: unknown) => thrown,
    )) as SymmError;

    expect(rejection).toBeInstanceOf(SymmError);
    expect(rejection).not.toBeInstanceOf(SymmApiError);
    expect(rejection.kind).toBe("api");
    expect(rejection.code).toBe("FETCH_ENIGMA_PRICE_SERVICE_METADATA_FAILED");
    expect(rejection.message).toBe("Failed to fetch Enigma price-service metadata: metadata service exploded");
    expect(rejection.cause).toBeUndefined();
  });

  it("rethrows an existing SymmError by identity", async () => {
    const err = new SymmError("api", "UPSTREAM_ALREADY_WRAPPED", "already wrapped");
    getMetadataApiV1MetadataGet.mockRejectedValue(err);

    const { config } = mockConfig();

    await expect(getEnigmaPriceServiceMetadata(config, { addresses: [SYMBOL_A] })).rejects.toBe(err);
  });

  it("throws a config-kind UNSUPPORTED_CHAIN error before any request is made", async () => {
    const { config } = mockConfig();

    const rejection = (await getEnigmaPriceServiceMetadata(config, {
      chainId: mainnet.id,
      addresses: [SYMBOL_A],
    }).catch((thrown: unknown) => thrown)) as SymmError;

    expect(rejection).toBeInstanceOf(SymmError);
    expect(rejection).not.toBeInstanceOf(SymmApiError);
    expect(rejection.kind).toBe("config");
    expect(rejection.code).toBe("UNSUPPORTED_CHAIN");
    expect(rejection.message).toBe(`Unsupported chain id: ${mainnet.id}.`);
    expect(getMetadataApiV1MetadataGet).not.toHaveBeenCalled();
  });
});
