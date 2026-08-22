# SDK coverage audit — what Prism uses, what it skips, and why

Audit date: 2026-08-22. Measured against the SDK build vendored in
`node_modules/@symmio/trading-core` and `node_modules/@symmio/trading-react`
(the repo build, per `pnpm sdk:refresh`).

The `/sdk` page already shows a live coverage tally produced by
[`src/features/sdk/scan-sdk-usage.ts`](src/features/sdk/scan-sdk-usage.ts). This
document is the reasoning that tally cannot show: for every symbol Prism does
**not** import, whether that is a gap worth closing, a deliberate choice, or
noise.

---

## 1. Numbers

Same method as the `/sdk` page — parse both package barrels for the
denominator, parse every `import … from "@symmio/trading-*"` under `src/` for
the numerator — extended to list the unused symbols by name.

|                         |    used | exported | slices touched |
| ----------------------- | ------: | -------: | -------------: |
| `@symmio/trading-core`  |     102 |     1511 |        26 / 56 |
| `@symmio/trading-react` |      73 |      579 |        24 / 31 |
| **total**               | **175** | **2090** |    **50 / 87** |

Unclassified symbols (imported but not attributable to a barrel module): none.

Two things make the raw ratio look worse than reality:

- **Roughly 70% of every slice is type and plumbing noise.** Every read ships
  `GetXParameters / GetXOptions / GetXData / GetXQueryKey / GetXQueryOptions /
GetXReturnType` plus `getXQueryKey`; every hook ships `UseXParameters /
UseXReturnType`; every write ships a `Simulate*` twin. Inference covers all of
  it. A consumer that imports none of these is doing it right.
- **A core slice showing 0 is often fully exercised through a react hook.**
  Prism follows the house rule (hooks from `react`, types and chain config from
  `core`), so `core:solvers/funding-info`, `core:solvers/get-solver-readiness`,
  `core:solvers/limit-open`, `core:symmio-contracts/instant-layer` and
  `core:websocket/prices` all read as untouched while `useFundingInfo`,
  `useSolverReadiness`, `useSolverErrorCodes`,
  `useLimitOpenAuto`, `useGrantDelegation` and `usePrices` are in daily use.

So the honest question is not "why is the number low" but "which of the
remaining symbols would change what Prism can do". That is the rest of this
document.

---

## 2. Unused only on paper — covered indirectly, do not import

These are building blocks that a hook Prism already uses calls internally.
Importing them directly would duplicate work the SDK does, or bypass the layer
that keeps it correct.

