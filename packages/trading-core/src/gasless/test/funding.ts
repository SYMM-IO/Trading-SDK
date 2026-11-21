import type { Address } from "viem";
import { vi, type Mock } from "vitest";
import { GASLESS_TEST_CHAIN, gaslessWriteTestConfig } from "./config";
import { rawFeeQuote, type RawGaslessFeeQuote } from "./fee-quote";

export const FUNDING_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
export const FUNDING_VA: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

/** Small integer Core-unit charges keep funding boundary tests readable. */
export function fundingQuote(payments?: RawGaslessFeeQuote["payments"]): RawGaslessFeeQuote {
  const rows = payments ?? [{ ...rawFeeQuote(FUNDING_ACCOUNT).payments[0]!, operationalFee18: 5n }];
  const totalFee18 = rows.reduce(
    (sum, row) => sum + row.operationalFee18 + row.depositFee18 + row.walletCreationFee18 + row.nativeTopUpFee18,
    0n,
  );
  return rawFeeQuote(FUNDING_ACCOUNT, {
    payments: rows,
    totalFee18,
    totalDebit18: totalFee18 + rows.reduce((sum, row) => sum + row.nativeGasCollateral18, 0n),
  });
}

/** An allowance far above any test fee, for payers whose allowance a test does not configure. */
export const FUNDING_UNLIMITED_ALLOWANCE = 10n ** 30n;

/**
 * All reads and signing are stubbed; an unconfigured balance is an error, never
 * zero. An unconfigured operational-fee allowance reads as effectively unlimited,
 * so balance-only tests keep their meaning.
 */
export function fundingTestConfig(
  quote = fundingQuote(),
  balances: Record<string, { free: bigint; allocated: bigint }> = {
    [FUNDING_ACCOUNT]: { free: 100n, allocated: 0n },
    [FUNDING_VA]: { free: 0n, allocated: 100n },
  },
  allowances: Record<string, bigint> = {},
): ReturnType<typeof gaslessWriteTestConfig> & { getBlockNumber: Mock } {
  const mocks = gaslessWriteTestConfig();
  const getBlockNumber = vi.fn().mockResolvedValue(100n);
  Object.assign(mocks.config.getClient({ chainId: GASLESS_TEST_CHAIN }), { getBlockNumber });
  mocks.readContract.mockImplementation(async ({ functionName, args }: { functionName: string; args: Address[] }) => {
    if (functionName === "previewFeeQuote") return quote;
    if (functionName === "getOperationalFeeAllowance") {
      return [allowances[args[0]!.toLowerCase()] ?? FUNDING_UNLIMITED_ALLOWANCE, 0n, 0n, 10_000n];
    }
    const balance = balances[args[0]!.toLowerCase()];
    if (!balance) throw new Error("Balance unavailable");
    if (functionName === "balanceOf") return balance.free;
    if (functionName === "balanceInfoOfPartyA") return [balance.allocated, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];
    throw new Error(`Unexpected read: ${functionName}`);
  });
  return { ...mocks, getBlockNumber };
}
