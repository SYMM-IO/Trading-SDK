import { GaslessRequestStatus, type GaslessDepositRequest, type GaslessOperationRequest } from "../types";

/**
 * A normalized operations record with every field populated, for tests that
 * only care about one or two of them.
 *
 * @internal test helper — not exported from the package.
 */
export function operationRequestFixture(overrides?: Partial<GaslessOperationRequest>): GaslessOperationRequest {
  return {
    service: "operations",
    requestId: "req-1",
    status: GaslessRequestStatus.QUEUED,
    txHash: null,
    errorCode: null,
    errorMessage: null,
    idempotencyKey: null,
    owner: "0x1111111111111111111111111111111111111111",
    walletIds: [0n],
    createdAt: null,
    updatedAt: null,
    operationType: "grantDelegation",
    accountId: null,
    feeAmountRaw: null,
    ...overrides,
  };
}

/**
 * A normalized deposits record with every field populated.
 *
 * @internal test helper — not exported from the package.
 */
export function depositRequestFixture(overrides?: Partial<GaslessDepositRequest>): GaslessDepositRequest {
  return {
    service: "deposits",
    requestId: "dep-1",
    status: GaslessRequestStatus.QUEUED,
    txHash: null,
    errorCode: null,
    errorMessage: null,
    idempotencyKey: null,
    owner: "0x1111111111111111111111111111111111111111",
    walletIds: [0n],
    createdAt: null,
    updatedAt: null,
    depositAddress: "0x5555555555555555555555555555555555555555",
    walletId: 0n,
    accountName: null,
    amountRaw: null,
    feeRaw: null,
    creditedRaw: null,
    ...overrides,
  };
}
