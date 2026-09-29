---
"@symmio/trading-core": minor
"@symmio/trading-react": patch
---

Add collateral ↔ 18-decimal Core unit conversion helpers, and correct the unit and "quote, not proof" labels on gasless fees, allowances and receipts.

SYMMIO Core keeps balances, operational-fee allowances and fee quotes in 18 decimals. Token transfers, deposit and withdrawal amounts, and a GaslessLayer's deposit terms use the collateral token's decimals. Several labels called 18-decimal values "raw collateral units", and nothing in the SDK converted between the two scales.

**`@symmio/trading-core`**

- New `collateralToCore18(amount, collateralDecimals)` scales a collateral-token amount up to 18-decimal Core units. The conversion is exact.
- New `core18ToCollateral(amount18, collateralDecimals, { rounding? })` scales an 18-decimal amount down to token base units. It rounds up by default, the rule for funding a fee (`(fee18 + scale - 1n) / scale` for a non-negative amount). `rounding: "down"` rounds toward negative infinity, for an amount that must not be overstated. The options bag is exported as `Core18ToCollateralOptions`.
- Both throw `SymmError("validation", "COLLATERAL_DECIMALS_UNSUPPORTED")` unless the decimals are an integer from 0 to 18. `withdrawAuto` now derives its 18-decimal deallocate amount with `collateralToCore18`, so a chain configured with unsupported collateral decimals fails with that typed error instead of a `RangeError`.
- Documentation corrections, with no behavior change:
  - `getOperationalFeeAllowance`'s `allowance` and `pendingAllowance`, and `approveOperationalFee`'s `amounts`, are 18-decimal Core units, not collateral units. An approval replaces the allowance rather than adding to it, every charge decrements it (`maxUint256` included), and it adds no balance. The charger is the GaslessLayer proxy. The examples approve a bounded `parseUnits("5", 18)` budget instead of `maxUint256`.
  - `getAccountBalanceOf`, `getAccountBalanceInfo` and `AccountBalanceInfo` return 18-decimal Core units, as the docs already said.
  - `GaslessSubmitReceipt.paidFee` and `remainingFeeAllowance` are the service's acceptance-time figures, as reported by the service. `paidFee` is not proof that a fee was collected. `remainingFeeAllowance` is not a post-execution balance or an authorization guarantee, and it can read `2^256 - 1` while the Core approval is bounded.
  - `GaslessDepositSubmitReceipt`'s `observedAmount`, `paidFee` and `creditedAmount` are acceptance-time estimates in token base units that leave out a wallet creation fee. The settlement sweeps the full balance present when it executes.

**`@symmio/trading-react`**

- Documentation only: the `useApproveOperationalFee` example approves a bounded 18-decimal budget instead of `maxUint256`, and `useOperationalFeeAllowance` and `useAccountBalanceOf` state that their values are 18-decimal Core units.
