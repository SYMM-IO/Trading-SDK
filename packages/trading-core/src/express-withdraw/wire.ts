import type { Address, Hex } from "viem";

/** @internal */
export interface ExpressWithdrawPartWire {
  id: string;
  amount: string;
  chainId: number;
  receiver: Address;
  virtualProvider: Address;
  expressProvider: Address;
}

/** @internal */
export interface ExpressWithdrawOptionWire {
  optionType: number;
  optionTypeName: string;
  nonce: number | string;
  affiliate: Address;
  expressAmount: string;
  generalAmount: string;
  affiliateAmount: string;
  creditAmount: string;
  fee: string;
  operatorFee: string;
  maxUserFee: string;
  sponsorCoverage: string;
  parts: ExpressWithdrawPartWire[];
  partsHash: Hex;
  signature: Hex;
  providerData: Hex;
  deadline: number;
  estimatedTimeSeconds: number;
  requiresValidators: boolean;
  minValidatorSignatures: number;
  creditDataRaw: Hex;
  validatorSignatures?: Hex[];
  validatorTimestamps?: number[];
  symmioNonce?: number | string;
  accelerateCandidate?: boolean;
  desiredCreditAmount?: string;
  creditCapacityReason?: string;
  requestDbId: number;
}

/** @internal */
export interface ExpressWithdrawOptionsWire {
  options: ExpressWithdrawOptionWire[];
  requestDbId: number;
  requestDbIds: Record<string, number>;
}

/** @internal */
export interface ExpressWithdrawStatusWire {
  code?: string;
  onChain: {
    status: string;
    optionType: string;
    expressAmount: string;
    acceptedAt: number;
    finalizedAt: number;
    cooldownEndTime: number;
    maxAccelerationFee?: string;
    accelerationFee?: string;
  };
  local: {
    status: string;
    riskScore: number | null;
    riskChecked: boolean;
    lockTxHash: Hex | null;
    processTxHash: Hex | null;
    finalizeTxHash: Hex | null;
  };
}
