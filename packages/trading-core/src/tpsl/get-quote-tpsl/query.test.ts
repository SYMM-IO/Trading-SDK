import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";
import type { PublicClient } from "viem";
import { mainnet } from "viem/chains";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
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
import { getQuoteTpSlQueryKey, getQuoteTpSlQueryOptions } from "./query";

const TPSL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).solvers.enigma!.tpsl!;

const ROW: ConditionalOrderResponseSchema = {
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

/** The hashable payload that trails the query key; `configKey` is folded in by the factory. */
type KeyPayload = { quoteId: string; chainId?: number; configKey?: string };

function okResponse<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config: { headers: {} } as AxiosResponse["config"],
  } as AxiosResponse<T>;
}

describe("getQuoteTpSlQueryOptions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is disabled for the `0n` sentinel and enabled for a real quote id", () => {
    const { config } = mockConfig();
    expect(getQuoteTpSlQueryOptions(config, { quoteId: 0n }).enabled).toBe(false);
    expect(getQuoteTpSlQueryOptions(config, { quoteId: 128n }).enabled).toBe(true);
  });

  it("is enabled for a negative quote id — hedger `tempQuoteId`s are deliberately allowed", () => {
    const { config } = mockConfig();
    expect(getQuoteTpSlQueryOptions(config, { quoteId: -42n }).enabled).toBe(true);
  });

  it("is disabled when `quoteId` is not a bigint at runtime", () => {
    const { config } = mockConfig();
    expect(getQuoteTpSlQueryOptions(config, { quoteId: 128 as unknown as bigint }).enabled).toBe(false);
    expect(getQuoteTpSlQueryOptions(config, { quoteId: "128" as unknown as bigint }).enabled).toBe(false);
  });

  it("still builds a key for a non-bigint `quoteId` (the key is built before `enabled` is evaluated)", () => {
    const { config } = mockConfig();
    const options = getQuoteTpSlQueryOptions(config, { quoteId: 128 as unknown as bigint });
    expect(options.queryKey[1]).toMatchObject({ quoteId: "128" });
  });

  it("respects an explicit query.enabled override over a valid quote id", () => {
    const { config } = mockConfig();
    expect(getQuoteTpSlQueryOptions(config, { quoteId: 128n, query: { enabled: false } }).enabled).toBe(false);
  });

  it("keeps the id guard authoritative when query.enabled is explicitly true", () => {
    const { config } = mockConfig();
    expect(getQuoteTpSlQueryOptions(config, { quoteId: 0n, query: { enabled: true } }).enabled).toBe(false);
  });

  it("spreads the consumer's `query` overrides onto the options bag without losing the factory's own fields", () => {
    const { config } = mockConfig();
    const options = getQuoteTpSlQueryOptions(config, {
      quoteId: 128n,
      query: { staleTime: 5_000, refetchInterval: 1_000, retry: 3 },
    });

    expect(options.staleTime).toBe(5_000);
    expect(options.refetchInterval).toBe(1_000);
    expect(options.retry).toBe(3);
    expect(options.queryKey[0]).toBe("getQuoteTpSl");
    expect(typeof options.queryFn).toBe("function");
    expect(options.enabled).toBe(true);
  });

  /**
   * Documents actual behavior, not desired behavior: `getQuoteTpSlQueryKey`
   * calls `options.quoteId.toString()` before `enabled` is evaluated, so the
   * `isValidQuoteId` guard never gets to disable the query for exactly the
   * `null` / `undefined` runtime shapes its JSDoc claims to defend against.
   */
  it("throws instead of returning a disabled bag when `quoteId` is null or undefined at runtime", () => {
    const { config } = mockConfig();

    expect(() => getQuoteTpSlQueryOptions(config, { quoteId: null as unknown as bigint })).toThrow(TypeError);
    expect(() => getQuoteTpSlQueryOptions(config, { quoteId: undefined as unknown as bigint })).toThrow(TypeError);
  });

  it("queryFn delegates to the action, forwarding `quoteId`", async () => {
    const { config } = mockConfig();
    const rows = [ROW];
    const get = vi.spyOn(axios, "get").mockResolvedValue(okResponse(rows));

    const result = await getQuoteTpSlQueryOptions(config, { quoteId: 128n }).queryFn();

    expect(result).toBe(rows);
    expect(get).toHaveBeenCalledTimes(1);
    const request = get.mock.calls[0]![1] as AxiosRequestConfig;
    expect(request.baseURL).toBe(TPSL.url);
    expect((request.params as GetConditionalOrdersV5ApiV5GetParams).quote_id).toBe(128);
  });

  it("queryFn forwards `chainId` — an unsupported chain surfaces a SymmError", async () => {
    const { config } = mockConfig();
    const get = vi.spyOn(axios, "get").mockResolvedValue(okResponse([]));

    const options = getQuoteTpSlQueryOptions(config, { quoteId: 128n, chainId: mainnet.id });

    const error = await options.queryFn().catch((err: unknown) => err);

    expect(error).toBeInstanceOf(SymmError);
    expect(error).toMatchObject({ kind: "config", code: "UNSUPPORTED_CHAIN" });
    expect(get).not.toHaveBeenCalled();
  });

  it("still keys and enables an unsupported chain, with the `unsupported` config fingerprint", () => {
    const { config } = mockConfig();

    const options = getQuoteTpSlQueryOptions(config, { quoteId: 128n, chainId: mainnet.id });

    expect(options.queryKey).toEqual([
      "getQuoteTpSl",
      { chainId: mainnet.id, quoteId: "128", configKey: "unsupported" },
    ]);
    expect(options.enabled).toBe(true);
  });

  it("builds a stable key with the quote id serialized as a decimal string", () => {
    expect(
      getQuoteTpSlQueryKey({
        chainId: SymmioSupportedChainId.HYPER_EVM,
        quoteId: 128n,
      }),
    ).toEqual([
      "getQuoteTpSl",
      {
        chainId: SymmioSupportedChainId.HYPER_EVM,
        quoteId: "128",
      },
    ]);
  });

  it("serializes a negative quote id as a decimal string too", () => {
    expect(getQuoteTpSlQueryKey({ chainId: SymmioSupportedChainId.HYPER_EVM, quoteId: -77n })).toEqual([
      "getQuoteTpSl",
      { chainId: SymmioSupportedChainId.HYPER_EVM, quoteId: "-77" },
    ]);
  });

  it("strips TanStack control fields from the key", () => {
    const withQuery = getQuoteTpSlQueryKey({
      chainId: SymmioSupportedChainId.HYPER_EVM,
      quoteId: 128n,
      query: { enabled: false, staleTime: 5_000, refetchInterval: 1_000 },
    } as Parameters<typeof getQuoteTpSlQueryKey>[0]);

    expect(withQuery).toEqual(getQuoteTpSlQueryKey({ chainId: SymmioSupportedChainId.HYPER_EVM, quoteId: 128n }));
  });

  it("keys two different quote ids apart", () => {
    const { config } = mockConfig();
    const first = getQuoteTpSlQueryOptions(config, { quoteId: 128n }).queryKey;
    const second = getQuoteTpSlQueryOptions(config, { quoteId: 129n }).queryKey;

    expect(first[1].quoteId).toBe("128");
    expect(second[1].quoteId).toBe("129");
    expect(first).not.toEqual(second);
  });

  it("folds the chain config fingerprint into the factory key so overrides rekey", () => {
    const { config: base } = mockConfig();
    const overridden = createConfig({
      getClient: () => ({}) as PublicClient,
      symmioConfig: {
        [SymmioSupportedChainId.HYPER_EVM]: {
          addresses: { affiliatesAddress: TEST_AFFILIATE_ADDRESS },
          solvers: { enigma: { tpsl: { url: "https://tpsl.override.test" } } },
        },
      },
    });

    const baseKey = getQuoteTpSlQueryOptions(base, { quoteId: 128n }).queryKey;
    const overriddenKey = getQuoteTpSlQueryOptions(overridden, { quoteId: 128n }).queryKey;

    const basePayload = baseKey[1] as KeyPayload;
    const overriddenPayload = overriddenKey[1] as KeyPayload;

    expect(basePayload.configKey).toBe(base.getChainConfigKey(SymmioSupportedChainId.HYPER_EVM));
    expect(overriddenPayload.configKey).toBe(overridden.getChainConfigKey(SymmioSupportedChainId.HYPER_EVM));
    /** Only the fingerprint moves — the identifying payload is otherwise identical. */
    expect(overriddenPayload.configKey).not.toBe(basePayload.configKey);
    expect({ ...overriddenPayload, configKey: undefined }).toEqual({ ...basePayload, configKey: undefined });
  });
});
