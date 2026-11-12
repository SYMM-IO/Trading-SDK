import { useTpSlStore, type UseInstantOpenWithTpSlData } from "@symmio/trading-react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { OpenPositionStep } from "./open-position-step";
import type { TpSlSubmissionStatus } from "./use-tp-sl-submission-feedback";

const mock = vi.hoisted(() => ({
  deployment: "deployment-a",
  chainId: 42161,
  wallet: "0x0000000000000000000000000000000000000011",
  connected: true,
  nextData: undefined as UseInstantOpenWithTpSlData | undefined,
  attach: vi.fn(),
  open: vi.fn(),
  options: vi.fn(),
  feedbackStatus: "pending" as TpSlSubmissionStatus,
  feedbackBegin: vi.fn(),
  feedbackAccepted: vi.fn(),
  preview: vi.fn(),
  timelock: { ready: true, unsupported: true, policy: { data: undefined as { ready: boolean } | undefined } },
  prepared: {
    estimatedOpenPrice: undefined as string | null | undefined,
    estimatedOpenPriceWithoutShadow: undefined as string | undefined,
  },
}));
vi.mock("@/features/timelock/use-timelock-context", () => ({
  useTimelockContext: () => mock.timelock,
}));
vi.mock("./use-tp-sl-submission-feedback", () => ({
  useTpSlSubmissionFeedback: () => ({ status: mock.feedbackStatus, begin: mock.feedbackBegin }),
}));
vi.mock("./estimated-price-preview", () => ({
  EstimatedPricePreview: (props: unknown) => {
    mock.preview(props);
    return null;
  },
}));
vi.mock("./instant-open-fees-preview", () => ({ InstantOpenFeesPreview: () => null }));
vi.mock("@symmio/trading-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-react")>();
  const { useState } = await import("react");
  const emptyRead = () => ({});
  return {
    ...actual,
    useSymmioConfig: () => ({
      getChainConfigKey: () => mock.deployment,
      getDefaultSolverId: () => "enigma",
      getSolver: () => ({ id: "enigma" }),
    }),
    useSymmioChainId: () => mock.chainId,
    useWalletAccount: () => ({ address: mock.wallet, isConnected: mock.connected, isOnExpectedChain: true }),
    useInstantOpenWithTpSl: (options: unknown) => {
      mock.options(options);
      const [data] = useState(mock.nextData);
      return {
        data,
        phase: data ? "success" : "idle",
        isSuccess: Boolean(data),
        isPending: false,
        mutateAsync: mock.open,
      };
    },
    useSetQuoteTpSl: () => ({ mutate: mock.attach, reset: vi.fn(), isPending: false, isSuccess: false, error: null }),
    useQuoteTpSl: ({ quoteId }: { quoteId: bigint }) => ({ data: actual.useTpSlRecord(quoteId) }),
    useLimitOpenAuto: emptyRead,
    useSupportsLimitOrder: () => false,
    useSubAccount: emptyRead,
    useMarkets: emptyRead,
    useAccountBalanceOf: emptyRead,
    useAccountBalanceInfo: emptyRead,
    usePriceByName: emptyRead,
    useLockedParams: emptyRead,
    useFeeForUser: emptyRead,
    useNotionalCapBySymbolId: emptyRead,
    useAvailableInstantOpenMargin: emptyRead,
    usePrepareInstantOpenParams: () => mock.prepared,
    usePredictedNextVirtualAccount: emptyRead,
  };
});

const props = {
  subAccount: "0x0000000000000000000000000000000000000002",
  sessionKey: "0x0000000000000000000000000000000000000001",
} as const;
const parameters: NonNullable<UseInstantOpenWithTpSlData["tpslParameters"]> = {
  chainId: 42161,
  quoteId: -123n,
  symbolId: 1n,
  positionType: 0,
  from: props.sessionKey,
  subAccount: props.subAccount,
  virtualAccount: "0x0000000000000000000000000000000000000003",
  quantity: "5.123456789",
  pricePrecision: 6,
  tp: { triggerPrice: "12.345678", priceType: "markPrice" },
};
beforeEach(() => {
  useTpSlStore.setState({ records: new Map(), index: new Map() });
  mock.deployment = "deployment-a";
  mock.chainId = 42161;
  mock.connected = true;
  mock.wallet = "0x0000000000000000000000000000000000000011";
  mock.attach.mockReset();
  mock.open.mockReset();
  mock.options.mockReset();
  mock.feedbackStatus = "pending";
  mock.feedbackBegin.mockReset().mockReturnValue(mock.feedbackAccepted);
  mock.feedbackAccepted.mockReset();
  mock.preview.mockReset();
  mock.timelock = { ready: true, unsupported: true, policy: { data: undefined } };
  mock.prepared = { estimatedOpenPrice: undefined, estimatedOpenPriceWithoutShadow: undefined };
  mock.nextData = {
    instantOpen: { kind: "enigma", success: true, tempQuoteId: "-123" },
    tpslParameters: parameters,
    tpslError: {
      name: "SymmioRequestError",
      kind: "api",
      code: "SET_TPSL_REJECTED",
      message: "Rejected",
      retryAfterMs: null,
    },
  };
});
afterEach(cleanup);

