import { describe, expect, expectTypeOf, it } from "vitest";
import {
  PoolTransactionStatus,
  PoolTransactionType,
  type ListingMarketDetail,
  type UserPoolProfit,
  type UserTransaction,
} from "../types";
import { calculatePoolPosition, type CalculatePoolPositionParameters } from "./calculate-pool-position";
const wei = 10n ** 18n;
const profit: UserPoolProfit = {
  userBalanceInTokens: 101n,
  userBalanceInUsdc: 79n,
  userLpAmount: 3n,
  pendingWithdrawLpAmount: 1n,
  availableLpAmount: 2n,
  claimableReward: 1n,
  claimedReward: 2n,
  userDepositedTokenAmount: 101n,
};
const input = { tokenContractAddress: "Mint", depositChain: 0, profit, detail: null, deposits: null };
function deposit(amount: bigint, status = PoolTransactionStatus.SUCCESS): UserTransaction {
  return {
    transactionId: status,
    type: PoolTransactionType.DEPOSIT,
    tokenAddress: "mint",
    chainId: 0,
    amount,
    status,
    tokenDecimals: 6,
  } as UserTransaction;
}
describe("position projection", () => {
  it("takes normalized SDK reads directly", () => {
    expectTypeOf<CalculatePoolPositionParameters["profit"]>().toEqualTypeOf<UserPoolProfit | null>();
    expectTypeOf<CalculatePoolPositionParameters["detail"]>().toEqualTypeOf<ListingMarketDetail | null>();
    expectTypeOf<CalculatePoolPositionParameters["deposits"]>().toEqualTypeOf<readonly UserTransaction[] | null>();
  });
  it("adds wei exactly beyond Number precision and recognizes a full refund", () => {
    const amount = 318605896839877136770n;
    const result = calculatePoolPosition({
      ...input,
      deposits: [
        deposit(amount),
        deposit(1n, "transferred" as PoolTransactionStatus),
        deposit(amount + 1n, PoolTransactionStatus.REFUND),
      ],
    });
    expect(result.depositedToken).toBe(318605896839877136771n);
    expect(result.fullyRefunded).toBe(true);
    expect(result.refundableToken).toBe(0n);
    expect(
      calculatePoolPosition({
        ...input,
        deposits: [deposit(10n ** 21n), deposit(1n, "transferred" as PoolTransactionStatus)],
      }).depositedToken?.toString(),
    ).toBe("1000000000000000000001");
  });
  it("splits integer balances exactly and keeps remainder in pending", () => {
    const result = calculatePoolPosition(input);
    expect(result.availableToken).toBe(67n);
    expect(result.pendingToken).toBe(34n);
    expect(result.availableToken! + result.pendingToken!).toBe(101n);
    expect(result.availableUsdc! + result.pendingUsdc!).toBe(79n);
  });
  it("preserves dust, pending LP and known collateral when the token price is unavailable", () => {
    const value = {
      ...profit,
      userLpAmount: 100n,
      pendingWithdrawLpAmount: 40n,
      userBalanceInTokens: 3n * wei,
      userBalanceInUsdc: 536000000000n,
    };
    expect(calculatePoolPosition({ ...input, profit: value, priceUsd: 2 })).toMatchObject({
      availableLp: 60n,
      availableToken: 1800000000000000000n,
      pendingToken: 1200000000000000000n,
      availableUsdc: 321600000000n,
      pendingUsdc: 214400000000n,
      balanceUsd: 6.000000536,
      valuationComplete: true,
    });
    expect(calculatePoolPosition({ ...input, profit: value })).toMatchObject({
      balanceUsd: 0.000000536,
      valuationComplete: false,
    });
  });
  it("clamps overdrawn pending LP and ownership", () => {
    expect(calculatePoolPosition({ ...input, profit: { ...profit, pendingWithdrawLpAmount: 4n } })).toMatchObject({
      availableLp: 0n,
      pendingLp: 3n,
    });
    expect(
      calculatePoolPosition({ ...input, detail: { totalUsdcInPool: 1n } as ListingMarketDetail }).shareFraction,
    ).toBe(1);
    expect(
      calculatePoolPosition({
        ...input,
        profit: { ...profit, userBalanceInUsdc: 0n },
        detail: { totalUsdcInPool: 1n } as ListingMarketDetail,
      }).shareFraction,
    ).toBe(0);
  });
  it("excludes another deposit chain, another token and withdrawal rows", () => {
    const result = calculatePoolPosition({
      ...input,
      deposits: [
        deposit(1n),
        { ...deposit(99n), chainId: 56 },
        { ...deposit(99n), tokenAddress: "Else" },
        { ...deposit(99n), type: PoolTransactionType.WITHDRAW },
      ],
    });
    expect(result.depositedToken).toBe(1n);
  });
  it("keeps pending, rejected and refund lifecycle amounts separate", () => {
    expect(
      calculatePoolPosition({
        ...input,
        deposits: [
          deposit(1n),
          deposit(2n, PoolTransactionStatus.PENDING),
          deposit(4n, PoolTransactionStatus.REJECTED),
          deposit(3n, PoolTransactionStatus.REFUND),
        ],
      }),
    ).toMatchObject({
      depositedToken: 1n,
      pendingDepositToken: 2n,
      rejectedDepositToken: 4n,
      refundedToken: 3n,
      refundableToken: 2n,
      fullyRefunded: false,
    });
  });
  it("does not fabricate zero stake after a failed profit read", () => {
    const result = calculatePoolPosition({ ...input, profit: null });
    expect(result.availableLp).toBeNull();
    expect(result.balanceUsd).toBeNull();
    expect(result.fullyRefunded).toBeNull();
  });
});
