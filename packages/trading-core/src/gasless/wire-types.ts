/**
 * Wire types for the GaslessQ HTTP APIs.
 *
 * Each type aliases a model that orval generates from the instance OpenAPI
 * documents, which are the vendor's schema of record. The models live in
 * `types/generated/` and come from the `gaslessOperations` and
 * `gaslessDeposits` projects in `orval.config.ts`. To change a shape,
 * regenerate; do not edit it here. A type stays hand-written only where the
 * body the SDK actually sends differs from the schema, and the reason is on
 * that type. Everything here is internal: neither these aliases nor the
 * generated models are exported from the package root.
 *
 * Service conventions:
 * - Requests are camelCase and responses are snake_case.
 * - Request models reject unknown top-level fields, so never add extras.
 * - Raw token, fee, allowance and balance amounts are decimal strings.
 * - Wallet IDs are decimal `uint256` strings, never JSON numbers. Outbound,
 *   they are `walletIds` (one per `signedOps` entry) on relay submits and
 *   `walletId` on deposit settlements; encode them with
 *   `toGaslessWalletIdWire`. The SDK always sends them explicitly, including
 *   the zeros: the service's zero-filling default exists for legacy clients,
 *   and relying on it would make a dropped ID indistinguishable from a
 *   deliberate wallet `0`. Inbound, they are `wallet_id` on deposit responses
 *   and `payload.wallet_ids` on stored operation records; parse them with
 *   `parseGaslessWalletId`, and treat a missing ID as wallet `0`.
 * - `replayAttackHeader.nonce` and `deadline`, `maxUses`, and the flex-field
 *   `offset` and `length` are schema integers. The SDK sends them as JSON
 *   numbers, and every `bigint` it puts there goes through
 *   `toGaslessSafeNumber`, which refuses values outside the safe-integer
 *   range. `templateId` is a schema integer too (minimum 0), but
 *   `relayInstantOperations` forwards the caller's `number` as-is, without
 *   that guard. The vendor guide says the API also accepts
 *   `replayAttackHeader.nonce` and `deadline` as decimal strings, but numbers
 *   are valid under both the guide and the schema.
 */
import type {
  DepositSettlementAcceptedResponse,
  DepositSettlementExistingAccountRequest,
  DepositSettlementNewAccountRequest,
  DepositSettlementRecord,
  SubAccountCreationDataModel,
} from "./types/generated/gasless-deposits";
import type {
  FlexField,
  InstantAccount,
  InstantSignedOperation,
  OperationAcceptedResponse,
  OperationStatusResponse,
  ReplayAttackHeader,
  SignedOperationRequest,
  TransactionAttemptRecord,
} from "./types/generated/gasless-operations";

/** Wire shape of `signerAccount` inside a relayed operation (`InstantAccount`). */
export type GaslessWireAccount = InstantAccount;

/** Wire shape of a flex field inside a relayed operation (`FlexField`). */
export type GaslessWireFlexField = FlexField;

/** Wire shape of the replay-protection header inside a relayed operation (`ReplayAttackHeader`). */
export type GaslessWireReplayAttackHeader = ReplayAttackHeader;

/**
 * Wire shape of one signed InstantLayer operation in a `relay-instant` body
 * (`InstantSignedOperation`). `flexFields` and `maxUses` are optional on the
 * wire, and `maxUses` defaults to `1`.
 */
export type GaslessWireSignedOperation = InstantSignedOperation;

/**
 * Wire body of `POST {operationBase}/gateway/relay-instant`
 * (`SignedOperationRequest`). When `walletIds` is omitted, the service
 * supplies one `"0"` per operation. An explicit empty or mismatched array is
 * rejected, and templates require all zeros.
 */
export type GaslessWireRelayInstantRequest = SignedOperationRequest;

/** Wire shape of the operations 202 acceptance (`OperationAcceptedResponse`). */
export type GaslessWireOperationAccepted = OperationAcceptedResponse;

/**
 * Wire shape of a stored operation record (`OperationStatusResponse`).
 * The operations service keys the record `id`; the deposits service keys its
 * record `request_id` — {@link GaslessWireDepositRecord}. There is no
 * top-level wallet field: the selected IDs live in `payload.wallet_ids`.
 */
export type GaslessWireOperationRecord = OperationStatusResponse;

/**
 * Wire body of a deposit settlement submit (new account)
 * (`DepositSettlementNewAccountRequest`), with one widening:
 * `accountData.isolationType` carries the SDK's `SubAccountIsolationType`,
 * which TypeScript does not accept where the generated enum of the same name
 * is expected even though the values match, so the field is typed as the
 * `number` the schema serializes.
 *
 * The SDK always sends `owner` and an explicit `walletId`; the legacy `wallet`
 * alias is not sent.
 */
export type GaslessWireNewAccountSettlementRequest = Omit<DepositSettlementNewAccountRequest, "accountData"> & {
  accountData: Omit<SubAccountCreationDataModel, "isolationType"> & { isolationType?: number };
};

/**
 * Wire body of a deposit settlement submit (existing account)
 * (`DepositSettlementExistingAccountRequest`). The service model rejects
 * unknown fields and carries no `metadata` slot.
 */
export type GaslessWireExistingAccountSettlementRequest = DepositSettlementExistingAccountRequest;

/**
 * Wire shape of the deposits 202 acceptance
 * (`DepositSettlementAcceptedResponse`). `wallet_id` is the settled wallet's
 * decimal ID; the schema defaults it to `"0"`.
 */
export type GaslessWireDepositAccepted = DepositSettlementAcceptedResponse;

/**
 * Wire shape of a stored deposit settlement record (`DepositSettlementRecord`).
 * `wallet_address` still means the owner address, and `wallet_id` selects
 * the owner's wallet. Older stored rows may lack `wallet_id`, which means
 * wallet `0`.
 */
export type GaslessWireDepositRecord = DepositSettlementRecord;

/**
 * Wire shape of one EVM broadcast attempt (`TransactionAttemptRecord`). Both
 * services serve the identical schema; the alias uses the operations copy.
 */
export type GaslessWireTransactionAttempt = TransactionAttemptRecord;

/** Union of the two status-record wire shapes a poll can return. */
export type GaslessWireRequestRecord = GaslessWireOperationRecord | GaslessWireDepositRecord;
