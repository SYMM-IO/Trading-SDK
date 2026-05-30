import type { Account, Address, Chain, Hash, PublicClient, Transport, WalletClient } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../chains";
import { SymmError } from "../errors";
import { createSymmioClient } from "./create-symmio-client";

vi.mock("../solver/axios-client", () => ({
  setSolverBaseUrl: vi.fn(),
  axiosClient: vi.fn(),
}));

vi.mock("../solver/enigma-solver", async (importOriginal) => {
  const original = await importOriginal<typeof import("../solver/enigma-solver")>();
  return {
    ...original,
    getLowCapSolverAPI: vi.fn(),
  };
});

import { setSolverBaseUrl } from "../solver/axios-client";
import { getLowCapSolverAPI } from "../solver/enigma-solver";

const HYPEREVM_ID = SymmioSupportedChainId.HYPER_EVM;
const DEFAULT_CONFIG = getChainConfig(HYPEREVM_ID);
const USER: Address = "0x1111111111111111111111111111111111111111";
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TX_HASH: Hash = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";

function mockPublicClient() {
  const readContract = vi.fn().mockResolvedValue([]);
  return {
    client: { chain: { id: HYPEREVM_ID }, readContract } as unknown as PublicClient,
    readContract,
  };
}

function mockWalletClient() {
  const writeContract = vi.fn().mockResolvedValue(TX_HASH);
  const account = { address: USER, type: "json-rpc" } as Account;
  return {
    client: {
      chain: { id: HYPEREVM_ID } as Chain,
      account,
      writeContract,
    } as unknown as WalletClient<Transport, Chain, Account>,
    writeContract,
  };
}

describe("createSymmioClient", () => {
  const mockGetContractSymbols = vi.fn();

  beforeEach(() => {
    vi.mocked(getLowCapSolverAPI).mockReturnValue({
      getContractSymbols: mockGetContractSymbols,
    } as unknown as ReturnType<typeof getLowCapSolverAPI>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates client with default config", () => {
    const { client: publicClient } = mockPublicClient();

    const symmioClient = createSymmioClient({
      chainId: HYPEREVM_ID,
      publicClient,
    });

    expect(symmioClient.config.chainId).toBe(HYPEREVM_ID);
    expect(symmioClient.config.addresses.accountLayerAddress).toBe(DEFAULT_CONFIG.addresses.accountLayerAddress);
    expect(symmioClient.publicClient).toBe(publicClient);
    expect(symmioClient.walletClient).toBeUndefined();
  });

  it("merges address overrides with defaults", () => {
    const { client: publicClient } = mockPublicClient();
    const customAddress: Address = "0x9999999999999999999999999999999999999999";

    const symmioClient = createSymmioClient({
      chainId: HYPEREVM_ID,
      publicClient,
      overrides: {
        addresses: {
          accountLayerAddress: customAddress,
        },
      },
    });

    expect(symmioClient.config.addresses.accountLayerAddress).toBe(customAddress);
    // Other addresses unchanged
    expect(symmioClient.config.addresses.symmioAddress).toBe(DEFAULT_CONFIG.addresses.symmioAddress);
  });

  it("merges solver overrides with defaults", () => {
    const { client: publicClient } = mockPublicClient();
    const customUrl = "https://custom-solver.example.com/api";

    const symmioClient = createSymmioClient({
      chainId: HYPEREVM_ID,
      publicClient,
      overrides: {
        solver: {
          url: customUrl,
        },
      },
    });

    expect(symmioClient.config.solver.url).toBe(customUrl);
    // Other solver fields unchanged
    expect(symmioClient.config.solver.name).toBe(DEFAULT_CONFIG.solver.name);
  });

  it("getUserSubAccounts uses bound config", async () => {
    const { client: publicClient, readContract } = mockPublicClient();

    const symmioClient = createSymmioClient({
      chainId: HYPEREVM_ID,
      publicClient,
    });

    await symmioClient.getUserSubAccounts({ user: USER });

    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT_CONFIG.addresses.accountLayerAddress,
        functionName: "getUserSubAccounts",
        args: [USER, 0n, 200n],
      }),
    );
  });

  it("getMarkets uses bound solver URL", async () => {
    const { client: publicClient } = mockPublicClient();
    mockGetContractSymbols.mockResolvedValue({ count: 0, symbols: [] });

    const symmioClient = createSymmioClient({
      chainId: HYPEREVM_ID,
      publicClient,
    });

    await symmioClient.getMarkets();

    expect(setSolverBaseUrl).toHaveBeenCalledWith(DEFAULT_CONFIG.solver.url);
    expect(mockGetContractSymbols).toHaveBeenCalled();
  });

  it("editAccountName uses bound walletClient", async () => {
    const { client: publicClient } = mockPublicClient();
    const { client: walletClient, writeContract } = mockWalletClient();

    const symmioClient = createSymmioClient({
      chainId: HYPEREVM_ID,
      publicClient,
      walletClient,
    });

    const hash = await symmioClient.editAccountName({ account: SUB_ACCOUNT, name: "Main" });

    expect(hash).toBe(TX_HASH);
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT_CONFIG.addresses.accountLayerAddress,
        functionName: "editAccountName",
        args: [SUB_ACCOUNT, "Main"],
      }),
    );
  });

  it("editAccountName throws when no walletClient provided", async () => {
    const { client: publicClient } = mockPublicClient();

    const symmioClient = createSymmioClient({
      chainId: HYPEREVM_ID,
      publicClient,
    });

    await expect(symmioClient.editAccountName({ account: SUB_ACCOUNT, name: "Main" })).rejects.toBeInstanceOf(
      SymmError,
    );
    await expect(symmioClient.editAccountName({ account: SUB_ACCOUNT, name: "Main" })).rejects.toThrow(
      "no walletClient",
    );
  });
});
