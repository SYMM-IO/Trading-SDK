import type { Chain } from "viem";

/**
 * Configuration used to initialize the SYMMIO SDK client.
 *
 * The config is intentionally small for the first VibeCaps phase. Endpoint and
 * contract configuration will be expanded in the next config-file slice.
 */
export interface SymmioClientConfig {
  /** Supported chain for the current SDK instance. */
  chain?: Chain;
  /** Backend API base URL for VibeCaps-specific requests. */
  backendUrl?: string;
  /** Solver or hedger API base URL used by VibeCaps trading flows. */
  solverUrl?: string;
}
