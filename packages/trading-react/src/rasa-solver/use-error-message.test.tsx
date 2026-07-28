import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getErrorMessageQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getErrorMessageQueryOptions };
});

import { useErrorMessage } from "./use-error-message";

const RESULT = { "2000": "insufficient margin" };

function mockOptions(queryFn: () => Promise<unknown>) {
  getErrorMessageQueryOptions.mockReturnValue({
    queryKey: ["getErrorMessage", {}],
    enabled: true,
    queryFn,
  });
}

describe("useErrorMessage", () => {
  afterEach(() => {
    getErrorMessageQueryOptions.mockReset();
  });

  it("wires chainId, solverId, and errorCode into the core query options and returns the map", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    const { result } = renderHookWithProviders(() =>
      useErrorMessage({ config, chainId: 8453, solverId: "rasa", errorCode: 2000 }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(RESULT);
    expect(getErrorMessageQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ chainId: 8453, solverId: "rasa", errorCode: 2000 }),
    );
  });

  it("defaults chainId to the connected chain when omitted", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    renderHookWithProviders(() => useErrorMessage({ config, errorCode: 2000 }));

    await waitFor(() => expect(getErrorMessageQueryOptions).toHaveBeenCalled());
    expect(getErrorMessageQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ chainId: expect.any(Number), errorCode: 2000 }),
    );
  });
});
