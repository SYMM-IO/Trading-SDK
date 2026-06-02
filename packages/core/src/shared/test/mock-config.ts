import type { Account, Address, Chain, Hash, PublicClient } from "viem";
import { vi, type Mock } from "vitest";
import { SymmioSupportedChainId } from "../../core/chains";
import { createConfig, type Config, type SymmioWalletClient } from "../../core/config";

/** Deterministic test EOA. Public, never used on a real chain. */
export const TEST_USER: Address = "0x1111111111111111111111111111111111111111";
/** Deterministic test transaction hash returned by the stub wallet client. */
export const TEST_TX_HASH: Hash = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";

/** What {@link mockConfig} returns: a real {@link Config} plus its stubbed viem fns. */
export interface MockConfigResult {
  config: Config;
  readContract: Mock;
  writeContract: Mock;
}

/**
 * Build a real {@link Config} (via {@link createConfig}) whose `getClient` /
 * `getWalletClient` resolvers return stub viem clients with `vi.fn()`-backed
 * `readContract` / `writeContract`. Lets action and query-factory tests assert
 * the contract calls without touching the network.
 *
 * @param options - `withWallet: false` omits the wallet resolver so write paths
 *   throw `SymmError`, simulating a disconnected wallet.
 */
export function mockConfig(options?: { withWallet?: boolean }): MockConfigResult {
  const readContract = vi.fn().mockResolvedValue([]);
  const writeContract = vi.fn().mockResolvedValue(TEST_TX_HASH);

  const publicClient = { readContract } as unknown as PublicClient;
  const account = { address: TEST_USER, type: "json-rpc" } as Account;
  const walletClient = {
    account,
    chain: { id: SymmioSupportedChainId.HYPER_EVM } as Chain,
    writeContract,
  } as unknown as SymmioWalletClient;

  const config = createConfig({
    getClient: () => publicClient,
    getWalletClient: options?.withWallet === false ? undefined : async () => walletClient,
  });

  return { config, readContract, writeContract };
}
