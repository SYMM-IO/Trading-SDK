import axios, { AxiosError, type AxiosResponse } from "axios";
import { mainnet } from "viem/chains";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";
import type { TpSlSigningSpec } from "../types";
import { getTpSlDeleteSigningSpec } from "./get-tpsl-delete-signing-spec";
import { getTpSlSigningSpec } from "./get-tpsl-signing-spec";

const TPSL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).solver.tpsl!;
/** Path the orval-generated `v5SigningSpecApiV5SigningSpecGet` client requests. */
const SPEC_PATH = "/api/v5/signing-spec";
/** Path the sibling DELETE-spec action requests — must never be the same one. */
const DELETE_SPEC_PATH = "/api/v5/signing-spec-del";
/** The exact axios request config both signing-spec actions build from the chain's tpsl block. */
const EXPECTED_REQUEST = {
  baseURL: TPSL.url,
  headers: { "App-Name": TPSL.appName, Accept: "application/json" },
};

/** Realistic handler payload: the EIP-712 typed-data schema for a conditional order. */
const SIGNING_SPEC: TpSlSigningSpec = {
  domain: {
    name: "SymmioConditionalOrder",
    version: "1",
    chainId: SymmioSupportedChainId.HYPER_EVM,
    verifyingContract: TPSL.cohWalletAddress,
  },
  types: {
    EIP712Domain: [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" },
    ],
    ConditionalOrder: [
      { name: "virtualAccount", type: "address" },
      { name: "subAccount", type: "address" },
      { name: "salt", type: "string" },
      { name: "quoteId", type: "uint256" },
      { name: "symbolId", type: "uint256" },
      { name: "positionType", type: "uint8" },
      { name: "affiliate", type: "address" },
    ],
  },
  primaryType: "ConditionalOrder",
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

describe("getTpSlSigningSpec", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GETs `/api/v5/signing-spec` with the handler base URL, `App-Name`, and a JSON accept header", async () => {
    const { config } = mockConfig();
    const get = vi.spyOn(axios, "get").mockResolvedValue(okResponse(SIGNING_SPEC));

    await getTpSlSigningSpec(config);

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(SPEC_PATH, EXPECTED_REQUEST);
  });

  it("returns the payload verbatim as the TpSlSigningSpec", async () => {
    const { config } = mockConfig();
    vi.spyOn(axios, "get").mockResolvedValue(okResponse(SIGNING_SPEC));

    const spec = await getTpSlSigningSpec(config, { chainId: SymmioSupportedChainId.HYPER_EVM });

    /** The action only casts `response.data`, so the exact object round-trips untouched. */
    expect(spec).toBe(SIGNING_SPEC);
  });

  it("does not validate the payload — an off-spec body is cast and returned unchanged", async () => {
    const { config } = mockConfig();
    /** The openapi response type is `unknown`; the action casts without a runtime shape check. */
    const offSpec = { primaryType: 42, unexpected: ["field"] } as unknown as TpSlSigningSpec;
    vi.spyOn(axios, "get").mockResolvedValue(okResponse(offSpec));

    await expect(getTpSlSigningSpec(config)).resolves.toBe(offSpec);
  });

  it("defaults `parameters` to `{}` — omitting it resolves the config's default chain", async () => {
    const { config } = mockConfig();
    const get = vi.spyOn(axios, "get").mockResolvedValue(okResponse(SIGNING_SPEC));

    await getTpSlSigningSpec(config);
    await getTpSlSigningSpec(config, { chainId: config.defaultChainId });

    expect(get.mock.calls).toEqual([
      [SPEC_PATH, EXPECTED_REQUEST],
      [SPEC_PATH, EXPECTED_REQUEST],
    ]);
  });

  it("does not share an endpoint with getTpSlDeleteSigningSpec", async () => {
    const { config } = mockConfig();
    const get = vi.spyOn(axios, "get").mockResolvedValue(okResponse(SIGNING_SPEC));

    await getTpSlSigningSpec(config);
    await getTpSlDeleteSigningSpec(config);

    expect(get.mock.calls.map((call) => call[0])).toEqual([SPEC_PATH, DELETE_SPEC_PATH]);
  });

  it("wraps an axios failure as a SymmApiError tagged FETCH_TPSL_SIGNING_SPEC_FAILED", async () => {
    const { config } = mockConfig();
    const axiosErr = Object.assign(new AxiosError("Request failed with status code 503"), {
      config: { url: SPEC_PATH, method: "get" },
      response: { status: 503, statusText: "Service Unavailable", data: { detail: "handler down" } },
    });
    vi.spyOn(axios, "get").mockRejectedValue(axiosErr);

    const error = await getTpSlSigningSpec(config).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SymmApiError);
    expect(error).toMatchObject({
      kind: "api",
      code: "FETCH_TPSL_SIGNING_SPEC_FAILED",
      status: 503,
      statusText: "Service Unavailable",
      method: "GET",
      url: `${TPSL.url}${SPEC_PATH}`,
      responseData: { detail: "handler down" },
      cause: axiosErr,
    });
    expect((error as SymmApiError).message).toBe(
      `FETCH_TPSL_SIGNING_SPEC_FAILED: Request failed with status code 503 (GET ${TPSL.url}${SPEC_PATH} → 503 Service Unavailable)`,
    );
  });

  it("falls back to status 0 / `Unknown` / the bare base URL when the axios error carries no response", async () => {
    const { config } = mockConfig();
    /** A transport-level failure: no `response`, no `config`, so every `??` fallback fires. */
    const axiosErr = new AxiosError("Network Error");
    vi.spyOn(axios, "get").mockRejectedValue(axiosErr);

    const error = await getTpSlSigningSpec(config).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SymmApiError);
    expect(error).toMatchObject({
      code: "FETCH_TPSL_SIGNING_SPEC_FAILED",
      status: 0,
      statusText: "Unknown",
      method: "GET",
      url: TPSL.url,
      responseData: undefined,
    });
    expect((error as SymmApiError).message).toBe(
      `FETCH_TPSL_SIGNING_SPEC_FAILED: Network Error (GET ${TPSL.url} → 0 Unknown)`,
    );
  });

  it("re-throws an existing SymmError untouched instead of re-wrapping it", async () => {
    const { config } = mockConfig();
    const original = new SymmError("validation", "ALREADY_TAGGED", "already tagged");
    vi.spyOn(axios, "get").mockRejectedValue(original);

    const error = await getTpSlSigningSpec(config).catch((err: unknown) => err);

    expect(error).toBe(original);
    expect(error).not.toBeInstanceOf(SymmApiError);
    expect((error as SymmError).kind).toBe("validation");
    expect((error as SymmError).code).toBe("ALREADY_TAGGED");
  });

  it("wraps a non-axios failure as a plain api-kind SymmError", async () => {
    const { config } = mockConfig();
    const cause = new Error("socket hang up");
    vi.spyOn(axios, "get").mockRejectedValue(cause);

    const error = await getTpSlSigningSpec(config).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SymmError);
    expect(error).not.toBeInstanceOf(SymmApiError);
    expect(error).toMatchObject({
      kind: "api",
      code: "FETCH_TPSL_SIGNING_SPEC_FAILED",
      message: "TP/SL request failed: socket hang up",
      cause,
    });
  });

  it("stringifies a thrown non-Error and leaves `cause` unset", async () => {
    const { config } = mockConfig();
    vi.spyOn(axios, "get").mockRejectedValue("handler exploded");

    const error = await getTpSlSigningSpec(config).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SymmError);
    expect((error as SymmError).message).toBe("TP/SL request failed: handler exploded");
    expect((error as SymmError).code).toBe("FETCH_TPSL_SIGNING_SPEC_FAILED");
    expect((error as SymmError).cause).toBeUndefined();
  });

  it("throws a SymmError from resolveTpSlConfig for an unsupported chain, before any request", async () => {
    const { config } = mockConfig();
    const get = vi.spyOn(axios, "get").mockResolvedValue(okResponse(SIGNING_SPEC));

    const error = await getTpSlSigningSpec(config, { chainId: mainnet.id }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SymmError);
    expect(error).toMatchObject({ kind: "config", code: "UNSUPPORTED_CHAIN" });
    expect(get).not.toHaveBeenCalled();
  });
});
