---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Add Binance USD-M Futures as a second price provider, behind a provider-agnostic mark-price facade.

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
