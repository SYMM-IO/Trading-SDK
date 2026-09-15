import type { Address, Hex } from "viem";

/**
 * A single Schnorr signature produced by the Muon network's TSS, mirrored from
 * the on-chain `ISymmio.SchnorrSign` struct field-for-field (same order).
 *
 * @remarks
 * Both `owner` and `nonce` are `address` on-chain (not numbers) — `nonce` is the
 * Muon nonce **address**, not a numeric nonce.
 *
 * @see {@link https://github.com/SYMM-IO/perps-core/blob/version_0.8.6/contracts/accountLayer/interfaces/ISymmio.sol}
 */
export interface SchnorrSign {
  /** Aggregated Schnorr signature scalar. */
  signature: bigint;
  /** Signer (gateway) address. */
  owner: Address;
  /** Muon nonce address (an `address`, not a numeric nonce). */
  nonce: Address;
}

/**
 * A Muon uPnL attestation, mirrored from the on-chain `ISymmio.SingleUpnlSig`
 * struct field-for-field (same order) so the object encodes directly as the
 * contract tuple without translation.
 *
 * @remarks
 * This is what {@link removeMargin} requires as its `upnlSig` argument: the
 * contract verifies it to prove the virtual account stays solvent after the
 * deallocation. Fetch a fresh one from the Muon service immediately before
 * submitting — the attestation is timestamped and short-lived. Note there is
 * **no** `price` field (this is the uPnL-only sig, not `SingleUpnlAndPriceSig`).
 *
 * @see {@link https://github.com/SYMM-IO/perps-core/blob/version_0.8.6/contracts/accountLayer/interfaces/ISymmio.sol}
 */
export interface SingleUpnlSig {
  /** Muon request id (opaque bytes). */
  reqId: Hex;
  /** Attestation timestamp (seconds). */
  timestamp: bigint;
  /** Signed unrealized PnL of the party, `int256` (may be negative). */
  upnl: bigint;
  /** Muon gateway signature over the request (opaque bytes). */
  gatewaySignature: Hex;
  /** The Schnorr TSS signature pieces. */
  sigs: SchnorrSign;
}

/**
 * Strategy the AccountLayer uses to create Virtual Accounts (VAs) for trades
 * placed through this subaccount.
 *
 * @remarks
 * Names and ordering mirror the on-chain `enum SubAccountIsolationType` in
 * `AccountStorage.sol` (perps-core v0.8.6) exactly, so a `uint8` returned by
 * `getUserSubAccounts` casts directly to this enum without translation.
 *
 * @see {@link https://github.com/SYMM-IO/perps-core/blob/version_0.8.6/contracts/accountLayer/storages/AccountStorage.sol}
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

/**
 * Raw balance fields returned by `balanceInfoOfPartyA(account)` on a SYMMIO
 * core/diamond contract.
 *
 * Values are returned in the collateral token's raw units.
 */
export interface AccountBalanceInfo {
  /** Total allocated balance. */
  allocatedBalance: bigint;
  /** Locked CVA margin. */
  lockedCVA: bigint;
  /** Locked LF margin. */
  lockedLF: bigint;
  /** Locked PartyA maintenance margin. */
  lockedPartyAMM: bigint;
  /** Locked PartyB maintenance margin. */
  lockedPartyBMM: bigint;
  /** Pending locked CVA margin. */
  pendingLockedCVA: bigint;
  /** Pending locked LF margin. */
  pendingLockedLF: bigint;
  /** Pending locked PartyA maintenance margin. */
  pendingLockedPartyAMM: bigint;
  /** Pending locked PartyB maintenance margin. */
  pendingLockedPartyBMM: bigint;
}

/**
 * Input parameters for creating one subaccount via `createSubAccounts`.
 *
 * Field shapes and ordering mirror the on-chain `SubAccountCreationData` struct
 * in `AccountStorage.sol` (perps-core v0.8.6) exactly, so the object encodes
 * directly as the contract tuple without translation.
 *
 * @see {@link https://github.com/SYMM-IO/perps-core/blob/version_0.8.6/contracts/accountLayer/storages/AccountStorage.sol}
 */
