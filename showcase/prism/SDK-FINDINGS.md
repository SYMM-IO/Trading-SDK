# What building Prism found in the SDK

Prism is the first consumer to drive **two SYMMIO deployments at once**. That
exercised paths the single-deployment reference app never reaches. These are the
concrete findings, each with the file that proves it.

Nothing here is a blocker — Prism works around all of it. They are listed as
SDK-improvement candidates, roughly in order of how much they cost a consumer.

---

## 1. The published npm packages are not the packages in this repo

`@symmio/trading-core@1.1.0` and `@symmio/trading-react@1.1.0` on npm carry the
same version numbers as `packages/*` but a substantially older build.

|                                                        | published 1.1.0      | this repo's 1.1.0    |
| ------------------------------------------------------ | -------------------- | -------------------- |
| `export` lines in `dist/index.d.ts`                    | 42                   | 1986 (source barrel) |
| `SymmioSolverKind` / `SolverId`                        | absent               | present              |
| `Market` union (`EnigmaMarket \| RasaMarket`)          | absent               | present              |
| `watchPrices` / `usePrices` (provider-agnostic)        | absent — Enigma only | present              |
| orderbook, candles, TP/SL, Muon, margin, `rasa-solver` | absent               | present              |
| quote reconciliation (`useManagedQuotes`)              | partial              | present              |

A consumer following the docs installs from npm and cannot compile anything
multi-solver. Prism vendors tarballs built from this repo instead; see the
README. **A release carrying the current surface is the single highest-value
fix on this list.**

## 2. Nothing tells you how to chart a pool-traded market ← _cost me a wrong feature_

**This is the highest-value documentation gap on the list**, because it did not
produce an error — it produced a confident, wrong UI that shipped.

Building Prism's chart, I read `packages/trading-core/src/candles/`, found that
the only `CandleSource` implementation is Binance, and concluded lowcaps cannot
be charted. I rendered a panel saying _"No candle source for this solver"_. That
panel was plausible, authoritative, and wrong.

Lowcaps **are** chartable, and this repo's own `apps/web` already does it:

```
useEnigmaPriceServiceSymbolsInfo()      → market token address
useEnigmaPriceServiceMetadata({addresses})  → { chain_id, pair_address }
                                        → DexScreener embed for that pool
```

See `apps/web/src/features/candles/lowcap-chart.tsx` and `dexscreener-embed.ts`.

Nothing connected those dots for a reader:

