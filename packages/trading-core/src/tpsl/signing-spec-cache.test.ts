import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Config } from "../core/config";
import { mockConfig, TEST_USER } from "../shared/test/mock-config";
import { deleteQuoteTpSl } from "./delete-quote-tpsl/delete-quote-tpsl";
import { setQuoteTpSl } from "./set-quote-tpsl/set-quote-tpsl";
import { getTpSlDeleteSigningSpec } from "./signing-spec/get-tpsl-delete-signing-spec";
import { getTpSlSigningSpec } from "./signing-spec/get-tpsl-signing-spec";
import type { TpSlSignedRequest, TpSlSigningSpec } from "./types";

const POST_PATH = "/api/v5/signing-spec";
const DELETE_PATH = "/api/v5/signing-spec-del";
const TTL = 300_000;
// Synthetic wire schemas; request/signature assertions do not depend on a live handler.
const POST_SPEC: TpSlSigningSpec = {
  domain: { name: "ConditionalOrders", version: "1", chainId: 42161, verifyingContract: TEST_USER },
  primaryType: "Order",
  types: { Order: [{ name: "quoteId", type: "int256" }] },
};
const DELETE_SPEC: TpSlSigningSpec = {
  ...POST_SPEC,
  primaryType: "CancelOrder",
  types: { CancelOrder: [{ name: "cohQuoteId", type: "string" }] },
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe.each([
  ["POST", getTpSlSigningSpec, POST_SPEC, "FETCH_TPSL_SIGNING_SPEC_FAILED"],
  ["DELETE", getTpSlDeleteSigningSpec, DELETE_SPEC, "FETCH_TPSL_DELETE_SIGNING_SPEC_FAILED"],
] as const)("%s signing schema cache", (_method, read, spec, errorCode) => {
  it("coalesces concurrent reads and reuses the successful response", async () => {
    const { config } = mockConfig();
    let resolve!: (value: { data: TpSlSigningSpec }) => void;
    const get = vi.spyOn(axios, "get").mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const first = read(config);
    const second = read(config, { chainId: config.defaultChainId });
    await Promise.resolve();
    expect(get).toHaveBeenCalledTimes(1);
    resolve({ data: spec });
    expect(await Promise.all([first, second])).toEqual([spec, spec]);
    expect(await read(config)).toEqual(spec);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("expires five minutes after success, without extending expiry on a hit", async () => {
    vi.useFakeTimers();
    const { config } = mockConfig();
    let resolve!: (value: { data: TpSlSigningSpec }) => void;
    const get = vi
      .spyOn(axios, "get")
      .mockReturnValueOnce(
        new Promise((done) => {
          resolve = done;
        }),
      )
      .mockResolvedValue({ data: spec });
    const pending = read(config);
    await Promise.resolve();
    vi.advanceTimersByTime(20_000);
    resolve({ data: spec });
    await pending;
    vi.advanceTimersByTime(TTL - 1);
    await read(config);
    expect(get).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    await Promise.all([read(config), read(config)]);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("forgets rejected reads and never falls back to an expired schema", async () => {
    vi.useFakeTimers();
    const { config } = mockConfig();
    const get = vi.spyOn(axios, "get").mockResolvedValue({ data: spec });
    await read(config);
    vi.advanceTimersByTime(TTL);
    get.mockRejectedValueOnce(new Error("offline"));
    const failures = await Promise.allSettled([read(config), read(config)]);
    for (const failure of failures) expect(failure).toMatchObject({ status: "rejected", reason: { code: errorCode } });
    expect(get).toHaveBeenCalledTimes(2);
    await expect(read(config)).resolves.toEqual(spec);
    expect(get).toHaveBeenCalledTimes(3);
  });

  it.each([
    undefined,
    {},
    { ...POST_SPEC, domain: {} },
    { ...POST_SPEC, domain: { ...POST_SPEC.domain, verifyingContract: "missing" } },
    { ...POST_SPEC, types: {} },
    { ...POST_SPEC, types: { Order: [] } },
    { ...POST_SPEC, types: { Order: [{ name: "quoteId" }] } },
  ])("returns incomplete responses unchanged without retaining them: %j", async (data) => {
    const { config } = mockConfig();
    const get = vi.spyOn(axios, "get").mockResolvedValueOnce({ data }).mockResolvedValue({ data: spec });
    expect(await read(config)).toBe(data);
    expect(await read(config)).toEqual(spec);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("protects the retained schema from mutation through returned objects", async () => {
    const { config } = mockConfig();
    const get = vi.spyOn(axios, "get").mockResolvedValue({ data: structuredClone(spec) });
    const first = await read(config);
    first.domain.name = "changed";
    first.types[first.primaryType]![0]!.type = "bytes32";
    const second = await read(config);
    expect(second).toEqual(spec);
    second.domain.chainId = 1;
    expect(await read(config)).toEqual(spec);
    expect(get).toHaveBeenCalledTimes(1);
  });
});

describe("schema cache scope and action integration", () => {
  it("isolates Config instances even when their fingerprints match", async () => {
    const a = mockConfig().config;
    const b = mockConfig().config;
    expect(a.getChainConfigKey()).toBe(b.getChainConfigKey());
    const get = vi.spyOn(axios, "get").mockResolvedValue({ data: POST_SPEC });
    await Promise.all([getTpSlSigningSpec(a), getTpSlSigningSpec(b)]);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it.each(["chain", "fingerprint", "url", "appName"] as const)(
    "isolates a changed %s within one config identity",
    async (part) => {
      const base = mockConfig().config;
      let changed = false;
      // Custom Config resolvers exercise each key dimension independently; production createConfig is immutable.
      const config: Config = {
        ...base,
        getChainConfig: () => ({ ...base.getChainConfig(), chainId: changed && part === "chain" ? 10 : 42161 }),
        getChainConfigKey: () => (changed && part === "fingerprint" ? "next" : "same"),
        getSolver: () => {
          const solver = base.getSolver();
          return {
            ...solver,
            tpsl: {
              ...solver.tpsl!,
              url: changed && part === "url" ? "https://next-handler.test" : solver.tpsl!.url,
              appName: changed && part === "appName" ? "next-app" : solver.tpsl!.appName,
            },
          };
        },
      };
      const get = vi.spyOn(axios, "get").mockResolvedValue({ data: POST_SPEC });
      await getTpSlSigningSpec(config);
      changed = true;
      await getTpSlSigningSpec(config);
      expect(get).toHaveBeenCalledTimes(2);
      changed = false;
      await getTpSlSigningSpec(config);
      expect(get).toHaveBeenCalledTimes(2);
    },
  );

  it("shares schemas with actual set/delete actions while signing and submitting each fresh message", async () => {
    const { config, signTypedData, writeContract } = mockConfig();
    const get = vi
      .spyOn(axios, "get")
      .mockImplementation(async (url) => ({ data: url === POST_PATH ? POST_SPEC : DELETE_SPEC }));
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { successful: true } });
    const del = vi.spyOn(axios, "delete").mockResolvedValue({ data: { successful: true } });
    await Promise.all([getTpSlSigningSpec(config), getTpSlDeleteSigningSpec(config)]);
    for (const quoteId of [42n, 43n]) {
      await setQuoteTpSl(config, {
        virtualAccount: TEST_USER,
        subAccount: TEST_USER,
        quoteId,
        symbolId: 1n,
        positionType: 0,
        quantity: "5",
        pricePrecision: 6,
        tp: { triggerPrice: "12", priceType: "markPrice" },
      });
      await deleteQuoteTpSl(config, {
        virtualAccount: TEST_USER,
        quoteId,
        cohQuoteId: `coh${quoteId}`,
        conditionalOrderType: "take_profit",
      });
    }
    expect(get.mock.calls.map(([url]) => url)).toEqual([POST_PATH, DELETE_PATH]);
    expect(signTypedData).toHaveBeenCalledTimes(4);
    expect(post).toHaveBeenCalledTimes(2);
    expect(del).toHaveBeenCalledTimes(2);
    const posts = post.mock.calls.map(([, body]) => body as TpSlSignedRequest);
    const deletes = del.mock.calls.map(([, options]) => options!.data as TpSlSignedRequest);
    expect(posts.map((body) => body.typedData.message.quoteId)).toEqual([42, 43]);
    expect(deletes.map((body) => body.typedData.message.cohQuoteId)).toEqual(["coh42", "coh43"]);
    for (const body of posts) expect(body.typedData).toMatchObject(POST_SPEC);
    for (const body of deletes) expect(body.typedData).toMatchObject(DELETE_SPEC);
    expect(new Set([...posts, ...deletes].map((body) => body.typedData.message.salt)).size).toBe(4);
    expect(writeContract).not.toHaveBeenCalled();
  });
});
