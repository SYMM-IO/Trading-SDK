/**
 * Test-only render helpers. Compiled out of the published bundle by
 * `vite.config.ts`'s dts `exclude` and is not exported from `src/index.ts`.
 */
import { SymmioSupportedChainId } from "@symm-frontier/core";
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
import { http } from "viem";
import { hyperEvm } from "viem/chains";
import { createConfig, WagmiProvider, type Config } from "wagmi";
import { mock } from "wagmi/connectors";
import type { SymmioClientConfigInput } from "../config";
import { SymmioProvider } from "../provider/symmio-provider";

/**
 * Anvil deterministic test account #0. Public, never used on a real chain. Used
 * by the mock connector to simulate a connected wallet in tests.
 */
export const TEST_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
/** Address derived from {@link TEST_PRIVATE_KEY}. */
export const TEST_EOA = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;

/**
 * Default SDK config the test wrapper passes to `SymmioProvider`. Targets
 * HyperEVM so the live test addresses match the in-config defaults.
 */
export const TEST_SYMMIO_CONFIG: SymmioClientConfigInput = {
  chainId: SymmioSupportedChainId.HYPER_EVM,
  affiliateAddress: "0xBcB033C9154401fA000a1Ae60843f79f45741b7c",
};

/**
 * Build a wagmi config wired against HyperEVM with the `mock` connector. The
 * transport URL is a localhost placeholder — tests mock `@symm-frontier/core`
 * directly, so no real RPC traffic happens.
 */
export function createTestWagmiConfig(opts?: { connected?: boolean }): Config {
  const connectors = opts?.connected === false ? [] : [mock({ accounts: [TEST_EOA] })];

  return createConfig({
    chains: [hyperEvm],
    transports: {
      [hyperEvm.id]: http("http://127.0.0.1:0"),
    },
    connectors,
    multiInjectedProviderDiscovery: false,
  });
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
  wagmiConfig?: Config;
  /** QueryClient override. Defaults to a fresh per-test client. */
  queryClient?: QueryClient;
  /** SymmioProvider config override. */
  symmioConfig?: SymmioClientConfigInput;
}

/**
 * React tree wrapping a component / hook under test with the SDK's full
 * provider stack. Useful when each test needs deterministic provider state.
 */
export function TestProviders({
  children,
  wagmiConfig = createTestWagmiConfig(),
  queryClient = createTestQueryClient(),
  symmioConfig = TEST_SYMMIO_CONFIG,
}: PropsWithChildren<ProviderTestOptions>) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <SymmioProvider config={symmioConfig}>{children}</SymmioProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

/** Render a UI tree wrapped in {@link TestProviders}. */
export function renderWithProviders(ui: ReactElement, opts?: ProviderTestOptions & RenderOptions): RenderResult {
  const { wagmiConfig, queryClient, symmioConfig, ...rest } = opts ?? {};
  return render(ui, {
    wrapper: (props) => (
      <TestProviders wagmiConfig={wagmiConfig} queryClient={queryClient} symmioConfig={symmioConfig}>
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
  const { wagmiConfig, queryClient, symmioConfig, ...rest } = opts ?? {};
  return renderHook<TResult, TProps>(hook, {
    wrapper: (props) => (
      <TestProviders wagmiConfig={wagmiConfig} queryClient={queryClient} symmioConfig={symmioConfig}>
        {props.children}
      </TestProviders>
    ),
    ...rest,
  });
}
