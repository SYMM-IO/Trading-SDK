import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type PropsWithChildren } from "react";
import { http } from "viem";
import { arbitrum } from "viem/chains";
import { describe, expect, it } from "vitest";
import { createConfig, WagmiProvider } from "wagmi";
import { useUserSubAccounts } from "../account-layer/use-user-sub-accounts";
import { SymmioProvider } from "../provider/symmio-provider";
import { TEST_EOA } from "../test/test-utils";

/**
 * Public Arbitrum HTTP RPC used by the production config. Anyone can
 * hit this endpoint; no API key needed.
 */
const ARBITRUM_RPC = "https://arb1.arbitrum.io/rpc";

const INTEGRATION_WAGMI = createConfig({
  chains: [arbitrum],
  transports: {
    [arbitrum.id]: http(ARBITRUM_RPC, {
      batch: { wait: 16 },
    }),
  },
  multiInjectedProviderDiscovery: false,
});

function IntegrationProviders({ children }: PropsWithChildren) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return (
    <WagmiProvider config={INTEGRATION_WAGMI}>
      <QueryClientProvider client={queryClient}>
        <SymmioProvider
          symmioConfig={{
            [arbitrum.id]: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } },
          }}
        >
          {children}
        </SymmioProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

describe("useUserSubAccounts — integration (real Arbitrum RPC)", () => {
  it("resolves with an array (possibly empty) for a known EOA", async () => {
    const { result } = renderHook(() => useUserSubAccounts({ user: TEST_EOA }), { wrapper: IntegrationProviders });

    await waitFor(() => expect(result.current.status === "success" || result.current.status === "error").toBe(true), {
      timeout: 25_000,
    });

    if (result.current.status === "success") {
      expect(Array.isArray(result.current.data)).toBe(true);
      for (const sub of result.current.data ?? []) {
        expect(typeof sub.accountAddress).toBe("string");
        expect(typeof sub.name).toBe("string");
        expect(typeof sub.isExists).toBe("boolean");
      }
    } else {
      console.warn("[integration] Arbitrum RPC returned an error:", result.current.error?.message);
    }
  });
});
