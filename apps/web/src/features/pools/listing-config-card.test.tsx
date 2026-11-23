import type { useListingConfig } from "@symmio/trading-react";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ListingConfigCard } from "./listing-config-card";

type ListingConfig = NonNullable<ReturnType<typeof useListingConfig>["data"]>;
const mocks = vi.hoisted(() => ({ config: vi.fn(), active: vi.fn() }));

vi.mock("@symmio/trading-react", () => ({ useListingConfig: mocks.config }));
vi.mock("../solvers/solver-target", () => ({ useSolverKindActive: mocks.active }));
vi.mock("../inspector/method-card", () => ({
  MethodCard: ({ children }: { children: ReactNode }) => <section>{children}</section>,
}));

const config: ListingConfig = {
  recommendedInitialDepositUsdc: 5000000000000000000n,
  minimumInitialDepositUsdc: 1000000000000000000n,
  listingFeeUsdc: 1000000000000000000n,
  supportedDepositChains: [],
  rateLimits: { marketConfigUpdatesPerDay: 5, profitClaimsPerDay: 3 },
  protocolRewardSharePercent: 20,
};

function renderCard(chains: ListingConfig["supportedDepositChains"]) {
  mocks.config.mockReturnValue({ data: { ...config, supportedDepositChains: chains }, isPending: false, error: null });
  const element = document.createElement("div");
  element.innerHTML = renderToStaticMarkup(<ListingConfigCard />);
  return element;
}

describe("ListingConfigCard", () => {
  beforeEach(() => {
    mocks.active.mockReturnValue(true);
  });

  it("shows each chain's exact USD-token address and native decimals", () => {
    const solana = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    const bsc = "0x55d398326f99059fF775485246999027B3197955";
    const robinhood = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
    const element = renderCard([
      { chainId: 0, chainName: "solana", usdToken: { address: solana, decimals: 6 } },
      { chainId: 56, chainName: "bsc", usdToken: { address: bsc, decimals: 18 } },
      { chainId: 4663, chainName: "robinhood", usdToken: { address: robinhood, decimals: 6 } },
    ]);

    for (const [id, address, decimals] of [
      [0, solana, 6],
      [56, bsc, 18],
      [4663, robinhood, 6],
    ] as const) {
      const token = element.querySelector(`[data-testid="listing-config-usd-token-${id}"]`);
      expect(token?.textContent).toContain(address);
      expect(token?.textContent).toContain(`Native decimals: ${decimals}`);
    }
    expect(element.querySelector('[data-testid="listing-config-minimum"]')?.textContent).toContain("$1");
  });

  it("renders missing metadata as unknown without inventing token precision", () => {
    const element = renderCard([{ chainId: 0, chainName: "solana" }]);
    const token = element.querySelector('[data-testid="listing-config-usd-token-0"]');
    expect(token?.textContent).toContain("USD token: Unknown");
    expect(token?.textContent).not.toContain("Native decimals:");
  });

  it("preserves zero native decimals", () => {
    const element = renderCard([
      { chainId: 8453, chainName: "base", usdToken: { address: "quote-token", decimals: 0 } },
    ]);
    expect(element.textContent).toContain("Native decimals: 0");
  });

  it("preserves the empty-chain state", () => {
    const element = renderCard([]);
    expect(element.querySelector('[data-testid="listing-config-chains"]')?.textContent).toContain("—");
  });
});
