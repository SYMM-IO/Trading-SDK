import type { Address, PublicClient } from "viem";
import { vi, type Mock } from "vitest";
import { SymmioSupportedChainId } from "../../core/chains";
import type { SymmioGaslessConfig } from "../../core/chains/types";
import { createConfig, type Config } from "../../core/config";
import type { DeepPartial } from "../../shared/types/properties";

/** Deterministic gasless block used across gasless tests (production values). */
export const TEST_GASLESS: SymmioGaslessConfig = {
  url: "https://gaslessq.symmio.foundation",
  protocolInstance: "arbitrum-42161-vibe",
  gaslessLayerAddress: "0x8347953D80037b8d82827246f37EC7442AD188B4",
  apiKey: "test-key",
};

/** Chain every gasless test targets (the only 0.8.6 chain in the registry). */
export const GASLESS_TEST_CHAIN = SymmioSupportedChainId.ARBITRUM;

/**
 * Build a config whose Arbitrum chain carries a gasless block, plus a stubbed
 * public client for the contract reads gasless actions perform.
 *
 * @internal test helper — not exported from the package.
 */
export function gaslessTestConfig(overrides?: DeepPartial<SymmioGaslessConfig>): {
  config: Config;
  readContract: Mock;
} {
  const readContract = vi.fn();
  const publicClient = { readContract } as unknown as PublicClient;

  const config = createConfig({
    getClient: () => publicClient,
    symmioConfig: {
      [GASLESS_TEST_CHAIN]: {
        addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" },
        gasless: { ...TEST_GASLESS, ...(overrides as Partial<SymmioGaslessConfig>) },
      },
    },
  });

  return { config, readContract };
}

/** Deterministic signature the stub wallet returns for EIP-712 prompts. */
export const TEST_GASLESS_SIGNATURE = `0x${"ab".repeat(65)}` as const;
/** Deterministic hash the stub wallet returns for writeContract calls. */
export const TEST_GASLESS_TX_HASH = `0x${"cd".repeat(32)}` as const;
/** The stub wallet's EOA. */
export const TEST_GASLESS_SIGNER = "0x1111111111111111111111111111111111111111" as const;

/** Options for {@link gaslessWriteTestConfig}. */
export interface GaslessWriteTestConfigOptions {
  /**
   * Opt-in signer routing: maps a write's `from` hint to the EOA the returned
   * wallet client signs as. Omitted (the default), `getWalletClient` ignores its
   * arguments entirely and always signs as {@link TEST_GASLESS_SIGNER} — which
   * is why a test that needs to observe the `from` → signer seam (session keys,
   * delegation pre-flight) must opt in. A `from` with no entry, and a write with
   * no `from` at all, still get the {@link TEST_GASLESS_SIGNER} client.
   *
   * Every client shares the one `writeContract` / `signTypedData` spy, so call
   * counts stay observable across signers.
   */
  signersByFrom?: Readonly<Record<Address, Address>>;
}

/**
 * Like {@link gaslessTestConfig}, but with a stub wallet client so dispatcher
 * and write-seam tests can sign and (when falling back) submit transactions.
 *
 * @internal test helper — not exported from the package.
 */
export function gaslessWriteTestConfig(
  overrides?: DeepPartial<SymmioGaslessConfig>,
  options?: GaslessWriteTestConfigOptions,
): {
  config: Config;
  readContract: Mock;
  writeContract: Mock;
  signTypedData: Mock;
} {
  const readContract = vi.fn();
  const writeContract = vi.fn().mockResolvedValue(TEST_GASLESS_TX_HASH);
  const signTypedData = vi.fn().mockResolvedValue(TEST_GASLESS_SIGNATURE);
  const publicClient = { readContract } as unknown as import("viem").PublicClient;
  const clientFor = (signer: Address) =>
    ({
      account: { address: signer, type: "json-rpc" },
      chain: { id: GASLESS_TEST_CHAIN },
      writeContract,
      signTypedData,
    }) as unknown as import("../../core/config").SymmioWalletClient;
  const walletClient = clientFor(TEST_GASLESS_SIGNER);

  const config = createConfig({
    getClient: () => publicClient,
    getWalletClient: async ({ from }) => {
      const signer = from ? options?.signersByFrom?.[from] : undefined;
      return signer ? clientFor(signer) : walletClient;
    },
    defaultChainId: GASLESS_TEST_CHAIN,
    simulateBeforeWrite: false,
    symmioConfig: {
      [GASLESS_TEST_CHAIN]: {
        addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" },
        gasless: { ...TEST_GASLESS, ...(overrides as Partial<SymmioGaslessConfig>) },
      },
    },
  });

  return { config, readContract, writeContract, signTypedData };
}
