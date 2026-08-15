import {
  PositionType,
  getInstantOpensQueryKey,
  type InstantOpenReturnType,
  type PrepareInstantOpenParameters,
  type SetQuoteTpSlParameters,
  type SetQuoteTpSlReturnType,
} from "@symmio/trading-core";
import type { Query, QueryKey } from "@tanstack/react-query";
import { act, waitFor } from "@testing-library/react";
import { hyperEvm } from "viem/chains";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, createTestQueryClient, renderHookWithProviders } from "../test/test-utils";
import { __resetTpSlStore, useTpSlStore } from "../tpsl/tpsl-store";

const instantOpenAutoMutationOptions = vi.hoisted(() => vi.fn());
const setQuoteTpSlMutationOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, instantOpenAutoMutationOptions, setQuoteTpSlMutationOptions };
});

import { useInstantOpenWithTpSl } from "./use-instant-open-with-tpsl";

const SUB_ACCOUNT = "0x00000000000000000000000000000000000000a1" as const;
const VA = "0x00000000000000000000000000000000000000b2" as const;
const SESSION_KEY = "0x00000000000000000000000000000000000000c3" as const;

const OPEN_VARS: PrepareInstantOpenParameters = {
  subAccountAddress: SUB_ACCOUNT,
  market: { id: 1 },
  positionType: PositionType.LONG,
  initialMargin: "100",
  leverage: 5,
  slippage: 1,
};

const TPSL_BLOCK: Omit<SetQuoteTpSlParameters, "quoteId" | "chainId"> = {
  from: SESSION_KEY,
  virtualAccount: VA,
  subAccount: SUB_ACCOUNT,
  symbolId: 1n,
  positionType: PositionType.LONG,
  quantity: "10",
  pricePrecision: 4,
  tp: { triggerPrice: "150", priceType: "markPrice" },
  sl: { triggerPrice: "80", priceType: "markPrice" },
};

const OPEN_OK: InstantOpenReturnType = { kind: "enigma", success: true, tempQuoteId: "-1001" };
const OPEN_NO_ID: InstantOpenReturnType = { kind: "enigma", success: true };
const TPSL_OK: SetQuoteTpSlReturnType = { success: true, cohQuoteId: "coh42" };

function mockOpen(fn: ReturnType<typeof vi.fn>) {
  instantOpenAutoMutationOptions.mockReturnValue({ mutationKey: ["instantOpenAuto"], mutationFn: fn });
}
function mockTpSl(fn: ReturnType<typeof vi.fn>) {
  setQuoteTpSlMutationOptions.mockReturnValue({ mutationKey: ["setQuoteTpSl"], mutationFn: fn });
}

function queryWith(key: QueryKey): Query<unknown, Error, unknown, QueryKey> {
  return { queryKey: key } as Query<unknown, Error, unknown, QueryKey>;
}