export interface SubAccountCreationData {
  /**
   * Display name for the subaccount. Validated on-chain to 1-100 characters.
   */
  name: string;
  /**
   * Free-form metadata blob forwarded to the affiliate's `onAccountCreation`
   * hook. Pass `0x` when unused.
   */
  metadata: Hex;
  /**
   * The Symmio core (diamond) the subaccount trades against. Must be whitelisted
   * on the AccountLayer and registered for `affiliate`.
   */
  symmioCore: Address;
  /**
   * Strategy the AccountLayer uses to create VAs for this subaccount's trades.
   */
  isolationType: SubAccountIsolationType;
  /**
   * Route successive same-market quotes into the existing active VA instead of
   * creating a fresh VA per `sendQuote`. Only valid with `MARKET` or
   * `MARKET_DIRECTION` isolation; the contract reverts otherwise.
   */
  singleVAMode: boolean;
}

/**
 * Lifecycle state of an affiliate on the `AccountLayer`.
 *
 * @remarks
 * Names and ordering mirror the on-chain `enum AffiliateState` in
 * `AffiliateStorage.sol` (perps-core v0.8.6) exactly, so a `uint8` returned by
 * `getAffiliateState` casts directly to this enum without translation.
 *
 * @see {@link https://github.com/SYMM-IO/perps-core/blob/version_0.8.6/contracts/accountLayer/storages/AffiliateStorage.sol}
 */
export enum AffiliateState {
  /** No registration exists for this address. */
  NONE = 0,
  /** A registration request has been submitted and is awaiting approval. */
  PENDING = 1,
  /** The affiliate has been approved and can attribute trades and collect fees. */
  ACTIVE = 2,
  /** The affiliate has been paused by an approver; trading attribution is halted. */
  PAUSED = 3,
}

/**
 * A single fee recipient within an affiliate registration, mirrored from the
 * on-chain `Stakeholder` struct field-for-field (same order).
 *
 * @remarks
 * `share` is scaled to `1e18`; the sum of every stakeholder's `share` plus the
 * registration's `symmioShare` must equal exactly `1e18` or the contract reverts.
 *
 * @see {@link https://github.com/SYMM-IO/perps-core/blob/version_0.8.6/contracts/accountLayer/storages/AffiliateStorage.sol}
 */
export interface Stakeholder {
  /** Address that receives this stakeholder's cut of affiliate fees. */
  receiver: Address;
  /** This stakeholder's fee share, scaled to `1e18` (e.g. `0.4e18` for 40%). */
  share: bigint;
}

/**
 * The `AffiliateRegistration` tuple passed to {@link requestToRegisterAffiliate},
 * mirrored from the on-chain struct field-for-field (same order) so the object
 * encodes directly as the contract tuple without translation.
 *
 * @remarks
 * The returned affiliate address is a **new, deterministic** `AccountManager`
 * contract derived from `(msg.sender, name)` — not the caller's EOA. Predict it
 * ahead of time with {@link generateAccountManagerAddress}. Registration only
 * creates a `PENDING` affiliate; an `APPROVER_ROLE` holder must approve it before
 * it becomes `ACTIVE`.
 *
 * @see {@link https://github.com/SYMM-IO/perps-core/blob/version_0.8.6/contracts/accountLayer/storages/AffiliateStorage.sol}
 */
export interface AffiliateRegistration {
  /** Display name for the affiliate. Validated on-chain to 1..maxNameLength characters. */
  name: string;
  /** UI brand color for the affiliate (free-form string, e.g. a hex color). */
  brandColor: string;
  /** The affiliate admin address. Must be non-zero; controls the affiliate after approval. */
  admin: Address;
  /** Fee recipients and their shares. Shares plus `symmioShare` must sum to `1e18`. */
  stakeholders: Stakeholder[];
  /** The Symmio protocol's fee share, scaled to `1e18`. With `stakeholders` shares, sums to `1e18`. */
  symmioShare: bigint;
  /** Free-form metadata blob. Pass `0x` when unused. */
  metadata: Hex;
  /** Legacy `MultiAccount` contracts to migrate into this affiliate. Pass `[]` when none. */
  legacyMultiAccounts: Address[];
  /** Symmio core (diamond) addresses to register the affiliate on. Each must be whitelisted. */
  symmioCores: Address[];
}
