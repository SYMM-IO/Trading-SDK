import { getInstantOpenQuoteIdQueryOptions, type Config, type SetQuoteTpSlParameters } from "@symmio/trading-core";
import { SymmioProvider, useQuoteTpSl, useSymmioConfig, useTpSlStore } from "@symmio/trading-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { http } from "viem";
import { arbitrum } from "viem/chains";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createConfig, WagmiProvider } from "wagmi";
import { createFakeWebSocket } from "../../../../../packages/trading-core/src/shared/test/fake-web-socket";
import {
  ConditionalOrdersState,
  ConditionalOrderType,
  PriceActionType,
} from "../../../../../packages/trading-core/src/tpsl/types/generated/tpsl-handler";
import { TpSlConfirmationStatus } from "./tp-sl-confirmation-status";
import { useTpSlSubmissionFeedback } from "./use-tp-sl-submission-feedback";

const account = "0x0000000000000000000000000000000000000002";
const parameters: SetQuoteTpSlParameters = {
  chainId: 42161,
  quoteId: -123n,
  from: account,
  subAccount: account,
  virtualAccount: "0x0000000000000000000000000000000000000003",
  symbolId: 1n,
  positionType: 0,
  quantity: "5",
  pricePrecision: 6,
  tp: { triggerPrice: "12", priceType: "markPrice" },
};
let socket: ReturnType<typeof createFakeWebSocket>;
let client: QueryClient;
let feedback: ReturnType<typeof useTpSlSubmissionFeedback>;
let config: Config;
function Harness({ instantOpen = false, reader = false }: { instantOpen?: boolean; reader?: boolean }) {
  config = useSymmioConfig();
  feedback = useTpSlSubmissionFeedback({ account, chainId: 42161, solverId: "enigma", instantOpen });
  useQuoteTpSl({ quoteId: -123n, account: reader ? account : undefined, query: { enabled: false } });
  return <TpSlConfirmationStatus idPrefix="test" status={feedback.status} />;
}
function mount(instantOpen = false, reader = false) {
  const wagmi = createConfig({ chains: [arbitrum], transports: { [arbitrum.id]: http("http://127.0.0.1:0") } });
  const view = render(
    <WagmiProvider config={wagmi}>
      <QueryClientProvider client={client}>
        <SymmioProvider symmioConfig={{ [arbitrum.id]: { addresses: { affiliatesAddress: account } } }}>
          <Harness instantOpen={instantOpen} reader={reader} />
        </SymmioProvider>
      </QueryClientProvider>
    </WagmiProvider>,
  );
  act(() => socket.last().simulateOpen());
  return view;
}
function begin(p = parameters) {
  let accept!: ReturnType<typeof feedback.begin>;
  act(() => {
    accept = feedback.begin(p);
  });
  return () => act(() => accept(p));
}
function report(state = "new", side: string | null = "take_profit", successful = true, id = -123, address = account) {
  act(() =>
    socket.last().simulateMessage({
      app_name: "Arbitrum_COH_Production",
      type: "report",
      address,
      primary_identifier: id > 0 ? id : 0,
      secondary_identifier: id < 0 ? id : 0,
      data: { successful, state, conditional_order_type: side, coh_quote_id: "coh954" },
    }),
  );
}
beforeEach(() => {
  vi.useFakeTimers();
  socket = createFakeWebSocket();
  vi.stubGlobal("WebSocket", socket.WebSocket);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  useTpSlStore.setState({ records: new Map(), index: new Map() });
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test.each(["tp", "sl"] as const)("%s waits for its parsed WebSocket report, not HTTP acceptance", (side) => {
  mount();
  begin({
    ...parameters,
    tp: side === "tp" ? parameters.tp : undefined,
    sl: side === "sl" ? parameters.tp : undefined,
  })();
  expect(screen.getByTestId("test-status")).toBeDefined();
  report("new", side === "tp" ? "take_profit" : "stop_loss");
  expect(screen.getByTestId("test-success").textContent).toBe("TP/SL active");
});

test("both legs must confirm and a pending report cannot undo activation", () => {
  mount();
  begin({ ...parameters, sl: parameters.tp })();
  report();
  report("pending");
  expect(screen.getByTestId("test-status")).toBeDefined();
  report("edit", "stop_loss");
  expect(screen.getByTestId("test-success")).toBeDefined();
});

test.each(["canceled", "cancelled", "cancel"])("late %s replaces timeout with an explicit failure", (state) => {
  mount();
  begin()();
  act(() => vi.advanceTimersByTime(90_000));
  expect(screen.getByTestId("test-unconfirmed")).toBeDefined();
  report(state);
  expect(screen.getByRole("alert").textContent).toContain("failure or cancellation");
  expect(screen.queryByTestId("test-unconfirmed")).toBeNull();
});

test("a failed report is surfaced even though the SDK order store ignores unsuccessful frames", () => {
  mount();
  begin()();
  report("new", "take_profit", false);
  expect(screen.getByRole("alert")).toBeDefined();
});

test("a failed submitted leg wins over another active leg", () => {
  mount();
  begin({ ...parameters, sl: parameters.tp })();
  report();
  report("edit", "stop_loss", false);
  expect(screen.getByRole("alert")).toBeDefined();
});

test("missing confirmation remains a warning despite SDK/UI clock skew and REST absence", () => {
  useTpSlStore.getState().markConfirming(-123n, "tp");
  act(() => vi.advanceTimersByTime(1_000));
  mount();
  begin()();
  act(() => {
    vi.advanceTimersByTime(89_000);
    useTpSlStore.getState().setRows(-123n, []);
  });
  expect(screen.getByTestId("test-status")).toBeDefined();
  act(() => vi.advanceTimersByTime(1_000));
  expect(screen.getByTestId("test-unconfirmed")).toBeDefined();
  expect(screen.queryByRole("alert")).toBeNull();
  report();
  expect(screen.getByTestId("test-success")).toBeDefined();
});

test.each(["triggered", "trigger", "close"])("a confirmed order's %s report does not return to setting", (state) => {
  mount();
  begin()();
  report();
  report(state);
  expect(screen.getByTestId("test-triggered").textContent).toContain("execution status");
  act(() => vi.advanceTimersByTime(90_000));
  expect(screen.queryByTestId("test-unconfirmed")).toBeNull();
  expect(screen.queryByTestId("test-status")).toBeNull();
});

test("REST-backed active state alone cannot complete the notification result", () => {
  mount();
  begin()();
  act(() =>
    useTpSlStore.getState().setRows(-123n, [
      {
        coh_quote_id: "coh954",
        quote_id: -123,
        conditional_order_type: ConditionalOrderType.take_profit,
        state: ConditionalOrdersState.new,
        conditional_order_price: 12,
        action_price_type: PriceActionType.market,
        quantity: 5,
        party_a_address: account,
        symbol_id: 1,
        order_type: 1,
        position_type: 0,
        create_time: 1,
        modify_time: 1,
      },
    ]),
  );
  expect(useTpSlStore.getState().get(-123n)?.tpState).toBe("new");
  expect(screen.getByTestId("test-status")).toBeDefined();
  expect(screen.queryByTestId("test-success")).toBeNull();
});

test("a report arriving before HTTP acceptance is retained", () => {
  mount();
  const accept = begin();
  report();
  expect(screen.getByTestId("test-status")).toBeDefined();
  accept();
  expect(screen.getByTestId("test-success")).toBeDefined();
});

test("other accounts, positions and unsubmitted legs cannot settle the result", () => {
  mount();
  begin()();
  report("new", "take_profit", true, -123, "0x0000000000000000000000000000000000000009");
  report("new", "take_profit", true, 999);
  report("canceled", "stop_loss");
  expect(screen.getByTestId("test-status")).toBeDefined();
});

test("new attempts reset results and reject an obsolete HTTP completion", () => {
  mount();
  const obsolete = begin();
  const accept = begin({ ...parameters, sl: parameters.tp });
  obsolete();
  report();
  expect(screen.getByTestId("test-status")).toBeDefined();
  accept();
  expect(screen.getByTestId("test-status")).toBeDefined();
  report("new", "stop_loss");
  expect(screen.getByTestId("test-success")).toBeDefined();
});

test("current reader and feedback share one socket; unmount closes it and ignores late completion", () => {
  const view = mount(false, true);
  const accept = begin();
  expect(socket.instances).toHaveLength(1);
  expect(client.getQueryCache().findAll({ queryKey: ["getQuoteTpSl"] })).toHaveLength(1);
  view.unmount();
  accept();
  expect(socket.last().closeCalls).toHaveLength(1);
  expect(screen.queryByTestId("test-success")).toBeNull();
});

test("unrelated traffic cannot erase a confirmed leg", () => {
  mount();
  begin()();
  report();
  for (let id = 1; id < 140; id++) report("new", "take_profit", true, id);
  expect(screen.getByTestId("test-success")).toBeDefined();
});

test("at-open replays a buffered on-chain report when the real SDK resolver learns the ID", async () => {
  vi.useRealTimers();
  mount(true);
  const key = getInstantOpenQuoteIdQueryOptions(config, {
    chainId: 42161,
    solverId: "enigma",
    tempQuoteId: -123,
  }).queryKey;
  client.setQueryData(key, null);
  // The listener is already live before either the open or attachment response.
  let accept!: ReturnType<typeof feedback.begin>;
  act(() => {
    accept = feedback.begin();
  });
  report("new", "take_profit", true, 12572);
  act(() => accept(parameters));
  expect(screen.getByTestId("test-status")).toBeDefined();
  act(() => client.setQueryData(key, 12572));
  await waitFor(() => expect(screen.getByTestId("test-success")).toBeDefined());
  const queries = client.getQueryCache().findAll({ queryKey: ["getInstantOpenQuoteId"] });
  expect(queries.filter((query) => query.getObserversCount() > 0)).toHaveLength(1);
  expect(socket.instances).toHaveLength(1);
});
