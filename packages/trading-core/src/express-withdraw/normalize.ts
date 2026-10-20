import { isAddress, isHex } from "viem";
import { SymmError } from "../shared/errors/symm-error";
import {
  EXPRESS_WITHDRAW_OPTION_TYPE,
  type ExpressWithdrawLocalStatus,
  type ExpressWithdrawOnChainStatus,
  type ExpressWithdrawOption,
  type ExpressWithdrawOptionName,
  type ExpressWithdrawOptions,
  type ExpressWithdrawStatus,
} from "./types";
import type { ExpressWithdrawOptionWire, ExpressWithdrawOptionsWire, ExpressWithdrawStatusWire } from "./wire";

const OPTION_NAMES = new Set<ExpressWithdrawOptionName>(["SAME_TX", "WINDOWED", "STANDARD"]);
const ON_CHAIN_STATUSES = new Set<ExpressWithdrawOnChainStatus>([
  "NONE",
  "ACCEPTED",
  "LOCKED",
  "PROCESSED",
  "FINALIZED",
  "CANCELLED",
  "SUSPENDED",
]);
const LOCAL_STATUSES = new Set<ExpressWithdrawLocalStatus>([
  "PENDING_SIGN",
  "ACCEPTED",
  "LOCKED",
  "PROCESSED",
  "FINALIZED",
  "CANCELLED",
  "SUSPENDED",
  "FAILED",
  "NOT_FOUND",
]);

function invalid(field: string): never {
  throw new SymmError("api", "EXPRESS_WITHDRAW_INVALID_RESPONSE", `Express Withdraw returned an invalid ${field}.`);
}

function asBigInt(value: unknown, field: string): bigint {
  if ((typeof value !== "string" && typeof value !== "number") || value === "") invalid(field);
  if (typeof value === "number" && !Number.isSafeInteger(value)) invalid(field);
  try {
    return BigInt(value);
  } catch {
    return invalid(field);
  }
}

function asNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) invalid(field);
  return value;
}

function asInteger(value: unknown, field: string): number {
  const number = asNumber(value, field);
  if (!Number.isSafeInteger(number)) invalid(field);
  return number;
}

function asBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") invalid(field);
  return value;
}

function asNullableNumber(value: unknown, field: string): number | null {
  if (value === null) return null;
  return asNumber(value, field);
}

function asNumberRecord(value: unknown, field: string): Readonly<Record<string, number>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(field);
  return Object.fromEntries(
    Object.entries(value).map(([key, recordValue]) => [key, asInteger(recordValue, `${field}.${key}`)]),
  );
}

function asAddress(value: unknown, field: string) {
  if (typeof value !== "string" || !isAddress(value)) invalid(field);
  return value;
}

function asHex(value: unknown, field: string) {
  if (typeof value !== "string" || !isHex(value)) invalid(field);
  return value;
}

function asOptionName(value: unknown, field: string): ExpressWithdrawOptionName {
  if (typeof value !== "string" || !OPTION_NAMES.has(value as ExpressWithdrawOptionName)) invalid(field);
  return value as ExpressWithdrawOptionName;
}

