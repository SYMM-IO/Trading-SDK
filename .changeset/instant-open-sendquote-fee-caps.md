---
"@symmio/trading-core": major
"@symmio/trading-react": major
---

Per-chain contracts generation: chains declare `contractsVersion` and the instant-open signing path follows it.

`SymmioChainConfig` gains a required **`contractsVersion: SymmioContractsVersion`** (`"0.8.5" | "0.8.6"`; overridable via `symmioConfig`). Built-ins: HyperEVM and Base are `"0.8.5"`, Arbitrum is `"0.8.6"`. The SDK branches on it at exactly the seams where the generations diverge:

- **Quote-send signing (Enigma flow).** On a v0.8.6 chain the session key signs the new `sendQuote(...)` carrying `SolverFeeCaps { openRateCap, closeRateCap }` (18-decimal ratios of quote notional); on a v0.8.5 chain it keeps signing the legacy `sendQuoteWithAffiliateAndData(...)` — the capped selector does not exist on a v0.8.5 diamond. `prepareInstantOpenParams` resolves the caps from the market's `minOpenSolverFeeCap` / `minCloseSolverFeeCap` on v0.8.6 chains (pre-fillable via its `market` parameter) and emits `InstantOpenParameters.solverFeeCaps`. The Rasa flow is unchanged.
- **Session-key delegation set.** New `getInstantTradeRequiredSelectors(config, { chainId })` (React: `useInstantTradeRequiredSelectors()`) resolves the per-chain set. `INSTANT_TRADE_REQUIRED_SELECTORS` now holds the v0.8.6 set (`SEND_QUOTE_SELECTOR` as the open leg) and the new `LEGACY_INSTANT_TRADE_REQUIRED_SELECTORS` holds the v0.8.5 set; multi-chain flows must resolve instead of hardcoding either.
- **Withdraw-request decodes.** `getWithdrawRequests` / `getPendingWithdrawRequests` decode with a pinned v0.8.5 fragment on v0.8.5 chains (their on-chain struct predates `advancedAmount`) — without this, those reads fail to decode on HyperEVM/Base. `WithdrawRequest.advancedAmount` is now **optional**: `undefined` on v0.8.5 chains, the on-chain value on v0.8.6 chains.

New exports: `SymmioContractsVersion`, `encodeSendQuote` / `EncodeSendQuoteParameters`, `SolverFeeCaps`, `SEND_QUOTE_SELECTOR`, `LEGACY_INSTANT_TRADE_REQUIRED_SELECTORS`, `getInstantTradeRequiredSelectors`, `useInstantTradeRequiredSelectors`. The legacy encoder and selector stay exported.

**Breaking.** `INSTANT_TRADE_REQUIRED_SELECTORS` changed value (its open leg is now `SEND_QUOTE_SELECTOR`) — on v0.8.5 chains use `LEGACY_INSTANT_TRADE_REQUIRED_SELECTORS` or, better, the resolver. On v0.8.6 chains, session keys delegated under the legacy set must be re-granted before they can open.
