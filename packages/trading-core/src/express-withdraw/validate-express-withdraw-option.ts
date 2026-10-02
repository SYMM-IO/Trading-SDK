import { decodeAbiParameters, encodeAbiParameters, isAddressEqual, keccak256, zeroAddress, type Address } from "viem";
import { SymmError } from "../shared/errors/symm-error";
import { isExpressWithdrawOptionExpired } from "./is-express-withdraw-option-expired";
import { EXPRESS_WITHDRAW_OPTION_TYPE, type ExpressWithdrawOption } from "./types";

const WITHDRAW_PARTS_PARAMETER = [
  {
    type: "tuple[]",
    components: [
      { name: "id", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "chainId", type: "int256" },
      { name: "receiver", type: "bytes" },
      { name: "virtualProvider", type: "address" },
      { name: "expressProvider", type: "address" },
    ],
  },
] as const;

const PROVIDER_DATA_PARAMETERS = [{ type: "bytes" }, { type: "bytes" }, { type: "bytes" }] as const;
const OFFER_DATA_PARAMETERS = [
  { type: "uint256" },
  { type: "uint8" },
  { type: "uint256" },
  { type: "address" },
  { type: "uint256" },
  { type: "uint256" },
  { type: "uint256" },
  { type: "uint256" },
  { type: "uint256" },
  { type: "uint256" },
  { type: "uint256" },
  { type: "bytes" },
] as const;
const VALIDATOR_DATA_PARAMETERS = [{ type: "bytes[]" }, { type: "uint256[]" }] as const;

/** Validate a service option against the exact withdrawal intent. @internal */
export function validateExpressWithdrawOption(parameters: {
  option: ExpressWithdrawOption;
  amount: bigint;
  receiver: Address;
  providerAddress: Address;
  chainId: number;
}): void {
  const { option, amount, receiver, providerAddress, chainId } = parameters;
  if (EXPRESS_WITHDRAW_OPTION_TYPE[option.optionTypeName] !== option.optionType) {
    throwValidation("EXPRESS_WITHDRAW_OPTION_TYPE_MISMATCH", "The Express option name and numeric type disagree.");
  }
  if (isExpressWithdrawOptionExpired(option)) {
    throwValidation("EXPRESS_WITHDRAW_OPTION_EXPIRED", "The Express option has expired; request fresh options.");
  }
  if (option.parts.length === 0) {
    throwValidation("EXPRESS_WITHDRAW_PARTS_EMPTY", "The Express option has no receiver parts.");
  }

  let total = 0n;
  for (const part of option.parts) {
    total += part.amount;
    if (part.chainId !== BigInt(chainId)) {
      throwValidation(
        "EXPRESS_WITHDRAW_CROSS_CHAIN_UNSUPPORTED",
        "Express Withdraw currently supports same-chain parts only.",
      );
    }
    if (!isAddressEqual(part.receiver as Address, receiver)) {
      throwValidation("EXPRESS_WITHDRAW_RECEIVER_MISMATCH", "An Express option receiver does not match the request.");
    }
    if (!isAddressEqual(part.expressProvider, providerAddress)) {
      throwValidation(
        "EXPRESS_WITHDRAW_PROVIDER_MISMATCH",
        "An Express option provider does not match the configured deployment.",
      );
    }
    if (!isAddressEqual(part.virtualProvider, zeroAddress)) {
      throwValidation(
        "EXPRESS_WITHDRAW_VIRTUAL_PROVIDER_UNSUPPORTED",
        "Express Withdraw currently supports non-virtual same-chain parts only.",
      );
    }
  }
  if (total !== amount) {
    throwValidation(
      "EXPRESS_WITHDRAW_AMOUNT_MISMATCH",
      `Express option parts total ${total.toString()}, expected ${amount.toString()}.`,
    );
  }

  const computedPartsHash = keccak256(encodeAbiParameters(WITHDRAW_PARTS_PARAMETER, [option.parts]));
  if (computedPartsHash.toLowerCase() !== option.partsHash.toLowerCase()) {
    throwValidation("EXPRESS_WITHDRAW_PARTS_HASH_MISMATCH", "The Express option parts do not match its signed hash.");
  }

  validateProviderData(option);
}

function validateProviderData(option: ExpressWithdrawOption): void {
  try {
    const [offerData, validatorData, creditDataRaw] = decodeAbiParameters(
      PROVIDER_DATA_PARAMETERS,
      option.providerData,
    );
    const [
      nonce,
      optionType,
      ,
      affiliate,
      affiliateAmount,
      creditAmount,
      fee,
      operatorFee,
      maxUserFee,
      ,
      deadline,
      signature,
    ] = decodeAbiParameters(OFFER_DATA_PARAMETERS, offerData);

    const matchesOffer =
      nonce === option.nonce &&
      optionType === option.optionType &&
      isAddressEqual(affiliate, option.affiliate) &&
      affiliateAmount === option.affiliateAmount &&
      creditAmount === option.creditAmount &&
      fee === option.fee &&
      operatorFee === option.operatorFee &&
      maxUserFee === option.maxUserFee &&
      deadline === BigInt(option.deadline) &&
      signature.toLowerCase() === option.signature.toLowerCase() &&
      creditDataRaw.toLowerCase() === option.creditDataRaw.toLowerCase();
    if (!matchesOffer) {
      throwValidation(
        "EXPRESS_WITHDRAW_PROVIDER_DATA_MISMATCH",
        "The Express provider payload does not match the service option fields.",
      );
    }

    if (option.validatorSignatures || option.validatorTimestamps) {
      const [signatures, timestamps] = decodeAbiParameters(VALIDATOR_DATA_PARAMETERS, validatorData);
      if (
        !hexArraysEqual(signatures, option.validatorSignatures ?? []) ||
        !numberArraysEqual(timestamps, option.validatorTimestamps ?? [])
      ) {
        throwValidation(
          "EXPRESS_WITHDRAW_PROVIDER_DATA_MISMATCH",
          "The Express validator payload does not match the service option fields.",
        );
      }
    }
  } catch (error) {
    if (error instanceof SymmError) throw error;
    throwValidation("EXPRESS_WITHDRAW_PROVIDER_DATA_MALFORMED", "The Express provider payload is not valid ABI data.");
  }
}

function hexArraysEqual(left: readonly `0x${string}`[], right: readonly `0x${string}`[]): boolean {
  return (
    left.length === right.length && left.every((value, index) => value.toLowerCase() === right[index]?.toLowerCase())
  );
}

function numberArraysEqual(left: readonly bigint[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === BigInt(right[index] ?? -1));
}

function throwValidation(code: string, message: string): never {
  throw new SymmError("validation", code, message);
}
