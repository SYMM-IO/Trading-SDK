import {
  createConfig,
  getDelegationExpiryQueryKey,
  getInstantLayerNonceQueryKey,
  getIsDelegationActiveQueryKey,
  getOperationalFeeAllowanceQueryKey,
  SymmioSupportedChainId,
} from "@symmio/trading-core";
import { QueryClient } from "@tanstack/react-query";
import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../test/test-utils";

const grantDelegation = vi.hoisted(() => vi.fn());

/**
 * The mutation options are the seam: the transport choice happens inside the
 * core action, so a test drives it by controlling what that action returns.
 */
vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return {
    ...actual,
    grantDelegationMutationOptions: () => ({
      mutationKey: ["grantDelegation"] as const,
      mutationFn: grantDelegation,
    }),
  };
});

import { useGrantDelegation } from "./use-grant-delegation";

const CHAIN = SymmioSupportedChainId.ARBITRUM;
const AFFILIATE = "0x000000000000000000000000000000000000aFF1";
const ACCOUNT = "0xBabAD9AAA1a617886c272CEC2Ce7A132Fe2ECf29";
const DELEGATE = "0xdbe2Cd3ED29bb7bd26F25044C08E9F3Ad0a94B5B";
const OTHER_DELEGATE = "0x1111111111111111111111111111111111111111";
const SELECTOR = "0xa6d66852";
const RELAYED_HASH = `0x${"ee".repeat(32)}` as const;

function buildConfig() {
  const waitForTransactionReceipt = vi.fn().mockResolvedValue({ blockNumber: 9n, status: "success" });
  const config = createConfig({
    getClient: () => ({ waitForTransactionReceipt }) as unknown as PublicClient,
    symmioConfig: { [CHAIN]: { addresses: { affiliatesAddress: AFFILIATE } } },
  });
  return { config, waitForTransactionReceipt };
}

const VARIABLES = {
  chainId: CHAIN,
  account: { addr: ACCOUNT, isPartyB: false },
  delegatedSigner: DELEGATE,
  selectors: [SELECTOR],
  expiryTimestamp: 1n,
  gasless: true,
} as const;

describe("useGrantDelegation — gasless transport", () => {
  beforeEach(() => {
    grantDelegation.mockReset();
    grantDelegation.mockResolvedValue(RELAYED_HASH);
  });

  it("returns the relayer's hash and waits for its receipt like any write", async () => {
    const { config, waitForTransactionReceipt } = buildConfig();
    const { result } = renderHookWithProviders(() => useGrantDelegation({ config }));

    const resolved = await result.current.mutateAsync({ ...VARIABLES });

    expect(resolved.hash).toBe(RELAYED_HASH);
    expect(resolved.receipt).toEqual({ blockNumber: 9n, status: "success" });
    expect(waitForTransactionReceipt).toHaveBeenCalledWith(expect.objectContaining({ hash: RELAYED_HASH }));
  });

  it("forwards the gasless flag to the core action untouched", async () => {
    const { config } = buildConfig();
    const { result } = renderHookWithProviders(() => useGrantDelegation({ config }));

    await result.current.mutateAsync({ ...VARIABLES });

    expect(grantDelegation).toHaveBeenCalledWith(expect.objectContaining({ gasless: true }));
  });

  it("invalidates the delegation reads for this account and delegate, leaving others alone", async () => {
    const { config } = buildConfig();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const configKey = config.getChainConfigKey(CHAIN);

    const target = getIsDelegationActiveQueryKey({
      chainId: CHAIN,
      account: ACCOUNT,
      delegate: DELEGATE,
      selector: SELECTOR,
      configKey,
    });
    const expiry = getDelegationExpiryQueryKey({ chainId: CHAIN, account: ACCOUNT, delegate: DELEGATE, configKey });
    const otherDelegate = getIsDelegationActiveQueryKey({
      chainId: CHAIN,
      account: ACCOUNT,
      delegate: OTHER_DELEGATE,
      selector: SELECTOR,
      configKey,
    });
    queryClient.setQueryData(target, false);
    queryClient.setQueryData(expiry, 0n);
    queryClient.setQueryData(otherDelegate, false);

    const { result } = renderHookWithProviders(() => useGrantDelegation({ config }), { queryClient });
    await result.current.mutateAsync({ ...VARIABLES });

    expect(queryClient.getQueryState(target)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(expiry)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(otherDelegate)?.isInvalidated).toBe(false);
  });

  it("invalidates every granted selector, not just the one a read happens to hold", async () => {
    const { config } = buildConfig();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const configKey = config.getChainConfigKey(CHAIN);
    const keys = (["0xa6d66852", "0x0ac30baf", "0x501e891f"] as const).map((selector) =>
      getIsDelegationActiveQueryKey({ chainId: CHAIN, account: ACCOUNT, delegate: DELEGATE, selector, configKey }),
    );
    for (const key of keys) queryClient.setQueryData(key, false);

    const { result } = renderHookWithProviders(() => useGrantDelegation({ config }), { queryClient });
    await result.current.mutateAsync({ ...VARIABLES, selectors: ["0xa6d66852", "0x0ac30baf", "0x501e891f"] });

    for (const key of keys) expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
  });

  it("also invalidates what a relayed grant charges — the nonce and the fee allowance", async () => {
    const { config } = buildConfig();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const configKey = config.getChainConfigKey(CHAIN);
    const nonce = getInstantLayerNonceQueryKey({ chainId: CHAIN, account: ACCOUNT, configKey });
    const allowance = getOperationalFeeAllowanceQueryKey({ chainId: CHAIN, payer: ACCOUNT, configKey });
    queryClient.setQueryData(nonce, 1n);
    queryClient.setQueryData(allowance, 0n);

    const { result } = renderHookWithProviders(() => useGrantDelegation({ config }), { queryClient });
    await result.current.mutateAsync({ ...VARIABLES });

    expect(queryClient.getQueryState(nonce)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(allowance)?.isInvalidated).toBe(true);
  });

  it("invalidates nothing when the grant fails", async () => {
    const { config } = buildConfig();
    grantDelegation.mockRejectedValue(new Error("relay refused"));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const key = getIsDelegationActiveQueryKey({
      chainId: CHAIN,
      account: ACCOUNT,
      delegate: DELEGATE,
      selector: SELECTOR,
      configKey: config.getChainConfigKey(CHAIN),
    });
    queryClient.setQueryData(key, false);

    const { result } = renderHookWithProviders(() => useGrantDelegation({ config }), { queryClient });

    await expect(result.current.mutateAsync({ ...VARIABLES })).rejects.toBeTruthy();
    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false);
  });
});