| Low-level symbols                                                                                                                                                                                                                                                             | Already exercised through                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `watchPrices`, `watchEnigmaPrices`, `watchBinancePrices`, `parsePriceFrame`, `getMarkPrices`                                                                                                                                                                                  | `usePrices`                                                                                                                                                                   |
| `watchBinanceKlines`, `parseBinanceKline*`, `createBinanceCandleSource`, `getCandlesQueryOptions`, `BINANCE_*` constants                                                                                                                                                      | `useCandles`, `useCandleStream`, `useBinanceCandleSource`                                                                                                                     |
| `watchBinanceDepth`, `fetchBinanceDepth`, `accumulateOrderbook`, `groupOrderbook`, `walkOrderbook`, `suggestOrderbookTickSizes`                                                                                                                                               | `useLiveOrderbook`, `useBinanceOrderbookSource`                                                                                                                               |
| `watchNotifications`, `normalizeNotification`, `classifyNotification`, `buildSubscribeMessage`                                                                                                                                                                                | `useNotifications`                                                                                                                                                            |
| `reconcileQuotes`, `applyNotificationToQuotes`, `groupQuotes`, `partitionQuotes`, `resolveQuoteAccounts`, `toUnifiedQuoteFrom*`, `shouldAccelerate*`                                                                                                                          | `useGroupedQuotes`                                                                                                                                                            |
| `planGroupClose`, `GroupCloseAllocation`, `PlanGroupCloseResult`                                                                                                                                                                                                              | `useCloseQuoteGroup` (Prism still imports `toGroupCloseCandidates` to build the target — that is the documented contract)                                                     |
| `instantOpen`, `sendInstantOpen`, `prepareInstantOpenParams`, `buildSignedOperation`, `signSignedOperation`, `resolveMarket`, `resolveLockedParams`, `resolveFeeRates`, `generateSalt`, `encode*`, EIP-712 domain constants                                                   | `useInstantOpenWithTpSl`, `useLimitOpenAuto`                                                                                                                                  |
| `instantClose`, `sendInstantClose`, `prepareInstantCloseParams`, `calculateClosePrice`, `clampClosePrecision`, `encodeRequestToClosePosition`                                                                                                                                 | `useInstantCloseAuto`                                                                                                                                                         |
| `deallocate`, `initiateWithdraw`, `deallocateAndInitiateWithdraw`, `createClassicWithdrawPart`, `getLastWithdrawRequestId`, `useInitiateWithdraw`, `useDeallocate*`, `useLastWithdrawRequestId`, `useWithdrawRequest`                                                         | `useWithdraw` (the auto flow) plus `usePendingWithdrawRequests` / `useFinalizeWithdrawRequest` / `useRequestCancelWithdraw`                                                   |
| `planGroupTpSl`, `planGroupTpSlDelete`, `buildConditionalOrder*`, `buildTpSlDeleteMessage`, `signTpSlRequest`, `toSignableTpSlMessage`, `getTpSlSigningSpec`, `useSetQuoteTpSl`, `useDeleteQuoteTpSl`, `useDeleteQuoteGroupTpSl`, `useTpSlSigningSpec`, `invalidateTpSlReads` | `useQuoteGroupTpSlEditor`, `useSetQuoteGroupTpSl`                                                                                                                             |
| `getSolverCapabilities`, `supportsLimitOrder`, `supportsGroupClose`                                                                                                                                                                                                           | `useSolverCapabilities`, `useSupportsLimitOrder` (Prism consults `SolverCapabilities` directly; `supportsGroupClose` is implied by the grouping strategy it already gates on) |
| `getErrorMessage`, `useErrorMessage`, `useSolverErrorMessage`                                                                                                                                                                                                                 | `useSolverErrorCodes` + Prism's own `describeRequestError`                                                                                                                    |
| Every `*QueryKey` factory, every `*MutationOptions`, `filterQueryOptions`, `shouldSimulateBeforeWrite`                                                                                                                                                                        | React Query plumbing the hooks own                                                                                                                                            |
| `accountLayerAbi`, `instantLayerAbi`, `symmioAbi`                                                                                                                                                                                                                             | Only needed for a raw `viem` call the SDK does not wrap. Prism makes none.                                                                                                    |
| `solvers/types/generated/rasa-solver` (zod schemas)                                                                                                                                                                                                                           | Internal response validation                                                                                                                                                  |
| `createConfig`, `GetClientFn`, `SymmioChainConfigInput`, `getDefaultSolver`, `listSupportedChains`, `isChainSupported`                                                                                                                                                        | Prism pins its two deployments explicitly in `src/config/` and hands `SymmioProvider` a ready config; discovery helpers are for single-deployment consumers                   |

---

## 3. Better not used — wrong for Prism's architecture

These are real features, but adopting them in Prism would be a regression. Each
one has a specific reason.

### 3.1 Single-configuration read hooks for data Prism fans out over two chains

`useMarketInfo`, `useNotionalCapAll`, `useBalanceHistory`, `useDepositHistory`,
`useWithdrawHistory`, `useTransferHistory`, `useQuoteHistory`,
`useUserSubAccounts`, `useOnchainContractMarkets`, `useMarkPrices`.

Every one of these resolves against one deployment. Prism reads both
deployments at once by feeding the matching core `*QueryOptions` factories into
`useQueries` — see
[`src/features/data/use-deployment-queries.ts`](src/features/data/use-deployment-queries.ts),
[`src/features/markets/use-merged-markets.ts`](src/features/markets/use-merged-markets.ts)
and
[`src/features/activity/use-quote-history-rows.ts`](src/features/activity/use-quote-history-rows.ts).
That is why `getMarketsQueryOptions`, `getMarketInfoQueryOptions`,
`getNotionalCapAllQueryOptions`, `getBalanceHistoryQueryOptions`,
`getTransferHistoryQueryOptions`, `getQuoteHistoryQueryOptions` and
`getUserSubAccountsQueryOptions` are imported while their hook twins are not.
Swapping a hook in would silently drop one solver from the screen. Keep the
fan-out.

### 3.2 Hooks that follow the connected chain with no `chainId` parameter

`useQuoteUpnlAndPnl`, `useQuoteTpSl`.