| What I read                     | What it did not say                                             |
| ------------------------------- | --------------------------------------------------------------- |
| `CandleSource` interface        | that it is _pluggable_ — a consumer may implement one           |
| `createBinanceCandleSource`     | that it is _one_ implementation, not the charting story         |
| `EnigmaMarket.tokenAddress`     | what it is **for** (resolving the market's pool)                |
| `getEnigmaPriceServiceMetadata` | that `chain_id` + `pair_address` are pool **chart coordinates** |
| candles docs page               | that pool-priced markets chart by a different route entirely    |

### Recommended fixes, in priority order

1. **Add a `Charting a market` guide** (`apps/docs/app/guides/charting/`) built
   around the decision, not the API:

   > _Does this market have a reference-exchange listing?_
   > **Yes** → `CandleSource` → `useCandles` / `useCandleStream`.
   > **No** (pool-priced, e.g. lowcaps) → `useEnigmaPriceServiceMetadata` →
   > `chain_id` + `pair_address` → any pool indexer.
   > Both branches are first-class. Neither is a fallback.

2. **Retitle the candles docs page.** It reads as _the_ charting page; it is the
   _listed-market_ charting page. Add a banner naming the other branch and
   linking to it.

3. **Say "pluggable" in the `CandleSource` JSDoc.** One sentence — "implement
   this interface to chart a venue the SDK does not ship a source for" — plus
   the four required members, would have changed my conclusion on its own.

4. **Give `EnigmaMarket.tokenAddress` a purpose in its JSDoc.** Today it reads
   as an identifier. It is the key that unlocks the pool lookup; say so and link
   to `getEnigmaPriceServiceMetadata`.

5. **Document `MetadataResponse` as pool vitals, not opaque metadata.**
   `liquidity.usd`, `market_cap`, `price_change.h24`, `dex_id` are exactly what
   a pool-traded market shows instead of a depth ladder. Prism's `PoolStats`
   panel exists only because I eventually read the generated type.

6. **Add charting to the per-solver capability table** alongside TP/SL and group
   close, with the values `candle-source` / `pool-indexed` rather than
   yes/no — the honest answer is "differently", not "no".

7. **Cross-link `apps/web` as a worked example.** `lowcap-chart.tsx` answers
   this in 60 lines. Nothing in the docs points at it.

> **Generalisable lesson:** every place the SDK says a capability is _absent_
> for one solver kind, the docs should state what that kind does _instead_.
> "Enigma has no `CandleSource`" is true and useless. "Enigma markets are
> pool-priced; chart them from `pair_address`" is the same fact, actionable.

## 3. `useSwitchToSymmioChain` cannot target a deployment

It always switches to `config.defaultChainId`, so it can only ever reach one of
the two chains. Any app with more than one deployment has to drop to wagmi's
`useSwitchChain` and name the chain itself.

Prism's replacement: `src/features/wallet/use-chain-gate.ts`.

## 4. `getQuoteHistory` filters on a field chosen by isolation type

Two separate traps in one read:

- Passing a **Virtual Account** returns zero rows silently. It wants the parent
  SubAccount. (The SDK JSDoc says the opposite.)
- It also switches its subgraph filter field on `SubAccountIsolationType`:
  `CUSTOM` (cross-margin, i.e. majors) filters on `partyA`; every other value
  filters on the quote's `subAccount`. Omit `isolationType` and a correct
  SubAccount address still returns nothing.

So the fan-out unit is **deployment × isolation type**, not deployment.
See `src/features/activity/use-quote-history-rows.ts`.

## 5. Decimal bases are mixed and invisible to the type system

Every amount is a `bigint`, so nothing distinguishes these at a call site:

| API                                                  | base                    |
| ---------------------------------------------------- | ----------------------- |
| `useDeposit`, `useDepositAndAllocate`, `useWithdraw` | collateral decimals (6) |
| `useAllocate`, `useAddMargin`                        | 18                      |
| `WithdrawReceiverPart.amount`                        | collateral decimals (6) |
| `AccountBalanceInfo.*`, `TransferRow.amount`         | 18                      |
| `BalanceHistoryRow.amount`                           | collateral decimals (6) |

Merging `TransferRow` with `BalanceHistoryRow` without normalizing is off by
`1e12`. Prism routes every conversion through one `rescale()` in
`src/features/portfolio/amount.ts`.

A branded type (`Wei18`/`Collateral`) would make these mistakes unrepresentable.

## 6. `getAccountBalanceOf` JSDoc states the wrong decimals

It says "raw collateral token units", but perps-core `AccountFacetImpl.deposit`
stores `to18Decimals(amount)` into `AccountStorage.balances`, so `balanceOf`
returns an 18-decimal figure — the same scale as `allocatedBalance`.

## 7. `useAddMargin` is position-scoped, not account-scoped

It calls `AccountLayer.addMargin(virtualAccount, amount)` — a Virtual Account
top-up from its parent sub-account — and its inverse `useRemoveMargin` needs a
fresh Muon uPnL signature. The name reads like an account-level action. Prism's
account cards use `useAllocate` instead.

## 8. Composed hooks cannot be fanned out

The `getXQueryOptions` + `useQueries` trick (Prism's whole fan-out mechanism,
`src/features/data/use-deployment-queries.ts`) only works for reads backed by a
single query factory. These are composed hooks with no factory, so an N-deployment
app must mount one component per deployment and collect results upward:

- `useManagedQuotes` / `useGroupedQuotes` — and they take **no `solverId`**, so
  the fan-out unit is the chain
- `useAccountUpnl`, `useAccountMarginRisk`
- `usePrices`, `useNotifications` (sockets, inherently)

`useAccountMarginRisk` additionally does not fetch its own uPnL — it must be
paired with `useAccountUpnl` per account, and there is no combined hook.

## 9. `useQuotesFunding` returns a fresh object every render

Its memo depends on the caller's `quotes` array, which a fan-out recreates each
render. A consumer that lifts its result into parent state must compare content,
not identity, or it loops forever.

## 10. Per-kind response gaps worth documenting on the hook

Not bugs — real vendor divergence — but a consumer only discovers them by
reading adapters:

- **`MarketInfo` rows key by different things per kind, under the same field
  name.** Rasa's `/get_market_info` is keyed by the market's **name**
  (`"SOLUSDT"`); Enigma's is keyed by its **symbol** (`"$WIF"`, where the
  market's `name` is `"$WIF::EK..jm_SFLOW"`). Both adapters write that key into
  a normalised field called `symbol`, so a consumer that looks a market up by
  `market.name` gets every Rasa row and **silently zero Enigma rows** — the
  volume column reads `—` for all 201 lowcaps and nothing errors. Prism now
  looks up by name and falls back to symbol (`src/features/markets/market-key.ts`).
  The SDK should either normalise both to the market's `name`, or key the map by
  `symbolId`, which is unambiguous across kinds.
- **The same divergence in `getFundingInfo` is worse, because the key is also
  the request filter.** `getFundingInfo({ symbols })` forwards straight to the
  solver, and Enigma matches on symbol:

  ```
  GET /get_funding_info?symbols=SYMM                 → { "SYMM": { … } }
  GET /get_funding_info?symbols=SYMM::80..5f_SFLOW   → { }
  ```

  An empty object is indistinguishable from "this market has no funding", so the
  funding column reads `—` for all 201 lowcaps with no error anywhere. Prism now
  passes `solverMarketKey(market)`. **`GetFundingInfoParameters.symbols` should
  document which identifier it expects per kind**, or accept `symbolId`.

- `EnigmaMarketInfo` rows carry **no 24h price change**; Rasa's do. But the
  figure is not actually missing for lowcaps — it lives on the pool, as
  `MetadataResponse.price_change.h24`. See finding 2: state what a kind does
  _instead_, rather than only what it lacks.
- `RasaNotionalCap` is `{ kind, totalCap, used }`: **no `openInterest`**. Enigma
  has it.
- `getNotionalCapAll` (whole-book) and `getEstimatedPrice` are Enigma-only.
  `getSolverCapabilities` covers only `tpsl` and `groupClose`, so neither can be
  gated through it — Prism gates on `solverId` directly.
- Notification frames carry `quoteId` and no market, so resolving a ticker for a
  live event needs a `getQuote` round-trip.

## 11. Configuration gaps for multi-deployment apps

- A solver config carries only `name`. Anything user-facing — palette, label,
  blurb, chain display name — has to live in the app. Prism keeps it in
  `src/config/deployments.ts`.
- Base's subgraph URLs in the built-in registry are **placeholders** pointing at
  HyperEVM's Goldsky project, so every subgraph-backed read (quote history,
  transfers, funding) is unreliable for majors. Prism renders an explicit notice
  rather than an empty table.
