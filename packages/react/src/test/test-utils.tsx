/**
 * Test-only render helpers. Compiled out of the published bundle by
 * `vite.config.ts`'s dts `exclude` and is not exported from `src/index.ts`.
 */
import {
  createConfig,
  type Config,
  type SymmioWalletClient,
  type WebSocketConstructor,
  type WebSocketLike,
} from "@theoldvarorg/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  render,
  renderHook,
  type RenderHookOptions,
  type RenderHookResult,
  type RenderOptions,
  type RenderResult,
} from "@testing-library/react";
import { type PropsWithChildren, type ReactElement } from "react";
import type { Account, Chain, Hash, PublicClient } from "viem";
import { http } from "viem";
import { hyperEvm } from "viem/chains";
import { vi, type Mock } from "vitest";
import { createConfig as createWagmiConfig, WagmiProvider, type Config as WagmiConfig } from "wagmi";
import { mock, type MockParameters } from "wagmi/connectors";
import { SymmioProvider } from "../provider/symmio-provider";

/**
 * Anvil deterministic test account #0. Public, never used on a real chain. Used
 * by the mock connector to simulate a connected wallet in tests.
 */
export const TEST_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
/** Address derived from {@link TEST_PRIVATE_KEY}. */
export const TEST_EOA = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;
/** Deterministic test transaction hash. */
export const TEST_TX_HASH: Hash = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";

/**
 * Build a wagmi config wired against HyperEVM with the `mock` connector. The
 * transport URL is a localhost placeholder — hook tests inject a mock SDK config
 * via the hook's `config` parameter, so no real RPC traffic happens.
 *
 * @param opts.connected - `false` registers no connectors (no wallet available).
 * @param opts.chains - Chains the wagmi config knows about. Defaults to
 *   `[hyperEvm]`. Pass a chain the SDK does not support (e.g. `mainnet`) to drive
 *   the "connected but on the wrong network" path, or several chains to exercise
 *   `switchChain`. The first entry is the chain the mock connector connects on.
 * @param opts.features - Forwarded to the `mock` connector. Use
 *   `{ defaultConnected: true, reconnect: true }` to start connected on mount
 *   (reconnect-on-mount only authorizes the connector when both are set), or
 *   `{ connectError }` / `{ switchChainError }` to make those flows reject.
 */
export function createTestWagmiConfig(opts?: {
  connected?: boolean;
  chains?: readonly [Chain, ...Chain[]];
  features?: MockParameters["features"];
}): WagmiConfig {
  const chains = opts?.chains ?? [hyperEvm];
  const connectors = opts?.connected === false ? [] : [mock({ accounts: [TEST_EOA], features: opts?.features })];

  return createWagmiConfig({
    chains,
    transports: Object.fromEntries(chains.map((chain) => [chain.id, http("http://127.0.0.1:0")])),
    connectors,
    multiInjectedProviderDiscovery: false,
  });
}

/** What {@link createMockSymmioConfig} returns: a real SDK config plus its stubbed viem fns. */
export interface MockSymmioConfig {
  config: Config;
  readContract: Mock;
  writeContract: Mock;
  simulateContract: Mock;
  waitForTransactionReceipt: Mock;
}

/**
 * Build a real SDK {@link Config} whose resolvers return stub viem clients with
 * `vi.fn()`-backed `readContract` / `writeContract` / `waitForTransactionReceipt`.
 * Pass `config` into a hook to exercise the real query factory + action against
 * the stubs, with no network. `withWallet: false` omits the wallet resolver so
 * write paths reject with `SymmError`.
 */
export function createMockSymmioConfig(opts?: {
  withWallet?: boolean;
  webSocketConstructor?: WebSocketConstructor;
}): MockSymmioConfig {
  const readContract = vi.fn();
  const writeContract = vi.fn();
  const simulateContract = vi.fn();
  const waitForTransactionReceipt = vi.fn();

  const publicClient = { readContract, simulateContract, waitForTransactionReceipt } as unknown as PublicClient;
  const account = { address: TEST_EOA, type: "json-rpc" } as Account;
  const walletClient = { account, chain: hyperEvm as Chain, writeContract } as unknown as SymmioWalletClient;

  const config = createConfig({
    getClient: () => publicClient,
    getWalletClient: opts?.withWallet === false ? undefined : async () => walletClient,
    webSocketConstructor: opts?.webSocketConstructor,
  });

  return { config, readContract, writeContract, simulateContract, waitForTransactionReceipt };
}

