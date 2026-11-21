import { QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WriteAddMargin } from "./write-add-margin";
import { WriteRemoveMargin } from "./write-remove-margin";

const mocks = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }));
const parentAccount = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const virtualAccount = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const covered = {
  hasSufficientBalance: true,
  hasSufficientAllowance: true,
  isCovered: true,
  maxAddAmount18: null,
  payers: [],
};
const insufficient = { ...covered, hasSufficientBalance: false, isCovered: false };
const receipt = { hash: `0x${"1".repeat(64)}`, receipt: { status: "success", blockNumber: 100n } };

vi.mock("@symmio/trading-react", () => ({
  useWalletAccount: () => ({ isConnected: true, isOnExpectedChain: true, address: parentAccount }),
  useVirtualAccount: () => ({ data: { isExists: true, parentAccount } }),
  useSupportsGaslessService: () => true,
  useGaslessMarginFunding: (parameters: { direction: string; amount18: bigint; query: { enabled: boolean } }) =>
    useQuery({
      queryKey: ["funding-test", parameters.direction, parameters.amount18.toString()],
      queryFn: () => mocks.read(),
      ...parameters.query,
    }),
  useAddMargin: () => useMutation({ mutationFn: () => mocks.write() }),
  useRemoveMargin: () => useMutation({ mutationFn: () => mocks.write() }),
  useSimulateAddMargin: () => ({}),
  useSimulateRemoveMargin: () => ({}),
  useDeallocateUpnlSig: () => ({}),
}));
vi.mock("@/features/gasless/gasless-write-mode-store", () => ({ useGaslessWriteOption: () => ({}) }));
vi.mock("@/features/timelock/use-protected-write", () => ({
  useProtectedWrite: () => ({
    available: true,
    run: (action: () => Promise<unknown>) => action().catch(() => undefined),
  }),
  ProtectedWriteNotice: () => null,
}));
vi.mock("./method-card", () => ({ MethodCard: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("./virtual-account-field", () => ({
  VirtualAccountField: ({ value, onValueChange }: { value: string; onValueChange: (value: string) => void }) => (
    <input aria-label="Virtual account" value={value} onChange={(event) => onValueChange(event.target.value)} />
  ),
}));
vi.mock("./simulate-result", () => ({ SimulateResult: () => null }));
vi.mock("@/components/tx-result", () => ({ TxReceipt: () => null }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

let client: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  mocks.read.mockResolvedValue(covered);
  mocks.write.mockResolvedValue(receipt);
});
afterEach(() => {
  cleanup();
  client.clear();
});

for (const [direction, Component] of [
  ["add", WriteAddMargin],
  ["remove", WriteRemoveMargin],
] as const) {
  describe(`${direction} margin funding lifecycle`, () => {
    function openForm() {
      render(
        <QueryClientProvider client={client}>
          <Component />
        </QueryClientProvider>,
      );
      fireEvent.change(screen.getByLabelText("Virtual account"), { target: { value: virtualAccount } });
      fireEvent.change(screen.getByTestId(`input-${direction}-margin-amount`), { target: { value: "50" } });
    }

    it("clears a completed write's cached preview and waits for an explicit fresh read", async () => {
      openForm();
      expect(mocks.read).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Preview gasless funding" }));
      await screen.findByText(/Quoted fees are covered/);

      fireEvent.click(screen.getByRole("button", { name: "Send transaction" }));
      await screen.findByTestId(`result-${direction}Margin-success`);
      expect(screen.queryByText(/Quoted fees are covered/)).toBeNull();
      expect(mocks.read).toHaveBeenCalledTimes(1);

      mocks.read.mockResolvedValue(insufficient);
      fireEvent.click(screen.getByRole("button", { name: "Preview gasless funding" }));
      await screen.findByText(/^Not covered/);
      expect(mocks.read).toHaveBeenCalledTimes(2);
      expect(mocks.write).toHaveBeenCalledTimes(1);
    });

    it("does not resurrect a pre-write request that resolves after the write", async () => {
      const pending = deferred<typeof covered>();
      mocks.read.mockReturnValueOnce(pending.promise);
      openForm();
      fireEvent.click(screen.getByRole("button", { name: "Preview gasless funding" }));
      await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByRole("button", { name: "Send transaction" }));
      await screen.findByTestId(`result-${direction}Margin-success`);

      await act(async () => pending.resolve(covered));
      await waitFor(() => expect(client.isFetching()).toBe(0));
      expect(screen.queryByText(/Quoted fees are covered/)).toBeNull();
      expect(mocks.read).toHaveBeenCalledTimes(1);

      mocks.read.mockResolvedValue(insufficient);
      fireEvent.click(screen.getByRole("button", { name: "Preview gasless funding" }));
      await screen.findByText(/^Not covered/);
    });

    it("does not allow previewing while the margin write is pending", async () => {
      const pending = deferred<typeof receipt>();
      mocks.write.mockReturnValueOnce(pending.promise);
      openForm();
      fireEvent.click(screen.getByRole("button", { name: "Preview gasless funding" }));
      await screen.findByText(/Quoted fees are covered/);
      fireEvent.click(screen.getByRole("button", { name: "Send transaction" }));
      await screen.findByTestId(`result-${direction}Margin-pending`);
      expect((screen.getByRole("button", { name: "Preview gasless funding" }) as HTMLButtonElement).disabled).toBe(
        true,
      );
      expect(screen.queryByText(/Quoted fees are covered/)).toBeNull();
      await act(async () => pending.resolve(receipt));
      await screen.findByTestId(`result-${direction}Margin-success`);
      expect((screen.getByRole("button", { name: "Preview gasless funding" }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });
  });
}