Their WebSocket subscriptions take no `chainId`, so a row from the deployment
the wallet is _not_ on gets priced by the wrong feed. This already mispriced a
Prism row by roughly $16M during development. The group variants Prism uses
(`useQuoteGroupFunding`, `useQuoteGroupTpSl`, `useQuoteGroupMarginRisk`) take
`chainId` explicitly and are the correct surface.

### 3.3 `useSwitchToSymmioChain`

Switches the wallet to the configuration's single chain. Prism has two target
chains and picks per deployment in
[`src/features/wallet/use-chain-gate.ts`](src/features/wallet/use-chain-gate.ts)
using wagmi's `useSwitchChain`. The SDK hook cannot express that.

### 3.4 Raw quote sources underneath the reconciler

`useManagedQuotes`, `usePartyAOpenPositions`, `usePartyAPendingQuotes`,
`useQuote`, `useLimitOrders`, `useOptimisticQuotesStore`,
`getSubAccountQuotes`, `getInstantOpens`, `getInstantCloses`.

`useGroupedQuotes` already composes `useManagedQuotes`, which in turn merges
all four sources (on-chain, instant-open, instant-close, notifications) with
Virtual Account fan-out. Reading any source directly produces a second,
unreconciled view of the same positions — split-brain rows, the exact failure
the reconciler exists to prevent.

### 3.5 Muon — all 36 hooks and 121 core symbols

`useMuonUpnlA`, `useSendQuoteUpnlSig`, `useDeallocateUpnlSig`,
`useForceClosePriceSig`, `getMuon*`, `MUON_*`, and so on.

These fetch and shape oracle attestations for the _manual_ mutation variants.
Every write Prism performs is an `*Auto` variant (`useInstantOpenWithTpSl`,
`useInstantCloseAuto`, `useLimitOpenAuto`, `useWithdraw`, `useRemoveMargin`)
that fetches its own signature. There is no Prism call site that needs a raw
attestation, and hand-assembling one is the easiest way to submit a stale
signature.

### 3.6 Escape hatches and internals

- `querySubgraph`, `useSubgraphQuery`, `SubgraphDocument` — raw GraphQL escape
  hatch. The typed reads (`getQuoteHistory`, `getQuoteEventsByType`,
  `getBalanceHistory`, `getTransferHistory`) cover everything Prism shows.
- `useTransactionsStore`, `useTpSlStore`, `useTpSlRecord(s)`, `TrackedTx` —
  SDK-internal stores. Prism's toasts are driven by mutation callbacks, which
  is the supported surface.
- `useSimulate*` (every write has one) — the config-level simulate-before-write
  switch already covers the safety case; per-call simulate hooks are for
  consumers that want a dry-run UI, which Prism does not have.
- `shared/types/properties` (`ExactPartial`, `Compute`, `ChainIdParameter` …)
  and `shared/types/query` — type utilities for _building_ SDK APIs, not for
  consuming them.

### 3.7 Features that belong to a different product surface

- **Affiliate registration** — `useAffiliateState`,
  `useRequestToRegisterAffiliate`, `useCancelRegistration`,
  `useGeneratedAccountManagerAddress` and the core equivalents. This is the
  landing-site onboarding flow for frontends that want to _be_ an affiliate.
  A trading UI has no place for it.
- **`useTradingViewDatafeed` / `toTradingViewDatafeed`** — an adapter for the
  TradingView Charting Library, which is an external, licence-gated dependency.
  Prism charts majors with its own canvas over `useCandles` + `useCandleStream`
  and embeds DexScreener for pool-traded lowcaps. Adding TradingView would add
  a dependency for no capability Prism lacks.
- **Binance price-service reads** — `useBinanceHealth`,
  `useBinancePremiumIndex`, `useBinanceSymbolsInfo`, `useBinancePrices`. The
  provider-agnostic `usePrices` already routes majors to Binance; the
  provider-specific hooks only matter for a UI that shows Binance itself as a
  data source. Same for the Enigma-specific set (`useEnigmaPrices`,
  `useEnigmaPriceByName`, `useEnigmaPriceServiceHealth`, `…SymbolsInfo`,
  `…PricesByAddresses`) — Prism only needs the metadata read it already makes.

---

## 4. Could use — genuine gaps, ranked

Ordered by how much each one changes what a trader can do, then by effort.

### 1. Cancel a stuck close — `useRequestToCancelCloseRequest` + `useForceCancelCloseRequest`

