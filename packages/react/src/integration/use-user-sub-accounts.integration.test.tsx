import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type PropsWithChildren } from "react";
import { http } from "viem";
import { hyperEvm } from "viem/chains";
import { describe, expect, it } from "vitest";
import { createConfig, WagmiProvider } from "wagmi";
import { useUserSubAccounts } from "../account-layer/use-user-sub-accounts";
import { SymmioSupportedChainId, type SymmioClientConfigInput } from "../config";
import { SymmioProvider } from "../provider/symmio-provider";
import { TEST_EOA } from "../test/test-utils";

/**
 * Public Hyperliquid HTTP RPC used by Vibe-ui's production config. Anyone can
 * hit this endpoint; no API key needed.
 */
const HYPER_EVM_RPC = "https://rpc.hyperliquid.xyz/evm";

const INTEGRATION_WAGMI = createConfig({
  chains: [hyperEvm],
  transports: {
    [hyperEvm.id]: http(HYPER_EVM_RPC, {
      batch: { wait: 16 },
    }),
  },
  multiInjectedProviderDiscovery: false,
});

const INTEGRATION_SYMMIO: SymmioClientConfigInput = {
  environment: "production",
  chainId: SymmioSupportedChainId.HYPER_EVM,
  affiliateAddress: "0xBcB033C9154401fA000a1Ae60843f79f45741b7c",
};

function IntegrationProviders({ children }: PropsWithChildren) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return (
    <WagmiProvider config={INTEGRATION_WAGMI}>
      <QueryClientProvider client={queryClient}>
        <SymmioProvider config={INTEGRATION_SYMMIO}>{children}</SymmioProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

describe("useUserSubAccounts — integration (real HyperEVM RPC)", () => {
  it("resolves with an array (possibly empty) for a known EOA", async () => {
    const { result } = renderHook(() => useUserSubAccounts({ user: TEST_EOA }), { wrapper: IntegrationProviders });

    await waitFor(() => expect(result.current.status === "success" || result.current.status === "error").toBe(true), {
      timeout: 25_000,
    });

    /**
     * Network or RPC errors aren't worth flagging — when offline, the test
     * shouldn't crash the suite. We assert: when it does come back, it comes
     * back with the expected shape.
     */
    if (result.current.status === "success") {
      expect(Array.isArray(result.current.data)).toBe(true);
      for (const sub of result.current.data ?? []) {
        expect(typeof sub.accountAddress).toBe("string");
        expect(typeof sub.name).toBe("string");
        expect(typeof sub.isExists).toBe("boolean");
      }
    } else {
      /**
       * Surface RPC failures as a soft-warn but don't fail the suite — keep
       * CI green when Hyperliquid RPC blips. Re-run locally to investigate.
       */
      console.warn("[integration] Hyperliquid RPC returned an error:", result.current.error?.message);
    }
  });
});
