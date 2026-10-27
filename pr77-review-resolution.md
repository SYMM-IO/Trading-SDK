# PR 77 review resolution

Review source: [reviewer's comment and attached Markdown](https://github.com/SYMM-IO/Trading-SDK/pull/77#issuecomment-6418193089).

This response starts from PR head `6d822512117cc2f762798d482ba2f13624056bfb` (including the newer empty commit) and merges target `feature/VIBE-1902/sdk-pools` at `d22a3eb05b2304a6a866ec3af09705901f0c72d9`. The target remains PR #75's branch, not main. The target's approved P29 redesign replaces scalar calculations with grouped APIs.

The user explicitly approved the revised public design on 2026-10-27: remove the five unreleased scalar exports; add withdrawal selection and pending ratio to the position API; return order/history metrics on reads; leave deposit estimates and running sums consumer-owned. That approval also covers the corrected partial-close fee display. No companion app source is changed here.

## Findings and resolutions

| Finding                                 | Resolution                                                                                                                                                                                                                                                                                             | Evidence                                                                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1: liquidation close fee               | The history read derives metrics after applying event snapshots. All liquidation event types return zero closing fee. Emergency and ADL closes retain closing fees after checking the contract paths.                                                                                                  | Public `getPoolTradeHistory` fixtures cover all three liquidation types, force/emergency/ADL, and liquidation fields without a snapshot.                           |
| P2: permanent scalar API surface        | Removed the unreleased scalar module and exports. The position read/calculator/hook accepts optional integer `withdrawalPercent` and returns flat nullable preview fields and pendingRatio. Quote reads return orderPrice/orderNotional; history rows return event metrics. No new read cache or hook. | Root export inspection, packed-consumer fixture and React percentage-change test proving source calls remain at one.                                               |
| P4: repeated full opening fee           | Opening fees use this event's quantity and the existing fill-price precedence. History rows expose openFee, closeFee and their sum platformFee.                                                                                                                                                        | Two partial closes produce 0.34 and 0.32; their opening shares total 0.20. Three uneven closes bound the flooring difference to fewer wei than the number of rows. |
| Additional requested tests              | Added short PnL, zero initial fill-price fallback, actual SDK history read output, zero snapshots and missing inputs.                                                                                                                                                                                  | Public-read and position regression fixtures, plus retained direct one-wei PnL tests.                                                                              |
| Follow-up: inherited rate documentation | Corrected the parent's description of quote tradingFee/closeFee as cumulative amounts. They are rates, distinct from history-row fee amounts.                                                                                                                                                          | Subgraph Quote schema, versioned loader and close-fee model regression at the pinned reference below.                                                              |

Six merge conflicts were resolved without restoring the removed scalar API: four modify/delete conflicts in the old calculations code/docs, plus the core root exports and packed-consumer fixture. Required calculations and regression coverage moved to the grouped consumers; generic deposit/running-sum helpers were removed intentionally.

## Protocol and wire evidence

The review attachment's `TRADE_FEES_SIMPLE.md` was not present in the fetched protocol tree. The behavior was checked directly against contract source instead; no missing document is presented as having been read.

- perps-core `version_0.8.6` at `7663dea19e0ac13ee4181fe92ccbde609bd32940`: [LibQuoteClose](https://github.com/SYMM-IO/perps-core/blob/7663dea19e0ac13ee4181fe92ccbde609bd32940/contracts/core/libraries/LibQuoteClose.sol) charges the close fee in `_finalizeCloseQuote`.
- [PartyBEmergencyActionsFacetImpl](https://github.com/SYMM-IO/perps-core/blob/7663dea19e0ac13ee4181fe92ccbde609bd32940/contracts/core/facets/PartyBEmergencyActions/PartyBEmergencyActionsFacetImpl.sol) calls that path from both emergencyClosePosition and adlClose.
- [LibPartyALiquidationProcess](https://github.com/SYMM-IO/perps-core/blob/7663dea19e0ac13ee4181fe92ccbde609bd32940/contracts/core/libraries/liquidation/LibPartyALiquidationProcess.sol) uses [LibQuote.closePositionFully](https://github.com/SYMM-IO/perps-core/blob/7663dea19e0ac13ee4181fe92ccbde609bd32940/contracts/core/libraries/LibQuote.sol), which does not charge the normal close fee.
- Subgraphs at `01a9c3370fe6821310b7e294edf958fc4fae0dfc`: [Quote schema](https://github.com/SYMM-IO/subgraphs/blob/01a9c3370fe6821310b7e294edf958fc4fae0dfc/perps/common/models/Quote.graphql), [VersionedQuoteLoader](https://github.com/SYMM-IO/subgraphs/blob/01a9c3370fe6821310b7e294edf958fc4fae0dfc/perps/common/VersionedQuoteLoader.ts) and [fee model test](https://github.com/SYMM-IO/subgraphs/blob/01a9c3370fe6821310b7e294edf958fc4fae0dfc/tests/quote-close-fee-model.test.mjs) identify tradingFee/closeFee as 18-decimal rates.

## Consumer migration and boundaries

| Removed unreleased API            | Replacement                                                                                                                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| getPoolWithdrawalPreview          | calculatePoolPosition/getPoolPosition/usePoolPosition with withdrawalPercent; consume withdrawalLpAmount, withdrawalTokenAmount, withdrawalUsdcAmount and withdrawalValueUsd |
| PoolBalanceBreakdown.pendingRatio | PoolPositionData.pendingRatio; follows the parent's clamped ledger and nullable unknown convention                                                                           |
| getPoolPendingQuoteMetrics        | getPoolQuotes(...).quotes[].orderPrice and orderNotional                                                                                                                     |
| getPoolTradeHistoryMetrics        | getPoolTradeHistory(...).rows[] event quantity/price/value, openFee, closeFee, platformFee and realizedPnl                                                                   |
| getPoolDepositPreview             | Consumer-owned minimum/price estimate and observed balance delta; preserve unknown price/baseline                                                                            |
| getPoolHistoryAmounts             | Consumer-owned bigint sum/cumulative series over the selected ordered range                                                                                                  |

These API removals affect unreleased branch code. The existing app PR #686 still imports removed APIs and must be migrated before pinning a compatible release. This SDK-only task does not claim app compatibility or release readiness. Parent PR #75 already records its own larger consumer migration and core-major release requirement.

The alternative was to retain five standalone scalar selectors and require consumers to compose their results after reads. That preserves the first draft's call sites but conflicts with the parent's approved grouped API and expands the permanent public surface. The approved approach adds protocol-derived values to existing reads/projections, without extra requests or hooks. Deposit estimates and ordered sums remain consumer-owned because they express presentation/range choices rather than a missing protocol read.

Withdrawal outputs remain exact 18-decimal bigint estimates. An omitted percentage or unavailable profit yields null; zero selection is zero. Missing price values only known collateral. Full withdrawal retains LP dust. The grouped pending ratio clamps consistently with the parent ledger. Deposit/withdraw acceptance is not settlement.

History openFee is an allocation of an already-paid opening fee, not a second charge on close. Partial rows round independently. Missing calculation inputs yield null. Unknown liquidation price does not borrow an earlier average close price. Gross realized PnL excludes platform, solver, funding and liquidation fees.

## Verification and comprehensive self-review

Baseline before replacement: 95 core files / 517 tests passed. New regressions first failed (20 failures) before the grouped fields and fee changes were implemented, then the initial focused run passed 36 tests across five files.

The self-review covers the entire incremental diff against target `d22a3eb`, including the original shared PnL precision change, rather than only this response's newest edits. It traced the public exports through core reads, React composition and the packed consumer; checked event snapshot ordering, null/zero precedence, bigint units, liquidation routing, rounding, request reuse and documentation. No unresolved code findings were identified. Independent review was not run.

- Full core suite: 496 files / 3,552 tests passed. After adding two final adverse-path cases, the affected history suite passed all 13 tests.
- Full React unit suite: 211 files / 923 tests passed. After updating the typed quote fixture, the two affected hook suites passed all 9 tests. The full suite emitted existing happy-dom teardown AbortError messages while exiting successfully; these are not represented as clean output.
- Core and React typechecks and strict lint passed after the final fixture changes.
- No app tests, browser QA or authenticated wallet/settlement checks are claimed. React runtime implementation is unchanged relative to the updated target; the React changes are regression fixtures only.

- `pnpm verify-packages` passed: SDK builds, packed publint/attw checks, a fresh external consumer install, strict NodeNext typecheck and runtime imports of all entrypoints.
- Documentation production build and Pagefind indexing passed. Next/Nextra emitted workspace-root and Git timestamp warnings in this nested worktree.
- Formatting across the incremental files and Git whitespace/conflict checks passed.

The reviewed content is the complete 24-file incremental tree carried by this merge commit, relative to `d22a3eb`; the final commit SHA is recorded in the PR description. The review report itself is the only content added after execution of the code checks. No dependency manifests or lockfiles changed. Release blockers remain parent review/merge, compatible publication, downstream app migration and published-mode/stage verification.

No merge of the PR, publication, deployment, app dependency change or live wallet transaction is authorized or performed by this response.
