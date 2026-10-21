# VIBE-1898 — Positions + position-detail reads onto the SDK (plan)

Status: **IMPLEMENTED 2026-10-19 (uncommitted, local SDK link).** Live record: app `docs/handbook/engineering/sdk-integrations/positions.md`.
Outcome of §11: D1 keep app grouping · D2 history stays on GraphQL (G2) · D3 pool quotes → VIBE-1903 · D4 **changed**: SDK gained `getPartyAOpenPositionsBatch` + `isPartyALiquidated` (see `party-a-open-positions-batch-proposal.md`) · D5 branched from staging (VIBE-1900 not merged; reader internals untouched by it) · D6 parity **failed** → pending instant opens stay on the hedger call (G5: no `create_time`, temp id defaults to 0, no `App-Name`).
Date: 2026-10-18. Ticket: https://symmio-vibe.atlassian.net/browse/VIBE-1898 (Epic PROD-19).
App repo: `Vibe-ui-v2`, surveyed at `origin/staging` `c2d07e53c` (+3 local commits on `fix/sdk-open-available-balance`).
SDK pinned in app: `@symmio/trading-core` 3.4.1, `@symmio/trading-react` 3.3.0 — every API named below exists at those tags (no SDK release needed for the "move" rows).

At implementation time this plan becomes the app's feature record
`docs/handbook/engineering/sdk-integrations/positions.md` (app `sdk-migration` skill, steps 1–8).

---

## 1. Scope recap (from ticket)

- VibeCaps (SYMMIO) **reads only**: open positions list, single-position detail, closed/history.
- Untouched: Hyperliquid/majors, TP/SL, close, reverse, margin, every write, WS manager, WS invalidation map.
- Preserve exactly: react-query keys, hook names + return shapes, poll tiers, pending instant-open merge (temp id → on-chain id).
- PnL, margin, liquidation price, notional, ticker resolution stay app-side, layered on SDK rows.
- SDK gap → keep that one read on current path, flag, file a separate SDK ticket. No invented SDK API.

Ticket is silent on **group positions**. This plan covers them explicitly (§4).

## 2. How positions work today (product view)

- One sub-account owns many **virtual accounts (VAs)**; each VA holds every open quote for one market + side.
- The positions table, the account overview, the open-position counts, the global notifications toasts, and post-open TP/SL all read through **one** hand-written reader: one RPC multicall per refresh asking every VA for "open positions" + "is this VA liquidated", plus one solver call for pending instant opens, then a local transform into the app's row shape.
- **Group position** = client-side grouping of the rows that share VA + market + side. No server-side group id exists. Group key: `<vaAddress|'default'>-<symbolId>-<positionType>`. The user's manual drag order of groups is **persisted in localStorage by that key**.
- Single row and group row both render from the same rows; group figures (size, avg entry, notional, PnL, leverage, liq price, margin) are aggregated locally.
- Detail rail: single quote → price-update/accounting events, settled + accrued + upcoming funding, funding accrual epochs, TP/SL. Group → same panels re-aggregated over the group's quote ids (accounting events only for single quote / sub-quote).
- History: analytics-subgraph close events with close-type + market filters, enriched with close margin + TP/SL snapshots.

## 3. Approach

**Swap the data source _inside_ existing readers, using SDK core actions through the `lib/symmio` read-config seam.** Hooks, keys, polling, WS wiring stay byte-identical — same pattern the balance slice shipped.

Not chosen (one line each):

