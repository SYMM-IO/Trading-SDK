import {
  createConfig,
  PositionType,
  SymmioSupportedChainId,
  type GetInstantOpenFeesReturnType,
  type PrepareInstantOpenParamsReturnType,
} from "@symmio/trading-core";
import { onlineManager } from "@tanstack/react-query";
import { act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const prepare = vi.hoisted(() => vi.fn());
const fees = vi.hoisted(() => vi.fn());
const estimate = vi.hoisted(() => vi.fn());
const lockedParams = vi.hoisted(() => vi.fn());
const solverInfo = vi.hoisted(() => vi.fn());
vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return {
    ...actual,
    prepareInstantOpenParamsQueryOptions: (
      ...args: Parameters<typeof actual.prepareInstantOpenParamsQueryOptions>
    ) => ({
      ...actual.prepareInstantOpenParamsQueryOptions(...args),
      queryFn: () => prepare(args[1]),
    }),
    getInstantOpenFeesQueryOptions: (...args: Parameters<typeof actual.getInstantOpenFeesQueryOptions>) => ({
      ...actual.getInstantOpenFeesQueryOptions(...args),
      queryFn: () => fees(args[1]),
    }),
  };
});
vi.mock("../solvers/use-solver-info", () => ({ useSolverInfo: solverInfo }));
vi.mock("../estimated-price/use-estimated-price", () => ({ useEstimatedPrice: estimate }));
vi.mock("../locked-params/use-locked-params", () => ({ useLockedParams: lockedParams }));
vi.mock("../markets/use-markets", () => ({ useMarkets: () => ({}) }));
vi.mock("../fees/use-fee-for-user", () => ({ useFeeForUser: () => ({}) }));
vi.mock("../price-service/use-price-by-name", () => ({ usePriceByName: () => ({}) }));

import { useInstantOpenFees } from "./use-instant-open-fees";
import { usePrepareInstantOpenParams } from "./use-prepare-instant-open-params";

const ACCOUNT = "0x0000000000000000000000000000000000005Ab1";
const params = {
  chainId: SymmioSupportedChainId.BASE,
  solverId: "enigma",
  subAccountAddress: ACCOUNT,
  market: {
    id: 1,
    name: "TEST",
    pricePrecision: 2,
    quantityPrecision: 3,
    minOpenSolverFeeCap: "0.01",
    minCloseSolverFeeCap: "0.01",
    hedgerFeeOpen: "0.001",
    hedgerFeeClose: "0.002",
    minAcceptablePortionLf: "0",
    minAcceptableQuoteValue: "0",
    minNotionalValue: "0",
    maxNotionalValue: 0,
    maxQuantity: "0",
    lotSize: "0.01",
  },
  positionType: PositionType.LONG,
  initialMargin: "100",
  availableBalance: "100",
  leverage: 2,
  slippage: 1,
  markPrice: "100",
  feeRates: { openFee: 0n, closeFee: 0n, isSet: true },
  solverInfo: { staticSolverFeeOpen: "0.5" },
} as const;
const PREPARED: PrepareInstantOpenParamsReturnType = {
  fundingMode: "full-balance",
  subAccountAddress: ACCOUNT,
  marketId: 1,
  positionType: PositionType.LONG,
  order: { price: 101n, quantity: 190n },
  lockedParam: { cva: 7n, lf: 3n, partyAmm: 90n, partyBmm: 0n },
  margin: { amount: 100n },
};
const FEES: GetInstantOpenFeesReturnType = {
  kind: "enigma",
  fundingMode: "full-balance",
  platformOpenFee: "0.1",
  notional: "190",
  quantity: "1.9",
  openSolverFee: "0.1",
  staticSolverFeeOpen: "0.5",
  expectedSettlementLoss: "0.95",
  totalFee: "1.65",
};

