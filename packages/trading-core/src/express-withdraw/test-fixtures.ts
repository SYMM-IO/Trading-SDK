import { encodeAbiParameters, keccak256, zeroAddress, type Address, type PublicClient } from "viem";
import { SymmioSupportedChainId } from "../core/chains";
import { createConfig } from "../core/config";
import type { ExpressWithdrawOption } from "./types";
import type { ExpressWithdrawOptionWire } from "./wire";

export const TEST_ACCOUNT: Address = "0x1111111111111111111111111111111111111111";
export const TEST_RECEIVER: Address = "0x2222222222222222222222222222222222222222";
export const TEST_AFFILIATE: Address = "0x3333333333333333333333333333333333333333";
export const TEST_PROVIDER: Address = "0x573310D7b04fF21BB8628C69eE103dDF4922294A";
export const TEST_AMOUNT = 1_000_000n;

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

export function createExpressConfig(options?: { contractsVersion?: "0.8.5" | "0.8.6" }) {
  return createConfig({
    defaultChainId: SymmioSupportedChainId.ARBITRUM,
    getClient: () => ({}) as PublicClient,
    symmioConfig: {
      [SymmioSupportedChainId.ARBITRUM]: {
        addresses: { affiliatesAddress: TEST_AFFILIATE },
        contractsVersion: options?.contractsVersion ?? "0.8.6",
        expressWithdraw: { url: "https://express.test/v1/", providerAddress: TEST_PROVIDER },
      },
    },
  });
}

export function createExpressOption(overrides: Partial<ExpressWithdrawOption> = {}): ExpressWithdrawOption {
  const parts = overrides.parts ?? [
    {
      id: 0n,
      amount: TEST_AMOUNT,
      chainId: BigInt(SymmioSupportedChainId.ARBITRUM),
      receiver: TEST_RECEIVER,
      virtualProvider: zeroAddress,
      expressProvider: TEST_PROVIDER,
    },
  ];
  const partsHash = keccak256(encodeAbiParameters(WITHDRAW_PARTS_PARAMETER, [parts]));
  const base = {
    optionType: 0,
    optionTypeName: "SAME_TX",
    nonce: 7n,
    affiliate: TEST_AFFILIATE,
    expressAmount: TEST_AMOUNT,
    generalAmount: 0n,
    affiliateAmount: 0n,
    creditAmount: TEST_AMOUNT,
    fee: 10n,
    operatorFee: 5n,
    maxUserFee: 15n,
    sponsorCoverage: 0n,
    parts,
    partsHash,
    signature: "0x1234",
    providerData: "0x",
    deadline: Math.floor(Date.now() / 1000) + 600,
    estimatedTimeSeconds: 12,
    requiresValidators: false,
    minValidatorSignatures: 0,
    creditDataRaw: "0x",
    requestDbId: 42,
  } satisfies ExpressWithdrawOption;
  const option = { ...base, ...overrides };
  if (overrides.providerData !== undefined) return option;

  const offerData = encodeAbiParameters(
    [
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
    ],
    [
      option.nonce,
      option.optionType,
      0n,
      option.affiliate,
      option.affiliateAmount,
      option.creditAmount,
      option.fee,
      option.operatorFee,
      option.maxUserFee,
      0n,
      BigInt(option.deadline),
      option.signature,
    ],
  );
  const validatorData = encodeAbiParameters(
    [{ type: "bytes[]" }, { type: "uint256[]" }],
    [option.validatorSignatures ?? [], (option.validatorTimestamps ?? []).map(BigInt)],
  );
  return {
    ...option,
    providerData: encodeAbiParameters(
      [{ type: "bytes" }, { type: "bytes" }, { type: "bytes" }],
      [offerData, validatorData, option.creditDataRaw],
    ),
  };
}

export function createExpressOptionWire(overrides: Partial<ExpressWithdrawOptionWire> = {}): ExpressWithdrawOptionWire {
  const normalized = createExpressOption();
  return {
    optionType: normalized.optionType,
    optionTypeName: normalized.optionTypeName,
    nonce: normalized.nonce.toString(),
    affiliate: normalized.affiliate,
    expressAmount: normalized.expressAmount.toString(),
    generalAmount: normalized.generalAmount.toString(),
    affiliateAmount: normalized.affiliateAmount.toString(),
    creditAmount: normalized.creditAmount.toString(),
    fee: normalized.fee.toString(),
    operatorFee: normalized.operatorFee.toString(),
    maxUserFee: normalized.maxUserFee.toString(),
    sponsorCoverage: normalized.sponsorCoverage.toString(),
    partsHash: normalized.partsHash,
    signature: normalized.signature,
    providerData: normalized.providerData,
    deadline: normalized.deadline,
    estimatedTimeSeconds: normalized.estimatedTimeSeconds,
    requiresValidators: normalized.requiresValidators,
    minValidatorSignatures: normalized.minValidatorSignatures,
    creditDataRaw: normalized.creditDataRaw,
    ...(normalized.validatorSignatures ? { validatorSignatures: [...normalized.validatorSignatures] } : {}),
    ...(normalized.validatorTimestamps ? { validatorTimestamps: [...normalized.validatorTimestamps] } : {}),
    parts: normalized.parts.map((part) => ({
      ...part,
      id: part.id.toString(),
      amount: part.amount.toString(),
      chainId: Number(part.chainId),
    })),
    ...(normalized.symmioNonce === undefined ? {} : { symmioNonce: normalized.symmioNonce.toString() }),
    ...(normalized.accelerateCandidate === undefined ? {} : { accelerateCandidate: normalized.accelerateCandidate }),
    ...(normalized.desiredCreditAmount === undefined
      ? {}
      : { desiredCreditAmount: normalized.desiredCreditAmount.toString() }),
    ...(normalized.creditCapacityReason === undefined ? {} : { creditCapacityReason: normalized.creditCapacityReason }),
    requestDbId: normalized.requestDbId,
    ...overrides,
  };
}
