# @symmio/trading-react

## 2.0.0

### Major Changes

- 1b9cc0a: Add grouped partial close — close an exact quantity across a merged position, and fix the group's notional and leverage figures.

  A `QuoteGroup` is several on-chain quotes, so closing "2.8 of the position" means splitting that amount across children without leaving a remainder the contract will reject. `core` gains a `close-planning` slice:
  - `planGroupClose` / `PlanGroupCloseResult` — a pure, deterministic greedy plan over the children (largest open size first, `key` as tie-break) that sums to the target **exactly** or fails without closing anything. Each candidate is either closed in full or partially down to its dust cap, with the excess spilled to the next child. Failures are typed: `exceeds-open`, `nothing-to-close`, and `dust-locked` (every remaining child sits at its cap) — the last carries `closeableQuantity`, the largest amount that would have worked, so a UI can offer it instead of a bare error.
  - `minRemainingQuantityOf` — the smallest remainder a quote may keep after a partial close, `ceil(openQuantity × minAcceptableQuoteValue / (cva + lf + partyAmm))`. This mirrors perps-core v0.8.5 `LibQuoteClose.closeQuote` ("Remaining quote value is low") and rounds **up**, because a remainder one wei short reverts on-chain. A quote with no partyA-locked value on record is reported as full-close-only.
  - `toGroupCloseCandidates` — the `UnifiedQuote[]` → `GroupCloseCandidate[]` adapter.

  `react` gains `useCloseQuoteGroup`: it plans the allocation, submits **every** child close in one bulk request (`instantCloseBulkAuto`), then tracks settlement per child off the account's live notifications — a step flips to `closed` on its close-**fill** frame, advancing `closedQuantity` / `progressPercent`, and the run reaches `success` only once every child confirms. The returned `close()` promise resolves at **submit** time, not settlement; read `status` / `steps` for the rest.

  **Breaking — `QuoteGroupMetrics.notional` is renamed to `initialNotional` and changes meaning.** It was `Σ(openQuantity × openPrice)`, which shrank as a position was partially closed; it is now `Σ(quantity × (initialOpenedPrice ?? requestedOpenPrice))` — the frozen at-open notional, unaffected by partial closes. Rename the field at the call site; if you were rendering "current position value", multiply `weightedOpenPrice` by `openQuantity` yourself rather than reusing this field.

  Two figures were also wrong and now change value:
  - **Group leverage** was `notional / (cva + lf + partyAmm)` off the current locked values — it drifted as a position was partially closed and it omitted `partyBmm`. It is now `Σ(quantity × (requestedOpenPrice ?? openedPrice)) / Σ(cva + lf + partyAmm + partyBmm)`, each child folding its frozen `initialLockedValues` when known. This is blended **opening** leverage and it holds steady across partial closes.
  - **`calculateQuoteLeverage`** returned `"0"` for a quote whose `requestedOpenPrice` is `0` (a market order, where only the settled price exists). It accepts an optional `openedPrice` used as the reference price in exactly that case. Existing callers are unaffected.

- 04c4973: Add multi-chain support and a second solver **kind** — the config, identity, and per-kind normalization that let one SDK serve Enigma (lowcap) and Rasa (majors) side by side, and add Base as a second chain.

  **Config & identity.** A chain now registers a map of solvers keyed by `SolverId`, where the id **is** the solver's kind — `SolverId = SymmioSolverKind = "enigma" | "rasa"` — because a chain registers at most one solver per kind. `getDefaultSolver` resolves a chain's default; actions take an optional `solverId` and fall back to it (mirroring the `chainId` fallback). The chain config gains `SymmioListingConfig` and `SymmioInventoryConfig` (the lowcap Pools backends), and its notifications config splits per kind into `SymmioEnigmaNotificationsConfig` / `SymmioRasaNotificationsConfig` (a discriminated `SymmioNotificationsConfig`). `createConfig` / `mergeChainConfig` validate every configured solver against the supported kinds and reject an unknown one. Base ships as a second chain (`SymmioSupportedChainId.BASE`) hosting a Rasa solver.

  **Per-kind response normalization.** Different solver kinds serve the same logical endpoint with different response shapes, so the reads that diverge now return a **discriminated union on `kind`** rather than a raw vendor type — read the shared fields without narrowing, narrow on `kind` for a solver's exclusive fields, or pass a literal `solverId` to get one variant directly:
  - markets — `Market = EnigmaMarket | RasaMarket` (+ `NormalizedMarketByKind`)
  - market info — `MarketInfo = EnigmaMarketInfo | RasaMarketInfo` (+ `RasaMarketInfoRow`, `NormalizedMarketInfoByKind`)
  - notional cap — `MarketNotionalCap` gains `EnigmaNotionalCap | RasaNotionalCap` (+ `NormalizedNotionalCapByKind`)
  - `searchNotifications` — one interface over both kinds: an enigma solver hits the notification service (`POST /api/v1/search`), a rasa solver hits its own position-state endpoint, returning `NotificationSearchResult = EnigmaNotificationSearchResult | RasaNotificationSearchResult`.

  **Breaking — removed / renamed exports.** The per-kind union replaces the previous single-shape reads:
  - `toMarketInfo` and `toMarketNotionalCap` are **removed** — the per-kind adapters are internal; call `getMarketInfo` / the notional-cap reads and read the normalized union.
  - `SymbolContractSymbol` is **removed**; use `Market` / `EnigmaMarket` from the markets slice.
  - `DefilyticsNotificationEnvelope` is **renamed** to `EnigmaNotificationEnvelope`, and `RawPositionNotification` is now joined by `RawEnigmaPositionNotification` / `RawRasaPositionNotification`. `buildRasaSubscribeMessage` is the Rasa twin of `buildSubscribeMessage`.

  **Rasa-only solver reads.** Endpoints only a `rasa` solver exposes — `getSolverBalanceInfo`, `getPartyAUpnl`, `getSolverOpenInterest`, `getSolverPriceRange`, `getSolverReadiness`, `getErrorMessage`, and `addSolverWhitelist` — each throwing a typed `UNSUPPORTED_BY_SOLVER` `SymmError` when the resolved solver is not a Rasa solver. The generated Rasa request/response schemas are re-exported for callers that need the raw wire shape.

  **Solver metadata & analytics reads.** `getSymbols` (the `/contract-symbols` catalogue, `SolverSymbol` with `SymbolStateFilter` / `SymbolValidityFilter`) and `getTradeVolume` (`SolverDailyVolume`), plus `getCoolDownsOfMA` and `getPendingQuotes` on the account reads, and `calculateAvailableForOrder` — the collateral a cross-margin (majors) account can still commit to a new order.

  `@symmio/trading-react` adds the matching hooks — the Rasa-only family (`useSolverBalanceInfo`, `usePartyAUpnl`, `useSolverOpenInterest`, `useSolverPriceRange`, `useSolverReadiness`, `useErrorMessage`, `useAddSolverWhitelist`), `useSymbols`, `useTradeVolume`, `useAccountUpnl`, `useCoolDownsOfMA`, and the per-kind `useSearchNotifications` (narrow on `data.kind`). All are `solverId`-aware and inherit the chain's default when it is omitted.

