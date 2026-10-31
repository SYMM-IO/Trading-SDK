import type { UseInstantOpenWithTpSlData } from "@symmio/trading-react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { OpenPositionStep } from "./open-position-step";

const mock = vi.hoisted(() => ({
  deployment: "deployment-a",
  chainId: 42161,
  wallet: "0x0000000000000000000000000000000000000011",
  connected: true,
  nextData: undefined as UseInstantOpenWithTpSlData | undefined,
  attach: vi.fn(),
  open: vi.fn(),
  options: vi.fn(),
}));
vi.mock("./estimated-price-preview", () => ({ EstimatedPricePreview: () => null }));
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
    usePrepareInstantOpenParams: emptyRead,
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
  mock.deployment = "deployment-a";
  mock.chainId = 42161;
  mock.connected = true;
  mock.wallet = "0x0000000000000000000000000000000000000011";
  mock.attach.mockReset();
  mock.open.mockReset();
  mock.options.mockReset();
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

test("the mounted retry button sends only attachment parameters, never another open", () => {
  render(<OpenPositionStep {...props} />);
  const button = screen.getByRole("button", { name: "Retry TP/SL only" });
  act(() => {
    fireEvent.click(button);
    fireEvent.click(button);
  });
  expect(mock.attach).toHaveBeenCalledTimes(1);
  expect(mock.attach.mock.calls[0]?.[0]).toBe(parameters);
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
