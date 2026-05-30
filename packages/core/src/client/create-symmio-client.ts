import { editAccountName, getUserSubAccounts } from "../account-layer";
import { SymmError } from "../errors";
import { getMarkets } from "../markets";
import { resolveConfig } from "./resolve-config";
import type { CreateSymmioClientParams, SymmioClient } from "./types";

/**
 * Create a SYMMIO client with bound read/write actions.
 *
 * The client merges built-in chain defaults with any overrides you provide.
 * All bound methods use the resolved config automatically — no need to pass
 * addresses or clients per call.
 *
 * @param params - Chain ID, viem clients, and optional config overrides
 * @returns A SymmioClient with bound actions
 *
 * @example
 * ```ts
 * import { createSymmioClient, SymmioSupportedChainId } from "@symm-frontier/core";
 * import { createPublicClient, createWalletClient, http } from "viem";
 * import { hyperEvm } from "viem/chains";
 *
 * const publicClient = createPublicClient({
 *   chain: hyperEvm,
 *   transport: http("https://rpc.hyperliquid.xyz/evm"),
 * });
 *
 * const client = createSymmioClient({
 *   chainId: SymmioSupportedChainId.HYPER_EVM,
 *   publicClient,
 * });
 *
 * // Read operations work immediately
 * const markets = await client.getMarkets();
 * const subs = await client.getUserSubAccounts({ user: "0x..." });
 * ```
 *
 * @example Override default addresses
 * ```ts
 * const client = createSymmioClient({
 *   chainId: SymmioSupportedChainId.HYPER_EVM,
 *   publicClient,
 *   overrides: {
 *     addresses: {
 *       accountLayerAddress: "0xCustomAccountLayer...",
 *     },
 *     solver: {
 *       url: "https://custom-solver.example.com/api",
 *     },
 *   },
 * });
 * ```
 */
export function createSymmioClient(params: CreateSymmioClientParams): SymmioClient {
  const { chainId, publicClient, walletClient, overrides } = params;
  const config = resolveConfig(chainId, overrides);

  return {
    config,
    publicClient,
    walletClient,

    async getUserSubAccounts(clientParams) {
      return getUserSubAccounts(publicClient, {
        user: clientParams.user,
        offset: clientParams.offset,
        limit: clientParams.limit,
        accountLayerAddress: config.addresses.accountLayerAddress,
      });
    },

    async getMarkets() {
      return getMarkets(config.solver.url);
    },

    async editAccountName(clientParams) {
      if (!walletClient) {
        throw new SymmError("Cannot call editAccountName: no walletClient provided to createSymmioClient.");
      }
      return editAccountName(walletClient, {
        account: clientParams.account,
        name: clientParams.name,
        accountLayerAddress: config.addresses.accountLayerAddress,
      });
    },
  };
}