- Rasa's solver URL is a **staging host** (`stage-archon.rasa.capital`), with an
  inline TODO in the registry.

---

## What worked exactly as advertised

Worth recording, because it is what made the app possible:

- **Query-key isolation.** Every key carries `chainId`, `solverId` and a hash of
  the resolved chain config, so two deployments' data never collided once — no
  manual namespacing anywhere in Prism.
- **Cross-chain reads without wallet switching.** `SymmioProvider` bridging
  `getClient` to wagmi's per-chain transports is what makes a merged book
  possible at all.
- **The layered API.** Every read shipping both a typed hook _and_ a
  `getXQueryOptions` factory is what let Prism build an N-deployment fan-out in
  one `useQueries` call. Without the factories there is no merged view.
- **Per-kind discriminated unions.** `kind: "enigma" | "rasa"` on markets,
  market-info and notional caps meant divergence surfaced at compile time
  instead of as runtime `undefined`.
- **`useManagedQuotes`' VA fan-out.** Lowcap positions live under Virtual
  Accounts; the reconciler resolved them, including predicting VAs for
  not-yet-anchored opens, with no consumer involvement.

---

# Round two — findings from wiring the guards

The first pass built the surface. The second pass made the **order ticket
correct** — the guards, limits, errors and per-solver preconditions the docs
describe — and that exercised a different part of the SDK. These are the
findings from that work, in the same spirit: each one is a place a careful
consumer following the documentation still gets it wrong.

## 12. `useAvailableInstantOpenMargin` cannot tell "zero" from "unknown" through the field everyone reads ← _shipped a broken guard_

