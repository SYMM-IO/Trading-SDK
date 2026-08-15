import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import type { Account, Address, Chain, PublicClient } from "viem";
import { mainnet } from "viem/chains";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig, type Config, type SymmioWalletClient } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import { TEST_AFFILIATE_ADDRESS, TEST_USER } from "../../shared/test/mock-config";
import type { TpSlSigningSpec } from "../types";
import type { StatusResponse } from "../types/generated/tpsl-handler";
import { deleteQuoteTpSl, type DeleteQuoteTpSlParameters } from "./delete-quote-tpsl";

const CHAIN_CONFIG = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const TPSL = CHAIN_CONFIG.solvers.enigma!.tpsl!;

/** Local fixtures — handler-issued / test-only values, never real on-chain constants. */
const VIRTUAL_ACCOUNT: Address = "0x2222222222222222222222222222222222222222";
const COH_QUOTE_ID = "coh42";
const TEST_SIGNATURE = "0xc0ffee";

/** 2^256 - 1: the largest value a `uint256` salt may take. */
const MAX_UINT256 = (1n << 256n) - 1n;

/**
 * Stand-in for the handler's `/api/v5/signing-spec-del` payload. Only the
 * `verifyingContract` is read from the chain config; the schema itself is
 * handler-owned data the SDK never hardcodes.
 */
const SIGNING_SPEC: TpSlSigningSpec = {
  domain: {
    name: "ConditionalOrders",
    version: "1",
    chainId: SymmioSupportedChainId.HYPER_EVM,
    verifyingContract: TPSL.cohWalletAddress,
  },
  types: {
    DeleteConditionalOrder: [
      { name: "virtualAccount", type: "address" },
      { name: "salt", type: "uint256" },
      { name: "cohQuoteId", type: "string" },
      { name: "conditionalOrderType", type: "string" },
    ],
  },
  primaryType: "DeleteConditionalOrder",
};

const PARAMETERS: DeleteQuoteTpSlParameters = {
  chainId: SymmioSupportedChainId.HYPER_EVM,
  from: TEST_USER,
  quoteId: 42n,
  virtualAccount: VIRTUAL_ACCOUNT,
  cohQuoteId: COH_QUOTE_ID,
  conditionalOrderType: "take_profit",
};

/** What {@link mockSigningConfig} hands back to a test. */
interface SigningHarness {
  config: Config;
  /** The wallet client's `signTypedData`, resolving {@link TEST_SIGNATURE} by default. */
  signTypedData: Mock;
  /** The config's injected wallet resolver — asserts `chainId` / `from` forwarding. */
  getWalletClient: Mock;
  walletClient: SymmioWalletClient;
}

/**
 * Build a real {@link Config} whose wallet client exposes a `vi.fn()`-backed
 * `signTypedData`. `mockConfig()`'s stub wallet client only has `writeContract`,
 * so the TP/SL signing path needs its own harness.
 *
 * @param options - `withWallet: false` omits the resolver entirely (simulating a
 *   disconnected wallet); `tpslUrl` overrides the chain's TP/SL handler URL;
 *   `signerAddress` makes the resolved wallet account differ from `from`
 *   (the session-key case) so `signer` can be attributed unambiguously.
 */
