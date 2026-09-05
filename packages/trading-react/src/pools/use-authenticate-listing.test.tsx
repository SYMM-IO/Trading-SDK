import type { ListingAuthToken } from "@symmio/trading-core";
import { act, waitFor } from "@testing-library/react";
import { arbitrum, hyperEvm } from "viem/chains";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const authenticateListingMutationOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, authenticateListingMutationOptions };
});

import { useAuthenticateListing } from "./use-authenticate-listing";

const TOKEN: ListingAuthToken = { accessToken: "eyJhbGc.header.sig", tokenType: "bearer" };

function mockMutationFn(mutationFn: ReturnType<typeof vi.fn>) {
  authenticateListingMutationOptions.mockReturnValue({ mutationKey: ["authenticateListing"], mutationFn });
}

describe("useAuthenticateListing", () => {
  afterEach(() => {
    authenticateListingMutationOptions.mockReset();
  });

  it("fills domain/uri from window.location and the connected chain, then returns the token", async () => {
    const { config } = createMockSymmioConfig();
    const mutationFn = vi.fn().mockResolvedValue(TOKEN);
    mockMutationFn(mutationFn);

    const { result } = renderHookWithProviders(() => useAuthenticateListing({ config }));

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync({});
    });

    expect(res).toEqual(TOKEN);
    expect(mutationFn).toHaveBeenCalledWith({
      domain: window.location.host,
      uri: window.location.origin,
      chainId: hyperEvm.id,
    });
  });

  it("forwards explicit domain, uri, and chainId overrides unchanged", async () => {
    const { config } = createMockSymmioConfig();
    const mutationFn = vi.fn().mockResolvedValue(TOKEN);
    mockMutationFn(mutationFn);

    const { result } = renderHookWithProviders(() => useAuthenticateListing({ config }));

    await act(async () => {
      await result.current.mutateAsync({
        domain: "app.example.com",
        uri: "https://app.example.com",
        chainId: arbitrum.id,
      });
    });

    expect(mutationFn).toHaveBeenCalledWith({
      domain: "app.example.com",
      uri: "https://app.example.com",
      chainId: arbitrum.id,
    });
  });

  it("normalizes a rejected mutationFn to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockMutationFn(vi.fn().mockRejectedValue(new Error("login rejected")));

    const { result } = renderHookWithProviders(() => useAuthenticateListing({ config }));

    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({});
      } catch (e) {
        error = e;
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((error as SymmioRequestError).kind).toBe("unknown");
  });
});
