import { PositionType } from "@symmio/trading-core";
import { SymmioProvider, type TpSlRecord } from "@symmio/trading-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http } from "viem";
import { arbitrum } from "viem/chains";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createConfig, WagmiProvider } from "wagmi";
import { createFakeWebSocket } from "../../../../../packages/trading-core/src/shared/test/fake-web-socket";
import { SetTpSlStep } from "./tpsl-flow";

const mock = vi.hoisted(() => ({
  record: undefined as TpSlRecord | undefined,
  submit: undefined as Promise<unknown> | undefined,
}));
vi.mock("@symmio/trading-react", async (importOriginal) => {
  const { useMutation } = await import("@tanstack/react-query");
  return {
    ...(await importOriginal<typeof import("@symmio/trading-react")>()),
    useMarkets: () => ({ data: [] }),
    usePriceByMarketId: () => ({ markPrice: "10", isLoading: false }),
    useSymmioChainId: () => 42161,
    useTpSlConfig: () => ({ data: undefined }),
    useQuoteTpSl: () => ({ data: mock.record, isLoading: false, isFetching: false, refetch: async () => {} }),
    useSetQuoteTpSl: () => useMutation({ mutationFn: async () => (await mock.submit, { successful: true }) }),
    useDeleteQuoteTpSl: () => useMutation({ mutationFn: async () => ({ successful: true }) }),
  };
});

const account = "0x0000000000000000000000000000000000000002";
const position = {
  id: 9565n,
  symbolId: 1n,
  positionType: PositionType.LONG,
  quantity: 5n * 10n ** 18n,
  closedAmount: 0n,
  openedPrice: 10n * 10n ** 18n,
};
let socket: ReturnType<typeof createFakeWebSocket>;
let client: QueryClient;
function mount() {
  const wagmi = createConfig({ chains: [arbitrum], transports: { [arbitrum.id]: http("http://127.0.0.1:0") } });
  render(
    <WagmiProvider config={wagmi}>
      <QueryClientProvider client={client}>
        <SymmioProvider symmioConfig={{ [arbitrum.id]: { addresses: { affiliatesAddress: account } } }}>
          <SetTpSlStep
            subAccount={account}
            virtualAccount="0x0000000000000000000000000000000000000003"
            sessionKey="0x0000000000000000000000000000000000000001"
            position={position}
          />
        </SymmioProvider>
      </QueryClientProvider>
    </WagmiProvider>,
  );
  act(() => socket.last().simulateOpen());
}
async function submitTakeProfit(price: string) {
  fireEvent.change(screen.getAllByPlaceholderText("0.00")[0]!, { target: { value: price } });
  fireEvent.click(screen.getByTestId("tpsl-submit"));
  await waitFor(() => expect(screen.getByTestId("tpsl-status")).toBeDefined());
}
function report(state: string, side: "take_profit" | "stop_loss" = "take_profit") {
  act(() =>
    socket.last().simulateMessage({
      app_name: "Arbitrum_COH_Production",
      type: "report",
      address: account,
      primary_identifier: Number(position.id),
      secondary_identifier: 0,
      data: { successful: true, state, conditional_order_type: side, coh_quote_id: `coh-${side}` },
    }),
  );
}
beforeEach(() => {
  socket = createFakeWebSocket();
  vi.stubGlobal("WebSocket", socket.WebSocket);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  mock.submit = undefined;
  mock.record = {
    quoteId: position.id,
    tp: "11",
    sl: "8",
    tpOpenPrice: "",
    slOpenPrice: "",
    tpPriceType: "markPrice",
    slPriceType: "markPrice",
    tpState: "new",
    slState: "new",
    tpCohQuoteId: "coh-take_profit",
    slCohQuoteId: "coh-stop_loss",
  };
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.unstubAllGlobals();
});

test("deleting the side the last submit set ends that result instead of reporting a failure", async () => {
  mount();
  await submitTakeProfit("12");
  report("new");
  expect(screen.getByTestId("tpsl-success").textContent).toBe("TP/SL active");

  fireEvent.click(screen.getByTestId("tpsl-delete-take_profit"));
  report("cancel");
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByTestId("tpsl-success")).toBeNull();
});

test("deleting a side the last submit did not set keeps that result", async () => {
  mount();
  await submitTakeProfit("12");
  report("new");

  fireEvent.click(screen.getByTestId("tpsl-delete-stop_loss"));
  report("cancel", "stop_loss");
  expect(screen.getByTestId("tpsl-success").textContent).toBe("TP/SL active");
});

test("delete waits while a submit is in flight", async () => {
  let finish!: () => void;
  mock.submit = new Promise<void>((resolve) => (finish = resolve));
  mount();
  fireEvent.change(screen.getAllByPlaceholderText("0.00")[0]!, { target: { value: "12" } });
  fireEvent.click(screen.getByTestId("tpsl-submit"));
  await waitFor(() => expect(screen.getByTestId("tpsl-submit").textContent).toBe("Submitting…"));
  expect((screen.getByTestId("tpsl-delete-take_profit") as HTMLButtonElement).disabled).toBe(true);

  await act(async () => finish());
  await waitFor(() => expect(screen.getByTestId("tpsl-status")).toBeDefined());
  expect((screen.getByTestId("tpsl-delete-take_profit") as HTMLButtonElement).disabled).toBe(false);
});