`availableMargin` is the string `"0"` in **four** distinct situations
(`packages/trading-react/src/margin/use-available-instant-open-margin.ts:179`,
`:192`):

1. the balance and fee reads are still loading;
2. either read errored;
3. the account genuinely has nothing spendable;
4. on the cross-margin path, `useAccountUpnl` has not priced every open position
   yet — and its `isLoading` deliberately excludes that socket wait, so the hook
   reports `isLoading: false` while the answer is still unknown.

Only `availableMarginWei: bigint | undefined` separates them. Prism's ticket read
the string and guarded with `availableUsd > 0 && margin > availableUsd`, which
**disables itself in exactly the case it exists for**: an empty account passes
the guard and submits an order the solver will certainly reject.

The type documents the distinction on `availableMarginWei`; the string field is
what every UI reaches for first. **Either drop `availableMargin` in favour of the
wei field, or make it `string | undefined`.** A field that is `"0"` for four
different reasons is a guard-shaped trap.

## 13. `useAvailableInstantOpenMargin` throws during render

`:113` calls `resolvedConfig.getSolver({ chainId, solverId }).id === "rasa"` with
no `try`/`catch`, at the top of the hook body. `getSolver` throws
`UNSUPPORTED_CHAIN` / `UNKNOWN_SOLVER`. Every sibling probe wraps the same call
(`solvers/capabilities.ts:34`, `tpsl/supports-tpsl.ts:25`,
`estimated-price/supports-estimated-price.ts:36`); this one does not, so mounting
a ticket while the wallet is on an unsupported chain throws during render instead
of resolving to an error state. One `try`/`catch` defaulting to `false` fixes it.

The same hook also does **not** default `chainId` to `useSymmioChainId()`, unlike
`useSolverCapabilities` / `useTpSlSupported` / `useMarkets` / `useInstantOpenAuto`
— it falls through to `config.defaultChainId`. In a multi-deployment app an
omitted `chainId` therefore mixes two chains on one screen.

## 14. Nothing validates an order before the wallet prompt unless you call it yourself

`prepareInstantOpenParams` resolves market metadata, mark price, locked params
and fees, runs `calculateTradeParams`, and returns — it **never** calls
`validateInstantOpenAgainstMarket`. So `minAcceptableQuoteValue`,
`minAcceptablePortionLf`, `maxNotionalValue`, `minNotionalValue`, `maxQuantity`,
`lotSize` (floor **and** integer-multiple) and the solver's notional cap are all
unchecked on the happy path. The user signs, and _then_ gets a rejection.

The validator exists, takes exactly the values `calculateTradeParams` returns,
and is a drop-in — but nothing in the flow docs says the wizard skips it. **Either
call it inside `prepareInstantOpenParams`, or say plainly on the instant-open
page that validation is the consumer's job.** The same is true of
`validateInstantCloseAgainstMarket` for closes.

## 15. `useQuoteTpSl` has no `supportsTpSl` guard, while its siblings do

`useWatchTpSlAccounts:48` and `useQuoteGroupTpSl:107` both call `supportsTpSl`
and go idle on a solver without a `tpsl` block. `useQuoteTpSl:107` is enabled
purely on `account` + `quoteId`, so mounting it per row on Base fires **one
failing query per position** with `TPSL_NOT_CONFIGURED`. `useInstantOpenWithTpSl`
likewise accepts a `tpsl` block on a solver that cannot honour it and reports the
failure through `data.tpslError` after the open has already landed.

## 16. Docs state the balance model as universal when it is per-isolation ← _this one strands money_

`app/core/concepts/balance-model/page.mdx` says instant trading spends the
_available_ balance and that `depositAndAllocateForAccount` is an anti-pattern —
"the symptom is exactly that: deposited, but can't trade". True for VA isolations.
**Inverted for cross-margin.**
`use-available-instant-open-margin.ts:127-186` forks on the sub-account's
isolation type: VA isolations read `balanceOf` (available), `CUSTOM` reads
`balanceInfoOfPartyA` (allocated) through `calculateAvailableForOrder`, times a
Rasa-only 90% reserve.

