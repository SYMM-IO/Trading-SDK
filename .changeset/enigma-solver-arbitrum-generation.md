---
"@symmio/trading-core": major
"@symmio/trading-react": major
---

Regenerate the Enigma solver client from the Arbitrum solver's OpenAPI spec — the enigma generation matching perps-core v0.8.6 (`orval.config.ts` now points at `https://arb-staging.enigma.bz/api/swagger/doc.json`).

Breaking — `getSolverRevenue` / `useSolverRevenue` are now **per-market**:

- The new solver generation removed the protocol-wide `GET /revenue` aggregate (and the unused `/revenue/batch` and `/revenue/per-symbol`); only `/revenue/{symbolId}` and `/revenue/records` remain.
- `GetSolverRevenueParameters.symbolId` is therefore **required**, and the parameters object is no longer optional on `getSolverRevenue`, `getSolverRevenueQueryOptions` and `useSolverRevenue`. For a multi-market figure, call once per market and label the sum with the markets it covers; `getRevenueRecords` remains the honest cross-market source.

Additive — solver-fee caps on the market catalog:

- `EnigmaMarket` and `SolverSymbol` gain `minOpenSolverFeeCap` / `minCloseSolverFeeCap` (decimal strings, defaulted to `"0"` when the solver omits them) — the minimum solver-fee caps a quote must allow under the perps-core v0.8.6 solver-fee mechanism, from the new `min_open_solver_fee_cap` / `min_close_solver_fee_cap` fields on `/contract-symbols` and `/symbols`.