- SDK `useManagedQuotes` / `useGroupedQuotes` hooks — own their own query keys, WS subscription, polling, and take no `config` (would bypass the app's RPC client). Violates "keys + WS unchanged".
- SDK `getSubAccountQuotes` one-shot — re-enumerates VAs every poll (bypasses the app's VA cache), adds pending-quote + instant-close reads, different reconcile rules, no liquidated-VA filter. Behavior change + RPC cost up.

## 4. Single vs group positions

### 4a. Single position (row)

| Concern                            | Plan                                                                                                                                                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open quotes per VA                 | SDK `getPartyAOpenPositions({ chainId, partyA: va, start: 0n, size: 200n })` — same contract call, same page size as today                                                                                                            |
| Sub-account with no VAs            | same action with `partyA = subAccount` (preserve today's fallback path)                                                                                                                                                               |
| Per-VA failure                     | `Promise.allSettled`; failed VA omitted, others kept — parity with today's `allowFailure: true` multicall                                                                                                                             |
| Liquidated VA → drop its rows      | **SDK gap** (contract fn is ABI-only in SDK, no action). Keep this one call app-side using SDK-exported `symmioAbi` + the seam client. SDK ticket G1                                                                                  |
| Row shape                          | adapter SDK `Quote` → existing `VibecapsActiveQuote` (status map 4/5/6, `quantity − closedAmount`, margin rescale, leverage, funding index, fee rate, timestamps) — today's transform logic, re-typed on SDK `Quote`                  |
| Pending instant opens              | SDK `getInstantOpens({ chainId, partyA: subAccount, solverId: 'enigma' })` **if** field parity + production solver URL + `App-Name` header check pass (D6); app merge logic (resolved temp-id store, already-anchored skip) unchanged |
| Ticker                             | unchanged: symbolId → ticker via app symbol map                                                                                                                                                                                       |
| PnL / liq / margin / display price | unchanged, app-side                                                                                                                                                                                                                   |

### 4b. Group position

Group derivation **stays app-side and unchanged**; it automatically inherits SDK-sourced rows. Invariants the swap must hold:

1. **Group key byte-identical.** `va_address` must come from the VA enumeration entry exactly as today — **not** from SDK `quote.partyA` (viem checksums it; a casing change rewrites every group key → user's saved drag order and selected group are lost). `symbol_id` keeps its current JS type. No-VA path keeps `'default'`.
2. Aggregates unchanged: total size, weighted entry, entry notional, Σ PnL / PnL %, shared-submitted-leverage rule, VA-level liq price, VA-balance-based display margin minus funding debt.
3. Group detail (merged rail) keeps re-aggregating from the group's quote ids; its funding reads move with the single-quote funding reads (§5) — batch by quote ids, sums unchanged.
4. Group close / group TP/SL / nuke pseudo-group: write paths, untouched; they read rows from the same cache key.

SDK group helpers (`groupQuotes`, `aggregateGroupMetrics`, `useQuoteGroupMarginRisk`) are **not** adopted: key format (`md:<symbolId>:<side>`) and metric vintages (frozen `initialNotional`, leverage incl. partyBmm) differ from what users see today → visible behavior change + saved order reset. See D1.

## 5. Read-by-read map

| #   | Read                                            | Today                                                                          | SDK replacement                                       | Verdict                                                                                                         |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| R1  | Open positions per VA                           | raw viem multicall `getPartyAOpenPositions`                                    | `getPartyAOpenPositions`                              | **Move**                                                                                                        |
| R2  | Liquidated-VA flag                              | raw multicall `isPartyALiquidated`                                             | none (ABI only)                                       | **Gap G1** — keep, via SDK ABI                                                                                  |
| R3  | Pending instant opens                           | hedger `GET /instant_open/{subAccount}`                                        | `getInstantOpens`                                     | **Move if parity (D6)**                                                                                         |
| R4  | VA list                                         | already SDK                                                                    | —                                                     | done (balance slice)                                                                                            |
| R5  | Open-position counts (account switcher)         | own raw multicall                                                              | `getPartyAOpenPositions`                              | **Move** (keep its count semantics: no liq filter, no pending merge)                                            |
| R6  | Accrued funding (debts)                         | Diamond `getQuoteFundingDebts(ids)`                                            | `getQuotePendingFunding`                              | **Move** — SDK returns income-positive (negated); adapter flips back to app's owed-positive                     |
| R7  | Settled funding paid/received                   | subgraph `quotes(id_in)`                                                       | `getQuoteFunding`                                     | **Move** — SDK lacks `lastFundingPaymentTimestamp`; its only field consumer looks unused → confirm in inventory |
| R8  | Price-update / accounting events                | subgraph `quoteEvents` (3 types)                                               | `getQuoteEventsByType` w/ `PRICE_HISTORY_EVENT_TYPES` | **Move** (needs P1)                                                                                             |
| R9  | Funding accrual epochs                          | subgraph settlements + checkpoints + events, cursor-paged                      | events only                                           | **Gap G3** — keep                                                                                               |
| R10 | Funding totals (margin-history panel)           | subgraph                                                                       | maybe `getQuotesEventsByType`                         | **Verify** in inventory step                                                                                    |
| R11 | Initial-open-price fallback                     | subgraph `quotes(id_in)`                                                       | on-chain `Quote.initialOpenedPrice` already in R1     | **Verify** if fallback still reachable; delete only if proven dead                                              |
| R12 | Trade history                                   | subgraph close events + market filter + ~15 quote fields + open-event metadata | `getQuoteHistory`                                     | **Gap G2** — keep (no market filter, missing fields → enrichment breaks, 50-row page semantics change)          |
| R13 | Pool quotes                                     | subgraph                                                                       | SDK pool-quotes                                       | **Defer to VIBE-1903** (D3)                                                                                     |
| R14 | Strict VA-operation check (partial-close sweep) | paged `getPartyAOpenPositions`                                                 | `getPartyAOpenPositions`                              | **Leave** — inside close write flow (VIBE-1900 territory)                                                       |

Every open-positions consumer (table, overview, account page, notifications, post-open TP/SL, Telegram fallback, close settlement) inherits R1–R3 automatically because they all go through the one reader.

## 6. Prerequisites

- **P1 — map staging subgraphs in the seam.** `symmioConfigFromDeployment`'s staging profile maps solver + addresses but **not subgraphs** → SDK subgraph reads on staging would hit the **mainnet** analytics subgraph. Add the deployment's analytics/events URLs (verify the 3.4.1 chain-config type accepts `subgraphs`). Production already matches SDK default (`arbitrum-vibe-mainnet-analytics`).
  - Checked 2026-10-18: each analytics subgraph indexes **one** diamond only (staging: 305 quotes, all staging diamond; mainnet: zero quotes from other diamonds). So SDK subgraph reads filtering by numeric `quoteId` without the app's `source: diamond` filter are safe today. Defensive SDK filter = optional ticket G4.
- **P2 — base branch.** VIBE-1900 (`feature/VIBE-1900/sdk-close-positions`, not yet in staging) moves the active-positions wrapper into `lib/trading/vibecaps/activePositions.ts` and adds a `fetchQuery` reader on the same positions key. It does **not** touch the reader internals this slice changes (reader, transform, merge in `api.ts`). Plan: branch off staging after 1900 merges (D5).
- **P3 — baseline evidence** per app skill: `bun run sdk:status`, `bun run check:sdk -- --published`, staging SHA recorded.

## 7. Known deltas to accept or measure

- **RPC call count.** Today: 1 `eth_call` (multicall) for all VAs. After: 1 call per VA (+1 liq flag per VA), coalesced by the app transport's JSON-RPC batching (20/batch, 16 ms) → same HTTP round-trips, more billed calls. At 2 s fast-poll this matters. Measure in staging QA; no speculative fix.
- R6 batches 25 ids per `eth_call` vs one call today — same note.
- Positions key has no diamond/deployment and is address-case-sensitive — pre-existing; not changed here (keys frozen).

## 8. Behavior-to-test matrix (write characterization tests **before** swapping)

| Behavior                                                                | Test                                                                                                        | Expected                                    |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Multi-VA account renders same rows (count, side, size, entry, PnL, liq) | fixture SDK `Quote[]` per VA → old transform vs new adapter, deep-equal                                     | identical `VibecapsActiveQuote[]`           |
| Liquidated VA's rows dropped                                            | adapter test with flag true on one VA                                                                       | rows absent                                 |
| No-VA sub-account path                                                  | adapter test                                                                                                | reads sub-account directly                  |
| One VA read fails                                                       | adapter test, rejected leg                                                                                  | other VAs' rows kept                        |
| Pending instant open shown, then anchored                               | merge test with resolved temp-id store                                                                      | optimistic row → on-chain row, no duplicate |
| Group key unchanged                                                     | group-key snapshot from SDK-sourced rows vs today                                                           | byte-identical keys → saved order applies   |
| Group aggregates unchanged                                              | 2+ quote group fixture                                                                                      | same totals/leverage/liq/margin             |
| WS refresh unchanged                                                    | assert positions queryKey + refetch tiers untouched                                                         | same key, 2 s / 30 s                        |
| Accrued funding sign                                                    | R6 adapter test                                                                                             | owed-positive as today                      |
| Settled funding + price events                                          | R7/R8 adapter tests                                                                                         | same parsed shapes                          |
| Staging reads hit staging subgraph                                      | seam config test                                                                                            | staging analytics URL                       |
| `chainId` explicit on every SDK call                                    | adapter tests assert param                                                                                  | deployment chain id                         |
| Trade history / accruals / pool quotes                                  | existing tests                                                                                              | unchanged (not moved)                       |
| Manual staging QA                                                       | multi-VA open, partial close, instant open, liquidation, detail rail single + group, RPC count before/after | parity                                      |

## 9. Implementation order

1. Baseline (P3), confirm P2.
2. P1 seam change + test.
3. Characterization tests (§8) against current code.
4. `lib/symmio/positions.ts`: per-account SDK reads + liq flag + adapter; swap inside the existing reader. Keep merge.
5. R3 instant opens (if D6 passes).
6. R5 counts.
7. R6–R8 detail reads (`lib/symmio/quoteDetails.ts` or inside existing hooks).
8. Delete replaced code + dead position readers with no callers (`getActiveQuotes`, `getStrictActiveQuotesForVirtualAccount`, `getClosedQuotes`, raw multicall + raw quote ABI fragments if unused).
9. Feature record `sdk-integrations/positions.md` + index + `symmio-sdk.md` source-of-truth list.
10. `bun run test`, typecheck, lint, guardrails, build; staging QA.

## 10. SDK gap tickets to file (separate; show for approval before filing)

- **G1** — core action `isPartyALiquidated({ chainId, partyA })` (+ react hook).
- **G2** — `getQuoteHistory`: market filter (`marketIds`), richer quote snapshot (initial locked values, fees, leverage, initial opened/market price, funding paid/received, open tx), open-event metadata.
- **G3** — per-quote funding-accrual epochs read (settlements + funding checkpoints, cursor-paged).
- **G4** (optional, defensive) — diamond/`source` filter on subgraph quote reads.

## 11. Decisions needed

- **D1 — Groups:** keep app grouping + formulas (recommended) vs adopt SDK grouping (changes figures, resets saved order).
- **D2 — History:** keep on current path + file G2 (recommended) vs extend SDK first, then migrate here (blocks on SDK release).
- **D3 — Pool quotes:** defer to VIBE-1903 (recommended; pool detail tabs already scoped there) vs do here.
- **D4 — Liquidated-VA flag:** keep app call via SDK ABI + file G1 (recommended) vs add SDK action first.
- **D5 — Base:** wait for VIBE-1900 merge (recommended) vs branch from 1900 branch now.
- **D6 — Instant-opens read:** move to SDK `getInstantOpens` after parity check (recommended) vs keep hedger call this slice.