function normalizeOption(option: ExpressWithdrawOptionWire): ExpressWithdrawOption {
  if (!option || typeof option !== "object") invalid("option");
  const optionTypeName = asOptionName(option.optionTypeName, "optionTypeName");
  const expectedType = EXPRESS_WITHDRAW_OPTION_TYPE[optionTypeName];
  if (option.optionType !== expectedType) invalid("optionType/optionTypeName pairing");
  if (!Array.isArray(option.parts) || option.parts.length === 0) invalid("parts");

  return {
    optionType: expectedType,
    optionTypeName,
    nonce: asBigInt(option.nonce, "nonce"),
    affiliate: asAddress(option.affiliate, "affiliate"),
    expressAmount: asBigInt(option.expressAmount, "expressAmount"),
    generalAmount: asBigInt(option.generalAmount, "generalAmount"),
    affiliateAmount: asBigInt(option.affiliateAmount, "affiliateAmount"),
    creditAmount: asBigInt(option.creditAmount, "creditAmount"),
    fee: asBigInt(option.fee, "fee"),
    operatorFee: asBigInt(option.operatorFee, "operatorFee"),
    maxUserFee: asBigInt(option.maxUserFee, "maxUserFee"),
    sponsorCoverage: asBigInt(option.sponsorCoverage ?? "0", "sponsorCoverage"),
    parts: option.parts.map((part, index) => ({
      id: asBigInt(part.id, `parts[${index}].id`),
      amount: asBigInt(part.amount, `parts[${index}].amount`),
      chainId: asBigInt(part.chainId, `parts[${index}].chainId`),
      receiver: asAddress(part.receiver, `parts[${index}].receiver`),
      virtualProvider: asAddress(part.virtualProvider, `parts[${index}].virtualProvider`),
      expressProvider: asAddress(part.expressProvider, `parts[${index}].expressProvider`),
    })),
    partsHash: asHex(option.partsHash, "partsHash"),
    signature: asHex(option.signature, "signature"),
    providerData: asHex(option.providerData, "providerData"),
    deadline: asInteger(option.deadline, "deadline"),
    estimatedTimeSeconds: asInteger(option.estimatedTimeSeconds, "estimatedTimeSeconds"),
    requiresValidators: asBoolean(option.requiresValidators, "requiresValidators"),
    minValidatorSignatures: asInteger(option.minValidatorSignatures, "minValidatorSignatures"),
    creditDataRaw: asHex(option.creditDataRaw, "creditDataRaw"),
    ...(option.validatorSignatures === undefined
      ? {}
      : { validatorSignatures: option.validatorSignatures.map((value) => asHex(value, "validatorSignatures")) }),
    ...(option.validatorTimestamps === undefined
      ? {}
      : { validatorTimestamps: option.validatorTimestamps.map((value) => asInteger(value, "validatorTimestamps")) }),
    ...(option.symmioNonce === undefined ? {} : { symmioNonce: asBigInt(option.symmioNonce, "symmioNonce") }),
    ...(option.accelerateCandidate === undefined
      ? {}
      : { accelerateCandidate: asBoolean(option.accelerateCandidate, "accelerateCandidate") }),
    ...(option.desiredCreditAmount === undefined
      ? {}
      : { desiredCreditAmount: asBigInt(option.desiredCreditAmount, "desiredCreditAmount") }),
    ...(option.creditCapacityReason === undefined
      ? {}
      : typeof option.creditCapacityReason === "string"
        ? { creditCapacityReason: option.creditCapacityReason }
        : invalid("creditCapacityReason")),
    requestDbId: asInteger(option.requestDbId, "requestDbId"),
  };
}

/** Normalize and validate the service options wire response. @internal */
export function normalizeExpressWithdrawOptions(value: ExpressWithdrawOptionsWire): ExpressWithdrawOptions {
  if (!value || typeof value !== "object" || !Array.isArray(value.options)) invalid("options response");
  if (!value.requestDbIds || typeof value.requestDbIds !== "object") invalid("requestDbIds");
  return {
    options: value.options.map(normalizeOption),
    requestDbId: asInteger(value.requestDbId, "requestDbId"),
    requestDbIds: asNumberRecord(value.requestDbIds, "requestDbIds"),
  };
}

/** Normalize and validate the service status wire response. @internal */
export function normalizeExpressWithdrawStatus(value: ExpressWithdrawStatusWire): ExpressWithdrawStatus {
  if (!value || typeof value !== "object" || !value.onChain || !value.local) invalid("status response");
  if (!ON_CHAIN_STATUSES.has(value.onChain.status as ExpressWithdrawOnChainStatus)) invalid("onChain.status");
  if (!LOCAL_STATUSES.has(value.local.status as ExpressWithdrawLocalStatus)) invalid("local.status");

  return {
    ...(typeof value.code === "string" ? { code: value.code } : {}),
    onChain: {
      status: value.onChain.status as ExpressWithdrawOnChainStatus,
      optionType: asOptionName(value.onChain.optionType, "onChain.optionType"),
      expressAmount: asBigInt(value.onChain.expressAmount, "onChain.expressAmount"),
      acceptedAt: asInteger(value.onChain.acceptedAt, "onChain.acceptedAt"),
      finalizedAt: asInteger(value.onChain.finalizedAt, "onChain.finalizedAt"),
      cooldownEndTime: asInteger(value.onChain.cooldownEndTime, "onChain.cooldownEndTime"),
      ...(value.onChain.maxAccelerationFee === undefined
        ? {}
        : { maxAccelerationFee: asBigInt(value.onChain.maxAccelerationFee, "onChain.maxAccelerationFee") }),
      ...(value.onChain.accelerationFee === undefined
        ? {}
        : { accelerationFee: asBigInt(value.onChain.accelerationFee, "onChain.accelerationFee") }),
    },
    local: {
      status: value.local.status as ExpressWithdrawLocalStatus,
      riskScore: asNullableNumber(value.local.riskScore, "local.riskScore"),
      riskChecked: asBoolean(value.local.riskChecked, "local.riskChecked"),
      lockTxHash: value.local.lockTxHash === null ? null : asHex(value.local.lockTxHash, "local.lockTxHash"),
      processTxHash:
        value.local.processTxHash === null ? null : asHex(value.local.processTxHash, "local.processTxHash"),
      finalizeTxHash:
        value.local.finalizeTxHash === null ? null : asHex(value.local.finalizeTxHash, "local.finalizeTxHash"),
    },
  };
}
