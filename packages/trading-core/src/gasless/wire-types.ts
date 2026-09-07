/**
 * Hand-written wire types for the GaslessQ HTTP APIs.
 *
 * TODO(gasless-orval): the service serves a public OpenAPI document at
 * `{base}/openapi.json`, so these could be orval-generated like the other
 * HTTP slices. They are hand-written for now because the spec is served
 * per-instance from a live deployment (no checked-in artifact to generate
 * from) and the surface is small. Field shapes were verified against the
 * production instance's spec on 2026-09-04.
 *
 * Requests are camelCase, responses snake_case (service convention). Raw
 * amounts are decimal strings; `nonce` / `deadline` / `maxUses` / flex-field
 * offsets are JSON **numbers** (the service schema requires integers, not
 * strings). Request models reject unknown fields — never add extras.
 */

/** Wire shape of `signerAccount` inside a relayed operation. */
export interface GaslessWireAccount {
  addr: string;
  isPartyB: boolean;
}

/** Wire shape of a flex field inside a relayed operation. */
export interface GaslessWireFlexField {
  offset: number;
  length: number;
  authorizedFlexFiller: string;
}

/** Wire shape of the replay-protection header inside a relayed operation. */
export interface GaslessWireReplayAttackHeader {
  nonce: number;
  deadline: number;
  salt: string;
}

/**
 * Wire shape of one signed InstantLayer operation in a `relay-instant` body.
 * Matches the service's `InstantSignedOperation` schema: `flexFields` and
 * `maxUses` are optional on the wire (`maxUses` defaults to `1`).
 */
export interface GaslessWireSignedOperation {
  signer: string;
  target: string;
  callData: string;
  signerAccount: GaslessWireAccount;
  flexFields?: GaslessWireFlexField[];
  maxUses?: number;
  replayAttackHeader: GaslessWireReplayAttackHeader;
}

/** Wire body of `POST {operationBase}/gateway/relay-instant`. */
export interface GaslessWireRelayInstantRequest {
  idempotencyKey?: string;
  userAddress: string;
  accountId?: string;
  operationType: string;
  templateId?: number | null;
  signedOps: GaslessWireSignedOperation[];
  signatures: string[];
  fills?: string[][];
  flexFillerSignatures?: string[][];
  metadata?: Record<string, unknown>;
}

/** Wire shape of the operations 202 acceptance (`OperationAcceptedResponse`). */
export interface GaslessWireOperationAccepted {
  request_id: string;
  status: string;
  paid_fee: string;
  remaining_fee_allowance: string;
}

/**
 * Wire shape of a stored operation record (`OperationStatusResponse`).
 * The operations service keys the record `id`; the deposits service keys its
 * record `request_id` — {@link GaslessWireDepositRecord}.
 */
export interface GaslessWireOperationRecord {
  id: string;
  idempotency_key?: string | null;
  user_address: string;
  account_id?: string | null;
  operation_type: string;
  payload: Record<string, unknown>;
  status: string;
  fee_amount_raw?: string | null;
  tx_hash?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

/** Wire body of a deposit settlement submit (new account). */
export interface GaslessWireNewAccountSettlementRequest {
  idempotencyKey?: string;
  wallet: string;
  affiliate: string;
  accountData: {
    name: string;
    metadata?: string;
    isolationType?: number;
    singleVAMode?: boolean;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Wire body of a deposit settlement submit (existing account). The service
 * model rejects unknown fields and carries no `metadata` slot.
 */
export interface GaslessWireExistingAccountSettlementRequest {
  idempotencyKey?: string;
  wallet: string;
  subAccount: string;
}

/** Wire shape of the deposits 202 acceptance (`DepositSettlementAcceptedResponse`). */
export interface GaslessWireDepositAccepted {
  request_id: string;
  status: string;
  deposit_address: string;
  observed_amount: string;
  paid_fee: string;
  credited_amount: string;
}

/** Wire shape of a stored deposit settlement record (`DepositSettlementRecord`). */
export interface GaslessWireDepositRecord {
  request_id: string;
  idempotency_key?: string | null;
  wallet_address: string;
  deposit_address: string;
  account_name?: string | null;
  amount_raw?: string | null;
  fee_raw?: string | null;
  credited_raw?: string | null;
  payload: Record<string, unknown>;
  status: string;
  tx_hash?: string | null;
  error_code?: string | null;
  error_message?: string | null;
}

/** Wire shape of one EVM broadcast attempt (`TransactionAttemptRecord`). */
export interface GaslessWireTransactionAttempt {
  id: string;
  workflow: string;
  entity_id: string;
  tx_hash?: string | null;
  attempt_number: number;
  status: string;
  receipt?: Record<string, unknown> | null;
  error_code?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

/** Union of the two status-record wire shapes a poll can return. */
export type GaslessWireRequestRecord = GaslessWireOperationRecord | GaslessWireDepositRecord;
