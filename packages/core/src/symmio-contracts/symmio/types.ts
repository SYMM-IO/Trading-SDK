import type { Address, Hex } from "viem";

/**
 * Lifecycle status of a SYMMIO withdraw request.
 *
 * @remarks
 * Names and ordering mirror the on-chain `enum WithdrawStatus` in
 * `WithdrawStorage.sol` (perps-core v0.8.5) exactly, so the `uint8` returned by
 * the withdraw read views casts directly to this enum without translation.
 *
 * @see {@link https://github.com/SYMM-IO/perps-core/blob/version_0.8.5/contracts/core/storages/WithdrawStorage.sol}
 */
export enum WithdrawStatus {
  /** Created, awaiting provider acceptance (classic withdrawals stay here until finalized). */
  PENDING = 0,
  /** A provider accepted the request. */
  PROVIDER_ACCEPTED = 1,
  /** A provider declined the request; it was refunded. */
  PROVIDER_REJECTED = 2,
  /** Finalized successfully; funds were paid out. */
  COMPLETED = 3,
  /** The user requested cancellation; awaiting provider approval. */
  CANCEL_REQUESTED = 4,
  /** Fully cancelled and refunded. */
  CANCELLED = 5,
  /** Suspended due to a user-level restriction. */
  SUSPENDED = 6,
}

/**
 * One receiver "part" of a withdraw request. A single request may split its
 * amount across several parts (different chains/providers); a plain same-chain
 * withdrawal is a single part with both provider fields set to the zero address.
 *
 * Field shapes and ordering mirror the on-chain `WithdrawReceiverPart` struct in
 * `WithdrawStorage.sol` (perps-core v0.8.5) exactly, so the object encodes
 * directly as the contract tuple without translation.
 *
 * @see {@link https://github.com/SYMM-IO/perps-core/blob/version_0.8.5/contracts/core/storages/WithdrawStorage.sol}
 */
export interface WithdrawReceiverPart {
  /** Caller-assigned part id, unique within the request. */
  id: bigint;
  /** Amount of collateral for this part, in the collateral token's smallest unit. */
  amount: bigint;
  /** Destination chain id (`int256` on-chain; the source chain for a same-chain part). */
  chainId: bigint;
  /** Destination address as raw bytes (a 20-byte EVM address is its own byte representation). */
  receiver: Hex;
  /** Virtual (cross-chain) provider, or the zero address for a same-chain part. */
  virtualProvider: Address;
  /** Express (instant) provider, or the zero address for a standard-cooldown part. */
  expressProvider: Address;
}

/**
 * A full withdraw request as stored on the SYMMIO core, returned by the withdraw
 * read views ({@link "getWithdrawRequests"}, {@link "getPendingWithdrawRequests"}).
 *
 * Field shapes and ordering mirror the on-chain `WithdrawRequest` struct in
 * `WithdrawStorage.sol` (perps-core v0.8.5) exactly. `status` is surfaced as the
 * {@link WithdrawStatus} enum rather than a raw `uint8`.
 *
 * @see {@link https://github.com/SYMM-IO/perps-core/blob/version_0.8.5/contracts/core/storages/WithdrawStorage.sol}
 */
export interface WithdrawRequest {
  /** Sequential request id (starts at 1 per user). */
  id: bigint;
  /** The subaccount the request belongs to. */
  user: Address;
  /** The receiver parts the withdrawal is split into. */
  parts: readonly WithdrawReceiverPart[];
  /** Block timestamp at which the request was created. */
  timestamp: bigint;
  /** Earliest timestamp the request can be finalized. */
  cooldownEndTime: bigint;
  /** Current lifecycle status. */
  status: WithdrawStatus;
  /** Whether the request opted into the cooldown speed-up flow. */
  speedUp: boolean;
  /** Whether the cooldown was modified after creation (e.g. by an accepted speed-up). */
  isCooldownModified: boolean;
  /** The provider bound to the request, or the zero address for a classic withdrawal. */
  provider: Address;
  /** Whether the request is a pure-virtual (cross-chain, no express) withdrawal. */
  isPureVirtual: boolean;
  /** Opaque provider data (e.g. a signed option), or `0x`. */
  providerData: Hex;
  /** Total collateral amount across all parts. */
  totalAmount: bigint;
  /** Total amount delivered via virtual providers. */
  totalVirtualAmount: bigint;
}