Prism had followed the docs' universal reading in the other direction and funded
_every_ account with `depositAndAllocate`. On a `MARKET_DIRECTION` account that
parks the deposit where `addMarginToNextVA` cannot reach it — the portfolio shows
full equity while the ticket shows `AVAIL $0.00` — and it is not recoverable
in-app, because `withdraw` routes VA isolations to `initiateWithdraw`, which
draws on the _available_ balance that is now empty.

`calculateAvailableForOrder` and `useAccountUpnl` have **no doc page at all**, and
`app/react/margin/page.mdx:59-115` documents only the lowcap branch. The
cross-margin funding path is undocumented in a way that costs real money.

## 17. Smaller, verified corrections

- **`useInstantOpenAuto`'s JSDoc example is a different API.** It shows
  `{ walletAddress, sessionKeyAddress, signTypedData, marketId, positionType,
userInput, … }`; `PrepareInstantOpenParameters` is
  `{ subAccountAddress, market, positionType, initialMargin, leverage, slippage }`.
  Copying the example does not compile.
- **`getLockedParams` does not auto-disable.** The hook's prose implies the query
  waits for `symbol`; `solvers/locked-params/query.ts` has no such guard, and an
  empty symbol is a 404 `FETCH_LOCKED_PARAMS_FAILED`. The `enabled` guard is the
  caller's job.
- **Locked params are percents, not fractions.** The JSDoc says `"0.02"` for 2%;
  `trade-math.ts:140` divides by 100, so the solver returns `"4"` for 4%. Passing
  a pre-divided value silently under-locks the quote.
- **`getAccountBalanceOf` says "raw collateral token units".** Every consumer of
  it — including `CalculateAvailableInstantOpenMarginParameters.balance` and the
  hook's own `formatUnits(x, 18)` — treats it as 18-decimal.
- **`useFinalizeWithdrawRequest` does not invalidate the collateral balance,**
  though finalizing is the step that pays the ERC-20 out to the wallet. With
  `refetchOnWindowFocus: false` the deposit form shows a stale wallet balance
  indefinitely.
- **`useGroupingIsolation` is implemented but exported from neither the `quotes`
  barrel nor the root,** so a consumer cannot reach it. Same for
  `assertSolverKind`.
- **`getSolverPriceRange` has no boolean twin.** `supportsEstimatedPrice`,
  `supportsTpSl`, `supportsLimitOrder` and `supportsGroupClose` all exist; the
  Rasa-only price band leaves the consumer comparing `getSolver().id` by hand.
- **`getEstimatedPrice.price` is the _request_ price, not the mark.** Prism was
  passing the raw mark, which prices a different trade than the one being placed.
  The parameter doc says so; the name does not, and the mark is the obvious thing
  to reach for.
- **`instantClose`'s docs say `partyA` is "the Virtual Account that owns the
  position".** On a cross-margin account it is the sub-account itself. The
  action's own JSDoc gets this right; the docs page does not.
- **The Enigma instant-open adapter hardcodes `ORDER_TYPE_MARKET`** and drops
  `parameters.orderType` (`adapters/enigma-instant-open.ts:61`), while the Rasa
  one honours it. A LIMIT bag sent to `instantOpen` on Enigma is silently
  submitted as a market order — only the `prepareLimit*` wizards guard. The
  primitive should throw rather than downgrade.

## 18. Delegation is invisible until it is not

`InstantLayer._verifyOperation` skips the delegation check when
`accountOwner == signer` (perps-core v0.8.5,
`contracts/instantLayer/InstantLayer.sol:798-816`). So an app that omits `from`
and lets the owner EOA sign — which is what the React layer defaults to — works
with no delegation at all, and every guide's warnings read as theoretical. The
moment a session key signs, delegation becomes mandatory, and the failure lands
**on-chain, after the solver has accepted the request**.

Two things would help a consumer cross that gap safely:

1. `useIsDelegationActive` takes `account: Address` while `useGrantDelegation`
   takes `account: InstantLayerAccount` (`{ addr, isPartyB }`). Same concept,
   two shapes, one letter apart in the parameter name (`delegate` vs
   `delegatedSigner`).
2. `INSTANT_TRADE_REQUIRED_SELECTORS` is the **lowcap** superset. A cross-margin
   account never calls `addMarginToNextVA`, so gating on all three deadlocks a
   majors user whose grant legitimately omits it. Nothing in the constant's name
   or docs says the required set is per-isolation.
