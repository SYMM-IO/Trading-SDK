---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Add multi-chain support and a second solver **kind** — the config, identity, and per-kind normalization that let one SDK serve Enigma (lowcap) and Rasa (majors) side by side, and add Base as a second chain.

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

**Solver metadata & analytics reads.** `getSymbols` (the `/contract-symbols` catalogue, `SolverSymbol` with `SymbolStateFilter` / `SymbolValidityFilter`) and `getTradeVolume` (`SolverDailyVolume`), plus `getCoolDownsOfMA` and `getPendingQuotes` on the account reads.

`@symmio/trading-react` adds the matching hooks — the Rasa-only family (`useSolverBalanceInfo`, `usePartyAUpnl`, `useSolverOpenInterest`, `useSolverPriceRange`, `useSolverReadiness`, `useErrorMessage`, `useAddSolverWhitelist`), `useSymbols`, `useTradeVolume`, `useAccountUpnl`, `useCoolDownsOfMA`, and the per-kind `useSearchNotifications` (narrow on `data.kind`). All are `solverId`-aware and inherit the chain's default when it is omitted.
