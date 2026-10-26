import type { ListingSignInMessage } from "@symmio/trading-core";
import { act, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMockSymmioConfig,
  createTestQueryClient,
  createTestWagmiConfig,
  renderHookWithProviders,
  TEST_EOA,
  TestProviders,
} from "../test/test-utils";
import { useAuthenticateListing } from "./use-authenticate-listing";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), sign: vi.fn() }));
vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return {
    ...actual,
    getListingSignInMessageQueryOptions: (
      config: Parameters<typeof actual.getListingSignInMessageQueryOptions>[0],
      parameters: Parameters<typeof actual.getListingSignInMessageQueryOptions>[1],
    ) => ({
      ...actual.getListingSignInMessageQueryOptions(config, parameters),
      queryFn: () => mocks.fetch(parameters),
    }),
    authenticateListingMutationOptions: () => ({ mutationKey: ["authenticateListing"], mutationFn: mocks.sign }),
  };
});
describe("listing challenge prefetch", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    let nonce = 0;
    mocks.fetch.mockImplementation(
      async (parameters) =>
        ({
          message: `nonce-${++nonce}`,
          params: {
            ...parameters,
            version: "1",
            nonce: String(nonce),
            issuedAt: new Date().toISOString(),
            statement: parameters.statement ?? "",
          },
        }) satisfies ListingSignInMessage,
    );
    mocks.sign.mockResolvedValue({ accessToken: "token", tokenType: "bearer" });
  });
  it("does not prefetch on mount by default", async () => {
    const { config } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => useAuthenticateListing({ config, from: TEST_EOA }));
    await act(async () => {});
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(result.current.challenge).toBeUndefined();
  });
  it("renders on the server without reading window or fetching a challenge", () => {
    const { config } = createMockSymmioConfig();
    const wagmiConfig = createTestWagmiConfig();
    function ServerLogin() {
      useAuthenticateListing({ config, from: TEST_EOA, prefetchChallenge: true });
      return null;
    }
    vi.stubGlobal("window", undefined);
    try {
      expect(() =>
        renderToString(
          <TestProviders wagmiConfig={wagmiConfig}>
            <ServerLogin />
          </TestProviders>,
        ),
      ).not.toThrow();
      expect(mocks.fetch).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("refreshes an expiring prefetched challenge before another signing gesture", async () => {
    const { config } = createMockSymmioConfig();
    vi.useFakeTimers();
    mocks.fetch.mockImplementationOnce(async (parameters) => ({
      message: "short-lived",
      params: {
        ...parameters,
        version: "1",
        nonce: "short",
        issuedAt: new Date().toISOString(),
        expirationTime: new Date(Date.now() + 1500).toISOString(),
      },
    }));
    try {
      const { result } = renderHookWithProviders(() =>
        useAuthenticateListing({ config, from: TEST_EOA, prefetchChallenge: true }),
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(result.current.challenge?.message).toBe("short-lived");
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1001);
      });
      expect(mocks.fetch).toHaveBeenCalledTimes(2);
      expect(result.current.challenge?.message).toBe("nonce-1");
    } finally {
      vi.useRealTimers();
    }
  });
  it("uses the prefetched nonce then replaces it after success", async () => {
    const { config } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() =>
      useAuthenticateListing({ config, from: TEST_EOA, prefetchChallenge: true }),
    );
    await waitFor(() => expect(result.current.challenge?.message).toBe("nonce-1"));
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    await act(async () => {
      await result.current.mutateAsync({});
    });
    expect(mocks.sign.mock.calls[0]?.[0].signInMessage.message).toBe("nonce-1");
    await waitFor(() => expect(result.current.challenge?.message).toBe("nonce-2"));
  });
  it("does not reuse a nonce after a rejected attempt", async () => {
    const { config } = createMockSymmioConfig();
    mocks.sign.mockRejectedValueOnce(Error("rejected"));
    const { result } = renderHookWithProviders(() =>
      useAuthenticateListing({ config, from: TEST_EOA, prefetchChallenge: true }),
    );
    await waitFor(() => expect(result.current.challenge).toBeDefined());
    await act(async () => {
      await result.current.mutateAsync({}).catch(() => undefined);
    });
    await waitFor(() => expect(result.current.challenge?.message).toBe("nonce-2"));
    await act(async () => {
      await result.current.mutateAsync({});
    });
    expect(mocks.sign.mock.calls[1]?.[0].signInMessage.message).toBe("nonce-2");
  });
  it("consumes a cached nonce once across two mounted hooks", async () => {
    const { config } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(
      () =>
        [
          useAuthenticateListing({ config, from: TEST_EOA, prefetchChallenge: true }),
          useAuthenticateListing({ config, from: TEST_EOA, prefetchChallenge: true }),
        ] as const,
    );
    await waitFor(() => expect(result.current[0].challenge?.message).toBe("nonce-1"));
    await act(async () => {
      await Promise.all(result.current.map((login) => login.mutateAsync({})));
    });
    expect(mocks.sign.mock.calls.filter(([variables]) => variables.signInMessage?.message === "nonce-1")).toHaveLength(
      1,
    );
    expect(mocks.sign).toHaveBeenCalledTimes(2);
  });
  it("does not delay successful authentication for a replacement challenge", async () => {
    const { config } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() =>
      useAuthenticateListing({ config, from: TEST_EOA, prefetchChallenge: true }),
    );
    await waitFor(() => expect(result.current.challenge).toBeDefined());
    mocks.fetch.mockImplementationOnce(() => new Promise(() => {}));
    await act(async () => {
      expect(await result.current.mutateAsync({})).toEqual({ accessToken: "token", tokenType: "bearer" });
    });
    expect(result.current.isSuccess).toBe(true);
  });
  it("keys cached challenges by origin and respects explicit mutation signers", async () => {
    const { config } = createMockSymmioConfig();
    const queryClient = createTestQueryClient();
    let uri = "https://first.example";
    const { result, rerender } = renderHookWithProviders(
      () => useAuthenticateListing({ config, from: TEST_EOA, domain: new URL(uri).host, uri, prefetchChallenge: true }),
      { queryClient },
    );
    await waitFor(() => expect(result.current.challenge?.params.uri).toBe(uri));
    uri = "https://second.example";
    rerender();
    await waitFor(() => expect(result.current.challenge?.params.uri).toBe(uri));
    const signer = "0x0000000000000000000000000000000000000001";
    await act(async () => {
      await result.current.mutateAsync({ from: signer });
    });
    expect(mocks.sign.mock.calls[0]?.[0].from).toBe(signer);
  });
  it("changes the challenge when the signing wallet changes", async () => {
    const { config } = createMockSymmioConfig();
    const queryClient = createTestQueryClient();
    let from = TEST_EOA as `0x${string}`;
    const { result, rerender } = renderHookWithProviders(
      () => useAuthenticateListing({ config, from, prefetchChallenge: true }),
      { queryClient },
    );
    await waitFor(() => expect(result.current.challenge?.params.address).toBe(TEST_EOA));
    from = "0x0000000000000000000000000000000000000001";
    rerender();
    await waitFor(() => expect(result.current.challenge?.params.address).toBe(from));
  });
  it("ignores cached challenges for a different statement", async () => {
    const { config } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() =>
      useAuthenticateListing({ config, from: TEST_EOA, prefetchChallenge: true }),
    );
    await waitFor(() => expect(result.current.challenge).toBeDefined());
    await act(async () => {
      await result.current.mutateAsync({ statement: "other" });
    });
    expect(mocks.sign.mock.calls[0]?.[0].signInMessage).toBeUndefined();
  });
  it("lets the mutation fetch normally after prefetch fails", async () => {
    mocks.fetch.mockRejectedValueOnce(Error("offline"));
    const { config } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() =>
      useAuthenticateListing({ config, from: TEST_EOA, prefetchChallenge: true }),
    );
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));
    await act(async () => {
      await result.current.mutateAsync({});
    });
    expect(mocks.sign.mock.calls[0]?.[0].signInMessage).toBeUndefined();
    expect(result.current.isSuccess).toBe(true);
  });
});
