import axios, { AxiosError, type AxiosResponse } from "axios";
import { mainnet } from "viem/chains";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";
import type { TpSlSigningSpec } from "../types";
import { getTpSlDeleteSigningSpec } from "./get-tpsl-delete-signing-spec";
import { getTpSlSigningSpec } from "./get-tpsl-signing-spec";

const TPSL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).solvers.enigma!.tpsl!;
/** Path the orval-generated `v5SigningSpecDelApiV5SigningSpecDelGet` client requests. */
const DELETE_SPEC_PATH = "/api/v5/signing-spec-del";
/** Path the sibling POST-spec action requests — must never be the same one. */
const SPEC_PATH = "/api/v5/signing-spec";
/** The exact axios request config both signing-spec actions build from the chain's tpsl block. */
const EXPECTED_REQUEST = {
  baseURL: TPSL.url,
  headers: { "App-Name": TPSL.appName, Accept: "application/json" },
};

/** Realistic handler payload: the EIP-712 typed-data schema for a cancel request. */
const DELETE_SIGNING_SPEC: TpSlSigningSpec = {
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
    CancelConditionalOrder: [
      { name: "virtualAccount", type: "address" },
      { name: "salt", type: "string" },
      { name: "cohQuoteId", type: "string" },
      { name: "conditionalOrderType", type: "string" },
    ],
  },
  primaryType: "CancelConditionalOrder",
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

