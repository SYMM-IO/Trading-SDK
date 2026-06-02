import type { Address, Hex } from "viem";

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

/**
 * One subaccount owned by a user EOA on a SYMMIO `AccountLayer` deployment.
 *
 * Field shapes mirror the on-chain `SubAccountDetail` struct exactly so callers
 * comparing against raw viem decodings do not have to translate.
 */
export interface SubAccountDetail {
  /**
   * The subaccount's proxy address on-chain.
   */
  accountAddress: Address;
  /**
   * The EOA that created and owns the subaccount.
   */
  owner: Address;
  /**
   * User-defined display name. Editable via the `editAccountName` write.
   */
  name: string;
  /**
   * `false` for a subaccount that has been deleted on-chain.
   */
  isExists: boolean;
  /**
   * `true` when the subaccount routes successive quotes for the same market
   * into the existing active VA instead of creating a fresh VA per `sendQuote`.
   * Toggleable only while no VAs are active on the subaccount.
   */
  singleVAMode: boolean;
  /**
   * Affiliate address attributed to the subaccount, or the zero address.
   */
  affiliate: Address;
  /**
   * The Symmio core (diamond) address this subaccount trades against.
   */
  symmioCore: Address;
  /**
   * Free-form contract metadata blob. May be `0x` (empty) for most accounts.
   */
  metadata: Hex;
  /**
   * Strategy the AccountLayer uses to create VAs for this subaccount's trades.
   */
  isolationType: SubAccountIsolationType;
}