/**
 * A scriptable WebSocket instance for hook tests: records sent frames and
 * exposes `simulate*` helpers to drive the socket lifecycle deterministically.
 */
export interface FakeWebSocketInstance extends WebSocketLike {
  url: string;
  sent: string[];
  simulateOpen(): void;
  simulateMessage(data: unknown): void;
  simulateClose(code?: number): void;
}

/**
 * Build an isolated fake WebSocket implementation for a single test, plus access
 * to the instances it creates. Inject `WebSocket` via
 * `createMockSymmioConfig({ webSocketConstructor })`.
 */
export function createFakeWebSocket(): {
  WebSocket: WebSocketConstructor;
  instances: FakeWebSocketInstance[];
  last(): FakeWebSocketInstance;
} {
  const instances: FakeWebSocketInstance[] = [];

  class FakeSocket implements FakeWebSocketInstance {
    url: string;
    sent: string[] = [];
    readyState = 1;
    onopen: WebSocketLike["onopen"] = null;
    onclose: WebSocketLike["onclose"] = null;
    onerror: WebSocketLike["onerror"] = null;
    onmessage: WebSocketLike["onmessage"] = null;

    constructor(url: string) {
      this.url = url;
      instances.push(this);
    }

    send(data: string): void {
      this.sent.push(data);
    }

    close(): void {
      this.readyState = 3;
      this.onclose?.({ code: 1000, reason: "", wasClean: true });
    }

    simulateOpen(): void {
      this.readyState = 1;
      this.onopen?.({});
    }

    simulateMessage(data: unknown): void {
      this.onmessage?.({ data: typeof data === "string" ? data : JSON.stringify(data) });
    }

    simulateClose(code = 1006): void {
      this.readyState = 3;
      this.onclose?.({ code, reason: "", wasClean: false });
    }
  }

  return {
    WebSocket: FakeSocket as unknown as WebSocketConstructor,
    instances,
    last: () => instances[instances.length - 1]!,
  };
}

/**
 * Fresh `QueryClient` per test, with retries off so an intentional error in
 * `queryFn` surfaces immediately instead of waiting for backoff.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

/**
 * Options accepted by {@link renderWithProviders} and
 * {@link renderHookWithProviders}.
 */
export interface ProviderTestOptions {
  /** Wagmi config override. Defaults to a config with the `mock` connector connected. */
  wagmiConfig?: WagmiConfig;
  /** QueryClient override. Defaults to a fresh per-test client. */
  queryClient?: QueryClient;
}

/**
 * React tree wrapping a component / hook under test with the SDK's full
 * provider stack. Useful when each test needs deterministic provider state.
 */
export function TestProviders({
  children,
  wagmiConfig = createTestWagmiConfig(),
  queryClient = createTestQueryClient(),
}: PropsWithChildren<ProviderTestOptions>) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <SymmioProvider>{children}</SymmioProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

/** Render a UI tree wrapped in {@link TestProviders}. */
export function renderWithProviders(ui: ReactElement, opts?: ProviderTestOptions & RenderOptions): RenderResult {
  const { wagmiConfig, queryClient, ...rest } = opts ?? {};
  return render(ui, {
    wrapper: (props) => (
      <TestProviders wagmiConfig={wagmiConfig} queryClient={queryClient}>
        {props.children}
      </TestProviders>
    ),
    ...rest,
  });
}

/** Render a hook wrapped in {@link TestProviders}. */
export function renderHookWithProviders<TResult, TProps>(
  hook: (initialProps: TProps) => TResult,
  opts?: ProviderTestOptions & RenderHookOptions<TProps>,
): RenderHookResult<TResult, TProps> {
  const { wagmiConfig, queryClient, ...rest } = opts ?? {};
  return renderHook<TResult, TProps>(hook, {
    wrapper: (props) => (
      <TestProviders wagmiConfig={wagmiConfig} queryClient={queryClient}>
        {props.children}
      </TestProviders>
    ),
    ...rest,
  });
}