function createPreviewConfig() {
  const { config } = createMockSymmioConfig();
  return createConfig({
    getClient: config.getClient,
    symmioConfig: {
      [SymmioSupportedChainId.BASE]: {
        addresses: { affiliatesAddress: ACCOUNT },
        defaultSolverId: "enigma",
        solvers: {
          enigma: {
            name: "Enigma",
            address: ACCOUNT,
            url: "https://enigma.test",
            notifications: { url: "wss://enigma.test/ws", protocol: "enigma", channel: "test" },
          },
        },
      },
    },
  });
}

describe("automatic balance previews", () => {
  beforeEach(() => {
    solverInfo.mockReset().mockReturnValue({});
    prepare.mockReset().mockResolvedValue(PREPARED);
    fees.mockReset().mockResolvedValue(FEES);
    estimate.mockReset().mockReturnValue({
      data: { estimatedPrice: "100.5" },
      isFetched: true,
      isFetching: false,
      isDebouncing: false,
    });
    lockedParams.mockReset().mockReturnValue({ data: { cva: "7", lf: "3", partyAmm: "90", partyBmm: "0" } });
  });

  afterEach(() => onlineManager.setOnline(true));

  it.each([true, false])("reports an over-balance margin synchronously, online=%s", (online) => {
    onlineManager.setOnline(online);
    const config = createPreviewConfig();
    estimate.mockReturnValue({ isFetched: false, isFetching: true, isDebouncing: true });
    lockedParams.mockReturnValue({});
    const { result } = renderHookWithProviders(() => {
      const inputs = {
        ...params,
        config,
        initialMargin: "101",
        market: { id: 1 },
        markPrice: undefined,
        feeRates: undefined,
        query: { retry: 3 },
      };
      return {
        prepare: usePrepareInstantOpenParams(inputs),
        fees: useInstantOpenFees(inputs),
      };
    });
    for (const query of [result.current.prepare, result.current.fees]) {
      expect(query.validationError).toMatchObject({
        code: "INVALID_TRADE_PARAMETERS",
        message: "Initial margin exceeds available balance.",
      });
      expect(query.data).toBeUndefined();
      expect(query.failureCount).toBe(0);
      expect(query.error).toBeNull();
      expect(query.fetchStatus).toBe("idle");
    }
    expect(result.current.prepare.isReady).toBe(false);
    expect(prepare).not.toHaveBeenCalled();
    expect(fees).not.toHaveBeenCalled();
    for (const call of estimate.mock.calls) {
      expect(call[0].query.enabled).toBe(false);
    }
    for (const call of lockedParams.mock.calls) {
      expect(call[0].query.enabled).toBe(false);
    }
  });

  it("removes a cached preview immediately for invalid input and recovers when corrected", async () => {
    const config = createPreviewConfig();
    const { result, rerender } = renderHookWithProviders(
      ({ margin }) => ({
        prepare: usePrepareInstantOpenParams({ ...params, config, initialMargin: margin }),
        fees: useInstantOpenFees({ ...params, config, initialMargin: margin }),
      }),
      { initialProps: { margin: "100" } },
    );
    await waitFor(() => expect(result.current.prepare.isReady).toBe(true));
    await waitFor(() => expect(result.current.fees.isSuccess).toBe(true));
    estimate.mockReturnValue({ isFetched: false, isFetching: true, isDebouncing: true });
    rerender({ margin: "101" });
    expect(result.current.prepare.data).toBeUndefined();
    expect(result.current.fees.data).toBeUndefined();
    expect(result.current.prepare.isReady).toBe(false);
    expect(result.current.prepare.validationError?.code).toBe("INVALID_TRADE_PARAMETERS");
    expect(result.current.fees.validationError?.code).toBe("INVALID_TRADE_PARAMETERS");
    expect(estimate).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ enabled: false }) }),
    );

    estimate.mockReturnValue({
      data: { estimatedPrice: "100.5" },
      isFetched: true,
      isFetching: false,
      isDebouncing: false,
    });
    rerender({ margin: "99" });
    await waitFor(() => expect(result.current.prepare.isReady).toBe(true));
    await waitFor(() => expect(result.current.fees.isSuccess).toBe(true));
    expect(result.current.prepare.error).toBeNull();
    expect(result.current.prepare.validationError).toBeUndefined();
    expect(result.current.fees.validationError).toBeUndefined();
    expect(prepare).toHaveBeenLastCalledWith(expect.objectContaining({ initialMargin: "99" }));
  });

  it("does not start validation or estimates when the caller disables the hooks", async () => {
    const config = createPreviewConfig();
    const inputs = { ...params, config, initialMargin: "101", query: { enabled: false } };
    const { result } = renderHookWithProviders(() => ({
      prepare: usePrepareInstantOpenParams(inputs),
      fees: useInstantOpenFees(inputs),
    }));
    expect(result.current.prepare.error).toBeNull();
    expect(result.current.prepare.validationError).toBeUndefined();
    expect(result.current.fees.validationError).toBeUndefined();
    expect(result.current.fees.error).toBeNull();
    expect(result.current.prepare.isReady).toBe(false);
    expect(prepare).not.toHaveBeenCalled();
    expect(fees).not.toHaveBeenCalled();
    for (const call of estimate.mock.calls) expect(call[0].query.enabled).toBe(false);
  });

  it("forwards the same balance, estimate, locks, and static fees to both core previews", async () => {
    const config = createPreviewConfig();
    const { result } = renderHookWithProviders(() => ({
      prepare: usePrepareInstantOpenParams({ ...params, config }),
      fees: useInstantOpenFees({ ...params, config }),
    }));
    await waitFor(() => expect(result.current.prepare.isReady).toBe(true));
    await waitFor(() => expect(result.current.fees.isSuccess).toBe(true));
    for (const action of [prepare, fees]) {
      expect(action).toHaveBeenCalledWith(
        expect.objectContaining({
          initialMargin: "100",
          availableBalance: "100",
          estimatedOpenPrice: "100.5",
          solverInfo: params.solverInfo,
          lockedParamPercent: { cva: "7", lf: "3", partyAmm: "90", partyBmm: "0" },
        }),
      );
    }
    expect(lockedParams).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ enabled: true }) }),
    );
    expect(result.current.prepare.data?.fundingMode).toBe("full-balance");
    expect(result.current.fees.data?.fundingMode).toBe("full-balance");
  });

  it("waits for cached solver info and passes the same static fees to both previews", async () => {
    const config = createPreviewConfig();
    solverInfo.mockReturnValue({ isFetching: true });
    const { result, rerender } = renderHookWithProviders(() => ({
      prepare: usePrepareInstantOpenParams({ ...params, config, solverInfo: undefined }),
      fees: useInstantOpenFees({ ...params, config, solverInfo: undefined }),
    }));
    expect(prepare).not.toHaveBeenCalled();
    expect(fees).not.toHaveBeenCalled();
    solverInfo.mockReturnValue({ data: { staticSolverFeeOpen: "0.75" }, isFetching: false });
    rerender();
    await waitFor(() => expect(result.current.prepare.isReady && result.current.fees.isReady).toBe(true));
    for (const action of [prepare, fees]) {
      expect(action).toHaveBeenLastCalledWith(expect.objectContaining({ solverInfo: { staticSolverFeeOpen: "0.75" } }));
    }
  });

  it("settles unavailable inputs explicitly without putting fetches back inside core", async () => {
    const config = createPreviewConfig();
    solverInfo.mockReturnValue({ isError: true });
    estimate.mockReturnValue({ isFetched: true, isError: true, isFetching: false, isDebouncing: false });
    const { result } = renderHookWithProviders(() => ({
      prepare: usePrepareInstantOpenParams({ ...params, config, solverInfo: undefined }),
      fees: useInstantOpenFees({ ...params, config, solverInfo: undefined }),
    }));
    await waitFor(() => expect(result.current.prepare.isReady && result.current.fees.isReady).toBe(true));
    expect(result.current.prepare.estimatedOpenPrice).toBeNull();
    for (const action of [prepare, fees]) {
      expect(action).toHaveBeenLastCalledWith(expect.objectContaining({ solverInfo: {}, estimatedOpenPrice: null }));
    }
  });

  it("accepts an explicitly unavailable estimate without waiting for the estimate hook", async () => {
    const config = createPreviewConfig();
    estimate.mockReturnValue({ isFetched: false, isFetching: true, isDebouncing: true });
    const { result } = renderHookWithProviders(() => ({
      prepare: usePrepareInstantOpenParams({ ...params, config, estimatedOpenPrice: null }),
      fees: useInstantOpenFees({ ...params, config, estimatedOpenPrice: null }),
    }));
    await waitFor(() => expect(result.current.prepare.isReady && result.current.fees.isReady).toBe(true));
    expect(result.current.prepare.estimatedOpenPrice).toBeNull();
    for (const call of estimate.mock.calls) expect(call[0].query.enabled).toBe(false);
    for (const action of [prepare, fees]) {
      expect(action).toHaveBeenLastCalledWith(expect.objectContaining({ estimatedOpenPrice: null }));
    }
  });

  it("does not fetch locked parameters for a typed fee preview without a balance budget", async () => {
    const config = createPreviewConfig();
    lockedParams.mockReturnValue({});
    const { result } = renderHookWithProviders(() =>
      useInstantOpenFees({ ...params, config, availableBalance: undefined }),
    );
    await waitFor(() => expect(result.current.isReady).toBe(true));
    for (const call of lockedParams.mock.calls) expect(call[0].query.enabled).toBe(false);
  });

  it("keeps preparation failures in query.error instead of validationError", async () => {
    const config = createPreviewConfig();
    prepare.mockRejectedValue(new Error("Preparation failed"));
    const { result } = renderHookWithProviders(() => usePrepareInstantOpenParams({ ...params, config }));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.validationError).toBeUndefined();
    expect(result.current.isReady).toBe(false);
    expect(result.current.error?.message).toBe("Preparation failed");
  });

  it("blocks submission while a changed balance is being prepared, then restores typed mode", async () => {
    const config = createPreviewConfig();
    const { result, rerender } = renderHookWithProviders(
      ({ balance }) => usePrepareInstantOpenParams({ ...params, availableBalance: balance, config }),
      { initialProps: { balance: "100" } },
    );
    await waitFor(() => expect(result.current.isReady).toBe(true));
    let finish!: (value: PrepareInstantOpenParamsReturnType) => void;
    prepare.mockImplementationOnce(
      () =>
        new Promise<PrepareInstantOpenParamsReturnType>((resolve) => {
          finish = resolve;
        }),
    );
    rerender({ balance: "200" });
    expect(result.current.isReady).toBe(false);
    expect(result.current.isPlaceholderData).toBe(true);
    await act(async () => finish({ ...PREPARED, fundingMode: "initial-margin" }));
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.data?.fundingMode).toBe("initial-margin");
    expect(prepare).toHaveBeenLastCalledWith(expect.objectContaining({ availableBalance: "200" }));
  });

  it("does not treat cached data as ready while the fill estimate is debouncing or fetching", async () => {
    const config = createPreviewConfig();
    const { result, rerender } = renderHookWithProviders(() => usePrepareInstantOpenParams({ ...params, config }));
    await waitFor(() => expect(result.current.isReady).toBe(true));
    estimate.mockReturnValue({
      data: { estimatedPrice: "100.5" },
      isFetched: true,
      isFetching: false,
      isDebouncing: true,
    });
    rerender();
    expect(result.current.isReady).toBe(false);
    estimate.mockReturnValue({
      data: { estimatedPrice: "100.5" },
      isFetched: true,
      isFetching: true,
      isDebouncing: false,
    });
    rerender();
    expect(result.current.isReady).toBe(false);
  });

  it("does not enable submission for a disabled preparation with cached data", async () => {
    const config = createPreviewConfig();
    const { result, rerender } = renderHookWithProviders(
      ({ enabled }) => usePrepareInstantOpenParams({ ...params, config, query: { enabled } }),
      { initialProps: { enabled: true } },
    );
    await waitFor(() => expect(result.current.isReady).toBe(true));
    rerender({ enabled: false });
    expect(result.current.isReady).toBe(false);
  });
});