describe("getTpSlDeleteSigningSpec", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GETs `/api/v5/signing-spec-del` with the handler base URL, `App-Name`, and a JSON accept header", async () => {
    const { config } = mockConfig();
    const get = vi.spyOn(axios, "get").mockResolvedValue(okResponse(DELETE_SIGNING_SPEC));

    await getTpSlDeleteSigningSpec(config);

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(DELETE_SPEC_PATH, EXPECTED_REQUEST);
  });

  it("returns the payload verbatim as the TpSlSigningSpec", async () => {
    const { config } = mockConfig();
    vi.spyOn(axios, "get").mockResolvedValue(okResponse(DELETE_SIGNING_SPEC));

    const spec = await getTpSlDeleteSigningSpec(config, { chainId: SymmioSupportedChainId.HYPER_EVM });

    /** The action only casts `response.data`, so the exact object round-trips untouched. */
    expect(spec).toBe(DELETE_SIGNING_SPEC);
  });

  it("does not validate the payload — an off-spec body is cast and returned unchanged", async () => {
    const { config } = mockConfig();
    /** The openapi response type is `unknown`; the action casts without a runtime shape check. */
    const offSpec = { primaryType: null, types: "not-an-object" } as unknown as TpSlSigningSpec;
    vi.spyOn(axios, "get").mockResolvedValue(okResponse(offSpec));

    await expect(getTpSlDeleteSigningSpec(config)).resolves.toBe(offSpec);
  });

  it("defaults `parameters` to `{}` — omitting it resolves the config's default chain", async () => {
    const { config } = mockConfig();
    const get = vi.spyOn(axios, "get").mockResolvedValue(okResponse(DELETE_SIGNING_SPEC));

    await getTpSlDeleteSigningSpec(config);
    await getTpSlDeleteSigningSpec(config, { chainId: config.defaultChainId });

    expect(get.mock.calls).toEqual([
      [DELETE_SPEC_PATH, EXPECTED_REQUEST],
      [DELETE_SPEC_PATH, EXPECTED_REQUEST],
    ]);
  });

  it("does not share an endpoint with getTpSlSigningSpec", async () => {
    const { config } = mockConfig();
    const get = vi.spyOn(axios, "get").mockResolvedValue(okResponse(DELETE_SIGNING_SPEC));

    await getTpSlDeleteSigningSpec(config);
    await getTpSlSigningSpec(config);

    expect(get.mock.calls.map((call) => call[0])).toEqual([DELETE_SPEC_PATH, SPEC_PATH]);
  });

  it("wraps an axios failure as a SymmApiError tagged FETCH_TPSL_DELETE_SIGNING_SPEC_FAILED", async () => {
    const { config } = mockConfig();
    const axiosErr = Object.assign(new AxiosError("Request failed with status code 404"), {
      config: { url: DELETE_SPEC_PATH, method: "get" },
      response: { status: 404, statusText: "Not Found", data: { detail: "unknown route" } },
    });
    vi.spyOn(axios, "get").mockRejectedValue(axiosErr);

    const error = await getTpSlDeleteSigningSpec(config).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SymmApiError);
    expect(error).toMatchObject({
      kind: "api",
      code: "FETCH_TPSL_DELETE_SIGNING_SPEC_FAILED",
      status: 404,
      statusText: "Not Found",
      method: "GET",
      url: `${TPSL.url}${DELETE_SPEC_PATH}`,
      responseData: { detail: "unknown route" },
      cause: axiosErr,
    });
    expect((error as SymmApiError).message).toBe(
      `FETCH_TPSL_DELETE_SIGNING_SPEC_FAILED: Request failed with status code 404 (GET ${TPSL.url}${DELETE_SPEC_PATH} → 404 Not Found)`,
    );
  });

  it("falls back to status 0 / `Unknown` / the bare base URL when the axios error carries no response", async () => {
    const { config } = mockConfig();
    /** A transport-level failure: no `response`, no `config`, so every `??` fallback fires. */
    const axiosErr = new AxiosError("Network Error");
    vi.spyOn(axios, "get").mockRejectedValue(axiosErr);

    const error = await getTpSlDeleteSigningSpec(config).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SymmApiError);
    expect(error).toMatchObject({
      code: "FETCH_TPSL_DELETE_SIGNING_SPEC_FAILED",
      status: 0,
      statusText: "Unknown",
      method: "GET",
      url: TPSL.url,
      responseData: undefined,
    });
    expect((error as SymmApiError).message).toBe(
      `FETCH_TPSL_DELETE_SIGNING_SPEC_FAILED: Network Error (GET ${TPSL.url} → 0 Unknown)`,
    );
  });

  it("re-throws an existing SymmError untouched instead of re-wrapping it", async () => {
    const { config } = mockConfig();
    const original = new SymmError("validation", "ALREADY_TAGGED", "already tagged");
    vi.spyOn(axios, "get").mockRejectedValue(original);

    const error = await getTpSlDeleteSigningSpec(config).catch((err: unknown) => err);

    expect(error).toBe(original);
    expect(error).not.toBeInstanceOf(SymmApiError);
    expect((error as SymmError).kind).toBe("validation");
    expect((error as SymmError).code).toBe("ALREADY_TAGGED");
  });

  it("wraps a non-axios failure as a plain api-kind SymmError", async () => {
    const { config } = mockConfig();
    const cause = new Error("socket hang up");
    vi.spyOn(axios, "get").mockRejectedValue(cause);

    const error = await getTpSlDeleteSigningSpec(config).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SymmError);
    expect(error).not.toBeInstanceOf(SymmApiError);
    expect(error).toMatchObject({
      kind: "api",
      code: "FETCH_TPSL_DELETE_SIGNING_SPEC_FAILED",
      message: "TP/SL request failed: socket hang up",
      cause,
    });
  });

  it("stringifies a thrown non-Error and leaves `cause` unset", async () => {
    const { config } = mockConfig();
    vi.spyOn(axios, "get").mockRejectedValue("handler exploded");

    const error = await getTpSlDeleteSigningSpec(config).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SymmError);
    expect((error as SymmError).message).toBe("TP/SL request failed: handler exploded");
    expect((error as SymmError).code).toBe("FETCH_TPSL_DELETE_SIGNING_SPEC_FAILED");
    expect((error as SymmError).cause).toBeUndefined();
  });

  it("throws a SymmError from resolveTpSlConfig for an unsupported chain, before any request", async () => {
    const { config } = mockConfig();
    const get = vi.spyOn(axios, "get").mockResolvedValue(okResponse(DELETE_SIGNING_SPEC));

    const error = await getTpSlDeleteSigningSpec(config, { chainId: mainnet.id }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SymmError);
    expect(error).toMatchObject({ kind: "config", code: "UNSUPPORTED_CHAIN" });
    expect(get).not.toHaveBeenCalled();
  });
});