function mockSigningConfig(options?: {
  withWallet?: boolean;
  tpslUrl?: string;
  signerAddress?: Address;
}): SigningHarness {
  const signTypedData = vi.fn().mockResolvedValue(TEST_SIGNATURE);
  const account = { address: options?.signerAddress ?? TEST_USER, type: "json-rpc" } as Account;
  const walletClient = {
    account,
    chain: { id: SymmioSupportedChainId.HYPER_EVM } as Chain,
    signTypedData,
  } as unknown as SymmioWalletClient;
  const getWalletClient = vi.fn(async () => walletClient);

  const config = createConfig({
    symmioConfig: {
      [SymmioSupportedChainId.HYPER_EVM]: {
        addresses: { affiliatesAddress: TEST_AFFILIATE_ADDRESS },
        ...(options?.tpslUrl ? { solvers: { enigma: { tpsl: { url: options.tpslUrl } } } } : {}),
      },
    },
    getClient: () => ({}) as PublicClient,
    getWalletClient: options?.withWallet === false ? undefined : getWalletClient,
  });

  return { config, signTypedData, getWalletClient, walletClient };
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

/** Spy `axios.get` so the DELETE signing-spec fetch resolves {@link SIGNING_SPEC}. */
function mockSigningSpecFetch(): Mock {
  return vi.spyOn(axios, "get").mockResolvedValue(okResponse(SIGNING_SPEC)) as unknown as Mock;
}

/** Spy `axios.delete` so the handler call resolves the given status body. */
function mockDelete(body: StatusResponse | undefined): Mock {
  return vi.spyOn(axios, "delete").mockResolvedValue(okResponse(body)) as unknown as Mock;
}

/**
 * Build an `AxiosError` shaped like a real handler rejection so
 * `SymmApiError.fromAxios` has `status` / `statusText` / `url` / `method` to read.
 */
function axiosFailure(): AxiosError {
  const requestConfig = { url: "/api/v5/", method: "delete", headers: {} } as InternalAxiosRequestConfig;
  const response = {
    data: { detail: "unknown cohQuoteId" },
    status: 422,
    statusText: "Unprocessable Entity",
    headers: {},
    config: requestConfig,
  } as AxiosResponse;
  return new AxiosError("Request failed with status code 422", "ERR_BAD_REQUEST", requestConfig, {}, response);
}

/** Pull the typed-data argument `signTypedData` was called with. */
function signedTypedData(signTypedData: Mock, callIndex = 0): Record<string, unknown> {
  return signTypedData.mock.calls[callIndex]![0] as Record<string, unknown>;
}

/** Pull the EIP-712 message `signTypedData` was called with. */
function signedMessage(signTypedData: Mock, callIndex = 0): Record<string, unknown> {
  return signedTypedData(signTypedData, callIndex).message as Record<string, unknown>;
}

describe("deleteQuoteTpSl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches the DELETE signing spec (not the POST one) from the chain's handler", async () => {
    const get = mockSigningSpecFetch();
    mockDelete({ successful: true, message: null });

    await deleteQuoteTpSl(mockSigningConfig().config, PARAMETERS);

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith("/api/v5/signing-spec-del", {
      baseURL: TPSL.url,
      headers: { "App-Name": TPSL.appName, Accept: "application/json" },
    });
  });

  it("re-routes both the signing-spec fetch and the DELETE through a `solver.tpsl.url` override", async () => {
    const customUrl = "https://coh.example.test";
    const get = mockSigningSpecFetch();
    const del = mockDelete({ successful: true, message: null });

    await deleteQuoteTpSl(mockSigningConfig({ tpslUrl: customUrl }).config, PARAMETERS);

    expect(customUrl).not.toBe(TPSL.url);
    expect(get.mock.calls[0]![1]).toEqual({
      baseURL: customUrl,
      headers: { "App-Name": TPSL.appName, Accept: "application/json" },
    });
    expect(del.mock.calls[0]![1].baseURL).toBe(customUrl);
    /** Only `url` is overridden — the rest of the block is still deep-merged from the chain config. */
    expect(del.mock.calls[0]![1].headers).toEqual({
      "App-Name": TPSL.appName,
      "Content-Type": "application/json",
      Accept: "application/json",
    });
  });

  it("forwards `chainId` and `from` to the wallet resolver (session-key routing)", async () => {
    mockSigningSpecFetch();
    mockDelete({ successful: true, message: null });
    const { config, getWalletClient } = mockSigningConfig();

    await deleteQuoteTpSl(config, PARAMETERS);

    expect(getWalletClient).toHaveBeenCalledTimes(1);
    expect(getWalletClient).toHaveBeenCalledWith({
      chainId: SymmioSupportedChainId.HYPER_EVM,
      from: TEST_USER,
    });
  });

  it("signs the spec's domain/types/primaryType with the wallet account", async () => {
    mockSigningSpecFetch();
    mockDelete({ successful: true, message: null });
    const { config, signTypedData, walletClient } = mockSigningConfig();

    await deleteQuoteTpSl(config, PARAMETERS);

    expect(signTypedData).toHaveBeenCalledTimes(1);
    expect(signedTypedData(signTypedData)).toMatchObject({
      account: walletClient.account,
      domain: {
        name: SIGNING_SPEC.domain.name,
        version: SIGNING_SPEC.domain.version,
        chainId: SIGNING_SPEC.domain.chainId,
        verifyingContract: SIGNING_SPEC.domain.verifyingContract,
      },
      types: SIGNING_SPEC.types,
      primaryType: SIGNING_SPEC.primaryType,
    });
  });

  it("signs the four named domain fields while echoing the handler's raw domain on the wire", async () => {
    /**
     * The handler's domain payload may carry fields the SDK does not know about;
     * `signTpSlRequest` rebuilds a 4-field domain for signing but forwards the raw
     * spec domain inside `typedData`.
     */
    const extendedDomain = { ...SIGNING_SPEC.domain, salt: "0x01" } as unknown as TpSlSigningSpec["domain"];
    vi.spyOn(axios, "get").mockResolvedValue(okResponse({ ...SIGNING_SPEC, domain: extendedDomain }));
    const del = mockDelete({ successful: true, message: null });
    const { config, signTypedData } = mockSigningConfig();

    await deleteQuoteTpSl(config, PARAMETERS);

    expect(signedTypedData(signTypedData).domain).toEqual(SIGNING_SPEC.domain);
    expect(del.mock.calls[0]![1].data.typedData.domain).toEqual(extendedDomain);
  });

  it("falls back to the config's default chain when `chainId` is omitted", async () => {
    mockSigningSpecFetch();
    mockDelete({ successful: true, message: null });
    const { config, getWalletClient } = mockSigningConfig();

    await deleteQuoteTpSl(config, {
      from: TEST_USER,
      quoteId: PARAMETERS.quoteId,
      virtualAccount: VIRTUAL_ACCOUNT,
      cohQuoteId: COH_QUOTE_ID,
      conditionalOrderType: "take_profit",
    });

    expect(config.defaultChainId).toBe(SymmioSupportedChainId.HYPER_EVM);
    expect(getWalletClient).toHaveBeenCalledWith({ chainId: SymmioSupportedChainId.HYPER_EVM, from: TEST_USER });
  });

  it("signs a delete message bound to the virtual account, cohQuoteId and side", async () => {
    mockSigningSpecFetch();
    mockDelete({ successful: true, message: null });
    const { config, signTypedData } = mockSigningConfig();

    await deleteQuoteTpSl(config, { ...PARAMETERS, conditionalOrderType: "stop_loss" });

    const message = signedMessage(signTypedData);
    expect(message).toEqual({
      virtualAccount: VIRTUAL_ACCOUNT,
      salt: expect.stringMatching(/^\d+$/),
      cohQuoteId: COH_QUOTE_ID,
      conditionalOrderType: "stop_loss",
    });
    expect(BigInt(message.salt as string) <= MAX_UINT256).toBe(true);
  });

  it("generates a fresh salt on every call", async () => {
    mockSigningSpecFetch();
    mockDelete({ successful: true, message: null });
    const { config, signTypedData } = mockSigningConfig();

    await deleteQuoteTpSl(config, PARAMETERS);
    await deleteQuoteTpSl(config, PARAMETERS);

    expect(signedMessage(signTypedData, 0).salt).not.toBe(signedMessage(signTypedData, 1).salt);
  });

  it("DELETEs `/api/v5/` with exactly `{ typedData, signature, signer }` under `data`", async () => {
    mockSigningSpecFetch();
    const del = mockDelete({ successful: true, message: null });
    const { config, signTypedData } = mockSigningConfig();

    await deleteQuoteTpSl(config, PARAMETERS);

    expect(del).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledWith("/api/v5/", {
      data: {
        typedData: {
          types: SIGNING_SPEC.types,
          primaryType: SIGNING_SPEC.primaryType,
          domain: SIGNING_SPEC.domain,
          message: {
            virtualAccount: VIRTUAL_ACCOUNT,
            salt: expect.stringMatching(/^\d+$/),
            cohQuoteId: COH_QUOTE_ID,
            conditionalOrderType: "take_profit",
          },
        },
        signature: TEST_SIGNATURE,
        signer: TEST_USER,
      },
      baseURL: TPSL.url,
      headers: { "App-Name": TPSL.appName, "Content-Type": "application/json", Accept: "application/json" },
    });
    /** The transmitted message must be byte-for-byte what was signed, salt included. */
    expect(del.mock.calls[0]![1].data.typedData.message).toEqual(signedMessage(signTypedData));
  });

  it("reports the resolved wallet account as `signer`, not the requested `from`", async () => {
    mockSigningSpecFetch();
    const del = mockDelete({ successful: true, message: null });
    const sessionKey: Address = "0x3333333333333333333333333333333333333333";
    const { config, signTypedData } = mockSigningConfig({ signerAddress: sessionKey });

    await deleteQuoteTpSl(config, PARAMETERS);

    expect(sessionKey).not.toBe(PARAMETERS.from);
    expect(del.mock.calls[0]![1].data.signer).toBe(sessionKey);
    expect(signedTypedData(signTypedData).account).toMatchObject({ address: sessionKey });
  });

  it("sends whatever `signTypedData` resolved as the signature", async () => {
    mockSigningSpecFetch();
    const del = mockDelete({ successful: true, message: null });
    const { config, signTypedData } = mockSigningConfig();
    signTypedData.mockResolvedValue("0xfeed");

    await deleteQuoteTpSl(config, PARAMETERS);

    expect(del.mock.calls[0]![1].data.signature).toBe("0xfeed");
  });

  it("resolves `{ success: true }` on `successful: true`", async () => {
    mockSigningSpecFetch();
    mockDelete({ successful: true, message: null });

    await expect(deleteQuoteTpSl(mockSigningConfig().config, PARAMETERS)).resolves.toEqual({ success: true });
  });

  it('treats the string "true" as success', async () => {
    mockSigningSpecFetch();
    mockDelete({ successful: "true", message: null });

    await expect(deleteQuoteTpSl(mockSigningConfig().config, PARAMETERS)).resolves.toEqual({ success: true });
  });

  it('treats any string other than "false" as success (only the literal "false" is a rejection)', async () => {
    mockSigningSpecFetch();
    mockDelete({ successful: "0", message: "rejected" });

    await expect(deleteQuoteTpSl(mockSigningConfig().config, PARAMETERS)).resolves.toEqual({ success: true });
  });

  it("treats an absent response body as success (the `?? {}` fallback leaves `successful` undefined)", async () => {
    mockSigningSpecFetch();
    mockDelete(undefined);

    await expect(deleteQuoteTpSl(mockSigningConfig().config, PARAMETERS)).resolves.toEqual({ success: true });
  });

  it("rejects with DELETE_TPSL_REJECTED (untouched by rethrowTpSlError) on `successful: false`", async () => {
    mockSigningSpecFetch();
    mockDelete({ successful: false, message: "order already canceled" });

    const error = await deleteQuoteTpSl(mockSigningConfig().config, PARAMETERS).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SymmError);
    expect(error).not.toBeInstanceOf(SymmApiError);
    expect(error).toMatchObject({
      kind: "api",
      code: "DELETE_TPSL_REJECTED",
      message: "order already canceled",
    });
  });

  it('rejects on the string "false"', async () => {
    mockSigningSpecFetch();
    mockDelete({ successful: "false", message: "nope" });

    await expect(deleteQuoteTpSl(mockSigningConfig().config, PARAMETERS)).rejects.toMatchObject({
      code: "DELETE_TPSL_REJECTED",
      message: "nope",
    });
  });

  it("falls back to a default rejection message when the handler sends `message: null`", async () => {
    mockSigningSpecFetch();
    mockDelete({ successful: false, message: null });

    await expect(deleteQuoteTpSl(mockSigningConfig().config, PARAMETERS)).rejects.toMatchObject({
      code: "DELETE_TPSL_REJECTED",
      message: "Handler rejected TP/SL delete.",
    });
  });

  it("wraps an AxiosError from the DELETE as SymmApiError DELETE_TPSL_FAILED carrying the handler URL", async () => {
    mockSigningSpecFetch();
    vi.spyOn(axios, "delete").mockRejectedValue(axiosFailure());

    const error = await deleteQuoteTpSl(mockSigningConfig().config, PARAMETERS).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SymmApiError);
    expect(error).toMatchObject({
      kind: "api",
      code: "DELETE_TPSL_FAILED",
      status: 422,
      statusText: "Unprocessable Entity",
      method: "DELETE",
      url: `${TPSL.url}/api/v5/`,
      responseData: { detail: "unknown cohQuoteId" },
      message: `DELETE_TPSL_FAILED: Request failed with status code 422 (DELETE ${TPSL.url}/api/v5/ → 422 Unprocessable Entity)`,
    });
  });

  it("wraps a non-axios error from the DELETE as SymmError kind `api`", async () => {
    mockSigningSpecFetch();
    vi.spyOn(axios, "delete").mockRejectedValue(new Error("socket hang up"));

    const error = await deleteQuoteTpSl(mockSigningConfig().config, PARAMETERS).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SymmError);
    expect(error).not.toBeInstanceOf(SymmApiError);
    expect(error).toMatchObject({
      kind: "api",
      code: "DELETE_TPSL_FAILED",
      message: "TP/SL request failed: socket hang up",
    });
  });

  it("stringifies a non-Error rejection from the DELETE into the SymmError message", async () => {
    mockSigningSpecFetch();
    vi.spyOn(axios, "delete").mockRejectedValue("kaboom");

    await expect(deleteQuoteTpSl(mockSigningConfig().config, PARAMETERS)).rejects.toMatchObject({
      kind: "api",
      code: "DELETE_TPSL_FAILED",
      message: "TP/SL request failed: kaboom",
    });
  });

  it("propagates a signing-spec fetch failure without sending the DELETE", async () => {
    vi.spyOn(axios, "get").mockRejectedValue(Object.assign(new AxiosError("spec down"), { isAxiosError: true }));
    const del = mockDelete({ successful: true, message: null });

    await expect(deleteQuoteTpSl(mockSigningConfig().config, PARAMETERS)).rejects.toMatchObject({
      code: "FETCH_TPSL_DELETE_SIGNING_SPEC_FAILED",
    });
    expect(del).not.toHaveBeenCalled();
  });

  it("propagates a signing failure verbatim without sending the DELETE", async () => {
    mockSigningSpecFetch();
    const del = mockDelete({ successful: true, message: null });
    const { config, signTypedData } = mockSigningConfig();
    signTypedData.mockRejectedValue(new Error("User rejected the request."));

    const error = await deleteQuoteTpSl(config, PARAMETERS).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(SymmError);
    expect((error as Error).message).toBe("User rejected the request.");
    expect(del).not.toHaveBeenCalled();
  });

  it("rejects with a SymmError when the config has no wallet resolver", async () => {
    mockSigningSpecFetch();
    const del = mockDelete({ successful: true, message: null });

    const error = await deleteQuoteTpSl(mockSigningConfig({ withWallet: false }).config, PARAMETERS).catch(
      (err: unknown) => err,
    );

    expect(error).toBeInstanceOf(SymmError);
    expect(error).toMatchObject({ kind: "config", code: "NO_WALLET_CLIENT" });
    expect(del).not.toHaveBeenCalled();
  });

  it("rejects for an unsupported chain before issuing any request", async () => {
    const get = mockSigningSpecFetch();
    const del = mockDelete({ successful: true, message: null });

    const error = await deleteQuoteTpSl(mockSigningConfig().config, { ...PARAMETERS, chainId: mainnet.id }).catch(
      (err: unknown) => err,
    );

    expect(error).toBeInstanceOf(SymmError);
    expect(error).toMatchObject({ kind: "config", code: "UNSUPPORTED_CHAIN" });
    expect(get).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });
});