test("open form forwards the preparation hook's paired estimate to its preview", () => {
  mock.prepared = { estimatedOpenPrice: "105", estimatedOpenPriceWithoutShadow: "104" };
  render(<OpenPositionStep {...props} />);
  expect(mock.preview.mock.lastCall?.[0].preparedEstimate).toEqual({ price: "105", priceWithoutShadow: "104" });
});

test("the keyed form preserves the trading protection readiness check", () => {
  mock.timelock = { ready: false, unsupported: false, policy: { data: { ready: false } } };
  const view = render(<OpenPositionStep {...props} />);
  expect(screen.getByText("Review trading protection before opening a position.")).toBeDefined();
  expect(screen.getByRole("link", { name: "Open timelock settings" }).getAttribute("href")).toBe(
    `/contracts/timelock?account=${props.subAccount}`,
  );
  mock.timelock = { ready: true, unsupported: false, policy: { data: { ready: true } } };
  view.rerender(<OpenPositionStep {...props} />);
  expect(screen.queryByText("Review trading protection before opening a position.")).toBeNull();
});

test("accepted at-open attachment renders its notification feedback instead of HTTP success", () => {
  mock.nextData = { ...mock.nextData!, tpslError: undefined, tpsl: { success: true } };
  useTpSlStore.getState().markConfirming(-123n, "tp", { price: parameters.tp!.triggerPrice });
  const view = render(<OpenPositionStep {...props} />);
  expect(screen.getByTestId("instant-open-tpsl-status").textContent).toContain("Setting TP/SL");
  expect(screen.queryByTestId("instant-open-tpsl-success")).toBeNull();
  mock.feedbackStatus = "active";
  view.rerender(<OpenPositionStep {...props} />);
  expect(screen.getByTestId("instant-open-tpsl-success").textContent).toBe("TP/SL active");
  expect(mock.open).not.toHaveBeenCalled();
  expect(mock.attach).not.toHaveBeenCalled();
});

test("a deployment switch drops the old confirmation panel", () => {
  mock.nextData = { ...mock.nextData!, tpslError: undefined, tpsl: { success: true } };
  useTpSlStore.getState().markConfirming(-123n, "tp");
  const { rerender } = render(<OpenPositionStep {...props} />);
  expect(screen.getByTestId("instant-open-tpsl-status")).toBeDefined();
  mock.nextData = undefined;
  mock.deployment = "deployment-b";
  rerender(<OpenPositionStep {...props} />);
  expect(screen.queryByTestId("instant-open-tpsl-status")).toBeNull();
  expect(screen.queryByTestId("instant-open-tpsl-success")).toBeNull();
});

test("the mounted retry button sends only attachment parameters, never another open", () => {
  render(<OpenPositionStep {...props} />);
  const button = screen.getByRole("button", { name: "Retry TP/SL only" });
  act(() => {
    fireEvent.click(button);
    fireEvent.click(button);
  });
  expect(mock.attach).toHaveBeenCalledTimes(1);
  expect(mock.attach.mock.calls[0]?.[0]).toBe(parameters);
  expect(mock.feedbackBegin).toHaveBeenCalledTimes(1);
  expect(mock.feedbackBegin).toHaveBeenCalledWith(parameters);
  act(() => mock.attach.mock.calls[0]?.[1].onSuccess());
  expect(mock.feedbackAccepted).toHaveBeenCalledWith(parameters);
  expect(mock.open).not.toHaveBeenCalled();
  expect(mock.options).toHaveBeenCalledWith({ tpslState: "sdk" });
});
for (const context of ["wallet", "account", "session", "deployment", "solver", "disconnect"] as const) {
  test(`discards old recovery controls on ${context} change`, () => {
    const view = render(<OpenPositionStep {...props} />);
    expect(screen.queryByRole("button", { name: "Retry TP/SL only" })).not.toBeNull();
    mock.nextData = undefined;
    view.rerender(<OpenPositionStep {...props} />);
    expect(screen.queryByRole("button", { name: "Retry TP/SL only" })).not.toBeNull();
    if (context === "wallet") mock.wallet = "0x0000000000000000000000000000000000000022";
    if (context === "deployment") mock.deployment = "deployment-b";
    if (context === "disconnect") mock.connected = false;
    view.rerender(
      <OpenPositionStep
        {...props}
        subAccount={context === "account" ? "0x0000000000000000000000000000000000000004" : props.subAccount}
        sessionKey={context === "session" ? "0x0000000000000000000000000000000000000005" : props.sessionKey}
        solverId={context === "solver" ? "rasa" : undefined}
      />,
    );
    expect(screen.queryByRole("button", { name: "Retry TP/SL only" })).toBeNull();
    expect(mock.attach).not.toHaveBeenCalled();
  });
}
