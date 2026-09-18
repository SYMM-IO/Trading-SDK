import type { Address, Hash, Hex } from "viem";
import type { GaslessWriteParameter, WriteContractParameter } from "../shared/types/properties";
import type { SingleUpnlSig, SubAccountIsolationType } from "../symmio-contracts/account-layer/types";
import type { WithdrawReceiverPart } from "../symmio-contracts/symmio/types";

/** Numeric option identifiers used by the Express service and provider contract. */
export const EXPRESS_WITHDRAW_OPTION_TYPE = {
  SAME_TX: 0,
  WINDOWED: 1,
  STANDARD: 2,
} as const;

/** Human-readable option names returned by the Express service. */
export type ExpressWithdrawOptionName = keyof typeof EXPRESS_WITHDRAW_OPTION_TYPE;

/** Numeric Express option type returned by the service. */
export type ExpressWithdrawOptionType = (typeof EXPRESS_WITHDRAW_OPTION_TYPE)[ExpressWithdrawOptionName];

/** A normalized signed Express Withdraw option. Token quantities use collateral base units. */
export interface ExpressWithdrawOption {
  /** Numeric option type used by the provider contract. */
  optionType: ExpressWithdrawOptionType;
  /** Human-readable option type. */
  optionTypeName: ExpressWithdrawOptionName;
  /** Service offer nonce. */
  nonce: bigint;
  /** Affiliate bound into the signed offer. */
  affiliate: Address;
  /** Amount paid through the Express provider. */
  expressAmount: bigint;
  /** Amount paid through the general withdrawal path. */
  generalAmount: bigint;
  /** Amount attributed to affiliate liquidity. */
  affiliateAmount: bigint;
  /** Amount funded through provider credit. */
  creditAmount: bigint;
  /** Affiliate acceleration fee. */
  fee: bigint;
  /** Fixed provider operator fee. */
  operatorFee: bigint;
  /** Maximum total fee authorized by the user. */
  maxUserFee: bigint;
  /** Amount covered by a sponsor. */
  sponsorCoverage: bigint;
  /** Receiver parts signed by the service and submitted unchanged on-chain. */
  parts: readonly WithdrawReceiverPart[];
  /** Keccak hash of the ABI-encoded receiver parts. */
  partsHash: Hex;
  /** Provider offer signature. */
  signature: Hex;
  /** Complete provider callback payload passed to `initiateWithdraw`. */
  providerData: Hex;
  /** Unix timestamp, in seconds, after which the option must not be used. */
  deadline: number;
  /** Service estimate for receiver payout, in seconds. */
  estimatedTimeSeconds: number;
  /** Whether validator approval is required for the option. */
  requiresValidators: boolean;
  /** Minimum validator signatures required by the provider. */
  minValidatorSignatures: number;
  /** ABI-encoded credit data carried by the signed option. */
  creditDataRaw: Hex;
  /** Optional validator signatures returned by the service. */
  validatorSignatures?: readonly Hex[];
  /** Optional validator approval timestamps. */
  validatorTimestamps?: readonly number[];
  /** Optional SYMMIO nonce observed when the offer was produced. */
  symmioNonce?: bigint;
  /** Whether a STANDARD option may later be accelerated. */
  accelerateCandidate?: boolean;
  /** Desired credit amount used during service capacity calculation. */
  desiredCreditAmount?: bigint;
  /** Human-readable capacity decision returned by the service. */
  creditCapacityReason?: string;
  /** Service database id associated with this option request. */
  requestDbId: number;
}

/** Normalized result of requesting signed withdrawal options. */
export interface ExpressWithdrawOptions {
  /** Non-expired options in service order. */
  options: readonly ExpressWithdrawOption[];
  /** Database id for the overall options request. */
  requestDbId: number;
  /** Per-option database ids keyed by service option name. */
  requestDbIds: Readonly<Record<string, number>>;
}

/** Express provider lifecycle states stored on-chain. */
export type ExpressWithdrawOnChainStatus =
  | "NONE"
  | "ACCEPTED"
  | "LOCKED"
  | "PROCESSED"
  | "FINALIZED"
  | "CANCELLED"
  | "SUSPENDED";

/** Express service-local processing states. */
export type ExpressWithdrawLocalStatus =
  | "PENDING_SIGN"
  | "ACCEPTED"
  | "LOCKED"
  | "PROCESSED"
  | "FINALIZED"
  | "CANCELLED"
  | "SUSPENDED"
  | "FAILED"
  | "NOT_FOUND";

