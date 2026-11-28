import { ListingDepositChainId, ListingMarketStatus, type CreatedPool } from "@symmio/trading-core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreatePoolCard } from "./create-pool-card";

const mocks = vi.hoisted(() => ({
  listMarket: vi.fn(),
  weeklyLimit: vi.fn(),
  active: vi.fn(),
  auth: vi.fn(),
}));

vi.mock("@symmio/trading-react", () => ({
  useListMarket: mocks.listMarket,
  useWeeklyListingLimit: mocks.weeklyLimit,
}));
vi.mock("../solvers/solver-target", () => ({ useSolverKindActive: mocks.active }));
vi.mock("./listing-auth-context", () => ({ useListingAuth: mocks.auth }));
vi.mock("./deposit-chain-select", () => ({ DepositChainSelect: () => null }));
vi.mock("../inspector/method-card", () => ({
  MethodCard: ({ testId, name, children }: { testId: string; name: string; children: ReactNode }) => (
    <section data-testid={testId} aria-label={name}>
      {children}
    </section>
  ),
}));

const POOL: CreatedPool = {
  tokenContractAddress: "0xToken",
  userAddress: "0xUser",
  tokenName: "Symmio",
  tokenTicker: "SYMM",
  tokenDecimal: 18,
  buyBackRatio: 5,
  maxLeverage: 20,
  depositChain: ListingDepositChainId.ARBITRUM_ONE,
  marketStatus: ListingMarketStatus.WAITING_FOR_DEPOSIT,
  walletPublicKey: "0xDepositWallet",
  mainPool: null,
};

function mockListMarket(state: { data?: CreatedPool; error?: { kind: string; message: string } } = {}) {
  const mutate = vi.fn();
  mocks.listMarket.mockReturnValue({ mutate, isPending: false, data: state.data, error: state.error ?? null });
  return mutate;
}

describe("CreatePoolCard", () => {
  beforeEach(() => {
    mocks.active.mockReturnValue(true);
    mocks.auth.mockReturnValue({ accessToken: "TOKEN123", signIn: vi.fn(), isSigningIn: false });
    mocks.weeklyLimit.mockReturnValue({ data: { remaining: 3, limit: 5, resetAt: 0 } });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("is the listMarket card and submits the form through useListMarket with the web defaults", () => {
    const mutate = mockListMarket();
    render(<CreatePoolCard />);

    expect(screen.getByTestId("method-listMarket").getAttribute("aria-label")).toBe("listMarket");

    fireEvent.change(screen.getByTestId("create-pool-token-address"), { target: { value: " 0xToken " } });
    fireEvent.click(screen.getByTestId("create-pool-submit"));

    expect(mutate).toHaveBeenCalledWith({
      accessToken: "TOKEN123",
      tokenContractAddress: "0xToken",
      buyBackRatio: 5,
      maxLeverage: 20,
      depositChain: ListingDepositChainId.ARBITRUM_ONE,
      isTax: false,
      userWhitelistTax: false,
      additionalChains: [],
      cexList: [],
    });
  });

  it("explains that a delisted token is relisted through the same call", () => {
    mockListMarket();
    render(<CreatePoolCard />);

    expect(screen.getByTestId("create-pool-relist-note").textContent).toContain("A delisted token is relisted");
  });

  it("shows the returned status and deposit wallet on success", () => {
    mockListMarket({ data: POOL });
    render(<CreatePoolCard />);

    expect(screen.getByTestId("create-pool-success").textContent).toContain("waiting_for_deposit");
    expect(screen.getByTestId("create-pool-wallet").textContent).toBe("0xDepositWallet");
  });

  it("shows the service's rejection, such as a market that already exists", () => {
    mockListMarket({
      error: { kind: "api", message: "LIST_MARKET_FAILED: Request failed with status code 409" },
    });
    render(<CreatePoolCard />);

    expect(screen.getByTestId("create-pool-error").textContent).toContain("LIST_MARKET_FAILED");
  });

  it("does not submit when the weekly listing limit is reached", () => {
    const mutate = mockListMarket();
    mocks.weeklyLimit.mockReturnValue({ data: { remaining: 0, limit: 5, resetAt: 0 } });
    render(<CreatePoolCard />);

    fireEvent.change(screen.getByTestId("create-pool-token-address"), { target: { value: "0xToken" } });
    const submit = screen.getByTestId("create-pool-submit");
    fireEvent.click(submit);

    expect(submit.hasAttribute("disabled")).toBe(true);
    expect(mutate).not.toHaveBeenCalled();
  });
});
