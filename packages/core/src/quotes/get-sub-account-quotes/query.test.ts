import type { Address, PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { getSubAccountQuotesQueryKey, getSubAccountQuotesQueryOptions } from "./query";
/**
 * Mock the action so the queryFn-wiring test asserts the exact options the
 * factory forwards, without running the orchestrator's network fan-out.
 */
const getSubAccountQuotes = vi.hoisted(() => vi.fn());
vi.mock("./get-sub-account-quotes", () => ({ getSubAccountQuotes }));

const CHAIN_ID = SymmioSupportedChainId.HYPER_EVM;
const SUB = "0x00000000000000000000000000000000000000a1" as Address;
const EXTRA = "0x00000000000000000000000000000000000000c1" as Address;
const BASE_URL = "https://custom-hedger.example.com";
/** Stub config — the queryFn calls a mocked action, so the client is never used. */
const config = createConfig({ getClient: () => ({}) as PublicClient });

describe("getSubAccountQuotesQueryKey", () => {
  it("tags the key with the action name and embeds the filtered options", () => {
    const key = getSubAccountQuotesQueryKey({
      chainId: CHAIN_ID,
      subAccount: SUB,
      includeVirtualAccounts: false,
      extraAccounts: [EXTRA],
      configKey: "k",
    });
    expect(key[0]).toBe("getSubAccountQuotes");
    expect(key[1]).toMatchObject({
      subAccount: SUB,
      includeVirtualAccounts: false,
      extraAccounts: [EXTRA],
      configKey: "k",
    });
  });

  /** filterQueryOptions strips TanStack control fields so cache identity ignores them. */
  it("strips TanStack control fields like query from the key payload", () => {
    const key = getSubAccountQuotesQueryKey({
      chainId: CHAIN_ID,
      subAccount: SUB,
      configKey: "k",
      query: { enabled: false },
    } as Parameters<typeof getSubAccountQuotesQueryKey>[0]);
    expect(key[1]).not.toHaveProperty("query");
  });
});

describe("getSubAccountQuotesQueryOptions", () => {
  beforeEach(() => {
    getSubAccountQuotes.mockReset().mockResolvedValue({ quotes: [], accounts: [] });
  });

  it("defaults enabled to true and exposes a function queryFn tagged with the action name", () => {
    const options = getSubAccountQuotesQueryOptions(config, { chainId: CHAIN_ID, subAccount: SUB });
    expect(options.enabled).toBe(true);
    expect(options.queryKey[0]).toBe("getSubAccountQuotes");
    expect(typeof options.queryFn).toBe("function");
  });

  /** The factory injects the config's chain-config key so different chains get distinct cache entries. */
  it("embeds the config's chain-config key in the query key", () => {
    const options = getSubAccountQuotesQueryOptions(config, { chainId: CHAIN_ID, subAccount: SUB });
    expect(options.queryKey[1]).toMatchObject({ configKey: config.getChainConfigKey(CHAIN_ID) });
  });

  it("respects an explicit query.enabled === false", () => {
    const options = getSubAccountQuotesQueryOptions(config, {
      chainId: CHAIN_ID,
      subAccount: SUB,
      query: { enabled: false },
    });
    expect(options.enabled).toBe(false);
  });

  /** The queryFn must forward exactly the read parameters to the action — no TanStack control fields. */
  it("invokes getSubAccountQuotes with the forwarded read options", async () => {
    const options = getSubAccountQuotesQueryOptions(config, {
      chainId: CHAIN_ID,
      subAccount: SUB,
      includeVirtualAccounts: false,
      extraAccounts: [EXTRA],
      baseUrl: BASE_URL,
      query: { enabled: true },
    });
    await (options.queryFn as () => Promise<unknown>)();
    expect(getSubAccountQuotes).toHaveBeenCalledWith(config, {
      chainId: CHAIN_ID,
      subAccount: SUB,
      includeVirtualAccounts: false,
      extraAccounts: [EXTRA],
      baseUrl: BASE_URL,
    });
  });

  /**
   * The factory does not apply the action's defaults (those live in the action
   * itself); omitted read params are forwarded as `undefined`, never dropped or
   * defaulted at this layer.
   */
  it("forwards omitted read params as undefined without defaulting them", async () => {
    const options = getSubAccountQuotesQueryOptions(config, { chainId: CHAIN_ID, subAccount: SUB });
    await (options.queryFn as () => Promise<unknown>)();
    expect(getSubAccountQuotes).toHaveBeenCalledWith(config, {
      chainId: CHAIN_ID,
      subAccount: SUB,
      includeVirtualAccounts: undefined,
      extraAccounts: undefined,
      baseUrl: undefined,
    });
  });
});
