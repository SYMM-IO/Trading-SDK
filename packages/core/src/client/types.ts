import type { Account, Address, Chain, Hash, PublicClient, Transport, WalletClient } from "viem";
import type { SubAccountDetail } from "../account-layer";
import type {
  SymmioChainConfig,
  SymmioContractAddresses,
  SymmioSolverConfig,
  SymmioSubgraphUrls,
  SymmioSupportedChainId,
} from "../chains";
import type { Market } from "../markets";

/**
 * Optional overrides for chain config defaults.
 */
export interface SymmioConfigOverrides {
  /** Contract address overrides */
  addresses?: Partial<SymmioContractAddresses>;
  /** Subgraph URL overrides */
  subgraphs?: Partial<SymmioSubgraphUrls>;
  /** Solver config overrides */
  solver?: Partial<SymmioSolverConfig>;
}

/**
 * Parameters for creating a SYMMIO client.
 */
export interface CreateSymmioClientParams {
  /** Chain ID to use. Must be a supported chain. */
  chainId: SymmioSupportedChainId;
  /** viem PublicClient for read operations */
  publicClient: PublicClient;
  /** Optional viem WalletClient for write operations (must have account bound) */
  walletClient?: WalletClient<Transport, Chain, Account>;
  /** Optional config overrides to replace default values */
  overrides?: SymmioConfigOverrides;
}

/**
 * Parameters for getUserSubAccounts bound method.
 */
export interface GetUserSubAccountsClientParams {
  /** Owner address to query subaccounts for */
  user: Address;
  /** Starting offset for pagination (default: 0) */
  offset?: bigint;
  /** Maximum number of results (default: 200) */
  limit?: bigint;
}

/**
 * Parameters for editAccountName bound method.
 */
export interface EditAccountNameClientParams {
  /** Subaccount address to rename */
  account: Address;
  /** New name for the subaccount */
  name: string;
}

/**
 * SYMMIO SDK client with bound read/write actions.
 *
 * Created via `createSymmioClient()`. All methods use the config and clients
 * passed at initialization — no need to pass addresses or clients per call.
 *
 * @example
 * ```ts
 * const client = createSymmioClient({
 *   chainId: SymmioSupportedChainId.HYPER_EVM,
 *   publicClient: viemPublicClient,
 *   walletClient: viemWalletClient,
 * });
 *
 * const subs = await client.getUserSubAccounts({ user: "0x..." });
 * const markets = await client.getMarkets();
 * const hash = await client.editAccountName({ account: "0x...", name: "Main" });
 * ```
 */
export interface SymmioClient {
  /** Resolved chain config (defaults merged with overrides) */
  readonly config: SymmioChainConfig;
  /** viem PublicClient used for read operations */
  readonly publicClient: PublicClient;
  /** viem WalletClient used for write operations (undefined if not provided) */
  readonly walletClient?: WalletClient<Transport, Chain, Account>;

  /**
   * Fetch subaccounts for a user address.
   *
   * @param params - User address and optional pagination
   * @returns Array of subaccount details
   */
  getUserSubAccounts(params: GetUserSubAccountsClientParams): Promise<readonly SubAccountDetail[]>;

  /**
   * Fetch all tradable markets from the solver.
   *
   * @returns Array of market definitions
   */
  getMarkets(): Promise<Market[]>;

  /**
   * Rename a subaccount.
   *
   * @param params - Subaccount address and new name
   * @returns Transaction hash
   * @throws {SymmError} if no walletClient was provided at initialization
   */
  editAccountName(params: EditAccountNameClientParams): Promise<Hash>;
}
