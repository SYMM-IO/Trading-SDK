---
"@symmio/trading-core": major
"@symmio/trading-react": major
---

Upgrade the supported contracts version from perps-core v0.8.5 to **v0.8.6**.

Per the one-contracts-version-per-release doctrine (`ARCHITECTURE.md` §2), the ABI fragments under `src/symmio-contracts/abi/` were swapped in place and now live under `v0.8.6/` — `symmioAbi`, `accountLayerAbi` and `instantLayerAbi` are the complete/fragment ABIs from the `version_0.8.6` tag of `SYMM-IO/perps-core`.

Breaking, for consumers using the raw ABI exports directly:

- `symmioAbi` no longer contains `forceCancelWithdraw` / `WITHDRAW_FORCE_CANCEL_ROLE`, the pre-affiliate `sendQuote` overload, or `owner` (replaced by `getOwner`); it gains the 0.8.6 surface (withdraw advance, restatement, operational/solver fees, snapshot liquidation, funding views, …).
- `accountLayerAbi` drops the express-rate and virtual-provider admin functions and gains the 0.8.6 additions (scoped signers, sub-account ownership transfer, `createSubAccountsFor`, …).

SDK-surface change: `WithdrawRequest` gains the required field `advancedAmount: bigint` — the collateral already advanced to the provider before cooldown expiry (express credit-line flow), mirroring the 0.8.6 `WithdrawStorage.WithdrawRequest` struct. The withdraw read views (`getWithdrawRequests`, `getPendingWithdrawRequests`) and the hooks built on them now return it.

No typed action changed shape or behavior otherwise: every function the SDK wraps is signature-identical in 0.8.6 (the `QuoteStatus` and `WithdrawStatus` enums and `LibAccount.partyAAvailableBalanceForLiquidation` were verified unchanged against the `version_0.8.6` sources).
