import type { Address, Hash } from "viem";
import { SymmError } from "../../shared/errors/symm-error";
import {
  GaslessRequestStatus,
  type GaslessDepositRequest,
  type GaslessOperationRequest,
  type GaslessRequest,
} from "../types";
import { parseGaslessWalletId } from "../wallet-id";
import { toGaslessOptionalAmount } from "../wire-parse";
import type { GaslessWireDepositRecord, GaslessWireOperationRecord, GaslessWireRequestRecord } from "../wire-types";

const STATUS_VALUES = new Set<string>(Object.values(GaslessRequestStatus));

/**
 * Parse a wire status string into {@link GaslessRequestStatus}.
 *
 * @throws {SymmError} `GASLESS_STATUS_UNKNOWN` for a value outside the
 *   documented lifecycle — better a loud failure than a silent non-terminal
 *   status that polls forever.
 *
 * @internal
 */
export function toGaslessRequestStatus(raw: string): GaslessRequestStatus {
  if (!STATUS_VALUES.has(raw)) {
    throw new SymmError("api", "GASLESS_STATUS_UNKNOWN", `Gasless: unknown request status "${raw}".`);
  }
  return raw as GaslessRequestStatus;
}

/** The stored JSON payload of a record, as far as wallet ids are concerned. */
interface WalletIdPayload {
  wallet_ids?: unknown;
  wallet_id?: unknown;
  signed_ops?: unknown;
}

/**
 * The wallet ids a stored operation record selected.
 *
 * Records written before multiple wallets existed carry no ids at all, and an
 * omitted id means wallet `0` — so they normalize to one zero per stored
 * operation rather than to an empty array, which would read as "no wallets".
 *
 * @internal
 */
function toOperationWalletIds(payload: WalletIdPayload): bigint[] {
  if (Array.isArray(payload.wallet_ids)) {
    return payload.wallet_ids.map((value, index) => parseGaslessWalletId(value, `payload.wallet_ids[${index}]`));
  }
  const operationCount = Array.isArray(payload.signed_ops) ? payload.signed_ops.length : 0;
  return Array.from({ length: operationCount }, () => 0n);
}

/** Normalize a stored operations record. @internal */
function toGaslessOperationRequest(raw: GaslessWireOperationRecord): GaslessOperationRequest {
  return {
    service: "operations",
    requestId: raw.id,
    status: toGaslessRequestStatus(raw.status),
    txHash: (raw.tx_hash as Hash | undefined) ?? null,
    errorCode: raw.error_code ?? null,
    errorMessage: raw.error_message ?? null,
    idempotencyKey: raw.idempotency_key ?? null,
    owner: (raw.user_address as Address | undefined) ?? null,
    walletIds: toOperationWalletIds((raw.payload ?? {}) as WalletIdPayload),
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
    operationType: raw.operation_type ?? null,
    accountId: raw.account_id ?? null,
    feeAmountRaw: toGaslessOptionalAmount(raw.fee_amount_raw),
  };
}

/** Normalize a stored deposits record. @internal */
function toGaslessDepositRequest(raw: GaslessWireDepositRecord): GaslessDepositRequest {
  const payload = (raw.payload ?? {}) as WalletIdPayload;
  const storedWalletId = raw.wallet_id ?? payload.wallet_id;
  const walletId =
    storedWalletId === undefined || storedWalletId === null ? 0n : parseGaslessWalletId(storedWalletId, "wallet_id");

  return {
    service: "deposits",
    requestId: raw.request_id,
    status: toGaslessRequestStatus(raw.status),
    txHash: (raw.tx_hash as Hash | undefined) ?? null,
    errorCode: raw.error_code ?? null,
    errorMessage: raw.error_message ?? null,
    idempotencyKey: raw.idempotency_key ?? null,
    /** `wallet_address` is the owner address, not a GaslessWallet address. */
    owner: (raw.wallet_address as Address | undefined) ?? null,
    walletIds: [walletId],
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
    depositAddress: (raw.deposit_address as Address | undefined) ?? null,
    walletId,
    accountName: raw.account_name ?? null,
    amountRaw: toGaslessOptionalAmount(raw.amount_raw),
    feeRaw: toGaslessOptionalAmount(raw.fee_raw),
    creditedRaw: toGaslessOptionalAmount(raw.credited_raw),
  };
}

/**
 * Normalize a stored request record (operations or deposits shape) into the
 * {@link GaslessRequest} union.
 *
 * The two services are separate databases with different columns, so the shape
 * itself picks the variant: a deposits record carries `deposit_address` and
 * keys its id `request_id`, while an operations record keys its id `id`.
 * Optional wire fields normalize to explicit `null` (absent, not zero), and
 * wallet ids to `bigint`s, with a missing id meaning wallet `0`.
 *
 * @internal
 */
export function toGaslessRequest(raw: GaslessWireRequestRecord): GaslessRequest {
  return "deposit_address" in raw
    ? toGaslessDepositRequest(raw as GaslessWireDepositRecord)
    : toGaslessOperationRequest(raw as GaslessWireOperationRecord);
}
