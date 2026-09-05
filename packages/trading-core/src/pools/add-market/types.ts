import type { ListingDepositChainId, ListingMarketStatus } from "../types";

/**
 * A pool the listing service created for a freshly submitted token — the
 * normalized result of {@link addMarket}.
 *
 * The service both records the token's config and provisions a custodial
 * deposit wallet to seed the pool; this shape carries the config it echoed back
 * plus that wallet. Money/config fields are plain numbers as the service reports
 * them here (unlike the 18-decimal `bigint` scale of the catalog rows), because
 * `addMarket` returns the accepted application, not live pool metrics.
 */
export interface CreatedPool {
  /**
   * The submitted token's contract address on {@link CreatedPool.depositChain}.
   *
   * Typed as `string`, not viem's `Address`: a Solana listing
   * (`depositChain === ListingDepositChainId.SOLANA`) carries a base58 address
   * that is not 0x-prefixed.
   */
  tokenContractAddress: string;
  /** The signed-in user who submitted the listing (the token's on-chain owner as the service resolved it). */
  userAddress: string;
  /** Token display name the service resolved from the contract, e.g. `"Symmio"`. */
  tokenName: string;
  /** Token ticker the service resolved from the contract, e.g. `"SYMM"`. */
  tokenTicker: string;
  /** The token's on-chain decimals the service read from the contract. */
  tokenDecimal: number;
  /** Share of trading fees routed to buy-backs, `0`–`100`, as submitted. */
  buyBackRatio: number;
  /** Maximum leverage the market will allow, as a whole multiplier (`20` = 20x), as submitted. */
  maxLeverage: number;
  /** Chain the token lives on and its listing deposit must be made on. */
  depositChain: ListingDepositChainId;
  /** Where the new market sits in the listing lifecycle — a fresh application starts at {@link ListingMarketStatus.WAITING_FOR_DEPOSIT}. */
  marketStatus: ListingMarketStatus;
  /** The custodial deposit wallet the service generated to seed the pool; `null` when the service did not return one. */
  walletPublicKey: string | null;
  /** The main pool address, or `null` when the service has not assigned one yet. */
  mainPool: string | null;
}