> **Shipped 2026-08-23.** `resolvePositionIntent` now has the close-side rungs
> (`cancel-close` / `awaiting-cancel-close`, with the force-cancel-close
> cooldown from `useCoolDownsOfMA()[2]` and the request's own deadline), and
> both the blotter row and the details sheet render them. The text below is the
> gap as it was found.

**The largest gap.** The open-side cancel ladder in
[`src/features/trade/use-position-actions.ts`](src/features/trade/use-position-actions.ts)
is complete: `requestToCancelQuote`, a live countdown on the solver's cooldown,
then `forceCancelQuote`. The close side has nothing. If a solver accepts an
instant close and never fills it, the quote sits in `CLOSE_PENDING` and the row
stays on "closing…" with no exit. The SDK exposes the exact mirror pair, and
`useCoolDownsOfMA` (already read for the open side) carries the force-close
cooldown too. Same ladder, same gates, second branch in
`resolvePositionIntent`.

### 2. Limit close — `useLimitCloseAuto`

> **Shipped 2026-08-23.** `PositionLimitCloseModal` in
> [`src/features/trade/position-limit-close-modal.tsx`](src/features/trade/position-limit-close-modal.tsx),
> reached from a `Limit` button on majors rows and a `Limit close` button in
> the details sheet; gated on `useSupportsLimitOrder` per deployment, priced
> against `useSolverPriceRange`, sized through `validateInstantCloseAgainstMarket`.
> Item 3 (partial close) came with it for the limit path only.

The order ticket offers limit _opens_ (`useLimitOpenAuto`), but every close is
a market close through `useInstantCloseAuto`. A limit close is the natural
counterpart: same session-key signing path, relayed to the solver over HTTP, so
it needs none of the wallet/chain gates. Capability-gated by
`supportsLimitOrder`, which Prism already evaluates.

### 3. Partial close — no new symbol

`usePositionActions.close()` hard-codes `quantityToClose` to the full position.
`useInstantCloseAuto` accepts any quantity, and Prism already imports
`validateInstantCloseAgainstMarket` to check that the leftover would clear the
market's lot size and minimum quote value. Exposing a quantity input in the
details sheet is the whole change.

### 4. Close all — `useInstantCloseBulkAuto`

A "close everything" button on the blotter. Exercises the bulk API
(`MAX_INSTANT_CLOSE_BULK_ORDERS` is the per-request cap to chunk on) and is
the one action a trader wants at 3 a.m. Per-deployment, since orders are
relayed to one solver at a time.

### 5. Open interest on the markets page — `getOpenInterestBySymbolIdQueryOptions`

The markets table shows notional caps (`getNotionalCapAllQueryOptions`) but
not how much of each cap is consumed. Open interest next to the cap turns a
number into a utilisation bar. Use the core `*QueryOptions` factory through
`useDeploymentQueries`, not `useOpenInterestBySymbolId`, for the reason in
§3.1.

### 6. Solver health — `useSolverBalanceInfo`, `useSolverOpenInterest`, `usePartyAUpnl`

The solver-status surface already reads `useSolverReadiness` and
`useSolverPriceRange`. These three complete the picture (solver collateral,
solver-side open interest, the solver's own view of partyA's uPnL). They are
Rasa-only and take explicit parameters, so the hook form is safe here.

### 7. Pre-flight notional cap check — `checkNotionalCap`

The ticket validates against market rules with
`validateInstantOpenAgainstMarket` but does not check the notional cap before
sending, so an oversize order is rejected by the solver instead of by the
form. `checkNotionalCap` is a pure helper over data Prism already holds
(`useNotionalCapBySymbolId`).

### 8. Backfill the live stream — `useSearchNotifications`

The activity page's live-stream tab starts empty and only fills as WebSocket
frames arrive. The REST search endpoint returns the same documents for a time
window, so the tab could open with the last N events already in place. Worth
noting: the notification feed is a debugging aid as much as a product
surface, and this is the query that pulls a real notification trail for a
stuck quote.

### 9. Delete a sub-account — `useDeleteSubAccount`

The portfolio's account manager creates and renames accounts; delete completes
the set. Low value on its own, but it is the only account-layer write that is
both common and unwired.

### 10. Force close — `useForceClose`, `useForceCloseEligibility`, `useForceCloseParams`

The protocol's unilateral close: when a limit close's price has been reached
and the solver ignores it, partyA can close on-chain with a Muon price
attestation. This would light up an entire 25-symbol core slice and is a real
safety valve. It is also the most involved item here — eligibility windows,
a live `forceClosePriceSig`, and a wallet transaction on the right chain — and
it only applies once item 2 (limit close) exists. Stretch goal.

### 11. Real-time TP/SL state — `useWatchTpSlNotifications`

`useQuoteGroupTpSl` polls. The TP/SL WebSocket pushes fills and state changes
the moment they happen. Optional quality-of-life; polling is correct, just
slower.

### One caution

`projectFundingRate` is tempting for a "next funding" readout in the market
header. Do not render a signed amount from it: the sign of the solver's
next-epoch rate is still contradicted between the SDK docs, the contract and
the vendor documentation. Magnitude plus "pays / receives" only, as the funding
section does today.

---

## Appendix A — touched slices and the symbols Prism imports

### `@symmio/trading-core`

| Slice                            | Used / exported | Imported symbols                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------- | --------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `quotes`                         |        26 / 134 | `FUNDING_HISTORY_EVENT_TYPES`, `GetQuoteHistoryReturnType`, `PlanGroupCloseFailureReason`, `QuoteCloseEventType`, `QuoteCloseType`, `QuoteEventType`, `QuoteFundingData`, `QuoteGroup`, `QuoteGroupingStrategy`, `QuoteHistoryRow`, `QuoteLifecycle`, `UnifiedQuote`, `aggregateGroupMetrics`, `aggregateGroupUpnl`, `calculateClosePlatformFee`, `calculateLiquidationPrice`, `calculateOpenPlatformFee`, `calculateQuoteLeverage`, `calculateQuotePnl`, `calculateQuoteUpnl`, `getQuoteHistoryQueryOptions`, `isActivePosition`, `isPendingOrder`, `keyQuotePerQuote`, `supportsQuoteGrouping`, `toGroupCloseCandidates` |
| `solvers/instant-open`           |        10 / 104 | `ADD_MARGIN_TO_NEXT_VA_SELECTOR`, `CalculateTradeParamsReturnType`, `INSTANT_TRADE_REQUIRED_SELECTORS`, `QuoteConstraintViolation`, `REQUEST_TO_CLOSE_POSITION_SELECTOR`, `SEND_QUOTE_WITH_AFFILIATE_AND_DATA_SELECTOR`, `calculateTradeParams`, `computePlatformFee`, `isolationTypeForSide`, `validateInstantOpenAgainstMarket`                                                                                                                                                                                                                                                                                          |
| `symmio-contracts/symmio`        |         9 / 184 | `FeeForUser`, `GetQuoteReturnType`, `LockedValues`, `OrderType`, `PositionType`, `QuoteStatus`, `WithdrawRequest`, `WithdrawStatus`, `getQuoteQueryOptions`                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `tpsl`                           |         8 / 116 | `GroupTpSlChild`, `GroupTpSlDesiredMap`, `GroupTpSlSideKey`, `GroupTpSlSideSummary`, `TpSlPriceType`, `TpSlValidation`, `supportsTpSl`, `validateTpSl`                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `symmio-contracts/account-layer` |         7 / 192 | `AccountBalanceInfo`, `SubAccountDetail`, `SubAccountIsolationType`, `calculateAvailableForOrder`, `getAccountBalanceInfoQueryOptions`, `getAccountBalanceOfQueryOptions`, `getUserSubAccountsQueryOptions`                                                                                                                                                                                                                                                                                                                                                                                                                |
| `balance-history`                |          5 / 17 | `BalanceChangeType`, `BalanceHistoryFilter`, `BalanceHistoryRow`, `GetBalanceHistoryReturnType`, `getBalanceHistoryQueryOptions`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `core/chains`                    |          4 / 20 | `SymmioChainConfig`, `SymmioSolverKind`, `SymmioSupportedChainId`, `getChainConfig`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `core/config`                    |           4 / 8 | `Config`, `CreateConfigParameters`, `GetWalletClientFn`, `SymmioWalletClient`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `solvers/notional-cap`           |          4 / 34 | `GetNotionalCapAllReturnType`, `MarketNotionalCap`, `getNotionalCapAllQueryOptions`, `getNotionalCapBySymbolIdQueryOptions`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `transfers`                      |          3 / 14 | `GetTransferHistoryReturnType`, `TransferRow`, `getTransferHistoryQueryOptions`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `margin`                         |           2 / 3 | `MarginRiskMetrics`, `calculateMarginRisk`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `price-service/enigma`           |          2 / 52 | `EnigmaMetadataByAddress`, `getEnigmaPriceServiceMetadataQueryOptions`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `solvers/estimated-price`        |          2 / 15 | `calculatePriceImpact`, `supportsEstimatedPrice`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `solvers/market-info`            |          2 / 15 | `MarketInfo`, `getMarketInfoQueryOptions`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `solvers/markets`                |          2 / 13 | `Market`, `getMarketsQueryOptions`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `websocket/notifications`        |          2 / 16 | `Notification`, `NotificationType`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `candles`                        |          1 / 41 | `CandleResolution`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `orderbook`                      |          1 / 53 | `OrderbookDepthLevel`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `price-service/types`            |           1 / 4 | `MarkPriceTick`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `shared/errors/symm-error`       |           1 / 3 | `SymmError`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `shared/utils/price`             |           1 / 1 | `decimalPriceToWei`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `solvers/capabilities`           |           1 / 4 | `SolverCapabilities`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `solvers/instant-close`          |          1 / 45 | `validateInstantCloseAgainstMarket`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `solvers/locked-params`          |          1 / 10 | `GetLockedParamsReturnType`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `symmio-contracts/collateral`    |          1 / 26 | `getCollateralBalanceQueryKey`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `websocket/socket`               |           1 / 1 | `SocketStatus`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

### `@symmio/trading-react`

| Slice             | Used / exported | Imported symbols                                                                                                                                                                                                                                                                     |
| ----------------- | --------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `quotes`          |         12 / 98 | `useAccountLiquidationPrice`, `useAccountUpnl`, `useCloseQuoteGroup`, `useCoolDownsOfMA`, `useForceCancelQuote`, `useGroupedQuotes`, `useQuoteEventsByType`, `useQuoteGroupFunding`, `useQuoteGroupMarginRisk`, `useQuotePlatformFee`, `useQuotesFunding`, `useRequestToCancelQuote` |
| `account-layer`   |        11 / 114 | `useAccountBalanceInfo`, `useAccountBalanceOf`, `useAddMargin`, `useAllocate`, `useCreateSubAccounts`, `useDeposit`, `useDepositAndAllocate`, `useEditAccountName`, `usePredictedNextVirtualAccount`, `useRemoveMargin`, `useVirtualAccountsAddressesOfSubAccount`                   |
| `instant-layer`   |          6 / 52 | `useDelegationExpiry`, `useGrantDelegation`, `useInstantCloseAuto`, `useInstantOpenWithTpSl`, `useIsDelegationActive`, `useLimitOpenAuto`                                                                                                                                            |
| `tpsl`            |          5 / 50 | `useQuoteGroupTpSl`, `useQuoteGroupTpSlEditor`, `useSetQuoteGroupTpSl`, `useTpSlConfig`, `useTpSlSupported`                                                                                                                                                                          |
| `withdraw`        |          5 / 38 | `useFinalizeWithdrawRequest`, `usePendingWithdrawRequests`, `useRequestCancelWithdraw`, `useWithdraw`, `useWithdrawableTime`                                                                                                                                                         |
| `rasa-solver`     |          3 / 24 | `useAddSolverWhitelist`, `useSolverPriceRange`, `useSolverReadiness`                                                                                                                                                                                                                 |
| `candles`         |          3 / 10 | `useBinanceCandleSource`, `useCandleStream`, `useCandles`                                                                                                                                                                                                                            |
| `collateral`      |          3 / 13 | `useApproveCollateral`, `useCollateralAllowance`, `useCollateralBalance`                                                                                                                                                                                                             |
| `wallet`          |           3 / 8 | `useConnectWallet`, `useDisconnectWallet`, `useWalletAccount`                                                                                                                                                                                                                        |
| `errors`          |           2 / 4 | `SymmioRequestError`, `normalizeSymmError`                                                                                                                                                                                                                                           |
| `margin`          |           2 / 6 | `useAccountMarginRisk`, `useAvailableInstantOpenMargin`                                                                                                                                                                                                                              |
| `orderbook`       |          2 / 11 | `useBinanceOrderbookSource`, `useLiveOrderbook`                                                                                                                                                                                                                                      |
| `price-service`   |          2 / 49 | `useEnigmaPriceServiceMetadata`, `usePrices`                                                                                                                                                                                                                                         |
| `provider`        |           2 / 5 | `SymmioProvider`, `useSymmioConfig`                                                                                                                                                                                                                                                  |
| `solvers`         |           2 / 4 | `useSolverCapabilities`, `useSupportsLimitOrder`                                                                                                                                                                                                                                     |
| `error-codes`     |           1 / 4 | `useSolverErrorCodes`                                                                                                                                                                                                                                                                |
| `estimated-price` |           1 / 3 | `useEstimatedPrice`                                                                                                                                                                                                                                                                  |
| `fees`            |           1 / 3 | `useFeeForUser`                                                                                                                                                                                                                                                                      |
| `funding-info`    |           1 / 3 | `useFundingInfo`                                                                                                                                                                                                                                                                     |
| `locked-params`   |           1 / 3 | `useLockedParams`                                                                                                                                                                                                                                                                    |
| `markets`         |           1 / 6 | `useMarkets`                                                                                                                                                                                                                                                                         |
| `notional-cap`    |          1 / 10 | `useNotionalCapBySymbolId`                                                                                                                                                                                                                                                           |
| `utils`           |           1 / 1 | `predicateMatch`                                                                                                                                                                                                                                                                     |
| `websocket`       |           1 / 3 | `useNotifications`                                                                                                                                                                                                                                                                   |

## Appendix B — untouched slices, by verdict

| Slice                                                                                                            | Exported | Verdict                                                                            |
| ---------------------------------------------------------------------------------------------------------------- | -------: | ---------------------------------------------------------------------------------- |
| `core:solvers/funding-info`                                                                                      |       13 | exercised via `useFundingInfo` (§1)                                                |
| `core:solvers/get-solver-readiness`                                                                              |        9 | exercised via `useSolverReadiness`                                                 |
| `core:solvers/get-solver-price-range`                                                                            |        9 | exercised via `useSolverPriceRange`                                                |
| `core:solvers/add-solver-whitelist`                                                                              |        4 | exercised via `useAddSolverWhitelist`                                              |
| `core:solvers/error-codes`                                                                                       |        9 | exercised via `useSolverErrorCodes`                                                |
| `core:solvers/limit-open`                                                                                        |        4 | exercised via `useLimitOpenAuto`                                                   |
| `core:symmio-contracts/instant-layer`                                                                            |       27 | exercised via `useGrantDelegation`, `useDelegationExpiry`, `useIsDelegationActive` |
| `core:websocket/prices`                                                                                          |       10 | exercised via `usePrices`                                                          |
| `core:price-service/get-mark-prices`                                                                             |        9 | exercised via `usePrices` (REST fallback)                                          |
| `core:solvers/get-error-message`                                                                                 |        9 | covered indirectly (§2)                                                            |
| `core:shared/utils/query`, `core:shared/utils/simulate-before-write`, `core:shared/utils/percent`                |        3 | plumbing (§2)                                                                      |
| `core:symmio-contracts/abi/*` (3 slices)                                                                         |        3 | raw-call only (§2)                                                                 |
| `core:solvers/types/generated/rasa-solver`                                                                       |       10 | internal (§2)                                                                      |
| `core:shared/types/properties`, `core:shared/types/query`, `core:shared/types/websocket`                         |       15 | API-building types (§3.6)                                                          |
| `core:muon`, `react:muon`                                                                                        |      157 | better not (§3.5)                                                                  |
| `core:symmio-subgraph`                                                                                           |        9 | better not (§3.6)                                                                  |
| `react:transactions`                                                                                             |        5 | better not (§3.6)                                                                  |
| `react:balance-history`, `react:transfers`, `react:market-info`                                                  |       13 | better not — fan-out rule (§3.1)                                                   |
| `core:price-service/binance`                                                                                     |       31 | better not (§3.7)                                                                  |
| `core:solvers/limit-close`                                                                                       |        4 | **could use** — item 2                                                             |
| `core:solvers/get-solver-open-interest`, `core:solvers/get-solver-balance-info`, `core:solvers/get-party-a-upnl` |       27 | **could use** — item 6                                                             |
| `core:notifications`, `react:notifications`                                                                      |       20 | **could use** — item 8                                                             |
| `core:solvers/force-close`                                                                                       |       25 | **could use** — item 10 (stretch)                                                  |
| `core:websocket/tpsl`                                                                                            |        9 | **could use** — item 11 (optional)                                                 |
