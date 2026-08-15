import type { Address, Hex } from "viem";
import type { SymmioChainConfig, SymmioResolvedSolver } from "../../../../core/chains/types";
import type { Config, SymmioWalletClient } from "../../../../core/config";

/**
 * Everything the dispatch resolves once, before handing off to a kind's adapter.
 *
 * Resolving the wallet client up front matters: `config.getWalletClient` can
 * prompt the user, so it must happen exactly once per call regardless of which
 * adapter runs. Passing this bag also keeps adapters testable without stubbing a
 * whole `Config`.
 *
 * @internal
 */
export interface InstantOpenAdapterContext {
  /** The SDK config, for the nested calls an adapter still needs (Muon, hedger POST). */
  config: Config;
  /** The resolved target solver — its `address` is the quote's sole whitelisted partyB. */
  solver: SymmioResolvedSolver;
  /** The resolved chain config (addresses). */
  chainConfig: SymmioChainConfig;
  /** The wallet client that signs every operation in this call. */
  walletClient: SymmioWalletClient;
  /** Session-key / signer address taken from `walletClient`. */
  signerAddress: Address;
  /** Chain id override as the caller passed it (may be `undefined`). */
  chainId?: number;
  /** Unix-seconds deadline shared by every operation and the quote itself. */
  deadline: bigint;
  /** `marketId` widened to the contract's `bigint`. */
  symbolId: bigint;
  /** Encoded `{ uuid }` metadata blob attached to the quote. */
  metadata: Hex;
}
