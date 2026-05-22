/**
 * Strategy the AccountLayer uses to create Virtual Accounts (VAs) for trades
 * placed through this subaccount.
 *
 * @remarks
 * Names and ordering mirror the on-chain `enum SubAccountIsolationType` in
 * `AccountStorage.sol` (perps-core v0.8.5) exactly, so a `uint8` returned by
 * `getUserSubAccounts` casts directly to this enum without translation.
 *
 * @see {@link https://github.com/SYMM-IO/perps-core/blob/version_0.8.5/contracts/accountLayer/storages/AccountStorage.sol}
 */
export enum SubAccountIsolationType {
  /**
   * One VA per trade. Each position lives in its own VA, fully isolated.
   */
  POSITION = 0,
  /**
   * One VA per market. All trades on the same market share a VA.
   */
  MARKET = 1,
  /**
   * One VA per market + direction. Longs and shorts on the same market are
   * isolated from each other.
   */
  MARKET_DIRECTION = 2,
  /**
   * No automatic VA creation. Trades execute on the SubAccount directly or on
   * manually-created VAs.
   */
  CUSTOM = 3,
}