- d0e2a12: Add the contract-ready Muon signature assemblers the Rasa (majors) flows need, and let signed InstantLayer operations delegate a calldata region to a solver.

  Muon itself is deployment-agnostic — one `symmio` app on one shared gateway set serves both deployments, and the per-deployment input is the `symmio` request param (the chain's diamond), which the SDK already resolves per chain. What was missing was everything downstream of the attestation.

  **New in `@symmio/trading-core`**
  - `getSendQuoteUpnlSig` — assembles a Muon `uPnl_A_withSymbolPrice` attestation into `SingleUpnlAndPriceSig`, the `upnlSig` argument of `sendQuoteWithAffiliateAndData`. Solvers that enforce Muon verification require a live one.
  - `getForceClosePriceSig` — assembles a Muon `priceRange` attestation into `HighLowPriceSig`, which `forceClosePosition` verifies.
  - `SingleUpnlAndPriceSig` and `HighLowPriceSig` types, mirrored field-for-field from perps-core v0.8.5 `MuonStorage.sol`. Note `HighLowPriceSig.upnlPartyB` precedes `upnlPartyA`.
  - `sendQuoteUpnlSigFlexRange(callData)` — locates the encoded `upnlSig` region so it can be delegated to a solver. Argument indices are derived from the shipped ABI, not hardcoded.
  - `buildSignedOperation` now accepts `flexFields` and `maxUses` (defaults unchanged: `[]` and `1n`).

  **`instantOpen` now dispatches per solver kind**

  Enigma (lowcap) and Rasa (majors) open positions differently, and `instantOpen` now has one adapter per kind instead of assuming Enigma's shape for both:
  - **Enigma** — unchanged two-operation flow (`addMarginToNextVA` + `sendQuote`), still requiring `margin`, now additionally delegating the quote's `upnlSig` region to the solver via a `FlexField`.
  - **Rasa** — a single `sendQuote` operation signed for the sub-account (cross-margin, no virtual account, no `addMargin`), carrying a live Muon signature, posted to `/instant_trade/open` via the new `sendRasaInstantOpen`.

  `InstantOpenParameters` gains an optional `solverId` and makes `margin` optional (required by Enigma at runtime, ignored by Rasa). `InstantOpenReturnType` becomes a union discriminated on `kind` — `EnigmaInstantOpenResult | RasaInstantOpenResult`, the latter carrying the normalized `rfq`. Both are generic over the solver kind, so a literal `solverId` narrows them; `useInstantOpen` threads the same generic.

  **New in `@symmio/trading-react`**
  - `useSendQuoteUpnlSig` and `useForceClosePriceSig`, both mutations like the other Muon hooks.

  **Behavior changes**
  - `InstantOpenReturnType` now carries a required `kind` discriminant. Code that constructs or exhaustively destructures that value needs updating; code that only reads `success` / `tempQuoteId` / `partyBmm` is unaffected.
  - `getFakeSendQuoteMuonSignature` now emits a 32-byte zero `reqId` instead of `0x`, so the encoded `upnlSig` region is the size a solver's flex fill expects. This changes the bytes of the placeholder quote calldata (and therefore its EIP-712 struct hash) for lowcap opens.
  - `getDeallocateUpnlSig` now throws `MUON_SIG_MALFORMED` (was `MUON_UPNL_SIG_MALFORMED`) when the attestation is missing its Schnorr share, and `MUON_FIELD_MALFORMED` rather than a raw `TypeError` when `uPnl` is absent. Both now come from the shared envelope helper used by all three assemblers.

### Minor Changes

- d0e2a12: Add Binance USD-M Futures as a second price provider, behind a provider-agnostic mark-price facade.

  Majors trade against the Rasa solver, which has no mark-price feed of its own — no REST mark price, no mark-price WebSocket, no index price. Binance is the live price source, matching how the reference UI configures that solver. Until now the SDK shipped only the Enigma price service, and Base's `priceService` was a placeholder pointing majors markets at Enigma's _lowcap_ feed.

  **New public API**
  - `getMarkPrices(config, { chainId?, solverId?, names? })` (+ `getMarkPricesQueryKey` / `getMarkPricesQueryOptions`) — a one-shot snapshot from whichever provider serves the resolved solver.
  - `watchPrices(config, { …, onPrices })` — the provider-agnostic live feed, so a positions table or trade ticket never branches on provider.
  - `watchBinancePrices` / `parseBinancePriceFrame`, plus `getBinancePremiumIndex`, `getBinanceSymbolsInfo` and `getBinanceHealth` (+ their query factories) — the provider-specific twins, mirroring the existing Enigma price-service family. Each throws `UNSUPPORTED_BY_PRICE_SERVICE` when the resolved provider is not Binance. `getBinanceHealth` resolves `false` rather than throwing when the endpoint is unreachable, so a regional block reads as a health state instead of an error.
  - `MarkPriceTick`, a discriminated union on `provider` (`EnigmaMarkPriceTick | BinanceMarkPriceTick`), plus `NormalizedMarkPriceByProvider`. Read `name` / `markPrice` without narrowing; narrow to reach Binance's `indexPrice` and funding fields.
  - `SymmioSolverConfig.priceService?` — an optional per-solver override falling back to the chain-level price service, so one chain can host solvers that price differently.

  **New in `@symmio/trading-react`**

  The provider-agnostic mark-price hooks, each resolving whichever provider serves the target solver so a component never branches on provider:
  - `usePrices` (the live feed — returns both an ergonomic `prices` map and the full `ticks` map; narrow a tick on `provider` for Binance's `indexPrice`), `usePriceByName` / `usePriceByMarketId` (one market, with re-render gating), and `useMarkPrices` (the one-shot REST read).
  - `useBinancePrices` / `useBinanceHealth` / `useBinancePremiumIndex` / `useBinanceSymbolsInfo` — the Binance-specific twins, where every tick is a `BinanceMarkPriceTick` so `indexPrice` and the funding fields are reachable without narrowing. Each surfaces `UNSUPPORTED_BY_PRICE_SERVICE` when the target solver is not priced by Binance.

  Pass `names` on Binance: its stream pushes every listed symbol once per second, and the filter is what keeps that from churning the component tree. The Enigma-specific hooks (`useEnigmaPriceByMarketId`, …) now throw `UNSUPPORTED_BY_PRICE_SERVICE` on a chain whose provider is not Enigma, matching the core reads.

  **Behavior changes**
  1. `resolveMarkPrice` — and therefore `prepareInstantOpenParams` / `prepareInstantCloseParams` — now reads the price provider configured for the _resolved solver_ rather than always Enigma. A caller-supplied `markPrice` still short-circuits it, unchanged.
  2. `prepareInstantOpenParams` / `prepareInstantCloseParams` now forward `solverId` to every solver-scoped resolver **and carry it into their returned parameters**. Previously it was dropped, so a quote priced and sized for one solver was signed against the default solver's `partyB` (which is part of the signed EIP-712 payload) and submitted to that solver's URL. `resolveMarket` and `resolveLockedParams` gained a `solverId?` parameter for the same reason.
  3. Base's `priceService` changes from an Enigma placeholder to Binance. Anyone reading Base prices previously received Enigma's lowcap feed for majors symbols — i.e. wrong data. Base's `subgraphs` and `notifications` remain placeholders.
  4. `SymmioPriceServiceType` gains `"binance"`. Union widening is non-breaking for most consumers but will break an exhaustive `switch` over it or a `const t: "enigma" = …` annotation.
  5. `createConfig` now validates `priceService.type` on the chain block and on every solver-nested override, throwing `UNSUPPORTED_PRICE_SERVICE_TYPE`.
  6. `mergeChainConfig` can now throw `PRICE_SERVICE_OVERRIDE_INCOMPLETE` on a `priceService` override it previously accepted silently. A `type` swap must restate both URLs; inheriting the previous provider's endpoints would point one provider's client at another's host, which type-checks cleanly and 404s at runtime. Same-type partial overrides (the common `{ url, wsUrl }` staging shape) are unaffected.
  7. The five Enigma price-service reads and `watchEnigmaPrices` now throw `UNSUPPORTED_BY_PRICE_SERVICE` when the resolved provider is not Enigma. For the watcher this replaces a _silent_ failure: it would otherwise connect, parse every Binance frame to nothing, and report `open` while delivering zero ticks forever.
  8. `RESOLVE_MARK_PRICE_NOT_FOUND` keeps its code (the contract) but its message now names the provider, and hints when a `::`-suffixed lowcap name is sent to Binance.

  **Notes**

  Binance's WebSocket endpoint is configured as `wss://fstream.binance.com/market/ws/!markPrice@arr@1s`. Binance's _documented_ `/ws/<stream>` form was verified against the live endpoint to connect and then never push a frame, so using it would ship a silently dead feed. Both Binance URLs stay in config as the escape hatch for regional restrictions — repoint them at a proxy with no SDK change.

  Binance's `lastFundingRate` is exposed on the tick as `binanceLastFundingRate` but is **not** the funding a SYMMIO position is charged; `getFundingInfo` remains authoritative for that.

  The two Binance wire shapes are hand-written rather than generated: Binance publishes an official OpenAPI spec for SPOT only, and pointing Orval at a community futures spec would make an unaudited third-party repo a build input for types that reach a signed trade payload. See the `TODO(binance-openapi)` note in `orval.config.ts`.

- 8cddfc3: Add a candles slice — chart data decoupled from any chart library, with Binance as the first source.

  Consumers pick their own charting library, so the SDK's boundary is the data, not the widget. `CandleSource` is the whole contract: symbol metadata, historical bars for a range, and a live subscription. Everything else is written against that interface, never against a venue.

  `core` gains:
  - `CandleSource` / `Candle` / `CandleResolution` — the shared vocabulary, with bar times always in unix **milliseconds**, UTC.
  - `CandlePriceBasis` on every source (`reference-exchange` | `dex-pool` | `solver-mark`). A chart drawn from a reference exchange is not the price a SYMMIO trade settles at, so the SDK states which it is rather than leaving the UI to assume.
  - `createBinanceCandleSource` — USD-M futures by default (its symbols are perpetuals, matching what a SYMMIO market is), spot optional. History from `/klines`, live bars from the kline WebSocket, both reachable straight from a browser with no key or proxy. `exchangeInfo` is fetched once per source and cached to resolve price precision from the venue's own tick size.
  - `toTradingViewDatafeed` — adapts any source to TradingView's Charting Library. The datafeed contract is modeled **structurally**, so the returned object satisfies the library's `IBasicDataFeed` without the SDK depending on a licensed package that is not on npm.
  - `getCandlesQueryOptions` — TanStack options keyed by source id, so two venues never share a cache entry.

  `react` gains `@symmio/trading-react/candles`: `useBinanceCandleSource` (memoized, since a source caches `exchangeInfo`), `useCandles`, `useCandleStream` (handlers read through refs, so inline arrows do not re-dial the socket), and `useTradingViewDatafeed`.

  Three correctness details that a naive port of the usual datafeed gets wrong:
  - **Backfill pages backwards from `to`, sending `endTime` only.** Binance caps a bounded range from its _start_: passing `startTime`, `endTime` and `limit` together returns the OLDEST `limit` bars in the window, so a chart scrolling back receives the wrong end of the range. The `from` bound is applied client-side instead.
  - **Live frames are matched on symbol _and_ interval.** Matching on symbol alone lets two charts on different resolutions feed each other's series.
  - **A reconnect raises `onReset`**, wired to the library's `onResetCacheNeeded`, so a gap forces a history refetch rather than splicing a live bar onto a stale series. Requests are also capped at the real per-market maximum (1500 on futures, 1000 on spot), which is a hard `-1130` error rather than a silent clamp.

  Lowcap markets are deliberately out of scope here: their candles need a different source, and the price basis question there is unresolved.

- 1b9cc0a: Add grouped funding — read the settled funding of a merged position as one total and one merged timeline.

  `core` gains:
  - `aggregateGroupFunding` / `QuoteGroupFunding` — a pure fold of the per-quote `QuoteFundingData` rows into a single group total. De-duplicates by `quoteId`, skips optimistic children, tolerates over-fetched rows, and reports `isComplete` so a partially-indexed group reads as "funding unknown" rather than "no funding".
  - `getQuotesEventsByType` (plus `getQuotesEventsByTypeQueryKey` / `getQuotesEventsByTypeQueryOptions`) — the batched sibling of `getQuoteEventsByType`: many quote ids, one round-trip, rows already interleaved and sorted by `timestamp`, paged over the **merged** stream via `first` / `skip` and a `hasMore` flag. An omitted `first` asks for the 1000-row ceiling The Graph enforces, so an un-paged call returns everything one request can serve instead of a small default page.
  - `FUNDING_HISTORY_EVENT_TYPES` — the charge-event subset behind a funding timeline (`PRICE_HISTORY_EVENT_TYPES` minus `SETTLE_UPNL`).

  `react` gains `useQuoteGroupFunding` (the group total plus per-child rows aligned 1:1 with `group.quotes`) and `useQuoteGroupFundingHistory` (the merged, time-sorted per-tick timeline; every row carries its own `quoteId`, so a per-position breakdown is a client-side `groupBy`).

  **Sign convention** — `netReceived = received − paid` everywhere in this slice: a **positive** `netReceived` means the position **earned** funding, the P&L perspective trading venues present. It matches the polarity of `QuoteGroupUpnl.upnl`, so a card can colour and total funding and uPnL together, and it is the inverse of the cost-positive on-chain `int256`. A UI that colors "money in" green renders it as-is — the SDK nets it the way it is read, so no consumer negates.

  **Settled to date only** — every total and row covers funding the protocol has already charged and the analytics subgraph has indexed. Funding accrued since a quote's last funding charge is not indexed anywhere and is therefore not included.

  Two behavioural fixes ship alongside. Both can legitimately change numbers a consumer already renders:
  - **`getQuoteFunding` now pages internally.** The Graph silently caps an un-`first`-ed query at 100 entities, so any batch above that was truncated: the extras came back as `missingQuoteIds`, and a caller that ignored completeness showed a wrong total. Ids are now chunked at `QUOTES_FUNDING_MAX_IDS_PER_REQUEST` (1000, newly exported), issued concurrently, and merged; callers pass the full id list however long it is.
  - **`useQuotesFunding` no longer double-counts a repeated `quoteId`.** The sums fold over the distinct on-chain ids, and `netReceived` is derived as `received − paid` so the aggregate keeps the row-level invariant. `rows` is now aligned 1:1 with `quotes` on every path — including while loading and when no on-chain ids were requested — and `missingQuoteIds` reports every requested id while the query is in flight or has failed, instead of an empty list that read as "nothing missing".

- 1b9cc0a: Add margin & risk — read a merged position's margin, equity and distance to liquidation as one figure set.

  `core` gains a `margin` slice:
  - `calculateMarginRisk` / `MarginRiskMetrics` — a pure, **single-account** fold of `balanceInfoOfPartyA` plus the account's unrealized PnL into `totalMargin`, `maintenanceMargin` (`lockedCVA + lockedLF`), `initialMargin` (`+ lockedPartyAMM`), `equity`, `remainingToLiquidation`, `liquidationBufferPercent` and `isLiquidatable`. `isLiquidatable` is bit-for-bit the on-chain predicate `allocatedBalance − (cva + lf) + upnl < 0` (`LibAccount.partyAAvailableBalanceForLiquidation`, perps-core v0.8.5), so a UI never has to approximate it with a threshold on the buffer percent.
  - `aggregateGroupUpnl` / `QuoteGroupUpnl` — a pure bigint fold of a group's children into one signed unrealized-PnL total at the current mark price, with an `isComplete` flag so a group whose fill price has not settled reads as "PnL unknown" rather than "no PnL". Resting orders contribute nothing and are not counted as unvalued.
  - `decimalPriceToWei` — decimal price string to 18-decimal wei. Returns `undefined`, never `0n`, for an unparseable input: a fabricated `0n` mark price makes a uPnL fold report a −100% loss.

  `react` gains `useAccountMarginRisk` (one account) and `useQuoteGroupMarginRisk` (a `QuoteGroup`: resolves its Virtual Account, folds the group uPnL against a mark price you inject or it subscribes to, and returns the metrics alongside the account's liquidation price).

  **Margin risk is per liquidation domain and is never blended.** Each Virtual Account is liquidated on its own balance, so a group spanning several accounts reports `isMultiAccount: true` with `metrics: undefined` and exposes `accounts` — call `useAccountMarginRisk` per address. Summing balances across accounts would hide an account that is about to be liquidated behind a comfortable-looking average.

  `liquidationBufferPercent` is an 18-decimal fixed-point percent and is **not clamped**: it exceeds `100%` on a profitable book, goes negative once liquidatable, and is `undefined` when the zero-uPnL cushion is not positive. Clamp it at the render layer if you draw a bar.

  `sharePercent` moved from the TP/SL slice to shared utilities, and `triggerPriceToWei` now delegates to `decimalPriceToWei`. Both keep their exported name, signature and behaviour — no consumer change.

- 1b9cc0a: Add grouped TP/SL — read, plan, set and cancel take-profit / stop-loss orders across a merged position.

  A `QuoteGroup` is several on-chain quotes, and the conditional-order handler takes one signed request per quote. `core` gains a pure `tpsl/grouping` slice that folds those legs into one state and works out the smallest honest fan-out:
  - `toGroupTpSlChildren` / `summarizeQuoteGroupTpSl` / `toGroupTpSlOrders` — the cell and overview data model, with **notional-weighted** coverage rather than a count ratio.
  - `planGroupTpSl` — diffs a desired state against what the handler already holds, so an unchanged leg is never resubmitted and an unchanged side is dropped from its leg. Emits `set` / `delete` / `skip` per child with typed skip reasons and per-child validation.
  - `planGroupTpSlDelete` — the cancel-all plan, reading each `cohQuoteId` off the confirmed snapshot and excluding in-flight sides.
  - `estimateGroupTpSlReturn` — signed return if every staged trigger fires.

  `react` gains `useQuoteGroupTpSl` (one query per leg on the shared TP/SL key, one socket per distinct account), `useQuoteGroupTpSlEditor` (edit buffer, apply-to-all, live validation and plan), `useSetQuoteGroupTpSl` (sequential signed writes with per-leg progress and retry-failed-only) and `useDeleteQuoteGroupTpSl` (bounded-parallel cancels).

  `useSetQuoteGroupTpSl` executes **both** halves of the plan: a side the caller clears becomes a `deleteQuoteTpSl` cancel, a side with a new value becomes a `setQuoteTpSl` write, and one leg can do both in the same run. Steps carry a stable `id` and a `kind` (`"write" | "cancel" | "skip"`) because a leg can now produce several.

  Run reporting is stricter as a result:
  - `confirming` outranks `partial`, so a failure on one leg no longer makes the run terminal while another still awaits its handler report.
  - `acceptedCount` replaces the old `completedCount` and **excludes** failures; `failedCount` is reported alongside it.
  - A step is only confirmed by the transition it is actually waiting for — a _live_ report for a write, a _gone_ report for a cancel — so a shared socket cannot cross-confirm.
  - `retryFailed` merges onto the previous step list instead of replacing it, so successful legs keep their state.
  - A rejected wallet signature stops the run by default (`stopOnUserRejection`) rather than prompting for every remaining leg.

  Also fixes `useQuoteTpSl`, which returned a cast object whose `isLoading` / `isFetching` / `error` / `refetch` were `undefined` at runtime. It now returns those for real; the underlying query stays available as `query`.

  The React TP/SL hooks now refetch the handler's authoritative rows on a successful set or cancel (`invalidateTpSlReads`), so a box resolves out of `confirming` — and a cancelled side clears — even when the live WebSocket frame is missed. This applies to `useSetQuoteTpSl` / `useDeleteQuoteTpSl` and both grouped hooks.

  Grouped TP/SL run steps now resolve from the shared store (fed by every WebSocket subscription and the success refetch) rather than from each run hook's own subscription. A step no longer sticks on `confirming` when the handler's notification arrives on a channel that hook did not subscribe to.

- 04c4973: Add inventory TVL and solver-revenue reads — the analytics behind a pools / solver dashboard.

  **Inventory service** (`./inventory`) — the custody backend behind the lowcap Pools, a **separate vendor** from both the solver and the listing backend. `getInventoryTvl` reads the system-wide custodial TVL as a `bigint` at `INVENTORY_VALUE_DECIMALS` (18); `getInventoryTvlHistory` is its per-market twin, the TVL series behind one pool's chart (`InventoryTvlPoint`). `resolveInventoryService` returns the chain's configured backend and `supportsInventoryService` is its non-throwing boolean twin for gates.

  This TVL is deliberately **not** the sum of the pool catalogue's per-pool `tvl`: the catalogue covers listed markets, the inventory service covers the whole custodial system. Treat them as different numbers.

  **Solver revenue** — two reads off the chain's solver, Enigma-only:
  - `getSolverRevenue` — aggregate revenue totals, protocol-wide by default or for one market via `symbolId`, split into a hedger-fee share and a funding share whose sum is `totalRevenue` (`SolverRevenue`, `SolverRevenueTimeRange`).
  - `getRevenueRecords` — the itemized revenue rows behind that total (`SolverRevenueRecord`), for a table rather than a headline figure.

  `@symmio/trading-react` adds `useInventoryTvl` / `useInventoryTvlHistory`, `useSolverRevenue`, and `useRevenueRecords`, each a thin TanStack-Query wrapper over its core read with the resolved chain/solver threaded through.

- 04c4973: Add LIMIT orders, force-close, and force/request cancel — capability-gated writes for solvers that support resting orders and the on-chain escape hatches for stuck quotes.

  **Solver capabilities.** `getSolverCapabilities` reads a solver's declared feature flags into `SolverCapabilities`; `supportsLimitOrder` and `supportsGroupClose` are the boolean gates. Flags default to `false` — a solver must **declare** a capability to enable it — so a UI degrades gracefully instead of erroring against a solver that lacks the feature (Rasa/majors declare `limitOrder`; Enigma/lowcap declares `groupClose`).

  **LIMIT open / close.** `prepareLimitOpenParams` / `prepareLimitCloseParams` take the same inputs as their instant (market) twins, except the caller supplies an explicit resting **`price`** instead of a `markPrice` + `slippage` band. The order rests at exactly that price with **zero slippage** applied, and the request is tagged `orderType = LIMIT`, so the hedger writes a **pending** on-chain quote at that price rather than filling at mark. `limitOpenAuto` / `limitCloseAuto` are the prepare-then-submit one-call convenience actions.

  **Force-close.** When a solver stops answering close requests, `forceClosePosition` closes a quote directly on-chain against a Muon `priceRange` attestation (`HighLowPriceSig`, from `getForceClosePriceSig`), wrapped in the AccountLayer `_call` proxy. `checkForceCloseEligibility` / `findForceCloseWindow` / `previewForceClosePrice` / `getForceCloseParams` are the pure and read-side helpers that decide whether a force-close is allowed and at what price (`ForceCloseEligibility`, `ForceCloseIneligibleReason`, `ForceCloseWindow`); `forceCloseAuto` fetches the signature and submits in one call.

  **Force / request cancel.** The two-step cancel escape hatch for pending quotes, all routed through the `_call` proxy so the caller is the subaccount:
  - `requestToCancelQuote` → `forceCancelQuote` — cancel a pending open (e.g. a resting LIMIT order): request first, force it after the cooldown if the solver does not act.
  - `requestToCancelCloseRequest` → `forceCancelCloseRequest` — the same pair for a pending **close** request.

  `@symmio/trading-react` adds `useSolverCapabilities` / `useSupportsLimitOrder` / `useSupportsGroupClose`, `useLimitOpenAuto` / `useLimitCloseAuto` and `useLimitOrders` (the resting-order list), `useForceClose` / `useForceCloseEligibility` / `useForceCloseParams`, and `useForceCancelQuote` / `useRequestToCancelQuote` / `useForceCancelCloseRequest` / `useRequestToCancelCloseRequest`.

- 04c4973: Add an orderbook slice — market depth decoupled from any venue, with Binance as the first source.

  An `OrderbookSource` is the whole contract: symbol metadata, a depth snapshot, and a live subscription. Ladders, depth charts and price-impact estimates are all written against that interface, never against an exchange. As with candles, `priceBasis` states what the depth actually represents — a reference exchange's resting liquidity is **not** what a SYMMIO trade executes against.

  `createBinanceOrderbookSource` is the reference source for major markets. Its live book is **not** a stream of deltas applied on faith: it implements Binance's documented local-order-book procedure, verifies that every update chains onto the last, and rebuilds from a fresh snapshot the moment one does not — with `onResync` / `resyncReason` telling the consumer it happened, so a stale ladder can say so rather than drift silently. Depth limits, update speeds and the buffered-event cap are all exported constants.

  The pure helpers on top work on any source's book: `groupOrderbook` (onto a tick), `accumulateOrderbook` (cumulative depth), `getOrderbookSpread`, `walkOrderbook` / `getOrderbookDepthWithin` (fill-walking for impact), plus tick utilities (`roundToTick`, `countTickDecimals`, `suggestOrderbookTickSizes`). `getOrderbookQueryOptions` keys a one-off snapshot by source id so two venues never share a cache entry.

  `@symmio/trading-react` adds `useBinanceOrderbookSource` (a stable memoized source), `useLiveOrderbook` (the one most ladders want — a synchronized book, grouped onto a tick, with cumulative depth and spread already derived, exposing `isResyncing` / `resyncReason`), `useOrderbookStream` (the raw synchronized book for custom aggregation), and `useOrderbook` (a snapshot through TanStack Query). Import the value types (`Orderbook`, `OrderbookLevel`, `OrderbookSource`) from `@symmio/trading-core`.

- 04c4973: Add the lowcap **Pools** data layer — the whole listing-backend flow behind a pools page: catalogue, authentication, per-LP market config, pool detail, rewards, claims, LP withdrawals, and market listing/refund/retry.

  Pools are the lowcap side of SYMMIO served by a per-chain **listing backend** ({@link SymmioListingConfig}), a separate vendor from the solver and the subgraph. Listing is resolved **at chain level**: `resolveListingService` returns the chain's backend (throwing `LISTING_NOT_CONFIGURED` where a chain has none), and `supportsListingService` is its non-throwing boolean twin for `enabled` gates. Enigma-only.

  **Money is always 18-decimal `bigint`.** Every money and rate field on a pool row is a `bigint` at `LISTING_VALUE_DECIMALS` (18) — `1e18` is `$1` — independent of the collateral token's own decimals. A `null` means the backend reported no value; it never collapses to `0`. `parseListingValue` / `toListingValue` are the descaling helpers. APR/APY fields descale to a percentage instead; the reward series are money.

  **Catalogue (`getListingMarkets`)** — search, filter, sort and pagination are all **server-side**, so every parameter change is a fresh request rather than a re-view of an already-fetched page (`ListingMarketFilters`, `ListingMarketSortField`, `ListingSortDirection`, `ListingValueRange`, `ListingTimeRange`). `getUserListingMarkets` is its authed, caller-scoped twin — the signed-in user's own pools across every `ListingMarketStatus`, so a UI filters by status client-side rather than refetching.

  **Authentication (`authenticateListing`)** — SIWE. `getListingSignInMessage` builds the message to sign (`ListingSiweParams` / `ListingSignInMessage`); `authenticateListing` exchanges the signature for a bearer `ListingAuthToken`. Every authed read/write below takes that token.

  **Per-LP market config** — a pool's max leverage and buyback percentage are **not** set by any one LP. Each depositor submits an _opinion_ with `updateListingMarketConfig`, and the backend folds them into a deposit-weighted average, so a call **nudges** the pool rather than overwriting it. `getListingMarketConfig` reads the caller's own opinion back (`null` until they have ever set one) alongside the values in force; `projectListingMarketConfig` estimates where the pool lands **before** the write, from the pool detail plus the caller's stake. Both knobs are plain whole numbers (`LISTING_MARKET_CONFIG_BOUNDS`) — `50` is 50%, `20` is 20× — **not** 18-decimal. The write is authed, requires a deposit address on the market (minted by default), and is rate-limited to `getListingConfig().rateLimits.marketConfigUpdatesPerDay` per market in a rolling 24h window.

  **Pool detail** — the tables on a pool page, spanning three backends: `getListingMarketDetail` (listing backend — aggregate stats + inventory; `toPoolPositions` folds it into positions rows with no extra request), `getPoolQuotes` / `getPoolTradeHistory` (analytics subgraph — the pool's **whole** book and realized history, carrying **no** `partyA` filter, unlike the account-scoped quote reads), and `getPoolTransactions` (listing backend — deposits and withdrawals). A pool's resting limit orders are deliberately not here: they come from the TP/SL handler via `searchTpSlOrders({ symbolId, conditionalOrderType: "send_quote" })`.

  **Rewards** — `getPoolRewardChart` / `getPoolTotalReward` are **public**, one pool, addressed by `(marketAddress, marketChainId)`, where `marketChainId` is the chain the pool's token lives on (`ListingMarket.chainId`), not the SDK's own `chainId`. `getUserRewardChart` / `getUserTotalReward` are **authed** and cover every market the user has rewards in, so a single-pool view filters the series itself. Rewards are money (18-decimal), built from **earned** daily snapshots, so claiming does not reduce them — `getUserProfit` holds the claimable balance.

  **Money movements** — `getUserProfit` + `getDepositAddress`; `claimProfit` (+ `getClaimHistory`), `withdrawLp` and `cancelWithdraw`; `addMarket` to list a new market, and `refundMarket` / `retryListing` (+ `getRetryListingInfo`) for a rejected listing. `getWeeklyListingLimit` reports the remaining new-listing allowance. `getUserTransactions` is the account-wide, authed transaction history (deposits, withdrawals, claims) across every pool.

  `@symmio/trading-react` adds one hook per read and write above — `useListingMarkets`, `useUserListingMarkets`, `useAuthenticateListing`, `useListingConfig`, `useListingMarketConfig` / `useListingMarketConfigProjection` / `useUpdateListingMarketConfig`, `useListingMarketDetail`, `usePoolQuotes` / `usePoolTradeHistory` / `usePoolTransactions`, `usePoolRewardChart` / `usePoolTotalReward` / `useUserRewardChart` / `useUserTotalReward`, `useUserProfit` / `useDepositAddress`, `useClaimProfit` / `useClaimHistory`, `useWithdrawLp` / `useCancelWithdraw`, `useAddMarket` / `useRefundMarket` / `useRetryListing` / `useRetryListingInfo`, `useWeeklyListingLimit`, `useUserTransactions`, `useListingStatus`, and `useSupportsListingService` for gating. The write hooks invalidate the reads their effect changes (a claim/withdraw refreshes profit, balances and `useUserTransactions`), so a panel settles without a manual refetch.

  **Out of scope**: the pool candle/orderbook charts (see the candles and orderbook slices) and the on-chain deposit/allocate transaction itself (that is the existing account-layer flow) — this slice is the listing backend's own reads and writes.

- 306228e: Grouped TP/SL now waits for the handler's notification before reporting success.

  `useSetQuoteGroupTpSl().set()` and `useDeleteQuoteGroupTpSl().deleteOrders()` used
  to resolve as soon as every request had been accepted, leaving confirmation to
  run on in the background. They now resolve only once the WebSocket has reported
  each step — live for a write, gone for a cancel — so awaiting them means the
  exits are real rather than merely submitted.

  Three things had to change for that to be true rather than accidental:
  - **The runs subscribe to every channel their orders can report on.** The cancel
    run watched only the first Virtual Account, so a group spanning several was
    half-covered. Both runs now watch the sub-account — where the handler actually
    publishes, since a report's `address` is the subscribing account rather than
    the VA that owns the order — plus every VA the plan touches.
    `notificationsAccounts` replaces the deprecated single-address
    `notificationsAccount`, and `useQuoteGroupTpSl` gains a `subAccount` parameter
    for the same reason.
  - **A racing refetch can no longer erase a pending write.** The post-request
    refetch routinely beat the handler's own bookkeeping and came back empty,
    folding the side to `canceled` and blanking the price the trader had just set.
    `markConfirming` now records the `intent` behind a `"confirming"` side and
    `setRows` holds a pending write until the rows list it, a report lands, or the
    guard window closes. New `clearConfirming(id, side)` releases it.
  - **The wait is bounded.** `confirmationTimeoutMs` (default 45s) refetches the
    handler's rows and, failing those, fails the step with
    `error.code === "TPSL_CONFIRMATION_TIMEOUT"` — distinct from a rejected
    request, and still counted in `submittedCount` / `deletedCount`.

  Both summaries gain `confirmedCount`, and `progressPercent` now advances on
  confirmations rather than on acceptances, so a progress bar no longer reads 100%
  while the handler has yet to answer.

- 306228e: Confirm grouped TP/SL from the handler when the WebSocket report never arrives.

  **Fixes a false confirmation.** A pending write used to be settled by any
  snapshot that listed the side — including a _stale_ one. Editing a take-profit
  from 150 to 160 and refetching before the handler caught up reported the edit as
  confirmed and rendered 150 as though it were live. A write is now settled only
  by evidence of the order that was actually submitted: a matching `coh_quote_id`,
  or a matching trigger price and price type. Confirmations that seeded neither
  behave as before. This closes the same hole on the existing per-quote read,
  where a window-focus refetch could trigger it, and it flips the expectation of
  one store test.

  **Adds the fallback sweep.** New `searchTpSlOrders` in core wraps
  `POST /api/v5/search/`, returning `{ orders, count, isComplete }` for one
  account. The WebSocket report keeps the first `fallbackPollDelayMs` (default
  30s) to itself; only if none arrives does the run start reading the handler
  directly, every `fallbackPollIntervalMs` (default 2s, `0` disables), confirming
  from whichever signal lands first. In the normal case the report resolves the
  wait long before the delay elapses and no sweep request is ever sent.

  Once running it costs one request per Virtual Account per tick — never one per
  leg — shared between concurrent runs on the same account, single-flight, with
  exponential backoff on handler errors. The sweep is owned by the wait rather
  than by a component, so closing the modal mid-run does not silence it.

  Two rules keep an account-wide page from doing damage:
  - **Absence only counts on a complete page.** `isComplete` is derived from
    `orders.length < size` rather than from `count`, whose meaning on this
    endpoint is unverified. A truncated response contributes positive rows only,
    so a live order can never be reported as cancelled.
  - **A cancel confirms on its own `coh_quote_id` disappearing**, not on an empty
    result — which also means a row the store has not yet linked to a quote cannot
    masquerade as one.

  Supporting changes: `setRowsForSides(id, rows, sides)` folds a snapshot over
  named sides without the `quote_id` aliasing (an account-wide page handed to
  `setRows` would fuse two legs of a group into one record); `clearConfirming`
  gains a sibling on the store's public surface; and a no-op commit is now skipped
  entirely, so a 2s sweep does not wake every waiter and re-render every TP/SL cell
  on each tick that merely confirmed the status quo.

  `DEFAULT_TPSL_CONFIRMATION_TIMEOUT_MS` rises from 45s to 60s so it covers both
  halves of the wait: 30s belonging to the report, then roughly fifteen sweeps.
  `TPSL_CONFIRMING_GUARD_MS` rises to 90s to stay clear of it, so a grouped run
  always reaches its own deadline and releases the store guard itself rather than
  having the guard expire underneath it.

- 04c4973: Add a one-call withdraw flow — deallocate and initiate a withdrawal in a single action, with the cross-margin path handled for the caller.

  `deallocateAndInitiateWithdraw` batches the `deallocate` and `initiateWithdraw` legs through the AccountLayer `_call` proxy so both are attributed to the subaccount (the connected wallet must be its on-chain `owner`). The `deallocate` leg needs a fresh, short-lived Muon `uPnl_A` attestation to prove the subaccount stays solvent; the action fetches one immediately before submitting (via `getDeallocateUpnlSig`) unless the caller passes a `upnlSig` to reuse. Its `amount` is in **18 decimals**; `parts` are the withdraw receiver parts (a plain same-chain withdrawal is a single `createClassicWithdrawPart`). `simulateDeallocateAndInitiateWithdraw` is its dry-run twin.

  `withdrawAuto` is the convenience entry point: it takes an `amount` in the **collateral token's own decimals** and a `receiver`, resolves the subaccount's isolation type, and picks the right path — a plain `withdraw` when the balance is already available, or the deallocate-and-initiate path for cross-margin (`CUSTOM`) accounts, scaling the amount to the 18-decimal figure the `deallocate` leg needs. `withdraw` is the underlying base write. All three carry the `speedUp` cooldown opt-in and opaque `providerData` for express/virtual providers.

  `@symmio/trading-react` adds `useWithdraw` (over `withdrawAuto`) and `useDeallocateAndInitiateWithdraw` (over the explicit batched action), so a UI can offer either the one-input convenience or the fully-specified flow.

### Patch Changes

- Updated dependencies [d0e2a12]
- Updated dependencies [8cddfc3]
- Updated dependencies [1b9cc0a]
- Updated dependencies [1b9cc0a]
- Updated dependencies [1b9cc0a]
- Updated dependencies [1b9cc0a]
- Updated dependencies [04c4973]
- Updated dependencies [04c4973]
- Updated dependencies [04c4973]
- Updated dependencies [04c4973]
- Updated dependencies [04c4973]
- Updated dependencies [d0e2a12]
- Updated dependencies [306228e]
- Updated dependencies [04c4973]
  - @symmio/trading-core@2.0.0

## 1.1.0

### Minor Changes

- 15588f6: Add the affiliate registration API.

  `@symmio/trading-core` gains account-layer actions `requestToRegisterAffiliate`, `cancelRegistration`, `getAffiliateState`, and `generateAccountManagerAddress`, together with their `simulate*` variants, query option factories, and types. `@symmio/trading-react` wraps them as `useRequestToRegisterAffiliate`, `useCancelRegistration`, `useAffiliateState`, and `useGeneratedAccountManagerAddress`.

  Also clarifies the affiliate config contract: `createConfig` still throws `AFFILIATE_ADDRESS_REQUIRED` only when `affiliatesAddress` is missing, and the error message and JSDoc now spell out that the zero address is a valid no-affiliate placeholder (trades open, no fee share). Deposit docs now state that the instant flow funds via `deposit` alone (available balance), while `depositAndAllocate` targets the classic pool.

- 15588f6: @symmio/trading-core

  New account - layer API for registering an affiliate on - chain:
  - requestToRegisterAffiliate — submit registration request(creates PENDING affiliate)
    - cancelRegistration — cancel a pending registration
      - getAffiliateState — read affiliate status(PENDING / ACTIVE / …)
        - generateAccountManagerAddress — derive account - manager address
          - simulate \* variants for each write, query - option factories, and types — all exported from the package barrel

  Doc / error improvements(no behavior change):
  - AFFILIATE_ADDRESS_REQUIRED message rewritten — states zero address is valid no - affiliate placeholder(trades open, no
    fee share) and links registration page - depositForAccount JSDoc — instant flow funds via deposit alone(available balance); depositAndAllocateForAccount is
    classic - pool only

  @symmio/trading-react

      - New hooks wrapping the above: useRequestToRegisterAffiliate, useCancelRegistration, useAffiliateState,
          useGeneratedAccountManagerAddress
          - useDepositAndAllocate JSDoc clarified: allocates to classic pool; instant flow uses useDeposit alone
              - New hook tests: error - codes, locked - params, notional - cap(internal, no API change)

### Patch Changes

- Updated dependencies [15588f6]
- Updated dependencies [15588f6]
  - @symmio/trading-core@1.1.0

## 1.0.0

### Major Changes

- ee1ad05: First stable release of the SYMMIO SDK.

  v1.0.0 marks the SDK as production-ready. The public API of every package is now covered by semantic versioning: a breaking change requires a major bump. All packages move to 1.0.0 together and are versioned in lockstep from here.

  ### Breaking changes
  - **`@symmio/trading-core`**: `createConfig`'s optional `chainOverrides` parameter is replaced by **`symmioConfig`, which is now required**. Every supported chain must supply a non-zero `addresses.affiliatesAddress` — your frontend's on-chain affiliate for that chain, attached to every quote so the protocol attributes the trade to you and routes your share of the trading fee. Affiliate addresses are per chain: a registration on one chain is not valid on another. `createConfig` throws `SymmError` with code `AFFILIATE_ADDRESS_REQUIRED` for any supported chain missing one, so a trade can never silently fall back to the SDK's built-in default affiliate and lose attribution. The new `SymmioChainConfigInput` type describes the shape — everything stays optional except `addresses.affiliatesAddress`.

    ```diff
     const config = createConfig({
    +  symmioConfig: {
    +    [SymmioSupportedChainId.HYPER_EVM]: {
    +      addresses: { affiliatesAddress: "0xYourHyperEvmAffiliate…" },
    +    },
    +  },
       getClient: () => publicClient,
       getWalletClient: async () => walletClient,
     });
    ```

  - **`@symmio/trading-react`**: `SymmioProvider`'s optional `chainOverrides` prop is replaced by the required `symmioConfig` prop, forwarded to `createConfig` — same rule, same error.

    ```diff
    -<SymmioProvider>
    +<SymmioProvider
    +  symmioConfig={{
    +    [SymmioSupportedChainId.HYPER_EVM]: {
    +      addresses: { affiliatesAddress: "0xYourHyperEvmAffiliate…" },
    +    },
    +  }}
    +>
       <App />
     </SymmioProvider>
    ```

    Nothing else about the shape changed: `subgraphs`, `solver`, `priceService`, `notifications`, and `muon` remain optional and are still deep-merged onto the built-in chain defaults. An existing `chainOverrides` object can be renamed to `symmioConfig` as-is once each chain carries an affiliate address.

  ### New features
  - **`@symmio/trading-core`**: new `getEstimatedPrice` read — asks the solver what an open or close would actually fill at, given the order quantity, side, and slippage-adjusted request price. It is a read-only simulation; nothing is submitted. Ships with `getEstimatedPriceQueryKey` / `getEstimatedPriceQueryOptions` and the `toEstimatedPrice` transformer. New `calculatePriceImpact` derives the signed price-impact percent of an estimate against a reference price such as the mark.
  - **`@symmio/trading-react`**: new `useEstimatedPrice` hook wrapping the above, with `quantity` and `price` debounced (configurable via `debounceMs`) so typing in a trade form fires one request instead of one per keystroke.
  - **`@symmio/trading-core`**: new `calculateAvailableInstantOpenMargin` — the maximum initial margin an instant open can spend, shaved for fees and, for SHORT only, a worst-case slippage fill.
  - **`@symmio/trading-react`**: new `useAvailableInstantOpenMargin` hook composing the balance and fee reads into that spendable margin, ready to wire to a trade form's `Max` chip and submit gate.
  - **`@symmio/trading-react`**: `useAccountBalanceOf` and `useAccountBalanceInfo` accept `live: true`, which subscribes to the account's settle notifications over the shared WebSocket and refetches when an open anchors or a close fills, so a balance reflects a just-settled trade without a manual refresh. Off by default.
  - **`@symmio/trading-react`**: `calculateQuotePnl`, `calculatePriceImpact`, and `calculateAvailableInstantOpenMargin` are now re-exported from the package root, so trade-form math no longer needs a direct `@symmio/trading-core` import.

  ### Fixes
  - **`@symmio/trading-react`**: `useDeposit` now invalidates the credited subaccount's balance queries on success, not only the connected wallet's collateral allowance and balance. A deposit is not a trade settle, so live balance reads did not otherwise refetch and the trade form's available margin / `Max` kept showing the pre-deposit figure.
  - **`@symmio/trading-react`**: `useInstantOpenWithTpSl` now seeds the confirming TP/SL slot with the target trigger price and price type rather than the state alone, so `useQuoteTpSl` renders the levels immediately on the freshly-opened position row instead of leaving them blank until the WebSocket report lands.

  ### Other
  - **All packages**: `repository`, `homepage`, and `bugs` metadata now point at the `SYMM-IO/Trading-SDK` repository.
  - **`@symmio/utils`**, **`@symmio/session-key`**, **`@symmio/eslint-config`**, **`@symmio/typescript-config`**: no functional changes in this release; versions are aligned to 1.0.0 with the rest of the SDK.

### Patch Changes

- Updated dependencies [ee1ad05]
  - @symmio/trading-core@1.0.0

## 0.2.0

### Minor Changes

- 0cead1d: Add market-info and funding-info solver APIs.
  - **`@symmio/trading-core`**: new `getMarketInfo` (per-market 24h volume and lifetime value plus aggregate totals) and `getFundingInfo` (next-epoch long/short funding rates, next funding time, epoch length) reads, each with query-key and query-options helpers, plus `projectFundingRate` to extrapolate a per-epoch rate over a day window and the `toMarketInfo` / `toMarketFundingInfo` transformers.
  - **`@symmio/trading-react`**: new `useMarketInfo` and `useFundingInfo` hooks wrapping the above. Neither polls by default; the caller opts in via `query.refetchInterval`.
  - **`@symmio/utils`**: new `toFiniteNumber` numeric-coercion helper, exported from the root and from a new `@symmio/utils/number` subpath.

### Patch Changes

- 29cc357: Fix module resolution in the published packages.
  - **`@symmio/trading-react`**: the `./provider`, `./account-layer`, `./instant-layer`, `./wallet`, `./errors`, `./transactions`, `./markets`, `./fees`, and `./price-service` subpath exports pointed at `dist/<name>/index.js` files that were never emitted, so importing from any of them threw `ERR_MODULE_NOT_FOUND` at runtime. Each sub-barrel is now its own build entry, so the files exist.
  - **All packages**: generated `.d.ts` now use fully-specified relative import paths (`./x.js`, `./x/index.js`), so the types resolve under `moduleResolution: "node16"` / `"nodenext"`, not only `"bundler"`.

- Updated dependencies [0cead1d]
- Updated dependencies [29cc357]
  - @symmio/trading-core@0.2.0

## 0.1.1

### Patch Changes

- 429539a: Rewrite package READMEs with verified usage examples and links to the documentation site and SDK console.
- Updated dependencies [429539a]
  - @symmio/trading-core@0.1.1

## 0.1.0

### Minor Changes

- d3b5bff: Initial public release of the SYMMIO SDK packages.

### Patch Changes

- Updated dependencies [d3b5bff]
  - @symmio/trading-core@0.1.0
