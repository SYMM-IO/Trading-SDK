import {
  createConfig,
  getActiveDelegationsQueryKey,
  getIsDelegationActiveQueryKey,
  getPendingRevocationEtasQueryKey,
  SymmioSupportedChainId,
} from "@symmio/trading-core";
import { QueryClient } from "@tanstack/react-query";
import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../test/test-utils";

const grantDelegations = vi.hoisted(() => vi.fn());

/**
 * The mutation options are the seam: the transport choice happens inside the
 * core action, so a test drives it by controlling what that action returns.
 */
vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return {
    ...actual,
    grantDelegationsMutationOptions: () => ({
      mutationKey: ["grantDelegations"] as const,
      mutationFn: grantDelegations,
    }),
  };
});

import { useGrantDelegations } from "./use-grant-delegations";

const CHAIN = SymmioSupportedChainId.ARBITRUM;
const AFFILIATE = "0x000000000000000000000000000000000000aFF1";
const ACCOUNT = "0xBabAD9AAA1a617886c272CEC2Ce7A132Fe2ECf29";
const SESSION_KEY = "0xdbe2Cd3ED29bb7bd26F25044C08E9F3Ad0a94B5B";
const EXECUTOR = "0x2222222222222222222222222222222222222222";
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
  delegations: [
    { delegatedSigner: SESSION_KEY, selectors: [SELECTOR], expiryTimestamp: 1n },
    { delegatedSigner: EXECUTOR, selectors: [SELECTOR], expiryTimestamp: 1n },
  ],
  gasless: true,
} as const;

describe("useGrantDelegations — gasless transport", () => {
  beforeEach(() => {
    grantDelegations.mockReset();
    grantDelegations.mockResolvedValue(RELAYED_HASH);
  });

  it("forwards the variables, gasless flag included, to the core action untouched", async () => {
    const { config } = buildConfig();
    const { result } = renderHookWithProviders(() => useGrantDelegations({ config }));

    const resolved = await result.current.mutateAsync({ ...VARIABLES });

    expect(resolved.hash).toBe(RELAYED_HASH);
    expect(grantDelegations).toHaveBeenCalledWith(expect.objectContaining({ ...VARIABLES }));
  });

  it("invalidates every granted delegate's reads, the active probe and pending revocations, leaving other delegates alone", async () => {
    const { config } = buildConfig();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const configKey = config.getChainConfigKey(CHAIN);
    const delegator = { addr: ACCOUNT, isPartyB: false } as const;
    const [sessionKey, executor, other] = ([SESSION_KEY, EXECUTOR, OTHER_DELEGATE] as const).map((delegate) =>
      getIsDelegationActiveQueryKey({ chainId: CHAIN, account: ACCOUNT, delegate, selector: SELECTOR, configKey }),
    );
    const active = getActiveDelegationsQueryKey({
      chainId: CHAIN,
      delegator,
      delegates: [SESSION_KEY, EXECUTOR],
      selectors: [[SELECTOR], [SELECTOR]],
      configKey,
    });
    const revocation = getPendingRevocationEtasQueryKey({
      chainId: CHAIN,
      delegator,
      delegate: SESSION_KEY,
      selectors: [SELECTOR],
      configKey,
    });
    for (const key of [sessionKey!, executor!, other!]) queryClient.setQueryData(key, false);
    queryClient.setQueryData(active, []);
    queryClient.setQueryData(revocation, new Map([[SELECTOR, 1n]]));

    const { result } = renderHookWithProviders(() => useGrantDelegations({ config }), { queryClient });
    await result.current.mutateAsync({ ...VARIABLES });

    expect(queryClient.getQueryState(sessionKey!)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(executor!)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(other!)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(active)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(revocation)?.isInvalidated).toBe(true);
  });

  it("invalidates nothing when the grant fails", async () => {
    const { config } = buildConfig();
    grantDelegations.mockRejectedValue(new Error("relay refused"));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const key = getIsDelegationActiveQueryKey({
      chainId: CHAIN,
      account: ACCOUNT,
      delegate: SESSION_KEY,
      selector: SELECTOR,
      configKey: config.getChainConfigKey(CHAIN),
    });
    queryClient.setQueryData(key, false);

    const { result } = renderHookWithProviders(() => useGrantDelegations({ config }), { queryClient });

    await expect(result.current.mutateAsync({ ...VARIABLES })).rejects.toBeTruthy();
    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false);
  });
});
