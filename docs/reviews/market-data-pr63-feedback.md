# PR #63 feedback: market data parity (VIBE-1886)

**Status**: Changes requested. This document is the maintainer-approved design for the rework; the slices below may be implemented without a further design proposal. Reference this file in each new PR description.
**Date**: 2026-10-17
**PR**: [Trading-SDK #63](https://github.com/SYMM-IO/Trading-SDK/pull/63), branch `feature/VIBE-1886/market-data-parity` (based on main `1bdbf2de`)
**Linked app PR**: #664

Thank you for the detailed report and the regression coverage. Several of the gaps you found are real SDK defects that affect every consumer, not only your app. We want those fixed, but **inside the existing APIs** rather than through a parallel set of `market-data/*` reads. Three items stay on the app side.

---

## 1. Decisions at a glance

| #   | Proposal                        | Decision                                   | What we ask for                                                                                |
| --- | ------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| 1   | Market and funding reads by ID  | **Accepted, as a breaking change**         | Switch the existing `getMarketInfo` (Enigma) and `getFundingInfo` to the symbol-ID endpoints   |
| 2   | Complete symbol list            | **Accepted, as a fix to `getSymbols`**     | `getSymbols()` with no `limit`/`offset` returns every symbol. No `getAllSymbols`               |
| 3   | Notional-cap snapshot           | **Accepted, as a fix + one new page read** | `getNotionalCapAll` reads every page; new `getNotionalCapPage` for callers who page themselves |
| 4   | DexScreener enrichment          | **Rejected for the SDK**                   | Keep it in the app                                                                             |
| 5   | Exact-decimal listing reader    | **Rejected**                               | Use `getListingMarkets`; adapt in the app                                                      |
| 6   | Price-frame formats             | **Rejected for now**                       | Use `watchEnigmaPrices` as is                                                                  |
| 7   | `missingVolume: "omit"`         | **Replaced by a default fix**              | Always skip malformed daily rows. No new option                                                |
| 8   | Query factories and React hooks | **Only for the accepted reads**            | Only one new hook: `useNotionalCapPage`. Existing hooks pick up the fixes automatically        |

---

## 2. What we verified (live, read-only, 2026-10-17)

Production Enigma solver (`https://solver.enigma.bz/api`), listing services (`listing85`, `listing-staging`) and the lowcap price WebSocket.

| Check                                           | Result                                                                                                                                                                                                                                                               |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tickers shared by several markets in `/symbols` | 7 tickers (`PEPE` ×3; `SOL`, `GOKU`, `CATWIF`, `TROLL`, `ANSEM`, `NET` ×2)                                                                                                                                                                                           |
| `/get_market_info` vs `/market-info`            | 236 vs 244 keys: the ticker-keyed endpoint loses markets that share a ticker                                                                                                                                                                                         |
| `/get_funding_info` vs `/funding-info`          | 233 vs 241 keys: same loss                                                                                                                                                                                                                                           |
| Per-market market info                          | Does not exist. `/market-info/1` returns 404, and query filters are ignored (all rows returned). `/funding-info?symbol_ids=1` **does** filter                                                                                                                        |
| `/symbols`                                      | 241 rows; default page is 100; `limit=500` returns all in one request; `limit=501` is rejected                                                                                                                                                                       |
| `/notional_cap`                                 | 241 rows; **max 100 per page** (`limit=101+` returns 400, although the spec says 500); `/notional_cap/batch` is also capped at 100 IDs                                                                                                                               |
| `/notional_cap` totals                          | `total_used` / `total_open_interest` cover **the returned page only** (page 1: 70,128; real total ≈ 71,385)                                                                                                                                                          |
| `/symbols` `quote_currency`                     | Never sent. `max_notional_value` is a JSON number                                                                                                                                                                                                                    |
| Listing (434 rows, prod + staging)              | No `price_usd`, `apy_24h/30d/lifetime`, `reward_30d/lifetime`, `solver_revenue_*`. No fractional or scientific values. All money/rate fields are 1e18-scaled integers                                                                                                |
| Price WebSocket                                 | Only arrays of `{ name, markPrice, time, address }`. No single-symbol frames, no `symbol_id`, no index price, no funding. Tick `name` matches `/symbols` `name` (241 of 242), and shared tickers have distinct names (`PEPE::52..7D_SFLOW`, `PEPE::21..Vz_SFLOW`, …) |
| `/trade-volume/{id}` (5 markets)                | 0 rows without `volume`, 0 rows with `volume: null`                                                                                                                                                                                                                  |

Consequences for the SDK today:

- `getMarketInfo` (Enigma) and `getFundingInfo` drop or merge markets that share a ticker.
- `getNotionalCapAll` returns 100 of 241 rows, with totals from page 1 only. Our own docs promise "all caps in one call for a table".
- `getSymbols()` without `limit` returns 100 of 241 rows. `apps/web`'s symbols card and the core docs example (`getSymbols(config, {})`) both hit this.

---

## 3. General feedback (applies to every slice)

1. **Fix the existing API instead of adding a parallel one.** `getEnigmaMarketInfo` next to `getMarketInfo`, `getNotionalCapSnapshot` next to `getNotionalCapAll`, and so on, leave the old reads broken and give consumers two ways to do the same thing.
2. **Use the generated client.** `packages/trading-core/src/solvers/types/generated/enigma-solver.ts` already has `getMarketInfo` (`/market-info`), `getFundingInfo` (`/funding-info`), `getSymbols` and `getNotionalCap`. Don't call these endpoints with raw axios (the PR's `market-data/read.ts`). Import with an alias where the generated name clashes with the SDK export, as `solvers/symbols/get-symbols.ts` already does (`getSymbols as requestSymbols`).
3. **Keep the existing folder layout.** Changes go into `packages/trading-core/src/solvers/{market-info,funding-info,symbols,notional-cap,trade-volume}/` and the matching `packages/trading-react/src/<feature>/` folders. Drop the new `market-data/` folders.
4. **Solver reads stay solver-neutral.** No solver kind in public names (`getEnigma…`). The existing per-kind adapters (`solvers/market-info/adapters/`) are where Enigma-specific behavior lives.
5. **JSDoc on every public export**: purpose, parameters, return value, `@throws`, and an `@example`. One-line comments are not enough for IDE hover.
6. **Style**: one `const` per declaration (no `const a = …, b = …`); `function` keyword at module scope; kebab-case files; `pnpm format`-clean.
7. **Don't hand-edit generated files.** The `/notional_cap` limit drift (spec says 500, server allows 100) should be reported to the vendor; the SDK code carries its own page-size constant.
8. **One slice per PR, based on current `origin/main`** (now core 3.6.0; #60, #62 and #64 landed since your base). Each PR carries its own docs update and changeset.

---

## 4. Answers to your questions

- **Do these responsibilities belong in the SDK?** Items 1, 2, 3 and 7 yes: they are SDK defects. DexScreener (item 4) no: it is a third-party service, not a SYMMIO vendor; core would hard-code its URL with no way to configure or proxy it, every consumer would share its public rate limit, and `getEnigmaPriceServiceMetadata` already carries the vendor's DexScreener-sourced data. The missing fields (image, socials, websites) are branding, which the app owns. Items 5 and 6 are not needed for the data the services actually send (see section 2).
- **Extend existing APIs or add compatible alternatives?** Extend or fix the existing ones. The only new public read is `getNotionalCapPage`.
- **Identity, precision, missing-value and pagination contracts?** Identity by symbol ID: yes. Full pagination inside `getSymbols` / `getNotionalCapAll`: yes. Malformed rows are skipped, not zero-filled: yes. Exact decimal strings: not now; float dollars are fine for display, and changing the types would be a separate major-version decision.
- **Already available?** `getEnigmaPriceServiceMetadata` (enrichment), `getListingMarkets` (listing), `watchEnigmaPrices` / `useEnigmaPrices` (prices), `getNotionalCapBySymbolId` (one market's cap).

---

## 5. How to rework the branch

Please don't keep adding commits to `feature/VIBE-1886/market-data-parity`. Split the work into **four PRs, each branched from current `origin/main`**, and close #63 (or reuse it for slice A) with a link to this document.

| Slice | Branch                            | Items | Changeset                |
| ----- | --------------------------------- | ----- | ------------------------ |
| A     | `fix/notional-cap-all-pagination` | 3, 8  | minor (core + react)     |
| B     | `fix/symbols-full-list`           | 2     | minor (core; react docs) |
| C     | `fix/trade-volume-malformed-rows` | 7     | patch (core)             |
| D     | `feat/market-info-by-symbol-id`   | 1     | **major** (core + react) |

A, B and C are independent and can ship in one minor release. D changes the public API; it can be reviewed in parallel, but we will coordinate its release.

### Step by step (repeat per slice)

```bash
# 1. Start from fresh main
git fetch origin
git switch -c fix/notional-cap-all-pagination origin/main
pnpm install

# 2. Salvage useful pieces from the old branch without merging it,
#    e.g. view the old cap pagination tests to adapt them:
git show feature/VIBE-1886/market-data-parity:packages/trading-core/src/market-data/market-data.test.ts
#    or copy a whole file you will adapt in place (slice C):
git restore --source=feature/VIBE-1886/market-data-parity -- \
  packages/trading-core/src/solvers/trade-volume/missing-volume.test.ts

# 3. Implement the slice, including tests, docs and JSDoc.

# 4. Verify
pnpm --filter @symmio/trading-core test
pnpm --filter @symmio/trading-react test
pnpm check-types
pnpm lint
pnpm format            # must leave no diff
pnpm build && pnpm verify-packages   # slice A (new export) and slice D (type changes)

# 5. Changeset (one per slice; bump level from the table above)
pnpm changeset

# 6. Commit (Conventional Commits) and open the PR
git commit -m "fix(notional-cap): read every page in getNotionalCapAll"
git push -u origin fix/notional-cap-all-pagination
```

Suggested commit subjects:

- A: `fix(notional-cap): read every page in getNotionalCapAll` and `feat(notional-cap): add getNotionalCapPage`
- B: `fix(symbols): return the full list when no limit or offset is given`
- C: `fix(trade-volume): skip malformed daily rows`
- D: `feat(market-info)!: key market and funding info by symbol id`

### What to drop from the old branch

Do not carry over:

- `packages/trading-core/src/market-data/` (all of it) and its exports in `packages/trading-core/src/index.ts`
- `packages/trading-react/src/market-data/` and its exports in `packages/trading-react/src/index.ts`
- The changes to `websocket/prices/parse-price-frame.ts` and `websocket/prices/types.ts`
- The `missingVolume` parameter and its query-key field
- `apps/docs/app/{core,react}/market-data/`, the `_meta.ts` entries, and the doc edits on the price-service, notional-cap and markets pages that point to the removed reads
- `.changeset/complete-enigma-market-reads.md`

### PR checklist

- [ ] Branched from current `origin/main`; one slice only
- [ ] Uses the generated client; no raw axios for solver endpoints
- [ ] Existing folder layout; no new `market-data/` folders
- [ ] Full JSDoc with `@example` on every new or changed public export
- [ ] Tests updated or added, including the live-data edge case for the slice (shared tickers, >100 caps, malformed rows)
- [ ] `apps/docs` pages updated for every new or changed public API
- [ ] `apps/web` still builds; consumers updated where types changed (slice D)
- [ ] `pnpm lint`, `pnpm check-types`, tests, `pnpm format` clean
- [ ] Changeset with the right bump and a clear behavior/migration note
- [ ] PR description links this document

---

## 6. App-side follow-ups (app PR #664)

- **Symbols**: after slice B, call `getSymbols()` / `useSymbols()` with no limit. Until it ships, pass `limit: 500`.
- **Caps**: after slice A, use `getNotionalCapAll`. Your server cache, deduplication and stale fallback stay app-owned.
- **Market and funding info**: after slice D, key by `symbolId`. For one market, select from the shared query instead of requesting per market. `getFundingInfo({ symbolIds })` can filter on the server.
- **Token enrichment**: keep your DexScreener integration in the app. Consider `getEnigmaPriceServiceMetadata` for liquidity, price change and market cap.
- **Listing**: map from `getListingMarkets` in your adapter; drop the fields the service doesn't send.
- **Prices**: use `watchEnigmaPrices` / `useEnigmaPrices` as is. Join tick `name` to `symbolId` through `getSymbols()` (`name` matches exactly; shared tickers have distinct names).
- **Volume**: after slice C, malformed rows are omitted by default; no option needed.

---

## 7. Open questions for you

1. Do you know a deployment that sends single-symbol price frames, the legacy listing fields, or daily rows without `volume`? If yes, please share the URL and a sample payload; we would reconsider items 5, 6 or 7 with that evidence.
2. Slice D is a breaking release. Is there anything in the app besides market info and funding that relies on the ticker-keyed shape?
