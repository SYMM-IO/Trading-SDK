import type { Account, Address, Chain, Hash, PublicClient } from "viem";
import { vi, type Mock } from "vitest";
import { SymmioSupportedChainId } from "../../core/chains";
import { createConfig, type Config, type SymmioWalletClient } from "../../core/config";
import type { WebSocketConstructor } from "../types/websocket";

/** Deterministic test EOA. Public, never used on a real chain. */
export const TEST_USER: Address = "0x1111111111111111111111111111111111111111";
/** Deterministic, non-zero test affiliate address (createConfig requires one). */
export const TEST_AFFILIATE_ADDRESS: Address = "0x000000000000000000000000000000000000aFF1";
/** Deterministic test transaction hash returned by the stub wallet client. */
export const TEST_TX_HASH: Hash = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";

/** What {@link mockConfig} returns: a real {@link Config} plus its stubbed viem fns. */
export interface MockConfigResult {
  config: Config;
  readContract: Mock;
  writeContract: Mock;
  simulateContract: Mock;
}

/**
 * Build a real {@link Config} (via {@link createConfig}) whose `getClient` /
 * `getWalletClients` resolvers return stub viem clients with `vi.fn()`-backed
 * `readContract` / `writeContract`. Lets action and query-factory tests assert
 * the contract calls without touching the network.
 *
 * @param options - `withWallet: false` omits the wallet resolver so write paths
 *   throw `SymmError`, simulating a disconnected wallet. `simulateBeforeWrite`
 *   sets the config's global pre-flight default (defaults to `createConfig`'s own
 *   default of `true`). `webSocketConstructor` injects a (usually fake) WebSocket
 *   implementation for streaming-action tests.
 */
export function mockConfig(options?: {
  withWallet?: boolean;
  simulateBeforeWrite?: boolean;
  webSocketConstructor?: WebSocketConstructor;
}): MockConfigResult {
  const readContract = vi.fn().mockResolvedValue([]);
  const writeContract = vi.fn().mockResolvedValue(TEST_TX_HASH);
  const simulateContract = vi.fn().mockResolvedValue({ result: undefined, request: {} });

  const publicClient = { readContract, simulateContract } as unknown as PublicClient;
  const account = { address: TEST_USER, type: "json-rpc" } as Account;
  const walletClient = {
    account,
    chain: { id: SymmioSupportedChainId.HYPER_EVM } as Chain,
    writeContract,
  } as unknown as SymmioWalletClient;

  const config = createConfig({
    symmioConfig: { [SymmioSupportedChainId.HYPER_EVM]: { addresses: { affiliatesAddress: TEST_AFFILIATE_ADDRESS } } },
    getClient: () => publicClient,
    getWalletClient: options?.withWallet === false ? undefined : async () => walletClient,
    simulateBeforeWrite: options?.simulateBeforeWrite,
    webSocketConstructor: options?.webSocketConstructor,
  });

  return { config, readContract, writeContract, simulateContract };
}