describe("useInstantOpenWithTpSl", () => {
  afterEach(() => {
    instantOpenAutoMutationOptions.mockReset();
    setQuoteTpSlMutationOptions.mockReset();
    __resetTpSlStore();
  });

  it("runs instant open only when no `tpsl` block is passed", async () => {
    const { config } = createMockSymmioConfig();
    const openFn = vi.fn().mockResolvedValue(OPEN_OK);
    const tpslFn = vi.fn();
    mockOpen(openFn);
    mockTpSl(tpslFn);

    const { result } = renderHookWithProviders(() => useInstantOpenWithTpSl({ config }));

    await act(async () => {
      await result.current.mutateAsync(OPEN_VARS);
    });

    expect(openFn).toHaveBeenCalledWith({ ...OPEN_VARS, chainId: hyperEvm.id });
    expect(tpslFn).not.toHaveBeenCalled();
    expect(result.current.data).toEqual({ instantOpen: OPEN_OK });
    expect(result.current.phase).toBe("success");
  });

  it("runs instant open then TP/SL when `tpsl` is set and a tempQuoteId comes back", async () => {
    const { config } = createMockSymmioConfig();
    mockOpen(vi.fn().mockResolvedValue(OPEN_OK));
    const tpslFn = vi.fn().mockResolvedValue(TPSL_OK);
    mockTpSl(tpslFn);

    const { result } = renderHookWithProviders(() => useInstantOpenWithTpSl({ config }));

    await act(async () => {
      await result.current.mutateAsync({ ...OPEN_VARS, tpsl: TPSL_BLOCK });
    });

    expect(tpslFn).toHaveBeenCalledWith({
      ...TPSL_BLOCK,
      chainId: hyperEvm.id,
      quoteId: -1001n,
    });
    expect(result.current.data).toEqual({ instantOpen: OPEN_OK, tpsl: TPSL_OK });
    expect(result.current.phase).toBe("success");
  });

  it("marks the shared confirming slot for the submitted sides on TP/SL success", async () => {
    const { config } = createMockSymmioConfig();
    mockOpen(vi.fn().mockResolvedValue(OPEN_OK));
    mockTpSl(vi.fn().mockResolvedValue(TPSL_OK));

    const { result } = renderHookWithProviders(() => useInstantOpenWithTpSl({ config }));

    await act(async () => {
      await result.current.mutateAsync({
        ...OPEN_VARS,
        tpsl: { ...TPSL_BLOCK, sl: undefined },
      });
    });

    await waitFor(() => {
      const record = useTpSlStore.getState().get(-1001n);
      expect(record?.tpState).toBe("confirming");
      expect(record?.slState).toBe("canceled");
    });
  });

  it("skips the TP/SL leg when the hedger returns no tempQuoteId", async () => {
    const { config } = createMockSymmioConfig();
    mockOpen(vi.fn().mockResolvedValue(OPEN_NO_ID));
    const tpslFn = vi.fn();
    mockTpSl(tpslFn);

    const { result } = renderHookWithProviders(() => useInstantOpenWithTpSl({ config }));

    await act(async () => {
      await result.current.mutateAsync({ ...OPEN_VARS, tpsl: TPSL_BLOCK });
    });

    expect(tpslFn).not.toHaveBeenCalled();
    expect(result.current.data).toEqual({ instantOpen: OPEN_NO_ID });
  });

  it("returns partial success (data.tpslError) when only the TP/SL leg fails", async () => {
    const { config } = createMockSymmioConfig();
    mockOpen(vi.fn().mockResolvedValue(OPEN_OK));
    mockTpSl(vi.fn().mockRejectedValue(new Error("handler rejected")));

    const { result } = renderHookWithProviders(() => useInstantOpenWithTpSl({ config }));

    await act(async () => {
      await result.current.mutateAsync({ ...OPEN_VARS, tpsl: TPSL_BLOCK });
    });

    expect(result.current.isError).toBe(false);
    expect(result.current.data?.instantOpen).toEqual(OPEN_OK);
    expect(result.current.data?.tpsl).toBeUndefined();
    expect(result.current.data?.tpslError?.message).toContain("handler rejected");
    expect(result.current.phase).toBe("success");
  });

  it("throws (normalized) when instant open itself fails; never touches the TP/SL leg", async () => {
    const { config } = createMockSymmioConfig();
    mockOpen(vi.fn().mockRejectedValue(new Error("hedger down")));
    const tpslFn = vi.fn();
    mockTpSl(tpslFn);

    const { result } = renderHookWithProviders(() => useInstantOpenWithTpSl({ config }));

    await act(async () => {
      await expect(result.current.mutateAsync({ ...OPEN_VARS, tpsl: TPSL_BLOCK })).rejects.toThrow();
    });

    expect(tpslFn).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.phase).toBe("error"));
  });

  it("invalidates the instant-opens feed after the open leg succeeds", async () => {
    const { config } = createMockSymmioConfig();
    mockOpen(vi.fn().mockResolvedValue(OPEN_OK));
    mockTpSl(vi.fn().mockResolvedValue(TPSL_OK));
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHookWithProviders(() => useInstantOpenWithTpSl({ config }), { queryClient });

    await act(async () => {
      await result.current.mutateAsync({ ...OPEN_VARS, tpsl: TPSL_BLOCK });
    });

    await waitFor(() => expect(invalidate).toHaveBeenCalled());
    const { predicate } = invalidate.mock.calls[0]![0] as { predicate: (q: Query) => boolean };
    const configKey = config.getChainConfigKey(hyperEvm.id);
    expect(predicate(queryWith(getInstantOpensQueryKey({ configKey })))).toBe(true);
  });
});
