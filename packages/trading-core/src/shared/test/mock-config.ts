import type { Account, Address, Chain, Hash, Hex, PublicClient } from "viem";
import { vi, type Mock } from "vitest";
import { SymmioSupportedChainId } from "../../core/chains";
import { createConfig, type Config, type SymmioWalletClient } from "../../core/config";
import type { WebSocketConstructor } from "../types/websocket";

/** Deterministic test EOA. Public, never used on a real chain. */
export const TEST_USER: Address = "0x1111111111111111111111111111111111111111";
/**
 * Deterministic, non-zero test affiliate address (createConfig requires one).
 *
 * Checksummed on purpose: write paths that ABI-encode the affiliate (the
 * instant-open quote calldata) go through viem's address validation, which
 * rejects a mis-cased address.
 */
export const TEST_AFFILIATE_ADDRESS: Address = "0x000000000000000000000000000000000000AfF1";
/** Deterministic test transaction hash returned by the stub wallet client. */
export const TEST_TX_HASH: Hash = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
/** Deterministic EIP-712 signature returned by the stub wallet client. */
export const TEST_TYPED_SIGNATURE: Hex = `0x${"ab".repeat(65)}`;

/** What {@link mockConfig} returns: a real {@link Config} plus its stubbed viem fns. */
export interface MockConfigResult {
  config: Config;
  readContract: Mock;
  writeContract: Mock;
  simulateContract: Mock;
  /** Stub EIP-712 signer — instant-layer write paths sign operations through this. */
  signTypedData: Mock;
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
  const signTypedData = vi.fn().mockResolvedValue(TEST_TYPED_SIGNATURE);

  const publicClient = { readContract, simulateContract } as unknown as PublicClient;
  const account = { address: TEST_USER, type: "json-rpc" } as Account;
  const walletClient = {
    account,
    chain: { id: SymmioSupportedChainId.HYPER_EVM } as Chain,
    writeContract,
    signTypedData,
  } as unknown as SymmioWalletClient;

  const config = createConfig({
    symmioConfig: { [SymmioSupportedChainId.HYPER_EVM]: { addresses: { affiliatesAddress: TEST_AFFILIATE_ADDRESS } } },
    getClient: () => publicClient,
    getWalletClient: options?.withWallet === false ? undefined : async () => walletClient,
    simulateBeforeWrite: options?.simulateBeforeWrite,
    webSocketConstructor: options?.webSocketConstructor,
  });

  return { config, readContract, writeContract, simulateContract, signTypedData };
}