/** Service and on-chain progress for one Express withdrawal request. */
export interface ExpressWithdrawStatus {
  /** Optional service result code. */
  code?: string;
  /** Canonical state read from the ExpressProvider contract. */
  onChain: {
    status: ExpressWithdrawOnChainStatus;
    optionType: ExpressWithdrawOptionName;
    expressAmount: bigint;
    acceptedAt: number;
    finalizedAt: number;
    cooldownEndTime: number;
    maxAccelerationFee?: bigint;
    accelerationFee?: bigint;
  };
  /** Service-side indexing and transaction state. */
  local: {
    status: ExpressWithdrawLocalStatus;
    riskScore: number | null;
    riskChecked: boolean;
    lockTxHash: Hex | null;
    processTxHash: Hex | null;
    finalizeTxHash: Hex | null;
  };
}

/** Automatic service-option selection and fallback policy. */
export interface ExpressWithdrawRoutePolicy {
  /** Ordered acceptable options. Defaults to `SAME_TX`, then `STANDARD`. */
  optionPriority?: readonly ExpressWithdrawOptionName[];
  /** Behavior when the service cannot supply an option. Defaults to `classic`. */
  fallback?: "classic" | "error";
}

/** A prepared withdrawal route that can be displayed and submitted unchanged. */
export type WithdrawRoute =
  | {
      kind: "classic";
      finalize: "immediate" | "after-cooldown";
      reason: "cooldown-ready" | "service-disabled" | "service-error" | "no-option" | "unsupported-account";
    }
  | { kind: "express"; option: ExpressWithdrawOption };

/** Parameters for requesting signed Express withdrawal options. */
export interface GetExpressWithdrawOptionsParameters {
  /** Subaccount that owns the available collateral. */
  user: Address;
  /** Withdrawal amount in collateral base units. */
  amount: bigint;
  /** Same-chain EVM receiver. */
  receiver: Address;
  /** Affiliate override; defaults to the chain configuration. */
  affiliate?: Address;
  /** Target chain; defaults to the config's default chain. */
  chainId?: number;
  /** Abort the HTTP request. */
  signal?: AbortSignal;
}

/** Parameters for reading an Express withdrawal status. */
export interface GetExpressWithdrawStatusParameters {
  /** Subaccount used to initiate the request. */
  user: Address;
  /** Per-user withdrawal request id. */
  requestId: bigint;
  /** Target chain; defaults to the config's default chain. */
  chainId?: number;
  /** Abort the HTTP request. */
  signal?: AbortSignal;
}

/** Parameters for selecting a withdrawal route without writing. */
export interface GetWithdrawRouteParameters extends GetExpressWithdrawOptionsParameters {
  /** Known isolation type; omit to let the action read it. */
  isolationType?: SubAccountIsolationType;
  /** Option ordering and failure behavior. */
  policy?: ExpressWithdrawRoutePolicy;
}

/** Parameters for directly submitting a signed Express option. */
export type SubmitExpressWithdrawOptionParameters = WriteContractParameter &
  GaslessWriteParameter & {
    /** Subaccount that requested the option. */
    account: Address;
    /** Original requested amount in collateral base units. */
    amount: bigint;
    /** Original same-chain receiver. */
    receiver: Address;
    /** Signed option returned by the configured service. */
    option: ExpressWithdrawOption;
  };

/** Parameters for the Express-aware high-level withdrawal action. */
export type WithdrawWithExpressParameters = WriteContractParameter &
  GaslessWriteParameter & {
    /** Subaccount to withdraw from. */
    account: Address;
    /** Withdrawal amount in collateral base units. */
    amount: bigint;
    /** Same-chain receiver. */
    receiver: Address;
    /** Known isolation type; omit to let the action read it. */
    isolationType?: SubAccountIsolationType;
    /** Optional pre-fetched Muon signature for a classic CUSTOM withdrawal. */
    upnlSig?: SingleUpnlSig;
    /** Option selection and service-failure behavior. */
    policy?: ExpressWithdrawRoutePolicy;
    /** Submit a previously displayed route instead of requesting a new one. */
    preparedRoute?: WithdrawRoute;
  };

/** Result of an Express-aware withdrawal submission. */
export interface WithdrawWithExpressReturnType {
  /** Submitted transaction hash. */
  hash: Hash;
  /** Exact route used for the transaction. */
  route: WithdrawRoute;
}
