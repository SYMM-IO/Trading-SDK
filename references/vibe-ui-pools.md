# Vibe-ui — Pools Feature Reference

Read-only map of the pools feature in the Vibe-ui reference repo
(`/symmio/Vibe-ui`), produced by sixteen agents that each read the
actual source. It exists so the pools flows can be discussed and ported to the
SYMMIO Trading-SDK across separate sessions without re-reading Vibe-ui.

Every claim is anchored to `path/to/file.tsx:LINE`. Where two sections disagree,
neither has been silently reconciled — the disagreement is itself the finding.

**Scope note.** Vibe-ui is a read-only reference repo. Nothing here describes SDK
code; it describes the reference implementation that SDK slices are derived from.

## Contents

### Part I — Subsystem maps

1. Entry point, tab shell, and the Discover tab
2. The Your Pools tab
3. Pool detail — shell, header, stats, chart, summary cards
4. Pool detail — the five data tables
5. Create Pool wizard (permissionless listing)
6. Listing auth, deposit, and terms
7. Withdraw and claim rewards
8. Service / API layer — the endpoint catalog
9. State, on-chain surface, routing, GraphQL
10. Repo documentation and test coverage

### Part II — Resolved open questions

1. What is a pool on-chain? (main_pool, TVL, LP accounting)
2. Whose quotes does Open Quotes show — pool side or trader side?
3. Deposit chain vs trading chain: how deposits become pool liquidity
4. Lifecycle drivers and symbol_id provenance
5. Custodial deposit address semantics and failure modes
6. Realtime on a pool page: what ticks, and is it correct?

### Part III — Cross-cutting synthesis (partial)

A cross-cutting pass covering computation formulas, withdraw/claim math, and gotchas. Its opening sections were lost to an output-length cap, so it begins mid-document at the pool-statistics formulas. Parts I and II are complete and cover the same ground from the subsystem side.

---

# Part I — Subsystem maps

## 1. Entry point, tab shell, and the Discover tab

### Vibe-ui — Pools slice map: entry point, tab shell, DISCOVER tab

All paths are relative to `/symmio/Vibe-ui`.

---

#### 1. Component tree from `/pools` down, with state ownership

```
pages/pools/index.tsx:3            PoolsPage  → renders <Pools/>  (no state, no getServerSideProps)
└── components/App/Pools/index.tsx:9   Pools (default export)
    │   OWNS: nothing local. Reads router.query.tab (URL is the ONLY tab state).
    │   activeTab = tabs.some(t => t.key === query.tab) ? query.tab : 'discover'   (index.tsx:17)
    │   handleTabChange → router.push({pathname, query:{tab}}, undefined, {shallow:true})  (index.tsx:14)
    │   Shell markup: <div class="h-full overflow-auto"><div class="mx-auto max-w-7xl px-4 py-10 max-lg:pt-3">  (index.tsx:20-21)
    ├── components/PoolsTab/index.tsx:13   PoolsTabs({activeTab, handleTabChange})
    │      OWNS: nothing. useIsMobile() decides switch-vs-links.
    ├── (activeTab === 'your_pools')  ListingAuthGuard → YourPoolsContent      [out of slice]
    └── (else)  DiscoverPoolsContent.tsx:42   DiscoverPoolsContent
        │   OWNS ALL DISCOVER STATE (all React local, none in zustand, none in URL):
        │     searchTerm            useState('')                          :52
        │     {page, perPage}       usePagination(1, 10)                  :53
        │     debouncedSearchTerm   useDebounceValue(searchTerm, 1000)    :54  (usehooks-ts ^3.1.1)
        │     sortColumn            useState<DiscoverMarketSearchSortBy|undefined>(undefined) :55
        │     sortOrder             useState<QuoteOrder>(QuoteOrder.DESCENDING)               :56
        │   URL-owned state it only READS: query.status, query.chains, query[<filter keys>]
        ├── PoolsInfo/GeneralInfo.tsx:29   <GeneralInfo activeTab={'discover'} poolsCount isPoolsCountLoading/>
        │      OWNS: isShowingVibecapsOi useState(false) (:36) — TVL/Available-OI toggle tile
        ├── Filters/FilterByMarketStatus.tsx:14  <FilterByMarketStatus/>   (URL: query.status)
        ├── Filters/FilterByChain.tsx:6          <FilterByChain/>          (URL: query.chains; select state is UNCONTROLLED)
        ├── Button "Filters" (desktop, :105-119) → toggleListingFilterModal
        ├── Filters/MobilePoolsSort.tsx:19  <MobilePoolsSort options={DISCOVER_SORT_OPTIONS} .../>  OWNS: isOpen useState(false) :21
        ├── Button "Filters" (mobile duplicate, :129-143)  ← literal duplicate of the desktop button
        ├── ThemedInput.WithRightComponent  (search box, :146-156)
        ├── Tooltip(WeeklyLimitTooltip) → Button "New Pool" (:159-170)
        ├── <div class="inline lg:hidden">  PoolsList/DiscoverPoolsList.tsx:18   (:173-183)
        │     └── PoolsList/DiscoverPoolMobileCard.tsx:35  OWNS: openDetails useState(false) :38
        │           ├── DiscoverModeMainData (local fn, :157)
        │           ├── DiscoverModeDetails  (local fn, :217) → DetailRow (:292)
        │           └── TablePagination (components/Table/index.tsx:202)
        └── <div class="hidden lg:inline">  PoolsTable/DiscoverPoolsTable.tsx:25   (:184-197)
              └── components/Table/index.tsx:395 ThemedTables.Simple
                    OWNS (unused here — overridden by props): pageState/perPageState useState (Table/index.tsx:459-460)
                    └── row={(item)=> PoolsTable/DiscoverPoolTableItem.tsx:32}   (DiscoverPoolsTable.tsx:146)
                          └── PoolsTable/components/TradeButton.tsx:14
```

Modals are mounted **outside** the Pools tree, in `components/Layout/index.tsx`:

- `components/Layout/index.tsx:197` — `{showVibeListingFilterModal && <FilterPoolModal />}` (gate at `:130`-ish via `useIsModalOpen(ApplicationModal.LISTING_FILTER)`).
- `components/Layout/index.tsx:195` — `{showVibeListingTermsAndConditionsModal && <TermsAndConditionsModal />}`.
- `FilterPoolModal` (`components/App/Pools/components/FilterPoolModal/index.tsx:27`) OWNS `value: MarketSearchFilters` (`useState(() => getInitialFilters(query))`, `:33`) + `wasOpenRef` (`:34`).

---

#### 2. The Discover table — every column

Column definitions: `components/App/Pools/components/PoolsTable/DiscoverPoolsTable.tsx:38-138` (`useMemo`, deps `[t]`).
Cell rendering: `components/App/Pools/components/PoolsTable/DiscoverPoolTableItem.tsx`.
Widths: `components/App/Pools/components/PoolsTable/constants.ts:1-12` `DISCOVER_POOLS_COLUMN_WIDTHS`.

Every value comes from **one row object** `item: MarketSearchItem` supplied by the single `useDiscoverMarketSearch` query — there is **no per-row/per-cell data hook** except the token image and the deposit mutation.

| #   | `key`           | Header label                                                      | Width   | Cell expression (verbatim)                                                                                                                                                                                                                                                                                                                                                                                                                          | Data source                                                               | Sortable                |
| --- | --------------- | ----------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------- |
| 1   | `symbol`        | `t('Pool')`                                                       | `220px` | `item.token_ticker` (`:85`), `item.token_name` (`:97`), `item.max_leverage` + `'x'` (`:95`), chain logo `DEPOSIT_CHAIN_OPTIONS.find(ch => ch.value == item.chain_id)?.logo` (`:35`), token image `useTokenImageByContract({contractAddress: item.contract_address, tokenTicker: item.token_ticker}).image` (`:43-46`)                                                                                                                               | search row + `useTokenImageByContract`                                    | **no**                  |
| 2   | `tvl`           | `t('TVL')`                                                        | `104px` | `formatPrice(marketSearchWeiToDisplay(item.tvl), {addDollarSign:true, decimalPoints:1, abbreviate:true}).price` (`:104-108`)                                                                                                                                                                                                                                                                                                                        | search row                                                                | **yes**                 |
| 3   | `market_cap`    | `t('Mkt. Cap')`                                                   | `112px` | same formatter on `item.market_cap` (`:115-119`)                                                                                                                                                                                                                                                                                                                                                                                                    | search row                                                                | **yes**                 |
| 4   | `vol24h`        | `t('Vol 24H')`                                                    | `112px` | same formatter on `item.vol24h` (`:126-130`)                                                                                                                                                                                                                                                                                                                                                                                                        | search row                                                                | **yes**                 |
| 5   | `apr`           | `t('APY')`                                                        | `96px`  | gated: `isAprVisible = item.market_status === MarketStatus.Listed` (`:36`), `hasAprValue = item.apr != null && item.apr !== ''` (`:37`), `aprValue = hasAprValue ? Number(marketSearchWeiToDisplay(item.apr)) : null` (`:38`); render `` `${formatPrice(aprValue,{addDollarSign:false,decimalPoints:2,abbreviate:true}).price} %` `` (`:142-148`) else `'-'` (`:151`). Color: `text-main-light-blue` if `>0`, `text-main-pink` if `<0` (`:137-140`) | search row                                                                | **yes** (`sort_by=apr`) |
| 6   | `liquidity`     | `t('Liquidity')`                                                  | `112px` | same formatter on `item.liquidity` (`:157-161`)                                                                                                                                                                                                                                                                                                                                                                                                     | search row                                                                | **yes**                 |
| 7   | `open_interest` | `t('Open Int.')`                                                  | `112px` | same formatter on `item.open_interest` (`:168-172`)                                                                                                                                                                                                                                                                                                                                                                                                 | search row                                                                | **yes**                 |
| 8   | `listing_time`  | `t('Listed')`                                                     | `96px`  | `formatListingAge(item.listing_time)` (`:177`) → `` `${days}d${hours>0?` ${hours}h`:''}` ``, `'-'` when falsy (`utils/formatListingAge.ts:1-13`)                                                                                                                                                                                                                                                                                                    | search row                                                                | **yes**                 |
| 9   | `Status`        | `t('Status')`                                                     | `96px`  | `t(poolStatusMapper[item.market_status]?.title ?? item.market_status)` with inline `style={{color: poolStatusMapper[...]?.color}}` (`:180-185`); mapper at `constants.ts:19-40`                                                                                                                                                                                                                                                                     | search row                                                                | **no**                  |
| 10  | `account`       | `t('Action')` (header right-aligned, `justifyContent:'flex-end'`) | `104px` | `<TradeButton symbolId={item.symbol_id ?? undefined} disabled={!canTrade}/>` where `canTrade = canTradeMarket({status:item.market_status, symbolId:item.symbol_id})` (`:40`, `:189`); then `buttonIcon` from `evaluateJSX([[<Coins/>, canDeposit], [<PaperPlaneTopRight/>, false]])` (`:66-69`) → deposit button `onClick={handleClick}` (`:191`) or a disabled `-` button (`:195-197`). Wrapper has `onClick={e => e.stopPropagation()}` (`:188`)  | `canDepositToMarket`, `canTradeMarket`, `useAddDeposit`, `useListingAuth` | **no**                  |

**Coming-soon stubs in the Discover table: none.** No column is a stub; `ComingSoonBadge` / `ComingSoonColumnsPanel` are not used by the table (see §6).

Row-level behaviors:

- Whole `<tr>` is clickable: `onClick={() => router.push(routes.pools.poolDetail(item.contract_address, item.chain_id))}` (`DiscoverPoolTableItem.tsx:74`); `routes.pools.poolDetail` = `` `/pools/${contractAddress}?deposit_chain=${depositChain}` `` (`constants/routes.ts:23-24`).
- `TradeButton` links to `routes.vibecaps.symbolId(symbolId.toString())` = `/vibecaps/${symbolId}` (`TradeButton.tsx:30`, `constants/routes.ts:3`); when `!symbolId || disabled` it renders a disabled button inside a `Tooltip content={t('Market not available')}` (`TradeButton.tsx:22-28`).

Header/sort mechanics live in the shared table: `components/Table/index.tsx:501-515` `handleColumnHeaderClicked` — clicking a `sortable` header calls `onSortChange(column.key, QuoteOrder.DESCENDING)` when it is a new column, otherwise flips `ASCENDING`↔`DESCENDING`. Sort chevrons: `Sorting` at `components/Table/index.tsx:123-139`, rendered only when `column.sortable && sortOrder` (`:575-577`).

---

#### 3. Desktop table vs mobile list branching

Two containers, **both always mounted**, toggled purely by CSS (`DiscoverPoolsContent.tsx:173` and `:184`):

```tsx
<div className="inline lg:hidden"> <DiscoverPoolsList .../> </div>
<div className="hidden lg:inline"> <DiscoverPoolsTable .../> </div>
```

- Breakpoint: Tailwind v4 with `--breakpoint-lg: 60rem` overridden in `src/styles/global.css:98` → **`lg` = 960px**.
- The **tab shell** uses a _different_ mechanism: `PoolsTabs` (`components/PoolsTab/index.tsx:14`) calls `useIsMobile()` (`lib/hooks/useWindowSize.ts:9-13`) which reads `useApplicationStore.use.display().isMobile`, set in `pages/_app.tsx:86` as `window.innerWidth <= 960` (with `isUpToSmall = <= 640`, `:87`). So the _JS_ breakpoint and the _CSS_ breakpoint agree at 960 except at exactly `width === 960`, where `isMobile === true` (mobile switch tabs) but `lg:` matches (desktop table). Both are re-rendered on `resize` (`pages/_app.tsx:94-96`).
- Because both trees are mounted, **both `DiscoverPoolsList` and `DiscoverPoolsTable` render at all times** — each row mounts `useAddDeposit`/`useListingAuth`, and `DiscoverPoolTableItem` mounts one `useTokenImageByContract` per row, in addition to the mobile cards. Duplicated work at every viewport.

What differs:

|                       | Desktop `DiscoverPoolsTable`                                                                                                            | Mobile `DiscoverPoolsList`                                                                                                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Container             | `ThemedTables.Simple` (`Table/index.tsx:395`) with `isCard`, `pagination`, `hidePaginationWhenEmpty` (`DiscoverPoolsTable.tsx:142-168`) | plain `flex flex-col gap-4` + explicit `TablePagination` (`DiscoverPoolsList.tsx:24,46-52`)                                                                                                                                        |
| Sorting UI            | column headers (`sortColumn`/`sortOrder`/`onSortChange` props threaded, `DiscoverPoolsTable.tsx:155-157`)                               | none inside the list — `MobilePoolsSort` sits in `DiscoverPoolsContent` (`:122-127`), `lg:hidden` (`MobilePoolsSort.tsx:34`)                                                                                                       |
| Fields shown          | all 10 columns                                                                                                                          | collapsed: APY, 24h Volume, Liquidity (`DiscoverPoolMobileCard.tsx:108` → `DiscoverModeMainData:157`); expanded (`openDetails`): TVL, Mkt. Cap, Vol 24H, APY, Liquidity, Open Int., Listed, Status (`DiscoverModeDetails:251-288`) |
| Status                | text column, colored (`:179-186`)                                                                                                       | dot + text in the header row (`:99-105`)                                                                                                                                                                                           |
| Trade button          | yes (`TradeButton`, `:189`)                                                                                                             | **no TradeButton at all** — mobile users cannot reach `/vibecaps/{symbolId}` from the list                                                                                                                                         |
| Deposit               | icon-only `Coins` button (`:191`)                                                                                                       | full `Deposit` button, rendered only `if (canDeposit)` (`:137-142`)                                                                                                                                                                |
| Token image           | per-row hook `useTokenImageByContract({contractAddress, tokenTicker})`, skeleton while `isTokenImageLoading` (`:43-46`, `:78-82`)       | one hook in the parent, `getImage(item.contract_address, item.token_ticker)` passed down as `tokenImage` prop (`DiscoverPoolsList.tsx:20,42`)                                                                                      |
| Loading               | `loadingComponent` = `LottieLoader name="preloading"` 150×150 + `t('Loading Pools...')` (`DiscoverPoolsTable.tsx:158-165`)              | same lottie/text inline (`DiscoverPoolsList.tsx:25-31`)                                                                                                                                                                            |
| Empty                 | `emptyComponent = <EmptySleepingChepe key="Pool" message={t('No pools')}/>` (`:166`)                                                    | same component inline (`:32-35`)                                                                                                                                                                                                   |
| Row key               | none passed to `DiscoverPoolTableItem` (React key omitted at `DiscoverPoolsTable.tsx:146`)                                              | ``key={`${item.contract_address}${item.chain_id}`}`` (`DiscoverPoolsList.tsx:39`)                                                                                                                                                  |
| Card expand animation | n/a                                                                                                                                     | `framer-motion` `AnimatePresence` + `animationVariants.collapsable` (`DiscoverPoolMobileCard.tsx:112-134`)                                                                                                                         |

---

#### 4. Filtering, sorting, search, pagination — where state lives and how it reaches the request

##### 4.1 The single request

`components/App/Pools/services/hooks/useDiscoverMarketSearch.ts:39-76`

- **Method / URL**: `GET` `` `market/search${params ? `?${params}` : ''}` `` — `components/App/Pools/services/index.tsx:120-136` (`getMarketSearch`).
- **Base URL constant**: `APP_POOLS_BACKEND_URL` (`constants/misc.ts:23-27`), bound on the axios instance at `services/index.tsx:41-44` (`timeout: 20000`). Resolves:
  - `IS_BACKEND_STAGING_ENV` (`NEXT_PUBLIC_BACKEND_ENVIRONMENT === 'staging'`, `constants/environment.ts:2`) → `https://listing-staging.enigma.bz/v2/`
  - `IS_TEST_ENVIRONMENT` (`NEXT_PUBLIC_IS_TEST_ENVIRONMENT === 'true'`, `constants/environment.ts:1`) → `https://listing85.enigma.bz/v2/`
  - else → `https://listing85.enigma.bz/v2/` (**the two non-staging branches are identical — dead ternary**)
- **Auth**: request interceptor (`services/index.tsx:62-77`) attaches `Authorization: Bearer ${listingAccessTokens[account]}` from `useUserStore`/`useWalletStore` when present. `market/search` works unauthenticated. Response interceptor (`:79-93`) clears the token on `401` via `updateListingAccessToken(account, '')` and calls `captureAxiosError`.
- **Query string builder**: `constructQueryParams` (`utils/queryParams.ts:1-14`) — drops `undefined | null | ''`, expands arrays into repeated `key=value` pairs (this is how `chain_ids` becomes `chain_ids=8453&chain_ids=56`). **No URL-encoding** — the raw search term is interpolated verbatim.
- **Request params** assembled at `useDiscoverMarketSearch.ts:63-72`:
  - `limit = Math.min(size, 100)` (`:60`), `offset = start` (`:61`)
  - `query` ← `searchTerm` (the debounced value)
  - `market_status` ← `statusFilter`
  - `chain_ids` ← `query?.chains as string[]` (raw router value; a single selection arrives as a `string`, multiple as `string[]` — both work through `constructQueryParams`)
  - `sort_by` ← `sortBy`, `order_by` ← `orderBy` (`'asc' | 'desc'`, from `QuoteOrder`, `stores/quotes/quotesTypes.ts:15-18`)
  - `...filters` (the 20 `__ge`/`__le` keys)
- **Response type**: `MarketSearchResponse` = `{ total: number; limit: number; offset: number; items: MarketSearchItem[] }` (`services/types.ts:94-99`); row type `MarketSearchItem` at `services/types.ts:67-92` — all money/percent fields are **18-decimal strings**: `price_usd`, `market_cap`, `vol24h`, `apr`, `tvl`, `reward_24h?`, `liquidity`, `open_interest`; plus `contract_address`, `symbol_id: number|null`, `token_ticker`, `token_name`, `chain_id`, `max_leverage`, `listing_time: number|null`, `market_status: string`.
- **react-query key** (`:58`): `['getMarketSearch', query, size, start, searchTerm, statusFilter, sortBy, orderBy, filters]` — note `query` is the **entire** `router.query` object, so `statusFilter`/`filters` are redundant and any unrelated query change (e.g. `tab`) busts the cache.
- **staleTime**: `0` (`:56`). **refetchInterval**: `90_000` (`:57`). No `enabled` gate — it always runs, on every viewport, for both the table and the list (one shared query instance via the key).
- Loading flag used by the UI: `isDiscoverDataLoading = discoverQuery.isLoading || (discoverQuery.isFetching && !discoverQuery.data)` (`DiscoverPoolsContent.tsx:67`).
- `refetchList` prop threaded to both list and table is `discoverQuery.refetch` (`:179`, `:190`), and is forwarded into `useAddDeposit({refetchPoolsData})` so a completed deposit refreshes the list.

##### 4.2 Search

- State: `searchTerm` local `useState('')` (`DiscoverPoolsContent.tsx:52`), written from the input's `onChange` (`:148-150`).
- Debounce: `const [debouncedSearchTerm] = useDebounceValue(searchTerm, 1000)` (`:54`) — **1000 ms**, `usehooks-ts@^3.1.1`.
- Placeholder: `t('"SOL" or "Solana" or "Contract Address"')` (`:151`); left icon `MagnifyingGlass`, `rightComponent={null}` (`:153-154`).
- Fed to the request as `searchTerm: debouncedSearchTerm` → `query=` param.
- **Bug: searching does not reset pagination.** Nothing calls `setPage(1)` on search change, so a user on page 3 searching gets `offset = 20` with the new term.
- **Hack/bug: `useEffect(() => { setSearchTerm('') }, [page, perPage])` (`:79-81`)** — changing page or page-size wipes the search box; 1 s later the debounced value follows and the list silently reverts to unfiltered results while staying on the same page.

##### 4.3 Sorting

- State: `sortColumn` + `sortOrder` local `useState` in `DiscoverPoolsContent` (`:55-56`), initial `undefined` / `QuoteOrder.DESCENDING`. **Not** in the URL, **not** in a store.
- Single mutator `handleDiscoverSortChange(columnKey, order)` (`:69-73`): sets both and `setPage?.(1)`.
- Desktop entry: table header click → `ThemedTables.Simple.handleColumnHeaderClicked` (`Table/index.tsx:501-515`) → `onSortChange`.
- Mobile entry: `MobilePoolsSort.handleOptionClick` (`Filters/MobilePoolsSort.tsx:24-31`) — same key ⇒ flip direction, different key ⇒ `DESCENDING`. Options list `DISCOVER_SORT_OPTIONS` (`DiscoverPoolsContent.tsx:32-40`): `apr→'APY'`, `vol24h→'Vol 24H'`, `liquidity→'Liquidity'`, `tvl→'TVL'`, `market_cap→'Mkt. Cap'`, `open_interest→'Open Int.'`, `listing_time→'Listed'` — exactly the 7 sortable columns.
- Request wiring (`:64-65`): `sortBy: sortColumn`, `orderBy: sortColumn ? sortOrder : undefined` — order is suppressed while no column is chosen.
- Allowed values typed by `DiscoverMarketSearchSortBy` (`types.ts:11-18`): `'tvl' | 'liquidity' | 'market_cap' | 'vol24h' | 'open_interest' | 'apr' | 'listing_time'`. The cast at `:70` (`columnKey as DiscoverMarketSearchSortBy`) is unchecked.
- Sorting is **server-side only** — no client-side comparator anywhere in this slice.

##### 4.4 Chain filter — `Filters/FilterByChain.tsx`

- URL param `chains`. `onSelect` (`:13-15`): `router.push({pathname, query: {...query, chains}}, undefined, {shallow: true})`.
- Options: `DEPOSIT_CHAIN_OPTIONS` (`Pools/constants.ts:6-12`) — `Solana(0)/…SOL.svg`, `Base(8453)/…BASE.svg`, `BSC(56)/…BSC.png`, `Sonic(146)/…S.svg`, `Arbitrum one(42161)/…ARB.svg`; enum `DepositChain` at `types.ts:73-79`.
- Rendered via `SearchableSelectBase` with `multiple`, `logoOnly={false}`, `withChips={false}`, `searchable={false}` (`:18-26`).
- **Bug: no `value` prop is passed**, and `SearchableSelectBase` seeds its selection with `useState(externalValue ?? (multiple ? [] : ''))` (`FormInputs/SearchableSelect.tsx:65`) and never syncs afterwards. So on reload/deep-link the `chains` query param is still applied to the request but the control shows nothing selected; and re-selecting toggles against a stale empty array.

##### 4.5 Market-status filter — `Filters/FilterByMarketStatus.tsx`

- URL param `status`; read at `:18` (`typeof query?.status === 'string' ? query.status : undefined`).
- `onSelect` (`:20-38`): single-select semantics on a `multiple`-capable control — takes `Array.isArray(status) ? status[0] : status`, **deletes** `nextQuery.status` when the same value is re-picked (toggle-off) or the value isn't a string, then `router.push(..., {shallow: true})`.
- Options `MARKET_STATUS_OPTIONS` (`:6-12`): `listed→'Live'`, `waiting_for_deposit→'Waiting For Deposit'`, `under_review→'Under Review'`, `rejected→'Rejected'`, `delisted→'Delisted'` (values from `MarketStatus`, `types.ts:56-62`).
- **Hack: `key={selectedStatus || 'status'}` (`:42`)** — remounts `SearchableSelectBase` to force it to re-seed from `value`, working around the same never-syncs-`value` defect described above.
- Request wiring in `useDiscoverMarketSearch.ts:44`: `statusFilter = query?.status && query?.status !== 'all' ? query.status as string : undefined` → `market_status=`.

##### 4.6 Numeric/time filter modal — `FilterPoolModal`

- Opened from either "Filters" button via `useToggleListingFilterModal()` (`stores/application/applicationHooks.ts:265-267` → `ApplicationModal.LISTING_FILTER`, `applicationTypes.ts:50`); visibility read with `useIsModalOpen(ApplicationModal.LISTING_FILTER)` (`FilterPoolModal/index.tsx:29`).
- Field catalogue `FILTER_GROUPS` (`FilterPoolModal/helpers.ts:17-41`) — 4 groups, **7 fields / 14 query keys**:
  - _Market size_: `Market Cap` (`market_cap__ge`/`market_cap__le`, usd), `TVL` (`tvl__ge`/`tvl__le`, usd), `24H Volume` (`vol24h__ge`/`vol24h__le`, usd)
  - _Liquidity_: `Liquidity` (`liquidity__ge`/`__le`, usd), `Open Interest` (`open_interest__ge`/`__le`, usd)
  - _Performance_: `APY` (`apr__ge`/`apr__le`, percent)
  - _Listing_: `Listing Time` (`listing_time__ge`/`listing_time__le`, time)
  - Derived: `FILTER_FIELDS` (`:43`), `FILTER_FIELD_KEYS` (`:44`), `FILTER_UNIT_BY_KEY` (`:46-53`).
- Draft state is local (`value: MarketSearchFilters`, `:33`), re-seeded from the URL only on the open transition (`useEffect` + `wasOpenRef`, `:37-43`).
- **Input sanitizer** `sanitizeFilterInput(input, unit)` (`helpers.ts:131-158`) — keeps digits + a single `.` + one trailing suffix from `['k','m','b']` (usd/percent) or `['d','m','y']` (time). It drops `-`, so negative bounds are unreachable even though `parseNumberShorthand` accepts them.
- **Parsers**: `parseFilterValue` (`:125-129`) → `parseTimeShorthand` (`:107-123`, bare digits pass through as a timestamp; `Nd/Nm/Ny` become `now - N*86400 | N*2592000 | N*31536000`) or `parseNumberShorthand` (`:90-105`, strips `$ , % whitespace`, regex `^(-?(?:\d+\.?\d*|\.\d+))([kmb])?$`, multipliers `1e3/1e6/1e9`, formatted by `toPlainDecimal` `:84-88`).
- **Live preview** chip: `formatCompactNumber(value, unit)` (`:160-178`) → `$1.5M`, `10%`, `2d`; rendered inside `FilterInput` (`index.tsx:268-294`).
- **Apply** `onSubmit` (`index.tsx:60-85`): reduces the 14 `FILTER_FIELD_KEYS`, parses each, drops falsy results, then `router.push({pathname, query: {...getQueryWithoutFilters(), ...activeFilters}}, undefined, {shallow: true})` and closes.
- **Reset** `onReset` (`:87-98`): clears local state and pushes `getQueryWithoutFilters()`.
- `getQueryWithoutFilters` (`:52-58`) deletes all **20** `MARKET_SEARCH_FILTER_KEYS` — a superset of the 14 the modal edits (see the mismatch flag in §6).
- **Time round-trip is lossy**: `getInitialFilters` (`helpers.ts:55-65`) converts a stored timestamp into a _relative_ label via `formatTime` (`:180-191`, ceil to `d`/`m`/`y`), and re-submitting reparses that label as a fresh offset from `Date.now()`. Re-opening + applying without touching anything moves the boundary.
- **`unit === 'time'` swaps the inputs** (`index.tsx:178-179`): `firstInputKey = maxKey` labelled "From", `secondInputKey = minKey` labelled "To" — i.e. the _From_ box writes `listing_time__le`.
- Active-count badge on the Filters buttons: `activeFiltersCount = FILTER_FIELD_KEYS.filter(key => typeof query[key] === 'string').length` (`DiscoverPoolsContent.tsx:58`) — counts individual _bounds_, not fields; the modal's own badge uses `getActiveFieldCount` (`helpers.ts:193-195`), which counts _fields_. The two numbers disagree whenever both bounds of one field are set.
- Request wiring (`useDiscoverMarketSearch.ts:45-53`): every key in `MARKET_SEARCH_FILTER_KEYS` present in the URL as a string is forwarded, with values `key.startsWith('listing_time') ? value : toWei(value)` — i.e. all money **and percent** bounds are scaled by `1e18` (`utils/numbers.ts:34-36`), matching the 18-decimal row fields.

##### 4.7 Pagination

- State: `usePagination(1, 10)` (`hooks/usePagination.ts:4-17`) — two plain `useState`s in `DiscoverPoolsContent` (`:53`). Not URL-backed.
- Offset math (`:62-63`): `start: ((page || 1) - 1) * (perPage || 10)`, `size: perPage`; capped server-side by `Math.min(size, 100)` (`useDiscoverMarketSearch.ts:60`).
- Page-size options `10 / 20 / 50 / 100` from the shared `TablePagination` dropdown (`Table/index.tsx:347-365`).
- `TablePagination` (`Table/index.tsx:202-376`): `lastPage = max(1, ceil(total/perPage))` (`:227`), the `from`/`to` label (`:230-239`), page buttons from `buildPaginationItems` (`Table/tableUtils.ts:8-35`, 7 slots with ellipses), `useEffect(() => setPage(1), [perPage, setPage])` (`:246-248`), and early-return `if (total <= perPage && page === 1) return null` (`:267`).
- Desktop passes `totalCount={data?.total}` into `ThemedTables.Simple` (`DiscoverPoolsTable.tsx:151`), which makes `displayData` slice `data.slice(0, currentPage * currentPerPage)` (`Table/index.tsx:475`) — server pages through, no client slicing.
- Mobile renders `TablePagination` directly with `total={data?.total ?? 0}` and unchecked `as` casts on `page/setPage/perPage/setPerPage` (`DiscoverPoolsList.tsx:46-52`).
- **`useEffect(() => { setPage?.(1) }, [query, setPage])` (`DiscoverPoolsContent.tsx:75-77`)** — every router-query change (any filter, chain, status, or even the `tab` param) resets to page 1.

---

#### 5. Every hook called + every prop threaded (data-dependency graph)

##### `Pools` (`components/App/Pools/index.tsx`)

`useRouter()` only.

##### `PoolsTabs` (`components/PoolsTab/index.tsx`)

Props: `{ activeTab: ActiveTabKeys, handleTabChange: (tabKey: ActiveTabKeys) => void }` (`:8-11`).
Hooks: `useIsMobile()` (`:14`), `useTranslation()` (`:15`).
Mobile branch renders `ThemedSwitch.Primary` with `activeOption={tabs.findIndex(item => item.key === activeTab)}` (`:52`) and `activeOptionChanged={(index) => handleTabChange(tabs[index].key)}` (`:53-55`); `tabs` from `Pools/constants.ts:14-17` (`discover`/`Discover`, `your_pools`/`Your Pools`). Desktop branch maps `tabs` to clickable `<p>` (`:63-73`).

##### `DiscoverPoolsContent` (`DiscoverPoolsContent.tsx`)

Hooks, in order:

1. `useTranslation()` `:43`
2. `useRouter()` `:44`
3. `useToggleListingTermsAndConditionsModal()` `:47`
4. `useToggleListingFilterModal()` `:48`
5. `useUserStore.use.hasSeenListingTerms()` `:49`
6. `useWeeklyListingLimit()` → `{isLimitReached, limit, resetAt}` `:51`
7. `useState('')` searchTerm `:52`
8. `usePagination(1, 10)` `:53`
9. `useDebounceValue(searchTerm, 1000)` `:54`
10. `useState<DiscoverMarketSearchSortBy|undefined>` `:55`
11. `useState<QuoteOrder>(QuoteOrder.DESCENDING)` `:56`
12. `useDiscoverPoolsCount()` `:57`
13. `useDiscoverMarketSearch({searchTerm, start, size, sortBy, orderBy})` `:60-66`
14. two `useEffect`s `:75-81`

Props out:

- → `GeneralInfo`: `activeTab={'discover' as ActiveTabKeys}`, `poolsCount={discoverPoolsCountQuery.data ?? 0}`, `isPoolsCountLoading={discoverPoolsCountQuery.isLoading}` (`:93-97`)
- → `MobilePoolsSort`: `options={DISCOVER_SORT_OPTIONS}`, `sortColumn`, `sortOrder`, `onSortChange={handleDiscoverSortChange}` (`:122-127`)
- → `DiscoverPoolsList`: `page`, `perPage`, `setPerPage`, `setPage`, `refetchList={discoverQuery.refetch}`, `data={discoverQuery.data}`, `isLoading={isDiscoverDataLoading}` (`:174-182`)
- → `DiscoverPoolsTable`: the same seven **plus** `sortColumn`, `sortOrder`, `onSortChange` (`:185-196`)
- → `WeeklyLimitTooltip`: `limit`, `resetAt` (`:159`)
- `FilterByMarketStatus` / `FilterByChain` take **no props** (URL-driven).

##### `useWeeklyListingLimit` (`services/hooks/useWeeklyListingLimit.ts:10-36`)

`useWalletStore.use.account()`, `useUserStore.use.listingAccessTokens()`; `useQuery` key `['weeklyListingLimit']`, `queryFn: GetWeeklyListingLimit()` → `GET /market/weekly-listing-limit` (`services/index.tsx:255-257`), response `WeeklyListingLimitResponse {limit, remaining, reset_at}` (`services/types.ts:404-408`). `enabled: Boolean(accessToken)`, `staleTime: 30_000`, adaptive `refetchInterval`: `60_000` when `remaining <= 5` else `300_000` (`:20-25`). Returns `{isLimitReached: data ? data.remaining <= 0 : false, limit, remaining, resetAt, isLoading, isError}`.

##### `useDiscoverPoolsCount` (`services/hooks/useDiscoverPoolsCount.ts:4-20`)

`useQuery` key `['discoverPoolsCount']`, `queryFn` = `getMarketSearch({limit: 1, offset: 0})` → returns `res.data.total`. `staleTime: Infinity`, `refetchOnMount/OnReconnect/OnWindowFocus: false`. **Deliberately unfiltered** — the "Active Pools" tile shows the global total, never the filtered count.

##### `useDiscoverMarketSearch` — see §4.1.

##### `DiscoverPoolsTable` (`PoolsTable/DiscoverPoolsTable.tsx`)

Props interface `:12-23`: `page?`, `perPage?`, `isLoading`, `data?: MarketSearchResponse`, `refetchList: () => void`, `setPage?`, `setPerPage?`, `sortColumn?: DiscoverMarketSearchSortBy`, `sortOrder: QuoteOrder`, `onSortChange: (columnKey: string, order: QuoteOrder) => void`.
Hooks: `useTranslation()` `:37`, `useMemo` for `columns` `:38-138`.
Passes to `ThemedTables.Simple` (`:142-168`): `wrapperClassName="h-full"`, `isCard`, `columns`, `row`, `data={data?.items ?? []}`, `isLoading`, `pagination`, `totalCount={data?.total}`, `page`, `setPage`, `perPage`, `setPerPage`, `sortColumn`, `sortOrder`, `onSortChange`, `loadingComponent`, `emptyComponent`, `hidePaginationWhenEmpty`.

##### `DiscoverPoolTableItem` (`PoolsTable/DiscoverPoolTableItem.tsx`)

Props `:27-30`: `{ item: MarketSearchItem, refetchList: () => void }`.
Hooks: `useTranslation()` `:33`; `useRouter()` `:34`; `useListingAuth()` → `{triggerAuthFlow}` `:42`; `useTokenImageByContract({contractAddress, tokenTicker})` → `{image, isLoading}` `:43-46`; `useAddDeposit({token_contract_address: item.contract_address, deposit_chain: item.chain_id, tokenName: item.token_ticker, status: item.market_status, refetchPoolsData: refetchList})` → `{mutate}` `:48-54`; `useCallback` `performAction` `:56-60`.
Derived: `chainLogo :35`, `isAprVisible :36`, `hasAprValue :37`, `aprValue :38`, `canDeposit = canDepositToMarket(item.market_status, {allowRejected: true}) :39`, `canTrade = canTradeMarket({status, symbolId}) :40`, `buttonIcon = evaluateJSX([...]) :66-69`.
`handleClick = () => triggerAuthFlow(performAction)` (`:62-64`).

- `useTokenImageByContract` (`hooks/markets/useTokenImageByContract.ts:67-83`) → `useTokenVendors()` (`hooks/markets/useMarketsImage.ts:6-12`, key `['getTokenVendors']`, `staleTime: Infinity`) → `getTokenVendors()` = `GET ${APP_BACKEND_URL}/vibe_back/token-vendor/tokens/` (`services/markets/service.ts:34-38`; `APP_BACKEND_URL` = `https://api-staging.vibe.trading` | `https://api.vibe.trading`, `constants/misc.ts:21`). Resolution order (`:34-60`): (1) `major_liquidity_pool` map, (2) `${TICKER}::${addr[2:4]}..${addr[-2:]}_SFLOW`, (3) `${TICKER}USDT`, else `DEFAULT_TOKEN_IMAGE = '/static/images/default-token.svg'` (`constants/misc.ts:203`).
- `useListingAuth` (`services/hooks/useListingAuth.ts:15-88`) — `useActiveAccount()`, `useWalletStore.use.account()/isConnected()/isConnecting()`, `useUserAccounts()`, `useUserStore.use.listingAccessTokens()`. `isAuthenticated = Boolean(account && activeAccount && accessToken)` (`:24`). `triggerAuthFlow(cb)` (`:54-85`) opens, in order, `ApplicationModal.WAYS_TO_TRADE` → `CREATE_ACCOUNT` → `LISTING_SIGNATURE_REQUEST`, and replays the callback once authenticated via `pendingCallbackRef` + the effect at `:30-52`.
- `useAddDeposit` (`services/hooks/useAddUserDeposit.ts:9-58`) — `useMutation`, `mutationFn: AddDeposit({payload:{token_contract_address, deposit_chain}})` = `POST /market/deposit-address` (`services/index.tsx:170-177`), response `AddDepositResponse` (`services/types.ts:191-198`). On success it stuffs `modalOptions[ApplicationModal.LISTING] = {tokenName, publicAddress: data.wallet_public_key, chain: deposit_chain, refetchPoolsData}` and sets `openModal: ApplicationModal.LISTING` (`:32-44`). On error it fires a `ToastType.ERROR` popup (`:45-56`) after a stray `console.log('e', e)` (`:46`).

##### `TradeButton` (`PoolsTable/components/TradeButton.tsx`)

Props `:9-12`: `{ symbolId: IMarket['symbol_id'], disabled?: boolean }` (note: typed off `IMarket`, not `MarketSearchItem`). Hooks: `useTranslation()`.

##### `DiscoverPoolsList` (`PoolsList/DiscoverPoolsList.tsx`)

Props `:8-16`: `data`, `refetchList`, `isLoading`, `page?`, `perPage?`, `setPerPage?`, `setPage?`. Hooks: `useTranslation()` `:19`, `useTokenImageByContract()` (no args) → `{getImage}` `:20`.
Per card: `key`, `refetchList`, `pool={item}`, `tokenImage={getImage(item.contract_address, item.token_ticker)}` (`:38-43`).

##### `DiscoverPoolMobileCard` (`PoolsList/DiscoverPoolMobileCard.tsx`)

Props `:24-28`: `{ pool: MarketSearchItem, refetchList: () => void, tokenImage?: string }`.
Hooks: `useTranslation()` `:36`, `useRouter()` `:37`, `useState(false)` openDetails `:38`, `useListingAuth()` `:44`, `useAddDeposit({...})` `:46-52`, `useCallback` `:54-58`.
Derived: `chainLogo :39`, `isAprVisible :40`, `apr = pool.apr != null ? marketSearchWeiToDisplay(pool.apr) : undefined :41`, `canDeposit :42`, `vol24h/liquidity/oi/marketCap/tvl :64-68`, `poolDetailRoute :69`, `statusColor :70`.
Child props: `DiscoverModeMainData {vol24h, liquidity, apr, isAprVisible}` (`:108`); `DiscoverModeDetails {apr, isAprVisible, listingTime: pool.listing_time, liquidity, marketCap, oi, status: pool.market_status, tvl, vol24h}` (`:121-131`); `DetailRow {title, value, valueClassName?, style?}` (`:292-302`).

##### `GeneralInfo` (`PoolsInfo/GeneralInfo.tsx`) — rendered by the Discover tab

Props `:15-19`: `{ poolsCount, activeTab, isPoolsCountLoading? }`.
Hooks: `useTranslation()` `:30`; `useMarketInfo()` `:31` (`services/hedger/hooks/useMarketInfo.ts:11-16`, key `['getMarketInfo']`, `staleTime`/`refetchInterval` `2*60_000`, `GET {ENIGMA domain}/get_market_info` — domain `https://solver.enigma.bz/api` prod / `https://solver-staging.enigma.bz/api` test, `constants/hedgers.ts:86-90`, route name `constants/hedgers.ts:122`); `useNotionalCap({isLowcap: true, fetchAll: true})` `:33` (`services/markets/hooks/useNotionalCap.ts:17`; bulk query key `['getNotionalCaps', hedgerType]`, `refetchInterval: 120_000`, route `notional_cap` at `constants/hedgers.ts:126`; supplies `total_open_interest` and `total_used`, `:110-111`); `useAggregatedTvl()` `:34` (`services/hooks/useAggregatedTvl.ts:5-22`, key `['GetAggregatedTvl']`, `staleTime`/`refetchInterval` `2*60_000`, `GET /v1/markets/tvl-aggregate` on the inventory axios instance — `https://inventory85.enigma.bz/api` prod / `https://inventory-staging.enigma.bz/api` staging+test, `services/index.tsx:49-56`, `:203-205`); `useRevenue()` `:35` (`services/hooks/useRevenue.ts:11-32`, key `['GetRevenue', marketId]` with `DEFAULT_MARKET_ID = 1` (`constants/misc.ts:62`), `Promise.allSettled` of `GET {ENIGMA domain}/revenue/{marketId}` and `?time_range=24h` (`services/index.tsx:207-218`)); `useState(false)` `:36`; `useIsMobile()` `:38`.
Tiles (`infoItems`, `:54-120`): `Vibecaps TVL`↔`Available OI` toggle, `Total OI`, `24h Volume`, `24h Revenue`, **`Top Chain` (no value → `ComingSoonBadge`)**, `Active Pools` (= `poolsCount`), `Lifetime Volume`, `Lifetime Revenue`. The right card is a hard-coded **Coming Soon** panel: `ChartPlaceholder` + `t('Advanced revenue analytics and historical charts will be available in the next update.')` (`:175-185`).

##### Shared table internals used

`components/Table/index.tsx`: `TableDataItem` (`:27`), `SimpleTableRow` (`:55`), `Sorting` (`:123`), `TablePagination` (`:202`), `EmptySleepingChepe` (`:384`), `ThemedTables.Simple` (`:395`). `ThemedTables.Simple` itself calls `useTranslation`, `useRef`, two `useState`, `useMemo`, `useVirtualizer` (`@tanstack/react-virtual`, `enabled: virtual` — **`virtual` is not enabled by the Discover table**), `useLayoutEffect` (ResizeObserver), `useCallback`, `useIsMobile`.

##### Contract calls

**None anywhere in this slice.** Everything is REST against the listing service (`APP_POOLS_BACKEND_URL`), the Enigma solver, the inventory service, and the Vibe backend. No ABI, no wagmi read/write is reached from the Discover tab. (Wallet state is consulted only through `useWalletStore`/`useUserAccounts` inside `useListingAuth`.)

---

#### 6. Flags: dead code, TODOs, hacks, coming-soon stubs

**Coming soon**

- `components/ui/ComingSoonBadge.tsx:5` — used **only** by `PoolsInfo/GeneralInfo.tsx:167` (the `Top Chain` tile). Elsewhere it appears only inside commented-out JSX (`PoolDetail/tables/PoolOpenQuotesTable.tsx:137-140`, `PoolPositionsTable.tsx:144-146`) with commented-out imports (`PoolOpenQuotesTable.tsx:17`, `PoolPositionsTable.tsx:13`).
- `components/ui/ComingSoonColumnsPanel.tsx:8` — **not used by the Discover slice at all**; only `PoolDetail/tables/PoolPositionsTable.tsx:152` and `PoolOpenQuotesTable.tsx:147`. Its className has `hidden … md:flex`, so it never renders below 768px. Copy: `t('{{columns}} columns', …)` + `t('will be available in the next update.')` (`:36-38`).
- `GeneralInfo.tsx:175-185` — the entire right-hand analytics card is a placeholder.
- `GeneralInfo.tsx:122-133` `yourInfoItems` — 8 of 10 tiles have no `value` → all render `ComingSoonBadge` (Your Pools tab, out of slice but same component).

**Dead code / dead configuration**

- `ActiveTabKeys` (`Pools/types.ts:8`) still declares `'pools' | 'your_deposits'`; grep shows no other reference — dead members.
- `Filters/FilterByStatus.tsx` — imported only by `YourPoolsContent.tsx:18,96`; **never used by the Discover tab** despite living in the shared `Filters` folder. It also imports `DepositStatus` purely for a union in `onSelect` (`:25`) that can never receive one.
- `constants/environment.ts:5` `IS_POOLS_ENABLED` (`NEXT_PUBLIC_POOLS_ENABLE`) is declared and **never referenced anywhere** — the `/pools` route is unconditionally live.
- `constants/misc.ts:23-27` `APP_POOLS_BACKEND_URL` — the `IS_TEST_ENVIRONMENT` and default branches are the identical string.
- `DiscoverPoolTableItem.tsx:68` — `[<PaperPlaneTopRight …/>, false]` is a hard-coded-`false` branch in `evaluateJSX`; the paper-plane action is unreachable.
- `useAddDeposit` accepts a `status: MarketStatus` param (`useAddUserDeposit.ts:18`) that is never destructured or used; both call sites dutifully pass `item.market_status as MarketStatus` (`DiscoverPoolTableItem.tsx:52`, `DiscoverPoolMobileCard.tsx:50`).
- `DiscoverPoolsList.tsx:20` destructures only `getImage` from `useTokenImageByContract()`; the hook's `isLoading` is ignored, so mobile cards show the grey circle instead of a loading state (`:77-81`).
- `MarketSearchItem.reward_24h` (`services/types.ts:85`) is fetched-and-typed but rendered nowhere in the Discover UI.

**Hacks / latent bugs**

1. `Pools/index.tsx:14` — `handleTabChange` pushes `query: { tab: tabKey }`, **discarding every other query param**: switching tabs wipes `status`, `chains`, and all filter bounds.
2. `FilterByChain.tsx` never passes `value`, and `SearchableSelectBase` seeds its state once (`FormInputs/SearchableSelect.tsx:65`) — chain selection is not hydrated from the URL and desyncs from the request.
3. `FilterByMarketStatus.tsx:42` — `key={selectedStatus || 'status'}` force-remount is a workaround for the same defect.
4. `DiscoverPoolsContent.tsx:79-81` — `setSearchTerm('')` on every `page`/`perPage` change silently discards the user's search.
5. Search never resets pagination (no `setPage(1)` on `debouncedSearchTerm`), so page-3 + new search = `offset=20`.
6. `DiscoverPoolsContent.tsx:75-77` — `useEffect(..., [query, setPage])` resets the page on _any_ query change, including `tab`.
7. Active-filter badge (`:58`, counts bounds via `FILTER_FIELD_KEYS`) disagrees with the modal badge (`FilterPoolModal/index.tsx:35`, counts fields via `getActiveFieldCount`).
8. `MARKET_SEARCH_FILTER_KEYS` (20 keys, `useDiscoverMarketSearch.ts:8-29`) is a superset of `FILTER_FIELD_KEYS` (14, `helpers.ts:44`): `user_revenue__ge/__le`, `apr_24h__ge/__le`, `apr_30d__ge/__le` are forwarded to `market/search` if present in the URL but have no Discover UI and are not counted by the badge. `market/search` (public) likely ignores `user_revenue__*`.
9. `getInitialFilters`/`formatTime` round-trip for `listing_time` is lossy — reopening and re-applying the modal moves the boundary (`helpers.ts:55-65`, `:180-191`).
10. `FilterPoolModal/index.tsx:178-179` — for `unit === 'time'` the "From" input writes `__le` and "To" writes `__ge`.
11. `sanitizeFilterInput` strips `-` (`helpers.ts:131-158`) so the `-?` branch of `parseNumberShorthand` (`:95`) is unreachable through the UI.
12. `DiscoverPoolsTable.tsx:146` — the row factory returns `<DiscoverPoolTableItem>` with **no React `key`** (the mobile list does set one).
13. The Filters button is duplicated verbatim for desktop (`:105-119`, `max-md:hidden`) and mobile (`:129-143`, `hidden max-md:flex`) instead of one responsive button.
14. Both the mobile list and the desktop table are always mounted (CSS-only branch), doubling per-row hooks (`useAddDeposit`, `useListingAuth`, `useTokenImageByContract`).
15. `canDepositToMarket(status, {allowRejected: true})` (`utils/canDepositToMarket.ts:7-12`) returns `true` for everything except `delisted` — the Deposit action is offered on `under_review` and `waiting_for_deposit` rows too.
16. `DiscoverPoolMobileCard.tsx:268-271` — the APY row's color class is applied from `aprValue` even when `isAprVisible` is false and the printed value is `'-'`.
17. `constructQueryParams` (`utils/queryParams.ts`) does not URL-encode; the raw user search term is concatenated into the query string (`services/index.tsx:133-135`).
18. `useAddUserDeposit.ts:46` — leftover `console.log('e', e)`.
19. `useDiscoverMarketSearch` has no `enabled` gate and `staleTime: 0` with `refetchInterval: 90_000`; the query key embeds the whole `router.query` object, so unrelated query mutations force a network round-trip.
20. `TradeButton`'s prop is typed `IMarket['symbol_id']` (`TradeButton.tsx:11`) while rows are `MarketSearchItem` — `IMarket` additionally carries a `symmio_symbol_id` for the authenticated endpoint (`services/types.ts:53-55`), a naming split worth normalizing in any SDK port.

---

## 2. The Your Pools tab

### Vibe-ui — "Your Pools" tab: dense reference map

All paths relative to `/symmio/Vibe-ui`.

---

#### 0. Entry point & composition

- `src/components/App/Pools/index.tsx:17` — `activeTab` comes from `router.query.tab`, validated against `tabs` (`src/components/App/Pools/constants.ts:14-17`: `[{key:'discover'},{key:'your_pools'}]`), defaults to `'discover'`.
- `src/components/App/Pools/index.tsx:23-26` — `your_pools` is wrapped in `<ListingAuthGuard>`; `discover` is not. Tab switch is `router.push({pathname, query:{tab}}, undefined, {shallow:true})` (`index.tsx:14`) — note it **drops** all other query params (status/chains).
- Desktop table: `YourPoolsTable` rendered inside `div.hidden lg:inline` (`YourPoolsContent.tsx:158`). Mobile cards: `YourPoolsList` inside `div.inline lg:hidden` (`YourPoolsContent.tsx:147`). Both are always mounted; visibility is CSS-only, so both fetch (`YourPoolsList` additionally fires DexScreener).

##### The single data query

`src/components/App/Pools/services/hooks/useYourPoolsMarketDeposits.ts`

| Aspect          | Value                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP            | `GET {APP_POOLS_BACKEND_URL}market/search-user?<params>` — `services/index.tsx:138-154` (`getUserMarketSearch`)                                                                                                                                                                                                                                                                                                                   |
| Base URL const  | `APP_POOLS_BACKEND_URL` — `src/constants/misc.ts:23-27`: `IS_BACKEND_STAGING_ENV ? 'https://listing-staging.enigma.bz/v2/' : IS_TEST_ENVIRONMENT ? 'https://listing85.enigma.bz/v2/' : 'https://listing85.enigma.bz/v2/'` (test and prod branches are **identical — dead ternary**). Env vars: `NEXT_PUBLIC_BACKEND_ENVIRONMENT === 'staging'`, `NEXT_PUBLIC_IS_TEST_ENVIRONMENT === 'true'` (`src/constants/environment.ts:1-2`) |
| Auth            | `axios` instance `api` (`services/index.tsx:41-44`) with request interceptor `services/index.tsx:62-77` injecting `Authorization: Bearer ${listingAccessTokens[account]}`                                                                                                                                                                                                                                                         |
| Query params    | `limit` (=`Math.min(size,100)`), `offset` (=`start`), `query` (= debounced search), `market_status` (= `query.status` unless `'all'`/absent), `chain_ids` (= `router.query.chains`, repeated `chain_ids=` per element by `constructQueryParams`, `src/utils/queryParams.ts:5-8`), `sort_by`, `order_by`                                                                                                                           |
| Response type   | `UserMarketSearchResponse` = `{ total, limit, offset, items: UserMarketSearchItem[] }` — `services/types.ts:137-142`                                                                                                                                                                                                                                                                                                              |
| react-query key | `['getUserMarketSearch', accessToken, account, query, size, start, searchTerm, statusFilter, sortBy, orderBy]` — `useYourPoolsMarketDeposits.ts:31-42`. `query` is the **whole `router.query` object** (includes `tab`, `status`, `chains`), so `statusFilter` in the key is redundant, and any unrelated query-param change refetches.                                                                                           |
| staleTime       | `0` (`:28`)                                                                                                                                                                                                                                                                                                                                                                                                                       |
| refetchInterval | `90_000` ms (`:29`)                                                                                                                                                                                                                                                                                                                                                                                                               |
| enabled         | `Boolean(accessToken && account)` (`:30`)                                                                                                                                                                                                                                                                                                                                                                                         |
| pagination      | `usePagination(1, 10)` (`YourPoolsContent.tsx:51`, `src/hooks/usePagination.ts`) → `start = (page-1)*perPage` (`YourPoolsContent.tsx:60`)                                                                                                                                                                                                                                                                                         |
| search          | `useDebounceValue(searchTerm, 1000)` (`YourPoolsContent.tsx:52`)                                                                                                                                                                                                                                                                                                                                                                  |

401 handling: response interceptor `services/index.tsx:79-93` clears the token via `updateListingAccessToken(account, '')` on `err.response?.status === 401`, which makes `enabled` false and pops the user back through `ListingAuthGuard`.

Side effects in `YourPoolsContent.tsx`:

- `:72-74` — any `router.query` change resets `page` to 1.
- `:76-78` — any page/perPage change **clears the search term** (surprising UX: paging wipes the search box; the debounced value then lags 1s behind).

---

#### 1. Every column / field of the Your Pools row and its source

Desktop column definitions: `src/components/App/Pools/components/PoolsTable/YourPoolsTable.tsx:49-149`; widths from `YOUR_POOLS_COLUMN_WIDTHS` (`PoolsTable/constants.ts:14-26`). Cells rendered in `PoolsTable/YourPoolTableItem.tsx`.

| #   | Column key              | Header label                   | Sortable | API field(s)                                                                 | Transform                                                                                                                                                                                                                                                                  | Cell source                    |
| --- | ----------------------- | ------------------------------ | -------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 1   | `symbol`                | `Pool` (244px)                 | no       | `token_ticker`, `token_name`, `chain_id`, `max_leverage`, `contract_address` | token image via `useTokenImageByContract({contractAddress, tokenTicker})` (`src/hooks/markets/useTokenImageByContract.ts:67`); chain logo via `DEPOSIT_CHAIN_OPTIONS.find(ch => ch.value == chain_id)?.logo` (`Pools/constants.ts:6-12`); leverage badge `{max_leverage}x` | `YourPoolTableItem.tsx:89-113` |
| 2   | `apr`                   | `APR` (96px)                   | yes      | `apr` (18-dec string)                                                        | `hasAprValue = apr != null && apr !== ''`; `Number(marketSearchWeiToDisplay(apr))` then `formatPercentage(v,{decimalPoints:2,removeTrailingZeros:true})`; blue if `>0`, pink if `<0`; `'-'` when absent                                                                    | `:41-42, 114-132`              |
| 3   | `liquidity`             | `Liquidity` (112px)            | yes      | `liquidity` (18-dec)                                                         | `formatPrice(fromWei(v),{addDollarSign:true,decimalPoints:1,abbreviate:true})`                                                                                                                                                                                             | `:133-143`                     |
| 4   | `open_interest`         | `Open Int.` (112px)            | yes      | `open_interest` (18-dec)                                                     | same as liquidity                                                                                                                                                                                                                                                          | `:144-154`                     |
| 5   | `user_deposit`          | `Your Deposit` (120px)         | yes      | `user_deposit` (18-dec)                                                      | `formatPrice(fromWei(v),{addDollarSign:**false**,decimalPoints:2,abbreviate:true})` — **no `$` sign, unlike Your Revenue**                                                                                                                                                 | `:40, 155-165`                 |
| 6   | `user_share_percentage` | `Your Share %` (112px)         | yes      | `user_share_percentage` (plain `number \| null`, **not** wei)                | `formatPercentage(v,{decimalPoints:4,removeTrailingZeros:true})` — passed raw, no `fromWei`                                                                                                                                                                                | `:166-170`                     |
| 7   | `vol24h`                | `Vol 24H` (112px)              | yes      | `vol24h` (18-dec)                                                            | `formatPrice(fromWei(v),{$,1,abbrev})`                                                                                                                                                                                                                                     | `:171-181`                     |
| 8   | `user_revenue`          | `Your Revenue` (120px)         | yes      | `user_revenue` (18-dec)                                                      | `formatPrice(fromWei(v),{$,1,abbrev})`                                                                                                                                                                                                                                     | `:182-192`                     |
| 9   | `listing_time`          | `Listed` (96px)                | yes      | `listing_time` (unix seconds \| null)                                        | `formatListingAge()` → `"{d}d"` or `"{d}d {h}h"`, `'-'` when falsy (`utils/formatListingAge.ts:1-13`)                                                                                                                                                                      | `:193-195`                     |
| 10  | `Status`                | `Status` (96px)                | no       | `market_status`                                                              | `poolStatusMapper[status]` → `{color,title}` (`Pools/constants.ts:19-40`); falls back to raw `market_status` string if unmapped                                                                                                                                            | `:196-203`                     |
| 11  | `account`               | `Action` (80px, right-aligned) | no       | `market_status`, `symbol_id`, `contract_address`, `chain_id`, `user_deposit` | see §2                                                                                                                                                                                                                                                                     | `:204-228`                     |

Row-level: whole `<tr>` is clickable → `routes.pools.poolDetail(contract_address, chain_id)` = `/pools/{contractAddress}?deposit_chain={chainId}` (`src/constants/routes.ts:23-24`), `YourPoolTableItem.tsx:87`. The action cell stops propagation (`:205`).

**Row type** `UserMarketSearchItem extends MarketSearchItem` (`services/types.ts:102-115`):
`contract_address, symbol_id, token_ticker, token_name, chain_id, max_leverage, price_usd, market_cap, vol24h, apr, tvl, reward_24h?, liquidity, open_interest, listing_time, market_status` + `apr_24h, apr_30d, user_deposit, user_share_percentage, user_revenue, retry_limit?, remaining_retry_limit?, remaining_cooldown_seconds?`.
Fields present in the type but **never rendered in Your Pools**: `price_usd`, `market_cap`, `tvl`, `reward_24h`, `apr_24h`, `apr_30d`, `retry_limit`.
`UserMarketSearchSortBy` (`Pools/types.ts:21-27`) also allows `tvl`, `market_cap`, `apr_24h`, `apr_30d` — **not exposed** as sortable columns in Your Pools.

##### Mobile card (`PoolsList/YourPoolMobileCard.tsx`)

- Header: token image (from `getImage(contract_address, token_ticker)` hoisted in `YourPoolsList.tsx:39,61`), ticker, chain logo, `{max_leverage}x`, `token_name` (`:85-106`).
- Right of header: **price** — `marketMetaData?.priceUsd` from DexScreener, `$${Number(priceUsd).toPrecision(3)}` else `'-'` (`:108-110`). This is the only place a USD price appears in Your Pools, and it is **not** the API's `price_usd` field.
- Status dot + label + chevron (`:111-117`).
- Always-visible strip `YourPoolModeMainData`: `APR`, `Your Deposit`, `Your Revenue` (`:188-233`).
- Collapsible `YourPoolModeDetails` (`:235-302`) rows: `APR` (color-coded), `Liquidity`, `Open Int.`, `Your Deposit`, `Your Share %`, `Vol 24H`, `Your Revenue`, `Listed`, `Status`.
- **Mobile has no Trade button at all** — only Deposit / (Retry + Refund) / expand chevron (`:149-183`).

##### DexScreener side-fetch (mobile only)

`YourPoolsList.tsx:27-37` builds `TokenQuery[]` = `{tokenAddress: contract_address, chainName: DEPOSIT_CHAIN_OPTIONS.find(ch=>ch.value==chain_id)?.label}` → `useDexscreenerTokenDetails` (`src/services/dexscreener/hooks/useDexscreenerTokenDetails.ts`): query key `['tokenDetails', tokenRequests]`, `refetchInterval: 45_000`, `retry: 3`, `enabled: tokenRequests.length > 0`. Match back onto rows by `meta.baseToken.address === item.contract_address` (`YourPoolsList.tsx:60`) — **case-sensitive compare** against a lowercased request address; a checksummed `contract_address` will silently fail to match and the price shows `'-'`.

##### Sorting mechanics

- Desktop: `ThemedTables.Simple` header click → `src/components/Table/index.tsx:504-513`: new column ⇒ `DESCENDING`; same column ⇒ flip. Handler is `handleYourPoolsSortChange` (`YourPoolsContent.tsx:66-70`) which sets `sortColumn`/`sortOrder` and resets page to 1.
- `QuoteOrder` = `{ASCENDING:'asc', DESCENDING:'desc'}` (`src/stores/quotes/quotesTypes.ts:15-18`) — sent verbatim as `order_by`.
- Initial state: `sortColumn = undefined`, `sortOrder = DESCENDING` (`YourPoolsContent.tsx:53-54`); `orderBy` is only sent when `sortColumn` is set (`:63`).
- Mobile: `MobilePoolsSort` with `YOUR_POOLS_SORT_OPTIONS` (`YourPoolsContent.tsx:27-36`): `apr, user_deposit, user_revenue, liquidity, open_interest, user_share_percentage, vol24h, listing_time` (8 options; column order differs from the table).

---

#### 2. Listing STATUS state machine

##### The enum

`src/components/App/Pools/types.ts:56-62`

```ts
enum MarketStatus {
  WaitingForDeposit = "waiting_for_deposit",
  UnderReview = "under_review",
  Rejected = "rejected",
  Listed = "listed",
  Delisted = "delisted",
}
```

`market_status` on the row is typed as plain `string` (`services/types.ts:91`), so all comparisons are string-vs-enum and unknown values fall through to raw-string rendering.

`DepositStatus` (`types.ts:64-71`: `waiting | deposited | rejected | refound | success | withdraw`) — **declared but effectively dead**: its only reference outside the declaration is the parameter type union in `FilterByStatus.tsx:25`. No Your Pools UI branches on it. Same for `IDepositHistory` / `deposit_history` / `user_deposit_history` (`services/types.ts:60-62,144-152`) — the `search-user` row does not carry them; they are only _fabricated_ by `marketSearchItemToStubIMarket`.

##### Rendering per status

`poolStatusMapper` (`Pools/constants.ts:19-40`), used identically at `YourPoolTableItem.tsx:196-203` and `YourPoolMobileCard.tsx:112-115, 294-299`:

| `market_status`       | Title rendered       | Color                                |
| --------------------- | -------------------- | ------------------------------------ |
| `listed`              | `Live`               | `#089981`                            |
| `rejected`            | `Rejected`           | `var(--color-additional-danger-400)` |
| `under_review`        | `Under Review`       | `var(--color-neutrals-gray-100)`     |
| `waiting_for_deposit` | `Waiting`            | `var(--color-sunglow-400)`           |
| `delisted`            | `Delisted`           | `var(--color-main-gray)`             |
| anything else         | raw string, no color | `undefined`                          |

##### Gate predicates

`utils/canDepositToMarket.ts:7-12`

```ts
if (status === Delisted) return false;
if (status === Rejected) return Boolean(options?.allowRejected);
return true; // default-allow: unknown statuses are depositable
```

Your Pools calls it **without** `allowRejected` (`YourPoolTableItem.tsx:43`, `YourPoolMobileCard.tsx:55`); Discover calls it **with** `{allowRejected:true}` (`DiscoverPoolTableItem.tsx:39`, `DiscoverPoolMobileCard.tsx:42`) — the deliberate divergence between tabs.

`utils/canTradeMarket.ts:3-5` → `status === Listed && symbolId != null`.

##### Desktop action-cell state table (`YourPoolTableItem.tsx:204-228`)

`buttonIcon` is picked by `evaluateJSX` (`src/utils/evaluate.ts:75-79`, first truthy wins), `YourPoolTableItem.tsx:76-82`:

1. `PaperPlaneTopRight` when `canDeposit && market_status == waiting_for_deposit && Number(userDeposit) > 0`
2. `Coins` when `canDeposit`
   (`userDeposit` is `marketSearchWeiToDisplay(user_deposit)` → `undefined` for null, so `Number(undefined)=NaN` ⇒ falls to `Coins`.)

| status                | Trade button                                                                                                                                                    | Second button                                                                 | Retry                            | Refund                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------ |
| `listed`              | enabled iff `symbol_id != null`; links `routes.vibecaps.symbolId(symbolId)` (`PoolsTable/components/TradeButton.tsx:30`); else tooltip `"Market not available"` | `Coins` → `handleClick` → deposit flow                                        | —                                | —                                          |
| `under_review`        | disabled (tooltip `Market not available`)                                                                                                                       | `Coins` → deposit flow (**deposits allowed while under review**)              | —                                | —                                          |
| `waiting_for_deposit` | disabled                                                                                                                                                        | `PaperPlaneTopRight` if `user_deposit > 0`, else `Coins`; both → deposit flow | —                                | —                                          |
| `rejected`            | **not rendered**                                                                                                                                                | **not rendered**                                                              | `RetryListingButton` (icon-only) | `Money2` icon button → `handleRefundClick` |
| `delisted`            | disabled                                                                                                                                                        | `Coins` **rendered disabled** (`:221-223`) — no click path                    | —                                | —                                          |
| unknown string        | disabled                                                                                                                                                        | `Coins` enabled (default-allow)                                               | —                                | —                                          |

Discover's equivalent disabled fallback renders a literal `-` instead of a `Coins` icon (`DiscoverPoolTableItem.tsx:196`) — cosmetic divergence.

##### Mobile action-row state table (`YourPoolMobileCard.tsx:149-183`)

| status                                                                     | Buttons                                                                                        |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `rejected`                                                                 | `RetryListingButton variant="mobile"` (with `Retry` label) + `Money2` + `"Refund"` text button |
| `delisted`                                                                 | `Coins` + `"Deposit"`, **disabled**                                                            |
| everything else (`listed`, `under_review`, `waiting_for_deposit`, unknown) | `Coins` + `"Deposit"`, enabled                                                                 |
| all                                                                        | trailing `ChevronBottom` toggling `openDetails`                                                |

Note the mobile card ignores the paper-plane variant and `user_deposit` entirely.

##### Filters that drive `market_status` server-side

- Desktop pills `FilterByStatus` (`Filters/FilterByStatus.tsx:7-13`): `All` (+ `count` = `data.total`, `YourPoolsContent.tsx:96`) plus `listed | waiting_for_deposit | under_review | rejected | delisted`; writes `router.query.status`, shallow push.
- Mobile select `FilterByMarketStatus` (`Filters/FilterByMarketStatus.tsx:6-12`) — same five values, labels differ (`Waiting For Deposit` vs `Waiting`); re-selecting the active value deletes `status` from the query.
- Desktop-only vs mobile-only via `max-md:hidden` / `hidden max-md:block` (`YourPoolsContent.tsx:95-102`).
- `FilterByChain` (`Filters/FilterByChain.tsx`) multi-select over `DEPOSIT_CHAIN_OPTIONS` → `router.query.chains` → `chain_ids`.

---

#### 3a. Retry-listing flow (end to end)

**Trigger** — `RetryListingButton` (`components/RetryListingButton.tsx:45`), rendered only for `market_status == rejected` (`YourPoolTableItem.tsx:206-208`, `YourPoolMobileCard.tsx:150-152`). Note the component computes its own `isRejected` (`:48`) but only uses it to gate the info query, not to hide itself.

**Step 1 — status read.** `useRetryListingInfo` (`services/hooks/useRetryListingInfo.ts`):

- `GET {APP_POOLS_BACKEND_URL}market/retry-listing-info?token_contract_address=…&deposit_chain=…` (`services/index.tsx:183-187`)
- Response `RetryListingInfoResponse = { retry_limit, remaining_retries, remaining_cooldown_seconds }` (`services/types.ts:131-135`)
- key `['retryListingInfo', token_contract_address, deposit_chain]`; `staleTime: 30_000`; `enabled: Boolean(enabled && token_contract_address && deposit_chain != null)` — `enabled` passed as `isRejected` (`RetryListingButton.tsx:54`). `deposit_chain != null` correctly admits Solana's `0`.
- **One query per rejected row** — N rejected rows on a page ⇒ N parallel requests.

**Step 2 — fallback merge** (`RetryListingButton.tsx:58-67`): query data wins, row fields (`item.remaining_retry_limit`, `item.remaining_cooldown_seconds`) are the fallback.

```
remainingRetryLimit      = data?.remaining_retries        ?? item.remaining_retry_limit
remainingCooldownSeconds = data?.remaining_cooldown_seconds ?? item.remaining_cooldown_seconds ?? 0
isCooldownActive         = remainingCooldownSeconds > 0
isRetryLimitReached      = remainingRetryLimit != null && remainingRetryLimit <= 0
isLoadingRetryInfo       = isLoading && (!hasCooldownInfo || !hasRetryInfo)
isDisabled = isPending || isLoadingRetryInfo || isCooldownActive || isRetryLimitReached
```

Note the name mismatch across the two shapes: row field `remaining_retry_limit` vs endpoint field `remaining_retries`.

**Tooltip states** (`:69-108`), first match wins:
| condition | icon | copy |
|---|---|---|
| `retryMutation.isPending` | spinning `LoaderCircle` | `Submitting retry request...` |
| `isLoadingRetryInfo` | spinning `LoaderCircle` | `Loading retry status...` |
| `isCooldownActive` | `Clock3` | `Retry is available after {{time}}.` where time = `formatCooldown()` (`:21-34`: `Xd Yh` / `Xd` / `Xh Ym` / `Xh` / `Xm` / `Xs`) |
| `isRetryLimitReached` | `AlertCircle` | `Retry limit reached.` |
| default | `RotateCcw` | `Retry this listing. {{count}} retries left.` (or `Retry this listing.` when count unknown) |

**Step 3 — write.** Click → `triggerAuthFlow(() => retryMutation.mutate({token_contract_address, deposit_chain}))` (`:110-117`).
`useRetryMarketListing` (`services/hooks/useRetryMarketListing.ts`): `POST {APP_POOLS_BACKEND_URL}market/retry-listing` body `{token_contract_address, deposit_chain}` (`services/index.tsx:179-181`), response `RetryMarketResponse = { market_status }` (`services/types.ts:122-124`).

**Step 4 — invalidation + UI** (`useRetryMarketListing.ts:20-35`):

```ts
queryClient.invalidateQueries({ queryKey: ["getUserMarketSearch"] });
queryClient.invalidateQueries({ queryKey: ["getMarketSearch"] });
queryClient.invalidateQueries({ queryKey: ["retryListingInfo"] });
onSuccess?.(); // == refetchPoolsData (yourPoolsQuery.refetch)
addPopup(ToastType.SUCCESS, {
  successTitle: "Retry Submitted",
  successMessage: "Your listing retry request has been sent successfully.",
});
```

Error (`:36-46`): `ToastType.ERROR`, title `Retry Failed`, message `error.response?.data?.error_message ?? 'Something went wrong. Please try again.'`, typed as `AxiosError<TokenSupportError>` (`services/types.ts:212-216`).
The response's `market_status` is **discarded** — the row updates only via refetch. Note `['weeklyListingLimit']` is **not** invalidated.

**No contract call anywhere in this flow** — it is purely the listing REST service.

---

#### 3b. Refund-rejected-pool flow (end to end)

**Trigger** — `handleRefundClick` (`YourPoolTableItem.tsx:70-74`, `YourPoolMobileCard.tsx:76-80`):

```ts
triggerAuthFlow(() => {
  usePoolsStore.setState({ selectedPoolForRefund: marketSearchItemToStubIMarket(item) });
});
```

Store: `src/stores/pools/pools.ts` — `PoolsStore { selectedPoolForRefund: IMarket | null }`, created by `createZustandStore('pools', …)`. Mutated with a raw `setState`, not an action.

`marketSearchItemToStubIMarket` (`utils/marketSearchItemToStubIMarket.ts:15-43`) — carries the `// TODO: I think we can remove this function!` comment at `:13`. It **fabricates** `user_deposit_history` with `rejected` and `success` both set to the raw `user_deposit` wei string, hardcodes `token_decimal: 18`, `is_tax:false`, `buy_back_ratio:0`, `main_pool:null`, `cex_list:null`, `additional_chains:null`. Nothing downstream reads those fabricated fields — the modal only uses `contract_address`, `chain_id`, `token_ticker`, `token_name`.

**Mount** — `src/components/Layout/index.tsx:103,202`: `{selectedPoolForRefund && <RefundYourDepositModal />}` (globally mounted, not inside Pools).

**Modal** — `src/components/ReviewModal/RefundYourDepositModal/RefundYourDepositModal.tsx`

- Reads `selectedPoolForRefund` from store (`:23`), `accessToken = listingAccessTokens[account]` (`:33`).
- Deposit-amount read: `useUserTransactions` (`src/services/pools/hooks/useUserTransactions.ts`):
  - `GET {APP_POOLS_BACKEND_URL}market/user-transactions/{start}/{size}?<params>` with `start=0`, `size=150` (`src/services/pools/services.ts:38-64`), explicit `Authorization: Bearer ${accessToken}` header (separate raw `axios`, **not** the intercepted `api` instance).
  - Params sent here: `token_address = contract_address`, `chain_id`, `transaction_status: 'rejected'`, `transaction_type: 'deposit'` (`RefundYourDepositModal.tsx:35-41`).
  - Response `SearchUserTransactionsResponse = { count, items: UserTransaction[] }`; `UserTransaction` = `{transaction_id, amount, transaction_type, transaction_status, create_time, token_address, chain_id, token_name, token_ticker, wallet, token_decimal, refund_address}` (`src/services/pools/types.ts:25-43`).
  - key `['getUserTransactions', accessToken, start, size, rest]`; `enabled: Boolean(accessToken && rest.token_address && rest.chain_id != null)`; no staleTime/refetchInterval.
  - `depositAmount = Σ Number(fromWei(t.amount))` (`:59-61`) — **always 18 decimals**, ignoring `token_decimal` on each row.
- UI fields: token image + ticker/name (`:82-103`), `Token Address` = `truncateAddress(contract_address, 4)` (`:105-110`), `Deposit Amount` = `formatPrice(depositAmount,{addDollarSign:false})` + ticker + chain logo (`:112-127`), free-text `Refund Address` input (`:129-137`) — **no address validation, no chain-format check**, only the hint copy `"Enter a refund address on the same chain as your deposit"` (`:79`).
- Button label via `evaluate` (first truthy key, `src/utils/evaluate.ts:51-53`), order matters (`:63-68`): `Refunding` → `Enter Refund Address` → `Loading...` → `Refund`.
- Disabled when `!refundAddress || isRefundingRejectedPool || isLoadingUserTransactions || depositAmount === 0` (`:142`).

**Write** — `useRefundRejectedPool` (`src/services/pools/hooks/useRefundRejectedPool.ts`) → `refundRejectedPool` (`src/services/pools/services.ts:7-36`):
`POST {APP_POOLS_BACKEND_URL}market/refund`, body `{ market_address, deposit_chain, recipient_address }`, header `Authorization: Bearer ${token}` (token passed explicitly from the modal, `:49`). Params type `RefundRejectedPoolParams = {marketAddress, depositChain, recipientAddress, token}` (`src/services/pools/types.ts:1-6`).

**Invalidation + UI** (`useRefundRejectedPool.ts:21-30`):

```ts
addPopup(SUCCESS, { successTitle: "Refunded", successMessage: "Refund request has been sent successfully." });
queryClient.invalidateQueries({ queryKey: ["getUserTransactions"] });
queryClient.invalidateQueries({ queryKey: ["getUserMarketSearch"] });
```

then the modal clears the store: `usePoolsStore.setState({ selectedPoolForRefund: null })` (`RefundYourDepositModal.tsx:52`).
Error path (`:13-20`) is a **latent crash**: `error.response.data.error_message` with no optional chaining — a network error / CORS failure (no `response`) throws inside `onError`. The modal's own `catch` (`:53-55`) only `console.error`s.

Also note: `depositChain: selectedPoolForRefund?.chain_id || 0` (`:47`) — `||` collapses a genuine Solana `0` and an undefined chain to the same value (harmless only because Solana _is_ 0).

**No contract call** — refund is a backend request; the recipient address is arbitrary user input.

---

#### 4. Weekly listing limit

`src/components/App/Pools/services/hooks/useWeeklyListingLimit.ts`

- Source: `GET {APP_POOLS_BACKEND_URL}market/weekly-listing-limit` (`services/index.tsx:255-257`), response `WeeklyListingLimitResponse = { limit: number; remaining: number; reset_at: number }` (`services/types.ts:404-408`). `reset_at` is unix **seconds**.
- Query: key `['weeklyListingLimit']` (no account/token in the key — **stale across account switches**), `enabled: Boolean(accessToken)`, `staleTime: 30_000`.
- Adaptive `refetchInterval` (`:20-25`): `NEAR_LIMIT_REMAINING = 5`, `NEAR_LIMIT_REFETCH = 60_000`, `DEFAULT_REFETCH = 300_000` — 60s once `remaining <= 5`, else 300s; 300s while data is undefined.
- Derived (`:28-35`): `isLimitReached = data ? data.remaining <= 0 : false` (**fails open** while loading/erroring), `limit = data?.limit ?? 0`, `remaining`, `resetAt = data?.reset_at ?? null`, `isLoading`, `isError`.
- The limit is **global/per-account for the week**, not per-pool; nothing on the row reads it.

**What it blocks** — the `New Pool` button only:
`YourPoolsContent.tsx:127-144` — `<Tooltip disabled={!isLimitReached} content={<WeeklyLimitTooltip limit={limit} resetAt={resetAt}/>} side="top">` wrapping `<Button onClick={handleNewPool} disabled={isLimitReached}>`. Same pattern in `DiscoverPoolsContent.tsx:159` and again at the Create-Pool wizard step 1 (`CreatePool/components/TokenBasics.tsx:139-147`, `disabled={(!isSupported && !isCreatedMarket) || isLimitReached || isOpeningDeposit}`). It does **not** block retry, deposit, refund, or trade.

**Tooltip** — `components/WeeklyLimitTooltip.tsx`

- Copy: title `Weekly pool limit reached`; body `All {{limit}} pool slots for this week are filled.`; then either `You can create a new pool in ` + `<countdown>` or fallback `Please try again later.` (`:41-53`).
- `formatCountdown(resetAt)` (`:10-17`) uses `getRemainingTime(resetAt * 1000)` (`src/utils/time.ts:21-38`, dayjs-UTC) → `{d}d {h}h` / `{h}h {m}m` / `{m}m`, `null` once `diff <= 0`.
- Ticks every `60_000` ms and self-clears the interval once the countdown expires (`:30-34`).
- Only rendered when `isLimitReached` — `Tooltip.disabled` short-circuits (`src/components/Tooltip/index.tsx:39`).

**Gap:** nothing invalidates `['weeklyListingLimit']` — not `CreatePool`'s `AddMarket` success (which invalidates `getMarketSearch`, `getUserMarketSearch`, `discoverPoolsCount`, `CreatePool/index.tsx:83-85`), not the retry mutation. The counter only corrects on its 60s/300s poll.

---

#### 5. Auth gating

Two independent layers.

##### Layer A — route/tab guard

`components/ListingAuthGuard.tsx`, wrapping `<YourPoolsContent/>` at `Pools/index.tsx:24-26`:

- `:17-21` — on mount, `if (!isConnecting && !isAuthenticated) triggerAuthFlow()`.
- `:40-42` — **renders `null` while unauthenticated** (no skeleton, no empty state, no CTA — the tab body is blank behind the modal).
- `:24-38` — tracks that an auth modal opened (`authModalWasOpenRef`); if the user closes it while still unauthenticated, `router.replace({pathname: routes.pools.index, query:{tab:'discover'}}, undefined, {shallow:true})` — bounced back to Discover.

##### Layer B — per-action flow

`services/hooks/useListingAuth.ts`

```ts
isAuthenticated = Boolean(account && activeAccount && accessToken);
```

where `account` = `useWalletStore.use.account()`, `activeAccount` = `useActiveAccount()` (`src/stores/user/userHooks.ts:13-20`: requires `isConnected` and `activeAccount.owner === account`), `accessToken` = `useUserStore.use.listingAccessTokens()[account]` (per-account map, `src/stores/user/user.ts:48`).

`triggerAuthFlow(onComplete?)` (`:54-85`) — sequential modal ladder, `useApplicationStore.setState({openModal: …})`:
| state | opens |
|---|---|
| already authenticated | runs `onComplete()` immediately |
| `isConnecting` | nothing (waits) |
| `!isConnected` | `ApplicationModal.WAYS_TO_TRADE` |
| connected, accounts loaded, `!activeAccount` | `ApplicationModal.CREATE_ACCOUNT` |
| connected + `activeAccount` + `!accessToken` | `ApplicationModal.LISTING_SIGNATURE_REQUEST` |

The `onComplete` callback is parked in `pendingCallbackRef` and fired by the effect at `:30-52` once `isAuthenticated` flips — so the deposit / refund / retry action **resumes automatically** after the ladder completes. `isAuthFlowTriggeredRef` gates that effect so it only auto-advances for a flow the user actually started.

**Actions routed through `triggerAuthFlow`:** deposit (`YourPoolTableItem.tsx:66-68`, `YourPoolMobileCard.tsx:72-74`), refund (`YourPoolTableItem.tsx:70-74`, `YourPoolMobileCard.tsx:76-80`), retry (`RetryListingButton.tsx:110-117`). **Not routed:** the row click → pool detail, the Trade button (plain `<Link>`), `New Pool` (gated only by `hasSeenListingTerms` + weekly limit).

##### Token acquisition (SIWE-style)

`services/hooks/useListingLogin.ts` + `components/ListingSignatureRequestModal/index.tsx`:

1. `GET /auth/sign-in-message?address={account}&domain={window.location.host}&uri={window.location.origin}` → `GetSignInMessageResponse {message, params: SignInMessageParams{domain,address,uri,version,chainId,issuedAt,nonce,statement}}` (`services/index.tsx:156-160`).
2. `signMessageCallback(message)` from `useSignMessageV2`.
3. `POST /auth/login` body `{message: params, signature}` → `LoginResponse {accessToken, tokenType}` (`services/index.tsx:162-164`).
4. `updateListingAccessToken(account, data.accessToken)` (`useListingLogin.ts:37`) into `useUserStore.listingAccessTokens[account]` (`src/stores/user/user.ts:81-86`).
   Error → toast `Listing Error` / `Could not authenticate with the listing service.` The modal shows a 1.5s success state then auto-closes (`ListingSignatureRequestModal.tsx:26-37`); close is blocked while `isPending` (`:39-42, 52`).
   **Flag:** the "You're signing" preview at `ListingSignatureRequestModal.tsx:74` is hand-built and does **not** show the real `message`; it ends with `Chain ID: ${activeAccount.accountAddress ? '' : ''}` — always an empty string, i.e. dead/broken template.

##### Terms gate on `New Pool`

`YourPoolsContent.tsx:80-86`: `hasSeenListingTerms ? router.push(routes.pools.createPool) : toggleListingTermsAndConditions()`. `hasSeenListingTerms` is persisted in `useUserStore` (`src/stores/user/user.ts:49,88-91`). `TermsAndConditionsModal` (`components/TermsAndConditionsModal/index.tsx`) has a local `acceptTerms` checkbox defaulting to **true** (`:16`) and a "Do not show again" checkbox bound directly to the persisted flag; `Agree & Continue` pushes to `routes.pools.createPool`.

##### Deposit path (reached from a Your Pools row)

`services/hooks/useAddUserDeposit.ts` → `POST /market/deposit-address` body `{token_contract_address, deposit_chain}` → `AddDepositResponse {token_contract_address, user_address, deposit_chain, wallet_public_key, token_decimal, market_status}` (`services/index.tsx:170-177`). Success stores `modalOptions[ApplicationModal.LISTING] = {tokenName, publicAddress: data.wallet_public_key, chain: deposit_chain, refetchPoolsData}` and opens `ApplicationModal.LISTING` (`useAddUserDeposit.ts:32-44`). `ListingDepositModal` (`components/ListingDepositModal/index.tsx`) renders a QR of the deposit address, `MinDepositWarning` (`MIN_POOL_DEPOSIT_AMOUNT = 5`, `Pools/constants.ts:4`), and a `Confirm Deposit` button that just calls `refetchPoolsData?.()` + closes (`:110-120`) — no on-chain verification client-side. The hook accepts a `status: MarketStatus` prop that is **never used** in its body (`useAddUserDeposit.ts:13,18`) — dead parameter, passed by both row components. `onError` still has a `console.log('e', e)` (`:46`).

---

#### 6. Flags: dead code, hacks, oddities

1. `utils/marketSearchItemToStubIMarket.ts:13` — explicit `// TODO: I think we can remove this function!`; it fabricates `user_deposit_history` that nothing consumes.
2. `src/constants/misc.ts:24-27` — `IS_TEST_ENVIRONMENT` and prod branches of `APP_POOLS_BACKEND_URL` are byte-identical (dead ternary).
3. `useAddUserDeposit.ts` — `status: MarketStatus` param declared and required but unused.
4. `types.ts:64-71` `DepositStatus` — declared, never branched on; only appears as a type in `FilterByStatus.tsx:25`.
5. `useRefundRejectedPool.ts:13-19` — `error.response.data.error_message` unguarded; throws on network-level failures.
6. `useYourPoolsMarketDeposits.ts:31-42` — whole `router.query` object in the query key + a redundant `statusFilter` entry ⇒ over-invalidation.
7. `YourPoolsContent.tsx:76-78` — changing page/perPage clears the search input (search is lost on pagination).
8. `Pools/index.tsx:14` — tab switch drops `status`/`chains` query params.
9. `RetryListingButton.tsx` — the **only** Pools row component importing `lucide-react` (`LoaderCircle, Clock3, AlertCircle, RotateCcw`, `:5`) while using the in-house `Retry` icon for the button face; the rest of Your Pools uses `@/components/Icons/v2/*`.
10. `RetryListingButton` fires one `retryListingInfo` query **per rejected row**; no batching.
11. `['weeklyListingLimit']` is never invalidated after pool creation or retry.
12. `useWeeklyListingLimit` query key omits `account`/`accessToken` — a wallet switch serves the previous account's cached limit.
13. `YourPoolsList.tsx:60` — DexScreener match is a case-sensitive `===` against lowercased addresses.
14. `ListingSignatureRequestModal.tsx:74` — hardcoded signature preview with a dead `Chain ID: ${… ? '' : ''}` expression; it does not render the actual message being signed.
15. `RefundYourDepositModal.tsx:59-61` — refund amount summed with a hardcoded 18-decimal `fromWei`, ignoring each transaction's `token_decimal`.
16. `canDepositToMarket` default-allows unknown statuses, so a new backend status string silently gets an enabled Deposit button and an uncolored raw-string Status cell.
17. `YourPoolTableItem.tsx:221-223` (Delisted) renders a disabled `Coins` icon; the analogous Discover cell renders `-` — inconsistent.
18. Mobile Your Pools has no Trade action at all, even for `listed` markets with a `symbol_id`.
19. `CreatePool/index.tsx:109` — `console.log('Final data:', data)` left in the submit path (adjacent flow, reached from the Your Pools `New Pool` button).

---

## 3. Pool detail — shell, header, stats, chart, summary cards

ROOT = `/symmio/Vibe-ui` (all paths below are absolute).

---

### 1. Route param contract — `[contractAddress]`

**The page is a 4-line pass-through.**
`/symmio/Vibe-ui/src/pages/pools/[contractAddress].tsx:1-7` — imports `PoolDetail` from `@/components/App/Pools/components/PoolDetail` and renders `<PoolDetail />`. No `getServerSideProps`, no `getStaticProps`, no `getLayout`, no props. All logic lives in the component.

**What the address IS:** the **ERC-20 token contract address of the listed token** (`MarketDetailResponse.token_contract_address`), NOT a pool/vault address, NOT a symbol id. Proof chain:

- `/symmio/Vibe-ui/src/components/App/Pools/components/PoolDetail/index.tsx:24` — `const { contractAddress } = router.query as { contractAddress: string }`.
- It is passed verbatim as `token_contract_address` to `GetMarketDetail` (`/symmio/Vibe-ui/src/components/App/Pools/services/hooks/useMarketDetail.ts:28-31`) and as the path segment of `GET /profit/{token_contract_address}` (`useUserProfit` → `/symmio/Vibe-ui/src/components/App/Pools/services/index.tsx:232-234`).
- The header re-derives the same URL from `market.token_contract_address` (`/symmio/Vibe-ui/src/components/App/Pools/components/PoolDetail/PoolDetailHeader.tsx:36`), and the block-explorer link is a **token** link: `${base}/token/${address}` (`/symmio/Vibe-ui/src/components/App/Pools/utils/explorerUtils.ts:19`).
- Chain is **Solana-capable**: `DepositChain.Solana = 0` (`/symmio/Vibe-ui/src/components/App/Pools/types.ts:74`), so `contractAddress` is not guaranteed to be a 0x EVM address — it may be a Solana mint. No `isAddress()` / `viem` validation anywhere in this slice.

**Second, implicit route param: `?deposit_chain=`.**
`routes.pools.poolDetail` (`/symmio/Vibe-ui/src/constants/routes.ts:20-25`):

```ts
poolDetail: (contractAddress: string, depositChain?: number) =>
  depositChain != null ? `/pools/${contractAddress}?deposit_chain=${depositChain}` : `/pools/${contractAddress}`;
```

`useMarketDetail` reads it off the router, not from props (`/symmio/Vibe-ui/src/components/App/Pools/services/hooks/useMarketDetail.ts:7-8`):

```ts
const depositChain = router.query.deposit_chain ? Number(router.query.deposit_chain) : undefined;
```

**Resolution algorithm** (`useMarketDetail.ts:10-37`):

- query key `['marketDetail', contractAddress, depositChain]`; `enabled: Boolean(contractAddress)`; `staleTime: 30_000`; `refetchInterval: 60_000`.
- `queryFn`: if `!contractAddress` → `return null`. If `deposit_chain` is absent from the URL → **first** call `getMarketSearch({ limit: 1, offset: 0, query: contractAddress })` → `GET {APP_POOLS_BACKEND_URL}market/search?limit=1&offset=0&query=<addr>` (`/symmio/Vibe-ui/src/components/App/Pools/services/index.tsx:120-136`), take `searchRes.data.items?.[0]`; if none → `return null`; else `chain = found.chain_id`.
- Then `GetMarketDetail({ token_contract_address, deposit_chain: chain })` → `GET {APP_POOLS_BACKEND_URL}market?token_contract_address=<addr>&deposit_chain=<n>` (`services/index.tsx:220-230`), returns `MarketDetailResponse`.

**Base URL:** `APP_POOLS_BACKEND_URL` (`/symmio/Vibe-ui/src/constants/misc.ts:23-27`):

```ts
IS_BACKEND_STAGING_ENV
  ? "https://listing-staging.enigma.bz/v2/"
  : IS_TEST_ENVIRONMENT
    ? "https://listing85.enigma.bz/v2/"
    : "https://listing85.enigma.bz/v2/";
```

Env vars: `NEXT_PUBLIC_BACKEND_ENVIRONMENT === 'staging'`, `NEXT_PUBLIC_IS_TEST_ENVIRONMENT === 'true'` (`/symmio/Vibe-ui/src/constants/environment.ts:1-2`). Test and prod branches are **identical** — dead branch. Axios instance: `axios.create({ baseURL: APP_POOLS_BACKEND_URL, timeout: 20000 })` (`services/index.tsx:41-44`), with a request interceptor injecting `Authorization: Bearer <listingAccessTokens[account]>` (`services/index.tsx:62-77`) and a 401 interceptor that clears the token (`services/index.tsx:79-93`).

**URL self-healing effect** (`/symmio/Vibe-ui/src/components/App/Pools/components/PoolDetail/index.tsx:53-57`):

```ts
useEffect(() => {
  if (!router.isReady || !contractAddress || !market || router.query.deposit_chain != null) return;
  router.replace(routes.pools.poolDetail(contractAddress, market.deposit_chain), undefined, { shallow: true });
}, [contractAddress, market, router]);
```

Consequence: landing on `/pools/0xabc` (no chain) resolves via search → market arrives → URL is rewritten with `?deposit_chain=` → `depositChain` changes → **query key changes** → a second `GET market?...` fires for the same market. Note the effect depends on the whole `router` object (identity changes every render in the Next pages router), so it re-runs frequently — guarded only by the `deposit_chain != null` early-return.

**Bad / unknown address behavior** (`index.tsx:59-77`):

- While `isMarketLoading` (`query.isLoading`) → full-page centered `LottieLoader name="preloading"` 150×150 + `t('Loading pool details...')`. `LottieLoader` itself fetches `/static/lotties/preloading.json` through react-query key `['lottie', name]` (`/symmio/Vibe-ui/src/components/Animation/LottieLoader.tsx:36-40`).
- `if (!market)` → `t('Pool details not found')` + a `Button variant="primary" size="sm"` → `router.push(routes.pools.index)` labelled `t('Back to Pools')`.
- There is **no distinct error state**: `useMarketDetail` returns `isError` (`useMarketDetail.ts:42`) but `PoolDetail` never destructures it. A 404/500 from `GET market` lands in the same "not found" screen — after react-query's **default 3 retries** with exponential backoff (`retryDelay: min(1000·2^n, 30_000)`, `/symmio/Vibe-ui/src/components/Layout/Providers/ReactQueryProvider.tsx:7-16`), during which `isLoading` stays true and the Lottie spins.
- **Pre-`router.isReady` flash (bug):** on a hard load `router.query.contractAddress` is `undefined` on the first render, so the query is `enabled: false`. In react-query v5 (`^5.90.20`, `/symmio/Vibe-ui/package.json:50`) a disabled query reports `isLoading === false`, so `isMarketLoading` is false and `market` is `undefined` → the **"Pool details not found" screen renders for one tick** before the router hydrates. `router.isReady` is only consulted inside the effect (`index.tsx:54`), never in the render guard.
- No array handling: a duplicated `contractAddress` (impossible for a single dynamic segment, but a `deposit_chain` supplied twice yields `string[]` → `Number(['1','2'])` → `NaN` → `NaN` reaches `GetMarketDetail` as `deposit_chain=NaN`). Unvalidated.

**Auxiliary hooks mounted at the page root** (`index.tsx:27-38`):

- `useUserProfit(contractAddress, market?.market_status)`.
- `useListingAuth()` → `{ triggerAuthFlow, isAuthenticated }`.
- `useTogglePoolWithdrawModal()`.
- `useAddDeposit({ token_contract_address: market?.token_contract_address ?? '', deposit_chain: market?.deposit_chain ?? 0, tokenName: market?.token_ticker ?? '', status: (market?.market_status as MarketStatus) ?? MarketStatus.Listed, refetchPoolsData: refetch })` — note `status` is accepted by the hook's param type but **never used in its body** (`/symmio/Vibe-ui/src/components/App/Pools/services/hooks/useAddUserDeposit.ts:9-31`) — dead prop.

Handlers: `handleDeposit` → `triggerAuthFlow(() => addDeposit())` (`index.tsx:40-42`); `handleWithdraw` → `triggerAuthFlow(() => toggleWithdrawModal({ market, refetchPoolsData: refetch }))` (`index.tsx:44-47`); `handleSignIn` → `triggerAuthFlow()` (`index.tsx:49-51`).

Layout: `mx-auto max-w-7xl px-4 py-6 max-lg:pt-3` inside `h-full overflow-auto` (`index.tsx:80-81`); children in order — `PoolDetailHeader`, `SummaryCards`, a flex row `PoolStatsCard` + `PoolChartCard` (stacked `flex-col` when `useIsMobile()`), then `PoolDetailTabs` (`index.tsx:82-96`). `useIsMobile()` just reads `useApplicationStore.use.display().isMobile` (`/symmio/Vibe-ui/src/lib/hooks/useWindowSize.ts:9-13`).

---

### 2. Header + stats — every value and its exact formula

#### 2a. Header (`/symmio/Vibe-ui/src/components/App/Pools/components/PoolDetail/PoolDetailHeader.tsx`)

Props: `{ market: MarketDetailResponse; onDeposit: () => void; onWithdraw: () => void }` (`:19-23`). The header renders **no numeric stats at all** — it is identity + status + actions.

| Element            | Source                                                                                                                                                                                                           | Line            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Token logo         | `useTokenImageByContract({ contractAddress: market.token_contract_address, tokenTicker: market.token_ticker ?? undefined })` → `<TokenImage src={tokenImage} width={60} height={60} className="rounded-full" />` | `:29-32`, `:65` |
| Token name         | `market.token_name`, class `primary-heading-1-semibold`                                                                                                                                                          | `:69`           |
| Ticker             | `market.token_ticker`, class `primary-body-1-semibold text-main-gray`                                                                                                                                            | `:100`          |
| Chain badge        | `DEPOSIT_CHAIN_OPTIONS.find(ch => ch.value == market.deposit_chain)?.logo` (loose `==`), 18×18                                                                                                                   | `:34`, `:71`    |
| Explorer link      | `getTokenExplorerUrl(market.deposit_chain, market.token_contract_address)`; rendered only when non-null; `target="_blank" rel="noopener noreferrer"`, aria-label `Open token on block explorer`                  | `:35`, `:73-83` |
| Share              | `CopyToClipboard text={`${getAppUrl()}${routes.pools.poolDetail(market.token_contract_address, market.deposit_chain)}`}` with a `ShareAndroid` icon                                                              | `:36`, `:84-88` |
| Status pill        | `poolStatusMapper[market.market_status]` → `{color, title}`; a 2px dot + label both colored `statusInfo.color`                                                                                                   | `:33`, `:90-97` |
| Back button        | `variant="dark"`, `ArrowRight` rotated 180 → `router.push(routes.pools.index)`                                                                                                                                   | `:38-48`        |
| Withdraw / Deposit | `variant="dark"` + `Upload` → `onWithdraw`; `variant="primary"` + `Download` → `onDeposit`                                                                                                                       | `:50-61`        |

Mobile branch (`:105-115`) stacks `[back | actions]` above `tokenInfo`; desktop (`:117-125`) is `[back + tokenInfo] … [actions]`.

`poolStatusMapper` (`/symmio/Vibe-ui/src/components/App/Pools/constants.ts:19-40`): `listed → {#089981, 'Live'}`, `rejected → {var(--color-additional-danger-400), 'Rejected'}`, `under_review → {var(--color-neutrals-gray-100), 'Under Review'}`, `waiting_for_deposit → {var(--color-sunglow-400), 'Waiting'}`, `delisted → {var(--color-main-gray), 'Delisted'}`.

`getTokenExplorerUrl` (`/symmio/Vibe-ui/src/components/App/Pools/utils/explorerUtils.ts:7-20`):

```ts
const DEPOSIT_CHAIN_TO_SCANNER_KEY: Record<number, number> = {
  [DepositChain.Solana]: CCTPDomain.Solana,        // 0 -> 5
  [DepositChain.Base]: CCTPDomain.Base,            // 8453 -> 6
  [DepositChain.ARBITRUM_ONE]: CCTPDomain.Arbitrum,// 42161 -> 3
  [DepositChain.SONIC]: CCTPDomain.Sonic,          // 146 -> 13
  [DepositChain.BSC]: SupportedChainId.BSC,        // 56 -> 56
}
getTokenExplorerUrl(chain, address) => chain == null || !address ? null
  : SCANNER_URLS[DEPOSIT_CHAIN_TO_SCANNER_KEY[chain]] ? `${base}/token/${address}` : null
```

Resolved bases (`/symmio/Vibe-ui/src/constants/addresses.ts:144-155`): solscan.io, basescan.org, arbiscan.io, sonicscan.org, bscscan.com. `CCTPDomain` values at `/symmio/Vibe-ui/src/types/cctps.ts:8-18`; `DepositChain` at `/symmio/Vibe-ui/src/components/App/Pools/types.ts:73-79`.

Same file also exports `getSymmioPositionUrl(chain, quoteId)` → `https://intent.symmscan.com/position-details/{TENANT}/{quoteId}` with tenant map `ARBITRUM→'ARBITRUM'`, `BASE→'BASE'`, `BSC→'BNB'`, `HYPEREVM→'HYPEREVM'`, `SONIC→'SONIC'` (`explorerUtils.ts:24-39`) — used only by the Trade History table, not the header.

`getAppUrl()` returns `window.location.origin` client-side, else `APP_URL = 'https://vibe.trading'` (`/symmio/Vibe-ui/src/utils/appUrl.ts:4-9`, `/symmio/Vibe-ui/src/constants/misc.ts:19`).

#### 2b. Pool Stats card (`/symmio/Vibe-ui/src/components/App/Pools/components/PoolDetail/PoolStatsCard.tsx`)

Inputs assembled at `:26-52`:

```ts
const totalApy = Number(fromWei(market.apy_lifetime)); // :26  (18-dec → human)
const { notionalCap } = useNotionalCap({ hedgerType: HedgerType.ENIGMA, marketId: market.symbol_id, isLowcap: true }); // :28-32
const { data: marketInfo } = useMarketInfo(); // :34
const tokenQueries = [
  {
    tokenAddress: market.token_contract_address as Address,
    chainName: DEPOSIT_CHAIN_OPTIONS.find((c) => c.value === market.deposit_chain)?.label ?? "",
  },
]; // :35-43
const { data: marketMetaData } = useDexscreenerTokenDetails(tokenQueries); // :44
const tokenPrice = marketMetaData?.[0]?.priceUsd ? Number(marketMetaData[0].priceUsd) : undefined; // :45
const vol24h = market.token_ticker ? marketInfo?.[market.token_ticker]?.trading_volume : undefined; // :46
const { openInterest, availableLiquidityLong, availableLiquidityShort, tokenBalance, usdcBalance, tokenPercent } =
  getPoolStatsCardValues({ market, notionalCap, tokenPrice }); // :47-52
```

##### The eight grid stats (`:56-120`)

| #   | Label              | Value expression                                                                                                                                                                             | Color rule                                                                  |
| --- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | `Total APY`        | `formatPercentage(Number(fromWei(market.apy_lifetime))).percentage` → 2 dp, `ROUND_DOWN`, `%` suffix                                                                                         | `>0 → text-main-light-blue`, `<0 → text-main-pink`, `0 → undefined` (`:53`) |
| 2   | `Lifetime Rewards` | `formatPrice(fromWei(market.reward_lifetime), { addDollarSign: true, decimalPoints: 2, abbreviate: true }).price`                                                                            | none                                                                        |
| 3   | `OI`               | `market.symbol_id ? formatPrice(openInterest, {addDollarSign:true, decimalPoints:2, abbreviate:true}).price : null`                                                                          | `openInterest > 0 → text-main-light-blue` (`:54`), only when `symbol_id`    |
| 4   | `Available Liq`    | `market.symbol_id ? <span class="text-main-light-blue">{formatPrice(availableLiquidityLong,…)} / <span class="text-main-pink">{formatPrice(availableLiquidityShort,…)}</span></span> : null` | long = light-blue, short = pink, hardcoded                                  |
| 5   | `Vol 24H`          | `vol24h ? formatPrice(vol24h, {addDollarSign:true, decimalPoints:2, abbreviate:true}).price : '-'`                                                                                           | `vol24h ? text-main-light-blue : undefined`                                 |
| 6   | `Buyback Ratio`    | `formatPercentage(market.buyback_ratio, { decimalPoints: 2 }).percentage` — **raw `number` field, no ×100 and no `fromWei`**                                                                 | none                                                                        |
| 7   | `Active LPs`       | `String(market.active_lps)`                                                                                                                                                                  | none                                                                        |
| 8   | `Age`              | `market.age ? formatListingAge(market.age) : '-'`                                                                                                                                            | none                                                                        |

Render loop `:127-136`: `stat.value !== null` → `<p class={cn('primary-caption-2-semibold', stat.valueColor || 'text-white')}>`; else a grey `-`. Grid is `grid-cols-2 sm:grid-cols-4`; card is `w-1/2` desktop / `w-full` mobile (`:123`).

`DEFAULT_PRECISION = 2` (`/symmio/Vibe-ui/src/constants/misc.ts:114`).

##### Pool Balance bar (`:139-163`)

```
token side:  formatPrice(tokenBalance, { decimalPoints: 2, addDollarSign: false, abbreviate: true }).price + ' ' + market.token_ticker
usdc side:   formatPrice(usdcBalance,  { decimalPoints: 2, abbreviate: true }).price + ' ' + COLLATERAL_SYMBOL[FALLBACK_CHAIN_ID]
bar:         <div class="bg-main-blue" style={{width: `${tokenPercent}%`}} /><div class="bg-main-pink" style={{width: `${100 - tokenPercent}%`}} />
```

`COLLATERAL_SYMBOL[FALLBACK_CHAIN_ID]` = `COLLATERAL_SYMBOL[SupportedChainId.HYPEREVM]` = `'USDC'` (`/symmio/Vibe-ui/src/constants/addresses.ts:19-23`; `FALLBACK_CHAIN_ID = CHAIN_IDS[0] = SupportedChainId.HYPEREVM` at `/symmio/Vibe-ui/src/constants/chains.ts:50-52`). Note the usdc `formatPrice` call omits `addDollarSign`, whose default is `true` (`/symmio/Vibe-ui/src/utils/numbers.ts:110`) → renders `$1.2K USDC`.

#### 2c. `pool-stats.ts` — the transcribed math

`/symmio/Vibe-ui/src/components/App/Pools/components/PoolDetail/pool-stats.ts` (full body, `:30-53`):

```ts
const tokenBalance = fromWeiBN(market.total_token_in_pool); // :35  — 18 decimals ALWAYS
const usdcBalance = fromWeiBN(market.total_usdc_in_pool); // :36  — 18 decimals
const normalizedTokenPrice = toBN(tokenPrice ?? 0); // :37
const hasTokenPrice = normalizedTokenPrice.isFinite() && normalizedTokenPrice.gt(0); // :38
const tokenValue = hasTokenPrice ? tokenBalance.times(normalizedTokenPrice) : BN_ZERO; // :39
const totalPoolValue = tokenValue.plus(usdcBalance); // :40
const tokenPercent =
  hasTokenPrice && totalPoolValue.gt(0)
    ? tokenValue.div(totalPoolValue).times(100).toNumber()
    : DEFAULT_BALANCE_PERCENT; /* = 50, :28 */ // :41-44
return {
  openInterest: notionalCap.used, // :47 — passthrough, plain USD number
  availableLiquidityLong: Math.max(notionalCap.available_to_long, 0), // :48 — clamped
  availableLiquidityShort: Math.max(notionalCap.available_to_short, 0), // :49 — clamped
  tokenBalance,
  usdcBalance,
  tokenPercent,
};
```

Types: `NotionalCapSnapshot { used: number; available_to_long: number; available_to_short: number }` (`:7-11`); params `market: Pick<MarketDetailResponse, 'total_token_in_pool' | 'total_usdc_in_pool' | 'token_decimal'>`, `notionalCap`, `tokenPrice?: string | number | null` (`:13-17`); returns `PoolStatsCardValues { availableLiquidityLong: number; availableLiquidityShort: number; openInterest: number; tokenBalance: BigNumber; tokenPercent: number; usdcBalance: BigNumber }` (`:19-26`). BigNumber math via `bignumber.js@^9.3.1`; `fromWeiBN(amount, decimals = 18)` = `toBN(amount).div(BN_TEN.pow(decimals))`, returning `BN_ZERO` for `null`/`''`/`NaN`-strings (`/symmio/Vibe-ui/src/utils/numbers.ts:55-62`).

**`token_decimal` is declared in the params type but never read** — the function hardcodes 18 for the token balance. That was deliberate: commit `ebc1d08c7` _"fix: calculate token balance in right way"_ (Jun 16 2026) changed `fromWeiBN(market.total_token_in_pool, market.token_decimal)` → `fromWeiBN(market.total_token_in_pool)`. Earlier commit `886bace6d` had added the decimals argument and also dropped the previously-returned `tokenValue`/`usdcValue` and the `Math.min(100, Math.max(0, …))` clamp on `tokenPercent` (so `tokenPercent` is now unclamped — harmless given the formula, but the guard is gone).

**Unit summary for the card:** `total_token_in_pool` / `total_usdc_in_pool` / `tvl` / `apy_*` / `reward_*` are all 18-decimal strings; `notionalCap.*` are already plain USD floats (solver JSON strings `Number()`-cast in `useNotionalCap`, no wei); `buyback_ratio` and `active_lps` are plain numbers; `token_decimal` and `age` are numbers.

#### 2d. Upstream data sources for the stats

**`useNotionalCap`** — `/symmio/Vibe-ui/src/services/markets/hooks/useNotionalCap.ts`

- Single-market path (what the card uses; `fetchAll` not passed → `shouldUseBulkFetch === false`): query key `['getNotionalCap', effectiveHedgerType, effectiveMarketId]`, `queryFn: () => getNotionalCap(HedgerType.ENIGMA, effectiveMarketId!)`, `enabled: Boolean(effectiveMarketId) && !shouldUseBulkFetch`, `refetchInterval: 60_000` (`:35-52`).
- `effectiveMarketId = marketId || activeMarket?.id` (`:27`) — **if `market.symbol_id` is null/0 it silently falls back to the globally active trading market's id.** The card masks this by rendering `null` for OI / Available Liq when `!market.symbol_id` (`PoolStatsCard.tsx:72,79`), but the network request still fires for the wrong market.
- `select` (`:40-51`): `used: Number(data.used)`, `available_to_long`/`available_to_short` cast to Number; with `isLowcap: true`, `total = long + short + used` and `availableLiquidity = long + short` (not used by this card).
- Default when unresolved: `{ used: 0, total: 0, availableLiquidity: 0, available_to_long: 0, available_to_short: 0, open_interest: 0 }` (`:86-93`) → OI renders `$0.00`, both liq sides `$0.00`.
- HTTP: `GET {ENIGMA.domain}/notional_cap/{marketId}` — `getNotionalCap` (`/symmio/Vibe-ui/src/services/markets/service.ts:9-17`) joins `HEDGER_DATA_MAP[ENIGMA].domain` with `routes.notionalCap(marketId)` = `` `notional_cap/${marketId}` `` (`/symmio/Vibe-ui/src/constants/hedgers.ts:124`). Domain = `SIMULATOR_HEDGER_DOMAIN` | `https://solver-staging.enigma.bz/api` | `https://solver.enigma.bz/api` (`hedgers.ts:86-90`). Response type `NotionalCap { symbol, total_cap, used, available_to_long, available_to_short, open_interest }` — all strings (`/symmio/Vibe-ui/src/services/markets/types.ts:3-10`).

**`useMarketInfo`** — `/symmio/Vibe-ui/src/services/hedger/hooks/useMarketInfo.ts:11-16`: key `['getMarketInfo']`, `refetchInterval: 2*60_000`, `staleTime: 2*60_000`, no `enabled` gate. `getMarketInfo` → `GET {ENIGMA.domain}/get_market_info` (`/symmio/Vibe-ui/src/services/hedger/services/market-info.ts:9-10`). Response `TokenVolumeMap = Record<string, { trading_volume: number }> & { total_lifetime_value: number; total_value_24h: number }` (`/symmio/Vibe-ui/src/types/market.ts:32-35`) — **keyed by ticker**, hence `marketInfo?.[market.token_ticker]?.trading_volume`.

**`useDexscreenerTokenDetails`** — `/symmio/Vibe-ui/src/services/dexscreener/hooks/useDexscreenerTokenDetails.ts:12-42`: key `['tokenDetails', tokenRequests]`, `enabled: tokenRequests.length > 0`, `refetchInterval: 45_000`, `retry: 3`. It lowercases + sorts + dedupes `{chainName, tokenAddress}`. **Despite the name it does not call dexscreener.com**: `getDexscreenerTokenDetails` fetches the whole metadata snapshot `GET {PRICE_SERVICE_API_BASE_URL}/metadata` and filters it client-side (`/symmio/Vibe-ui/src/services/dexscreener/service.ts:165-195`), matching on `` `${chainId}:${baseToken.address}` `` (`:72-75`, `:151-154`), with a module-level `cachedSnapshot` fallback (`:6`, `:188-191`). `PRICE_SERVICE_METADATA_ENDPOINT = ${PRICE_SERVICE_API_BASE_URL}/metadata` where the base is `${SIMULATOR_HEDGER_DOMAIN}/api/v1` | `https://lowcap-price-staging.enigma.bz/api/v1` | `https://lowcap-price.enigma.bz/api/v1` (`/symmio/Vibe-ui/src/services/price-service/constants.ts:8-22`). Only `priceUsd` is consumed here.

- ⚠️ **Chain-name mismatch:** the card feeds `chainName` from `DEPOSIT_CHAIN_OPTIONS[].label` (`'Solana' | 'Base' | 'BSC' | 'Sonic' | 'Arbitrum one'`, `/symmio/Vibe-ui/src/components/App/Pools/constants.ts:6-12`), lowercased to `'arbitrum one'` for `DepositChain.ARBITRUM_ONE`. Snapshot keys are dexscreener-style chain slugs (`arbitrum`), so Arbitrum pools will not match → `tokenPrice === undefined` → `tokenPercent` falls back to the flat 50/50 bar.

**`formatListingAge`** — `/symmio/Vibe-ui/src/components/App/Pools/utils/formatListingAge.ts:1-13`:

```ts
if (!listingTime) return "-";
const diffMs = Date.now() - listingTime * 1000;
const days = Math.floor(diffMs / 86_400_000);
const hours = Math.floor((diffMs / 3_600_000) % 24);
return `${days}d${hours > 0 ? ` ${hours}h` : ""}`;
```

⚠️ Every other call site passes a **unix timestamp** `listing_time` (`PoolsTable/DiscoverPoolTableItem.tsx:177`, `PoolsTable/YourPoolTableItem.tsx:194`, `PoolsList/DiscoverPoolMobileCard.tsx:281`, `PoolsList/YourPoolMobileCard.tsx:293`). `PoolStatsCard.tsx:118` is the only place that passes `market.age`, while `MarketDetailResponse` carries **both** `listing_time` and `age` (`/symmio/Vibe-ui/src/components/App/Pools/services/types.ts:328,342`). If `age` is a duration (as the name implies) the `Age` stat renders nonsense (`age = 86_400` → ≈`20500d`). Flagged, not proven — depends on the listing API's semantics.

**`formatPrice` / `formatPercentage` mechanics** (`/symmio/Vibe-ui/src/utils/numbers.ts:93-198` and `:200-261`): `formatPrice` defaults `addDollarSign: true`, `useThousandsSeparator: true`, `decimalPoints: 2`, `roundingMode: 'down'` (`ROUND_DOWN`), `defaultValue: '-'` for null/undefined/non-finite; `abbreviate` divides by 1e9/1e6/1e3 with suffix `B`/`M`/`K` and forces `decimalPoints = abbreviateDecimalPoints (2)`. `formatPercentage` **does not multiply by 100** — it floors (`roundingMode: 'down'`) at `decimalPoints` and appends `%`.

---

### 3. The chart — placeholder, not real

`/symmio/Vibe-ui/src/components/App/Pools/components/PoolDetail/PoolChartCard.tsx` takes **no props** (`:20`) and issues **zero data fetches** — no hook, no query, no timeframe state beyond local UI toggles.

- Two local enums, both index-based, both write-only: `enum ChartTab { TVL, Rewards }` (`:10-13`) and `enum PerformanceTab { Pool, Your }` (`:15-18`); `const [chartTab, setChartTab] = useState(ChartTab.TVL)`, `const [performanceTab, setPerformanceTab] = useState(PerformanceTab.Pool)` (`:23-24`). **Neither state value is read anywhere in the render** — nothing branches on them.
- `ThemedSwitch.Underline id="poolChartTab"` with options `[{label:'TVL', value:'tvl'}, {label:'Rewards', value:'rewards'}]`, `activeColor/underlineColor: var(--color-main-pink)`, `inactiveColor: var(--color-main-gray)` (`:29-40`). `ThemedSwitch.Underline`'s `activeOption` is a plain **index** and `activeOptionChanged: (index: number) => void` (`/symmio/Vibe-ui/src/components/Switch/index.tsx:167-168`, `:204-220`); the `value` strings are only React keys.
- `ThemedSwitch.Primary id="poolPerformanceTab"` with `Pool Performance` / `Your Performance`, each `style={{width:'50%'}}`, wrapped in a `border-neutrals-dark-400 bg-neutrals-dark-500 rounded-[10px]` shell (`:43-73`).
- A **`Yearly` dropdown button that is not wired to anything**: `<Button variant="tertiary" size="sm">` with a `ChevronDown` and **no `onClick`** (`:75-78`) — the only "timeframe" affordance on the page, and it is inert.
- Body (`:82-88`): always the same, regardless of every toggle —
  ```
  <ChartPlaceholder />                                        // decorative 52×52 SVG donut
  <p>{t('Coming Soon')}</p>
  <p>{t('Advanced rewards analytics and historical charts will be available in the next update.')}</p>
  ```
- `ChartPlaceholder` (`/symmio/Vibe-ui/src/components/App/Pools/components/PoolsInfo/ChartPlaceholder.tsx:1-94`) is a static inline SVG: three arc paths `#FB88FF` / `#F36363` / `#188AFD`, `mixBlendMode: 'luminosity'`, `opacity 0.5`, three `feColorMatrix`/`feOffset dy=1` inner-shadow filters (`filter0/1/2_i_18257_62569`). Shared with the pools **list** page's `GeneralInfo` (`GeneralInfo.tsx:180`). Note the duplicated filter `id`s will collide in the DOM if both ever render on one page.

**There is no chart data layer anywhere in this slice** — no candles, no TVL series endpoint, no timeframe param, no subgraph query. The card is `w-1/2` desktop / `w-full` mobile (`:27`), sitting beside `PoolStatsCard`.

---

### 4. Summary cards

`/symmio/Vibe-ui/src/components/App/Pools/components/PoolDetail/SummaryCards/index.tsx` — props `{ market: MarketDetailResponse; userProfit?: UserProfitResponse; isAuthenticated: boolean; onSignIn: () => void }` (`:11-16`). Grid: `grid-cols-2` mobile / `grid-cols-4` desktop, `mb-4 gap-4` (`:25`). Four cards, fixed order:

**1. TVL** (`:26-31`) — public, never gated:

```ts
formatPrice(fromWei(market.tvl), { addDollarSign: true, decimalPoints: DEFAULT_PRECISION /*2*/ }).price;
```

No `abbreviate` → full thousands-separated dollars.

**2. 30D APY** (`:33-38`) — public:

```ts
const apy30d = Number(fromWei(market.apy_30d)); // :21
const apy30dColor = apy30d > 0 ? "text-main-light-blue" : apy30d < 0 ? "text-main-pink" : "text-white"; // :22
formatPercentage(apy30d, { decimalPoints: 0 }).percentage; // :36  → integer %, floored
```

(Contrast with the stats card's `Total APY`, which uses `apy_lifetime` at 2 dp and leaves the zero case uncolored.)

**3. Your Balance** — `isAuthenticated ? <BalanceCard …/> : <AuthGatedPlaceholder label="Your Balance" onSignIn={onSignIn} />` (`:40-44`).

**4. Claimable Rewards** — `isAuthenticated ? <ClaimableRewardsCard market={market} userProfit={userProfit} /> : <AuthGatedPlaceholder label="Claimable Rewards" onSignIn={onSignIn} />` (`:46-50`).

#### Auth gate

`AuthGatedPlaceholder` (`/symmio/Vibe-ui/src/components/App/Pools/components/PoolDetail/SummaryCards/AuthGatedPlaceholder.tsx:9-24`): same `card` shell, grey `t(label)` title, then a `<button onClick={onSignIn}>` with a `Lock` 14×14 icon and the literal copy `t('Sign to view your balance')` in `text-main-light-blue` — **the same string for both cards**, including the rewards one.

`isAuthenticated` comes from `useListingAuth()` (`/symmio/Vibe-ui/src/components/App/Pools/services/hooks/useListingAuth.ts:24`):

```ts
const isAuthenticated = Boolean(account && activeAccount && accessToken);
// account = useWalletStore.use.account(); activeAccount = useActiveAccount(); accessToken = listingAccessTokens[account]
```

`triggerAuthFlow(onComplete?)` (`:54-85`) short-circuits with `onComplete?.()` when already authenticated; otherwise it sets `isAuthFlowTriggeredRef` and opens the first missing step: `ApplicationModal.WAYS_TO_TRADE` if not connected → `ApplicationModal.CREATE_ACCOUNT` if connected but no `activeAccount` (and `!isAccountsLoading`) → `ApplicationModal.LISTING_SIGNATURE_REQUEST` if account exists but no `accessToken`. A `useEffect` (`:30-52`) auto-advances through the remaining steps and fires the stored callback once `isAuthenticated` flips true — that is what makes `handleDeposit`'s `addDeposit()` run after the sign-in ceremony. No-op while `isConnecting` (`:66-68`). Modals are mounted globally in `/symmio/Vibe-ui/src/components/Layout/index.tsx:194-201` (`ListingDepositModal`, `ListingSignatureRequestModal`, `ClaimRewardsModal`, `PoolWithdrawModal`, `WithdrawalDetailModal`).

#### `useUserProfit` — the data behind both gated cards

`/symmio/Vibe-ui/src/components/App/Pools/services/hooks/useUserProfit.ts:7-27`:

- key `['userProfit', contractAddress]` — ⚠️ **`marketStatus` and the auth flag are in `enabled` but not in the key**, so the cache entry is shared across auth transitions.
- `queryFn`: `GetUserProfit(contractAddress!)` → `GET {APP_POOLS_BACKEND_URL}profit/{token_contract_address}` with the Bearer interceptor (`services/index.tsx:232-234`).
- `enabled: Boolean(contractAddress && isAuthenticated && marketStatus === MarketStatus.Listed)` — so an `under_review` / `waiting_for_deposit` / `delisted` pool never fetches profit, and both cards render zeros for an authenticated user.
- `staleTime: 10 * 60 * 1000`, `refetchInterval: 10 * 60 * 1000` (10 min — much colder than the 30 s/60 s used elsewhere on the page).
- Response `UserProfitResponse` (`/symmio/Vibe-ui/src/components/App/Pools/services/types.ts:354-361`):
  ```ts
  user_balance_in_tokens: string; // 1e18
  user_balance_in_usdc: string; // 1e18
  claimable_reward: string; // NOT wei — see below
  user_deposited_token_amount: string;
  user_lp_amount: string; // 1e18
  pending_withdraw_lp_amount: string; // 1e18, already included in user_lp_amount but locked
  ```

#### `BalanceCard`

`/symmio/Vibe-ui/src/components/App/Pools/components/PoolDetail/SummaryCards/BalanceCard.tsx` — props `{ userProfit?: UserProfitResponse; tokenTicker: string | null }` (`:9-12`).

Computation (`:18-29`):

```ts
const usdcBalance = userProfit?.user_balance_in_usdc ?? "0";
const tokenBalance = userProfit?.user_balance_in_tokens ?? "0";
const userLpAmount = toBN(userProfit?.user_lp_amount ?? "0");
const pendingWithdrawalLpAmount = toBN(userProfit?.pending_withdraw_lp_amount ?? "0");
const pendingWithdrawalRate = userLpAmount.gt(0) ? pendingWithdrawalLpAmount.div(userLpAmount) : toBN(0);
const pendingWithdrawalUsdc = toBN(usdcBalance).times(pendingWithdrawalRate).toFixed(0); // stays in wei
const pendingWithdrawalToken = toBN(tokenBalance).times(pendingWithdrawalRate).toFixed(0); // stays in wei
const hasPendingWithdrawal = pendingWithdrawalLpAmount.gt(0);
const pendingWithdrawalRateLabel = formatPercentage(pendingWithdrawalRate.times(100), {
  decimalPoints: 2,
  removeTrailingZeros: true,
}).percentage;
```

Face value (`:111-131`): `formatPrice(fromWei(usdcBalance), {addDollarSign:true, decimalPoints:2, abbreviate:true})` in a span with a right border, then `formatPrice(fromWei(tokenBalance), {addDollarSign:false, decimalPoints:2, abbreviate:true})`, then ` {tokenTicker}` in grey — e.g. `$1.2K | 340.00 PEPE`.

Tooltip (`:31-92`, opened by clicking the `CircleInfo` 14×14 icon; controlled `useState` + `Tooltip side="top" align="center" sideOffset={8}`): title `Balance Breakdown`, rows `USDC` = `formatPrice(fromWei(usdcBalance), {addDollarSign:true, decimalPoints:2})` and `{tokenTicker ?? t('Token')}` = `formatPrice(fromWei(tokenBalance), {addDollarSign:false, decimalPoints:2})`. When `hasPendingWithdrawal`, a divider plus a `Pending Withdrawal ({rate}%)` block with the two `~`-prefixed `fromWei(pendingWithdrawal*)` amounts.

#### `ClaimableRewardsCard`

`/symmio/Vibe-ui/src/components/App/Pools/components/PoolDetail/SummaryCards/ClaimableRewardsCard.tsx` — props `{ market: MarketDetailResponse; userProfit?: UserProfitResponse }` (`:11-14`).

**The "computation" is a passthrough** (`:22`):

```ts
const claimableReward = userProfit?.claimable_reward ?? "0";
```

Rendered (`:28-37`) as `formatPrice(claimableReward, { addDollarSign: false, decimalPoints: DEFAULT_PRECISION /*2*/, abbreviate: true }).price` followed by the hardcoded literal `USDC`. **No `fromWei`** — and that is correct: the claim modal converts on the way out with `toWei(claimableReward)` when building `ClaimProfitRequest` (`/symmio/Vibe-ui/src/components/App/Pools/components/claim-rewards-modal/index.tsx:83-88`), and displays it the same way (`:45-47`). So `claimable_reward` is a human-decimal string, unlike the sibling `user_balance_*` fields — an asymmetry in the same response object.

Button (`:40-49`): `size="sm" variant="tertiary"`, `Coins` 16×16 + `t('Claim')`, `disabled={claimableReward === '0'}`, `onClick={() => openClaimRewardsModal({ market })}`. `useToggleClaimRewardsModal` toggles `ApplicationModal.CLAIM_REWARDS` and stashes `{ market }` in `modalOptions` (`/symmio/Vibe-ui/src/stores/application/applicationHooks.ts:275-283`).
⚠️ The disable check is a **strict string comparison** — `'0.0'`, `'0.00'`, `'0e0'`, or a numeric `0` from the API all leave the Claim button enabled with a zero balance. Layout: `flex-col` on mobile with a full-width button, `flex-row items-center justify-between` on desktop (`:25`, `:45`).

---

### 5. Tab set

`/symmio/Vibe-ui/src/components/App/Pools/components/PoolDetail/PoolDetailTabs.tsx` — props `{ market: MarketDetailResponse }` (`:29-31`). Local enum (`:21-27`):

```ts
enum PoolDetailTab {
  POSITIONS = "Positions",
  OPEN_QUOTES = "Open Quotes",
  OPEN_ORDERS = "Limit Orders",
  TRADE_HISTORY = "Trade History",
  DEPOSITS_WITHDRAWALS = "Deposits and Withdrawals",
}
```

Default `activeTab = PoolDetailTab.POSITIONS` (`:40`). Tab strip `:159-195`: horizontal scroller, active tab `text-main-pink` + `bg-main-pink text-main-gray-deep` count pill, inactive `text-main-gray` + `bg-neutrals-dark-400`; a pill only renders when `count > 0`; `formatCount` caps at `'+100'` for `count > 100` (`:33-36`). When `DEPOSITS_WITHDRAWALS` is active, a `ThemedDropDown.Primary` appears to the right with `All Actions` / `Your Actions` (`:45-53`, `:188-194`).

| Tab                          | Badge count                                                                                                       | Mounts                                                                                                                                                        | Data                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Positions**                | `(Number(market.long_position_amount) > 0 ? 1:0) + (Number(market.short_position_amount) > 0 ? 1:0)` (`:100-101`) | `<PoolPositionsTable market={market} />` (`:117`)                                                                                                             | **No fetch** — rows derived from `market.long_/short_position_{amount,value,avg_open_price,upnl}` via `fromWei` (`tables/PoolPositionsTable.tsx:34-60`); live mark price from `usePrice({ id: market.symbol_id, preferredHedgerType: HedgerType.ENIGMA })` and `useMarket({ id: market.symbol_id })` (`:30-33`). Renders a `ComingSoonColumnsPanel` for unimplemented columns (`:14`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Open Quotes**              | `openQuotes.length` (`:66`)                                                                                       | `<PoolOpenQuotesTable market openQuotes isLoading sortColumn sortOrder onSortChange />` (`:119-128`)                                                          | `usePoolQuotes({ symbolId: market.symbol_id, quoteStatuses: OPEN_STATUS_NUMBERS, orderBy: openQuotesSortField /*default 'timestamp'*/, orderDirection: openQuotesSortOrder /*QuoteOrder.DESCENDING*/ })` (`:60-65`). That hook runs an **Apollo GraphQL** query `POOL_QUOTES_BY_SYMBOL_AND_SOURCE` against `getApolloClient(FALLBACK_CHAIN_ID, ClientType.ANALYTICS)` with `source = LOWCAP_DIAMOND_ADDRESS[FALLBACK_CHAIN_ID].toLowerCase()`, `first: 101`, `skip: 0`, `fetchPolicy: 'no-cache'`; key `['poolQuotes', symbolId, quoteStatuses, first, skip, orderBy, orderDirection]`, `enabled: Boolean(symbolId && source)`, `staleTime: 30_000`, `refetchInterval: 60_000` (`/symmio/Vibe-ui/src/components/App/Pools/services/hooks/usePoolQuotes.ts:18-61`). `OPEN_STATUS_NUMBERS = OPEN_QUOTE_STATUS.map(s => Object.values(QuoteStatus).indexOf(s))` → `[4,5,6]` (`PoolDetailTabs.tsx:17`; `/symmio/Vibe-ui/src/types/quote.ts:3-17`). Pagination is client-side (`slice`, 10/page). |
| **Limit Orders**             | hardcoded `0` (`:106`)                                                                                            | **Coming-soon stub** (`:129-138`): `<Table width={64} height={64} />` + `t('Coming Soon')` + `t('Limit orders will be available in the next update.')`        | none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Trade History**            | `historyTotalCount` (see below)                                                                                   | `<PoolTradeHistoryTable market historyQuotes={historyPageData} chainId={historyQuotesChainId} isLoading page setPage perPage={10} totalCount />` (`:139-151`) | `usePoolHistoryQuotes({ symbolId: market.symbol_id, first: HISTORY_FETCH_SIZE /*110*/, skip: (historyPage-1)*HISTORY_PAGE_SIZE /*10*/ })` (`:79-83`) → GraphQL `POOL_QUOTE_EVENTS_BY_SYMBOL_AND_SOURCE` on the ANALYTICS client, `typeIn = historyCloseTypeToEventTypes[HistoryCloseTypeFilter.AllStatus]`, `fetchPolicy: 'no-cache'`; each row is `toQuoteFromGraph(event.quote)` with `applyHistoryCloseEventMetadata(quote, event.metadata, event.type)`, then `statusModifyTimestamp = Number(event.timestamp)`, `closeEventType`, `historyEventId` (`/symmio/Vibe-ui/src/components/App/Pools/services/hooks/usePoolHistoryQuotes.ts:29-72`). Same 30 s/60 s cadence.                                                                                                                                                                                                                                                                                                                   |
| **Deposits and Withdrawals** | `publicTransaction?.count ?? 0` (`:110`)                                                                          | `<PoolDepositsWithdrawalsTable market={market} filter={transactionsFilter} />` (`:153`)                                                                       | Badge source: `useTransactionHistory({ marketAddress: market.token_contract_address })` at the tabs level (`:68-70`) → `GET {APP_POOLS_BACKEND_URL}market/transaction-history/{start}/{size}?market_address=…&wallet_address=…` with hook defaults `start=0,size=10`, key `['GetTransactionHistory', marketAddress, walletAddress, start, size]`, `enabled: Boolean(marketAddress)`, `staleTime: 30_000` (`/symmio/Vibe-ui/src/components/App/Pools/services/hooks/useTransactionHistory.ts:19-46`; service `services/index.tsx:236-249`). The table re-issues its own paged copy, passing `wallet_address` only when `filter === ActionFilter.Yours` (`tables/PoolDepositsWithdrawalsTable.tsx:27-32`), `usePagination(1, 10)`, columns `action / amount / date / status`.                                                                                                                                                                                                                  |

**Trade-history pagination arithmetic** (`:85-98`), with its own inline comments:

```ts
const historyPageData = historyQuotes.slice(0, HISTORY_PAGE_SIZE); // show 10 of the 110 fetched
const computedHistoryTotalCount = (historyPage - 1) * HISTORY_PAGE_SIZE + historyQuotes.length;
if (!isHistoryQuotesLoading)
  lastHistoryTotalCountRef.current = Math.max(lastHistoryTotalCountRef.current, computedHistoryTotalCount);
const historyTotalCount = isHistoryQuotesLoading
  ? Math.max(computedHistoryTotalCount, lastHistoryTotalCountRef.current) // keep controls stable during refetch
  : computedHistoryTotalCount;
```

A deliberate hack: `totalCount` is synthesized ("reporting skip + response.length as totalCount naturally exposes additional pages as the user advances") because the subgraph query returns no total. Note the ref write happens **during render** (`:91-93`), not in an effect. Also `first: 110` while only 10 rows are displayed — 100 rows over-fetched per page.

---

### 6. `GeneralInfo` — belongs to the LIST page, not the detail page

`/symmio/Vibe-ui/src/components/App/Pools/components/PoolsInfo/GeneralInfo.tsx` is mounted **only** at `/symmio/Vibe-ui/src/components/App/Pools/DiscoverPoolsContent.tsx:93-97`, i.e. on `/pools`, never on `/pools/[contractAddress]`. Consequently `useAggregatedTvl` and `useRevenue` — both in the read list — **do not run on the detail page**; `GeneralInfo` is their sole consumer.

Props: `{ poolsCount: number; activeTab: ActiveTabKeys; isPoolsCountLoading?: boolean }` (`:15-19`). `isYours = activeTab === 'your_pools'` (`:32`) — but the only call site hardcodes `activeTab={'discover' as ActiveTabKeys}`, so **`isYours` is always `false`**: the entire `yourInfoItems` array (`:122-133`, 10 entries: Avg APR / ROI / Current Balance / 24h Volume / 24h Revenue / Top Earning Chain / Active Pools / Lifetime Deposits / Lifetime Volume / Lifetime Revenue) and the `'Your Pools Overview'` heading are unreachable dead code.

Hooks: `useMarketInfo()` (`:31`), `useNotionalCap({ isLowcap: true, fetchAll: true })` → **bulk** path `GET {ENIGMA.domain}/notional_cap`, key `['getNotionalCaps', hedgerType]`, `refetchInterval: 120_000` (`:33`; `useNotionalCap.ts:54-59`), `useAggregatedTvl()` (`:34`), `useRevenue()` (`:35`), plus `useState(false)` for `isShowingVibecapsOi` (`:36`).

`infoItems` (`:54-120`):
| Title | Value |
|---|---|
| `Vibecaps TVL` ⇄ `Available OI` (toggle, `isToggle: true`) | TVL = `formatPrice(toBN(tvlData.tvl).div(1e18), {addDollarSign:true, decimalPoints:1, abbreviate:true})` (`:39-45` — manual `/1e18`, not `fromWei`); OI = `formatPrice(total_open_interest, {…decimalPoints:1, abbreviate:true})` (`:46-52`); both `'-'` when absent. Toggled by the `<button aria-label="Switch between Vibecaps TVL and OI">` (`:147-156`). |
| `Total OI` | `formatPrice(total_used, {addDollarSign:true, decimalPoints:1, abbreviate:true})` from the bulk notional-cap response |
| `24h Volume` | `formatPrice(marketInfo?.total_value_24h, {…decimalPoints:1, abbreviate:true})` |
| `24h Revenue` | `formatPrice(revenueData.day.total_revenue, {…decimalPoints:1, abbreviate:true, roundingMode:'up'})` |
| `Top Chain` | **no `value`** → `<ComingSoonBadge />` (`:167`) |
| `Active Pools` | `poolsCount`; shows `ThemedLoading.ThreeStaticDots` while `isPoolsCountLoading` (`:160-163`) |
| `Lifetime Volume` | `formatPrice(marketInfo?.total_lifetime_value, {…})` |
| `Lifetime Revenue` | `formatPrice(revenueData.lifetime.total_revenue, {…, roundingMode:'up'})` |

Right-hand 36 % panel is the same `ChartPlaceholder` + `Coming Soon` + `t('Advanced revenue analytics and historical charts will be available in the next update.')` (`:175-185`).

**`useAggregatedTvl`** (`/symmio/Vibe-ui/src/components/App/Pools/services/hooks/useAggregatedTvl.ts:5-22`): key `['GetAggregatedTvl']`, no `enabled` gate, `staleTime` and `refetchInterval` both `2*60_000`. `GetAggregatedTvl()` → `GET {inventoryBase}/v1/markets/tvl-aggregate` where the inventory axios instance base is `https://inventory-staging.enigma.bz/api` (staging **and** test) else `https://inventory85.enigma.bz/api` (`services/index.tsx:49-56`, `:203-205`). Response `AggregatedTvlResponse { tvl: string }` (`services/types.ts:300-302`).

**`useRevenue`** (`/symmio/Vibe-ui/src/components/App/Pools/services/hooks/useRevenue.ts:11-32`): `marketId` defaults to `DEFAULT_MARKET_ID = 1` (`/symmio/Vibe-ui/src/constants/misc.ts:62`); key `['GetRevenue', marketId]`; `staleTime`/`refetchInterval` `2*60_000`; `queryFn` runs `Promise.allSettled([GetRevenue(marketId), GetRevenue(marketId, '24h')])` and returns `{ lifetime, day }`, each `null` when its promise rejected. `GetRevenue` → `GET {ENIGMA.domain}/revenue/{marketId}[?time_range=24h]` built with `joinUrl` and a **bare `axios`** (not the pools instance), with `captureAxiosError` on failure (`services/index.tsx:207-218`). Response `RevenueResponse { total_revenue, hedger_fee_revenue, funding_revenue, record_count }` (`services/types.ts:305-310`). Note `GeneralInfo` always calls `useRevenue()` with the default marketId `1` — the revenue figures are **not** pool-scoped.

---

### 7. `truncateToSignificant`

`/symmio/Vibe-ui/src/components/App/Pools/utils/truncateToSignificant.ts:34-49`:

```ts
export function truncateToSignificant(num: number, digitCount: number) {
  const sci = num.toExponential();
  const [significand, exponent] = sci.split("e");
  const sign = num < 0 ? -1 : 1;
  let digits = Math.abs(Number(significand)).toString().replace(".", "");
  digits = digits.slice(0, digitCount);
  const newSignificand = digits[0] + (digits.length > 1 ? "." + digits.slice(1) : "");
  return sign * Number(newSignificand) * Math.pow(10, Number(exponent));
}
```

32 lines of JSDoc (`:1-32`) with examples `truncateToSignificant(0.0456789, 2) → 0.045`, `(0.00987654, 3) → 0.00987`, `(-0.000007891, 2) → -0.0000078`. **Completely unused — dead code.** A repo-wide grep over `src/` and `test/` finds no importer; the only hits are its own definition and its doc comment.

---

### 8. Test file status — currently RED

`/symmio/Vibe-ui/test/unit/components/App/Pools/components/PoolDetail/pool-stats.test.ts` (3 cases, vitest):

1. **`'uses token decimals when normalizing the token balance'`** (`:6-25`) — inputs `total_token_in_pool: toWei('250', 6)` (= `'250000000'`), `total_usdc_in_pool: toWei('1000')`, `token_decimal: 6`, `tokenPrice: '4'`, notionalCap `{used: 321.45, available_to_long: 123.45, available_to_short: 67.89}`. Asserts `values.tokenBalance.toString() === '250'` and `values.tokenPercent === 50`.
   **This assertion cannot hold against the current implementation.** `pool-stats.ts:35` calls `fromWeiBN(market.total_token_in_pool)` with the default `decimals = 18`, so `250000000 / 1e18 = 2.5e-10` → `.toString()` yields `'2.5e-10'`, not `'250'`; and `tokenPercent = (2.5e-10·4)/(1e-9 + 1000)·100 ≈ 1e-10`, not `50`. The test was written for the pre-`ebc1d08c7` version that passed `market.token_decimal`. The `expect(values.openInterest).toBe(321.45)` line still passes.
   The suite **is** collected by CI: `vitest.config.mts:21` includes `['src/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}']` in the `unit` project, and `package.json:19-22` exposes `test` / `test:unit` / `test:watch` / `test:coverage`.
2. `'clamps exhausted liquidity sides to zero'` (`:27-44`) — `available_to_long: -12 → 0`, `available_to_short: 45 → 45`. Passes (exercises `Math.max(…, 0)` at `pool-stats.ts:48-49`).
3. `'keeps a neutral split when token price is unavailable'` (`:46-62`) — `tokenPrice: null` → `tokenPercent === 50` (`DEFAULT_BALANCE_PERCENT`). Passes.

Note that `token_decimal` must still be supplied by callers because it is in the `Pick<>` (`pool-stats.ts:14`), even though the body ignores it — the type is now lying about the function's inputs.

---

### 9. Consolidated defect / dead-code / stub list

**Stubs & "coming soon"**

- `PoolChartCard` body is permanently `Coming Soon` — no data layer at all; `chartTab` / `performanceTab` state is never read; the `Yearly` timeframe button has no `onClick` (`PoolChartCard.tsx:20-88`).
- `Limit Orders` tab renders a `Coming Soon` block (`PoolDetailTabs.tsx:129-138`) while a fully-written `PoolOpenOrdersTable` + `useOpenOrders` (→ `POST {conditionalOrders base}/api/v4/search/`, `services/index.tsx:263-265`) sit unmounted: `/symmio/Vibe-ui/src/components/App/Pools/components/PoolDetail/tables/PoolOpenOrdersTable.tsx` and `/symmio/Vibe-ui/src/components/App/Pools/services/hooks/useOpenOrders.ts` are referenced by nothing but each other — **dead code**.
- `ComingSoonColumnsPanel` overlays in the Positions and Open Quotes tables for `UPNL (ROE%) / Liq. Price / Margin / Funding`; those columns are commented out in place (`tables/PoolOpenQuotesTable.tsx:45-48,53`, `tables/PoolPositionsTable.tsx:13-14`).
- `GeneralInfo`'s `Top Chain` renders `<ComingSoonBadge />`; the whole `yourInfoItems` branch is unreachable.

**Dead code**

- `truncateToSignificant` — zero importers.
- `IS_POOLS_ENABLED` (`/symmio/Vibe-ui/src/constants/environment.ts:5`, env `NEXT_PUBLIC_POOLS_ENABLE`) is **defined but never read anywhere** — the pools routes are not feature-flagged.
- `token_decimal` in `GetPoolStatsCardValuesParams` — required by the type, ignored by the body.
- `status` param of `useAddDeposit` — accepted, never used.
- `useMarketDetail().isError` / `useUserProfit().isError` — returned, never consumed by `PoolDetail`.
- `APP_POOLS_BACKEND_URL`'s test-vs-prod branches are byte-identical (`misc.ts:25-27`), as are `inventory`'s staging-vs-test branches (`services/index.tsx:50-54`) and the price-service's (`price-service/constants.ts:15-18`).

**Likely bugs**

1. `PoolStatsCard.tsx:118` passes `market.age` to `formatListingAge`, which every other call site feeds a unix `listing_time`; `MarketDetailResponse` carries both fields.
2. `pool-stats.test.ts` case 1 is stale/red after commit `ebc1d08c7`.
3. Pre-`router.isReady` "Pool details not found" flash (`PoolDetail/index.tsx:59-77`).
4. `useNotionalCap`'s `marketId || activeMarket?.id` fallback fires a request for the wrong market when `symbol_id` is null (`useNotionalCap.ts:27`).
5. `chainName: 'Arbitrum one'` will not match the price-service `chain_id` slug → no `priceUsd` → flat 50/50 pool-balance bar for Arbitrum pools (`PoolStatsCard.tsx:39` vs `dexscreener/service.ts:72-75`).
6. `disabled={claimableReward === '0'}` is a strict string compare (`ClaimableRewardsCard.tsx:43`).
7. `useUserProfit`'s query key omits `isAuthenticated` and `marketStatus` even though `enabled` depends on them (`useUserProfit.ts:11,16`).
8. `PoolDetailTabs.tsx:91-93` mutates a ref during render.
9. The `deposit_chain` self-heal effect depends on the whole `router` object and causes a second `marketDetail` fetch on every cold entry without the query param (`PoolDetail/index.tsx:53-57`).
10. `AuthGatedPlaceholder` shows `Sign to view your balance` under the `Claimable Rewards` heading too (`AuthGatedPlaceholder.tsx:20`).
11. `PoolStatsCard.tsx:155` omits `addDollarSign: false` for the pool's USDC side, so it renders `$… USDC`.

---

## 4. Pool detail — the five data tables

### Vibe-ui — Pool Detail page TABLES (map)

All paths relative to `/symmio/Vibe-ui`. Root of the slice: `src/components/App/Pools/components/PoolDetail/`.

---

#### 0. Orchestrator: who mounts what

`src/components/App/Pools/components/PoolDetail/PoolDetailTabs.tsx` is the single parent that owns tab state and (for 3 of 5 tables) the data hooks. `PoolDetail/index.tsx:17` mounts it.

`PoolDetailTabs.tsx:21-27` — the tab enum:

```ts
enum PoolDetailTab {
  POSITIONS = "Positions",
  OPEN_QUOTES = "Open Quotes",
  OPEN_ORDERS = "Limit Orders",
  TRADE_HISTORY = "Trade History",
  DEPOSITS_WITHDRAWALS = "Deposits and Withdrawals",
}
```

`PoolDetailTabs.tsx:17-19` — module constants:

```ts
const OPEN_STATUS_NUMBERS = OPEN_QUOTE_STATUS.map((s) => Object.values(QuoteStatus).indexOf(s)); // → [4,5,6]
const HISTORY_PAGE_SIZE = 10;
const HISTORY_FETCH_SIZE = 110;
```

Tab badge counts (`PoolDetailTabs.tsx:100-112`): positions = `(Number(market.long_position_amount) > 0 ? 1 : 0) + (Number(market.short_position_amount) > 0 ? 1 : 0)`; open quotes = `openQuotes.length`; **open orders = hardcoded `0`** (`:106`); trade history = `historyTotalCount`; deposits = `publicTransaction?.count ?? 0`. `formatCount` (`:33-36`) renders `'+100'` when `count > 100`.

**`PoolDetailTab.OPEN_ORDERS` does NOT render `PoolOpenOrdersTable`** — `PoolDetailTabs.tsx:129-138` renders an inline "Coming Soon" placeholder (`Table` icon 64x64 + `t('Limit orders will be available in the next update.')`). See §6 for the dead-code trail.

---

#### 1. The five tables

##### 1.1 `PoolPositionsTable.tsx` — aggregate long/short pool exposure

- **Feed**: no hook of its own. Props `{ market: MarketDetailResponse }`. Rows are derived purely from the market-detail REST payload (`PoolPositionsTable.tsx:34-60`). Plus two zustand reads: `useMarket({ id: market.symbol_id ?? undefined })` (`:30`) and `usePrice({ id: market.symbol_id ?? undefined, preferredHedgerType: HedgerType.ENIGMA })` (`:31-32`).
- **Row model** (`:20-26`): `interface PositionRow { type: 'Longs' | 'Shorts'; size, positionValue, entryPrice, upnl: string }`. At most **2 rows**, pushed only when `Number(market.long_position_amount) > 0` (`:37-46`) / `Number(market.short_position_amount) > 0` (`:48-57`).
- **Columns** (`:62-75`), keys/labels: `type`/`Type` (`headStyle:{paddingLeft:'12px'}`), `size`/`Size`, `positionValue`/`Position Value`, `entryPrice`/`Entry Price`, `upnl`/`UPNL`, `markPrice`/`Mark Price`. Commented-out at `:70-72`: `liqPrice`, `margin`, `funding`.
- **Cell expressions**:
  - Type (`:89-98`): `<ArrowUp2/>` when `'Longs'` else `<ArrowDown2/>`; text class `text-main-light-blue` (long) / `text-main-pink` (short).
  - Size (`:99-107`): `formatPrice(item.size, { decimalPoints: symbolMarket?.quantityPrecision, addDollarSign: false }).price` + `<span className="text-main-gray">{market.token_ticker}</span>`.
  - Position Value (`:108-116`): `formatPrice(item.positionValue, { decimalPoints: DEFAULT_AMOUNT_PRECISION, addDollarSign: false }).price` + literal `t('USDC')`.
  - Entry Price (`:117-124`): `formatPrice(item.entryPrice, { decimalPoints: symbolMarket?.pricePrecision, addDollarSign: false }).price`.
  - UPNL (`:125-133`): `formatPrice(item.upnl, { addDollarSign: true, decimalPoints: DEFAULT_AMOUNT_PRECISION }).price`; class `text-main-light-blue` flipped to `text-main-pink` via `cn(...)` when `Number(item.upnl) < 0`.
  - Mark Price (`:134-143`): `liveMarkPrice ? formatPrice(Number(liveMarkPrice), { decimalPoints: symbolMarket?.pricePrecision, addDollarSign: false }).price : '-'`.
- **Pagination**: none. `ThemedTables.Simple` is called **without** `pagination`, which defaults to `true` (`src/components/Table/index.tsx:408`), so `TablePagination` mounts — but it self-hides because `total (=2) <= perPage (=10) && page === 1` (`src/components/Table/index.tsx:267`). Net effect: invisible.
- **Loading**: `isLoading` is **never passed** → the table never shows its spinner; while `useMarketDetail` is still loading, `PoolDetail/index.tsx:59-66` shows a full-page `LottieLoader name="preloading"` instead.
- **Empty**: `emptyComponent={<EmptySleepingChepe message={t('No open positions')} />}` (`:149`).
- **Error**: none (see §7).
- **Refetch cadence**: inherited from `useMarketDetail` (`services/hooks/useMarketDetail.ts:35-36`): `staleTime: 30_000`, `refetchInterval: 60_000`. Mark price ticks live off the hedger WS store (`usePrice`).
- **Side panel**: when `rows.length > 0`, `<ComingSoonColumnsPanel columns={[t('Liq. Price'), t('Margin'), t('Funding')]} />` (`:77`, `:152`).

##### 1.2 `PoolOpenQuotesTable.tsx` — live open positions from the subgraph

- **Feed**: props-driven. `PoolDetailTabs.tsx:60-65` calls
  ```ts
  usePoolQuotes({
    symbolId: market.symbol_id,
    quoteStatuses: OPEN_STATUS_NUMBERS,
    orderBy: openQuotesSortField,
    orderDirection: openQuotesSortOrder,
  });
  ```
  and passes `openQuotes`, `isLoading`, `sortColumn`, `sortOrder`, `onSortChange` (`:119-128`). Props interface at `PoolOpenQuotesTable.tsx:20-27`; data type is `SubgraphQuote[]`.
- **Columns** (`:38-51`): `type`/`Type` (padLeft 12px), `timestamp`/`Open Time` **`sortable: true`**, `quantity`/`Position Size (Value)` **`sortable: true`**, `entryPrice`/`Open Price`, `markPrice`/`Mark Price`. Commented out at `:45-48`: `upnl` (`UPNL (ROE%)`), `liqPrice`, `margin`, `funding`.
- **Per-row derivations** (`:76-82`):
  ```ts
  const leverage = getQuoteLeverage(item);
  const isLong = item.positionType === PositionType.LONG;
  const qty = toBN(item.quantity).minus(toBN(item.closedAmount)).toNumber(); // remaining size
  const price = toBN(item.openedPrice).toNumber();
  const markPrice = toBN(liveMarkPrice ?? 0);
  const positionValuePrice = markPrice.gt(0) ? markPrice.toNumber() : price;
  const positionValue = qty * positionValuePrice;
  ```
- **Cells**:
  - Type (`:86-96`): arrow icon + `t('Long')`/`t('Short')` + leverage chip `<div className="tag tag-primary ml-1 px-1">{leverage}x</div>`.
  - Open Time (`:97-101`): `formatTimestamp(item.statusModifyTimestamp * 1000, 'M/D/YYYY - HH:mm:ss')` (`src/utils/time.ts:97-99`, dayjs local).
  - Position Size (Value) (`:102-118`): `formatPrice(qty, {decimalPoints: symbolMarket?.quantityPrecision, addDollarSign:false}).price` + ticker + `(` + `formatPrice(positionValue, {decimalPoints: DEFAULT_AMOUNT_PRECISION, addDollarSign:true}).price` + `)`.
  - Open Price (`:119-126`): `formatPrice(price, {decimalPoints: symbolMarket?.pricePrecision, addDollarSign:false}).price`.
  - Mark Price (`:127-136`): same `liveMarkPrice ? … : '-'` expression as positions.
- **Pagination model**: **fully client-side**, on data already capped by the subgraph query. Local state `const [currentPage, setCurrentPage] = useState(1)`, `const [currentPerPage, setCurrentPerPage] = useState(10)` (`:35-36`); `paginatedQuotes = openQuotes.slice((currentPage-1)*currentPerPage, currentPage*currentPerPage)` (`:56-59`). `ThemedTables.Simple` gets `pagination={false}` (`:71`) and a **separate** `<TablePagination total={openQuotes.length} page setPage perPage setPerPage />` is rendered below, gated on `hasOpenQuotes` (`:150-158`). Page-size dropdown options are 10/20/50/100 (`src/components/Table/index.tsx:349-366`).
- **Sorting**: server-side. Header click → `ThemedTables.Simple`'s `handleColumnHeaderClicked` (`src/components/Table/index.tsx:501-515`) → `onSortChange(column.key, QuoteOrder.DESCENDING | ASCENDING)` → `PoolDetailTabs.tsx:55-58` sets `openQuotesSortField`/`openQuotesSortOrder` → new `usePoolQuotes` query key → new subgraph `orderBy`/`orderDirection`. `QuoteOrder` = `{ASCENDING:'asc', DESCENDING:'desc'}` (`src/stores/quotes/quotesTypes.ts:15-18`).
- **Loading**: `isLoading` forwarded (`:70`) → `ThemedLoading.ThreeStaticDots` row.
- **Empty**: `EmptySleepingChepe message={t('No open quotes')}` (`:144`).
- **Refetch cadence**: `usePoolQuotes` → `staleTime: 30_000`, `refetchInterval: 60_000`.
- **Side panel**: `<ComingSoonColumnsPanel columns={[t('UPNL (ROE%)'), t('Liq. Price'), t('Margin'), t('Funding')]} />` when `hasOpenQuotes` (`:53`, `:147`).
- Layout: outer `overflow-x-auto`, table column pinned to `min-w-[640px]` (`:63-65`).

##### 1.3 `PoolOpenOrdersTable.tsx` — limit / conditional orders (**ORPHANED, see §6**)

- **Feed**: `useOpenOrders` (`PoolOpenOrdersTable.tsx:25-35`) with a fixed payload:
  ```ts
  { symbol_id: market.symbol_id ?? undefined,
    start: (page - 1) * perPage,
    size: perPage,
    conditional_order_type: 'send_quote',
    state: ['pending', 'new', 'triggered_pending'] }
  ```
- **Pagination model**: **server-side offset/limit** via `usePagination(1, 10)` (`:23`, `src/hooks/usePagination.ts`). `totalCount={count}` from the response, `page/setPage/perPage/setPerPage` passed into `ThemedTables.Simple` (`:55-60`) which renders `TablePagination` internally (`src/components/Table/index.tsx:661-673`).
- **Columns** (`:37-47`): `openTime`/`Open Time` (padLeft 12), `type`/`Type`, `size`/`Size`, `orderValue`/`Order Value`, `price`/`Price`, `tpSl`/`TP | SL`. None sortable.
- **Cells** (`:61-102`), row keyed by `item.coh_quote_id`:
  - `isLong = item.position_type === 0` (`:62`) — raw int, not the `PositionType` enum.
  - `qty = item.quantity`, `price = item.price`, `orderValue = qty * price` (`:63-65`) — **plain JS numbers straight off JSON, no wei conversion, no BigNumber**.
  - Open Time: `item.create_time ? dayjs(item.create_time * 1000).format('DD/MM/YYYY HH:mm') : '-'`, class `text-main-gray` (`:70-72`).
  - Type: arrow + `t('Long Limit')` / `t('Short Limit')` (`:74-81`).
  - Size: `formatPrice(qty, {decimalPoints: symbolMarket?.quantityPrecision, addDollarSign:false}).price` + ticker.
  - Order Value: `formatPrice(orderValue, {decimalPoints: DEFAULT_AMOUNT_PRECISION, addDollarSign:true}).price`.
  - Price: `formatPrice(price, {decimalPoints: symbolMarket?.pricePrecision, addDollarSign:false}).price`.
  - **TP | SL: hardcoded stub `<p className="… text-main-gray">- | -</p>` (`:99`)** — never populated.
- **Loading**: `isLoading` forwarded (`:54`). **Empty**: `EmptySleepingChepe message={t('No open orders')}` (`:104`).
- **Refetch cadence**: `useOpenOrders` → `staleTime: 30_000`, `refetchInterval: 60_000`, `enabled: Boolean(payload.symbol_id)`.

##### 1.4 `PoolTradeHistoryTable.tsx` — closed / liquidated trades

- **Feed**: props. `PoolDetailTabs.tsx:75-83` calls `usePoolHistoryQuotes({ symbolId, first: HISTORY_FETCH_SIZE /*110*/, skip: (historyPage-1) * HISTORY_PAGE_SIZE /*10*/ })`. Props extend `PaginationProps` (`PoolTradeHistoryTable.tsx:21-26`, `src/types/paginated.ts:8-15`).
- **Columns** (`:90-102`): `closeTime`/`Close Time` (padLeft 12), `type`/`Type`, `closePrice`/`Close Price`, `size`/`Size`, `tradeValue`/`Trade Value`, `fee`/`Fee`, `closedPnl`/`Closed PNL`, `link`/`Link` (`headStyle:{justifyContent:'center'}`). None sortable.
- **Per-row derivations** (`:117-134`):
  ```ts
  const leverage = getQuoteLeverage(item);
  const qty = toBN(item.closedAmount).toNumber();
  const closePrice = toBN(item.avgClosedPrice || "0").toNumber();
  const openPrice = toBN(item.openedPrice).toNumber();
  const tradeValue = qty * closePrice;
  const initialNotionalValue = getOpenFeeNotionalValue(item);
  const closeNotionalValue = getCloseFeeNotionalValue(item, item.closedAmount || "0");
  const fee = calculatePlatformFee(
    initialNotionalValue,
    item.tradingFee || "0",
    item.closeFee || "0",
    closeNotionalValue,
  );
  const isLong = item.positionType === PositionType.LONG;
  const pnl = isLong ? (closePrice - openPrice) * qty : (openPrice - closePrice) * qty;
  const pnlColor = pnl >= 0 ? "text-main-light-blue" : "text-main-pink";
  const explorerUrl = getSymmioPositionUrl(chainId, item.id);
  ```
  Fee math (`src/utils/fees.ts:11-35`): `openNotional = marketPrice * quantity`; `closeNotional = avgClosedPrice * closedAmount`; `fee = openNotional*tradingFee + closeNotional*closeFee`.
- **Cells**:
  - Close Time (`:138-150`): `<Tooltip content={formatCloseTimeTooltip(item.statusModifyTimestamp)}>` wrapping `formatCloseTime(item.statusModifyTimestamp)`. `formatCloseTime` (`:28-56`) is a relative formatter: `>10 days` → `DD/MM/YYYY HH:mm`; `>0 days` → `Xd Yh ago` / `Xd ago`; `>0 hours` → `Xh ago`; `>0 minutes` → `Xm ago`; else `'now'`; `!timestamp` → `'-'`. `formatCloseTimeTooltip` (`:58-75`) uses `Intl.DateTimeFormat` 2-digit, `hour12:false`, `timeZoneName:'short'`, appended `(${Intl.DateTimeFormat().resolvedOptions().timeZone})`.
  - Type (`:151-161`): arrow + Long/Short + `{leverage}x` chip.
  - Close Price (`:162-168`): `closePrice > 0 ? formatPrice(closePrice, {decimalPoints: symbolMarket?.pricePrecision, addDollarSign:false}).price : '-'`.
  - Size (`:169-174`): `formatPrice(qty, {decimalPoints: symbolMarket?.quantityPrecision, addDollarSign:false}).price` + ticker.
  - Trade Value (`:175-180`): `formatPrice(tradeValue, {decimalPoints: DEFAULT_AMOUNT_PRECISION, addDollarSign:false}).price` + `t('USDC')`.
  - Fee (`:181-191`): `formatPrice(fee, {decimalPoints: DEFAULT_AMOUNT_PRECISION, addDollarSign:false}).price` + `t('USDC')`.
  - Closed PNL (`:192-203`): `closePrice > 0 ? formatPrice(pnl, {decimalPoints: DEFAULT_AMOUNT_PRECISION, addDollarSign:false}).price + ' USDC' : '-'`, colored by `pnlColor`.
  - Link (`:204-219`): renders only `if (explorerUrl)`; `<a href={explorerUrl} target="_blank" rel="noopener noreferrer">` with `<ArrowUpRightFromSquare width={14} height={14} color="var(--color-main-white)" />`.
- **Pagination model**: server-ish, **oversized-fetch + client slice**. See §5 in full.
  - `ThemedTables.Simple` gets `pagination`, `noPaginationSetting` (hides "N-M of T" text and the per-page dropdown, `src/components/Table/index.tsx:277`, `:344`), `page`, `setPage`, `perPage`, `totalCount` (`:110-115`). **`setPerPage` is deliberately not passed** — page size is frozen at `HISTORY_PAGE_SIZE = 10`.
- **Loading** `isLoading` (`:109`). **Empty**: `EmptySleepingChepe message={t('No trade history')}` (`:223`).
- **Refetch cadence**: `usePoolHistoryQuotes` → `staleTime: 30_000`, `refetchInterval: 60_000`.

##### 1.5 `PoolDepositsWithdrawalsTable.tsx` — LP deposits/withdrawals (REST, not chain)

- **Feed**: owns its hook. `useTransactionHistory({ marketAddress: market.token_contract_address, walletAddress: filter === ActionFilter.Yours ? (account ?? undefined) : undefined, start: (page-1)*perPage, size: perPage })` (`:27-32`). `account` from `useWalletStore.use.account()` (`:23`).
- **Filter** exported from this file (`:11-14`): `export enum ActionFilter { All = 'all', Yours = 'yours' }`. The dropdown lives in the parent (`PoolDetailTabs.tsx:188-194`, options `All Actions` / `Your Actions`, only rendered while this tab is active).
- **Columns** (`:34-42`) — the only table using explicit widths: `action`/`Action` (`paddingLeft:'12px', width:'45%'`), `amount`/`Amount` (`width:'25%'`), `date`/`Date` (`width:'20%'`), `status`/`Status` (`width:'10%'`).
- **Row**: delegated to `<TransactionRow key={`${item.time}-${index}`} item={item} market={market} />` (`:57-59`).
- **Pagination model**: **server-side offset/limit**, `usePagination(1, 10)` (`:25`); `totalCount={transaction?.count ?? 0}`, `page/setPage/perPage/setPerPage` all passed (`:52-56`) → full internal `TablePagination` with the per-page dropdown.
- **`isCard={false}`** (`:47`) — unique to this table; kills the 8px `borderSpacing` / `-8px` marginTop card look (`src/components/Table/index.tsx:557-558`).
- **Empty**: `EmptySleepingChepe message={t('No deposits or withdrawals')}` (`:60`). **Loading**: `isLoading` (`:50`).
- **Refetch cadence**: `useTransactionHistory` sets **`staleTime: 30_000` only — no `refetchInterval`** (`services/hooks/useTransactionHistory.ts:37`). This is the one table that does not self-poll.

###### `TransactionRow.tsx`

`isWithdrawal = item.type === 'withdraw'` (`:16`); `formattedDate = dayjs(item.time * 1000).format('YYYY/MM/DD - HH:mm')` (`:17`). Action cell = `<Minus …24x24/>` or `<Plus …24x24/>` + `t('Withdrawal')`/`t('Deposit')` (`:22-31`). Amount cell = `<AmountCell item market/>`. Status cell = `<StatusBadge status={item.status} />`.

---

#### 2. Data hooks — exact wire details

##### 2.1 `usePoolQuotes` — `src/components/App/Pools/services/hooks/usePoolQuotes.ts`

- **Transport**: Apollo (GraphQL), **not** REST. `getApolloClient(FALLBACK_CHAIN_ID, ClientType.ANALYTICS)` (`:31`).
- **Endpoint resolution**: `src/apollo/client/apolloClients.ts:12-28`. `ANALYTICS` → `https://api.goldsky.com/api/public/project_cm1hfr4527p0f01u85mz499u8/subgraphs/hyperevm_mainnet_analytics/latest/gn`; when `IS_TEST_ENVIRONMENT` → `.../hyperevm_analytics/latest/gn`. `getApolloClient` returns `undefined` for any chain ≠ `FALLBACK_CHAIN_ID` (and `console.log`s) — `FALLBACK_CHAIN_ID = CHAIN_IDS[0] = SupportedChainId.HYPEREVM = 999` (`src/constants/chains.ts:40,50,52`).
- **Query**: `POOL_QUOTES_BY_SYMBOL_AND_SOURCE` (`src/apollo/queries.ts:372-427`), operation `PoolQuotes`, `where: { symbolId: $symbolId, source: $source, quoteStatus_in: $quoteStatuses }`.
- **`source`**: `LOWCAP_DIAMOND_ADDRESS[FALLBACK_CHAIN_ID]?.toLowerCase()` (`:26`) → `0x57331038c21982116EE9b0906E4a5c5cB52dcE2e` (mainnet) / `0x99641E06d38F327166b3a48f86Ca2cbB3B4fB7EB` (test) per `src/constants/addresses.ts:51-57`.
- **Variables**: `{ symbolId: String(symbolId), source, quoteStatuses, first, skip, orderBy, orderDirection }`. Defaults `first = 101`, `skip = 0`, `orderBy = 'timestamp'`, `orderDirection = 'desc'` (`:22-25`). **`first = 101` is a deliberate `>100` sentinel** feeding `formatCount`'s `'+100'`.
- `fetchPolicy: 'no-cache'` (`:45`).
- **Mapping**: `(data.quotes ?? []).map(toQuoteFromGraph)` → `SubgraphQuote[]` (`src/apollo/service.ts:140-180`).
- **RQ**: key `['poolQuotes', symbolId, quoteStatuses, first, skip, orderBy, orderDirection]` (`:29`); `enabled: Boolean(symbolId && source)`; `staleTime: 30_000`; `refetchInterval: 60_000`.
- **Return**: `{ quotes: query.data ?? [], chainId: FALLBACK_CHAIN_ID, isLoading, isError, refetch }`.
- Note `PoolDetailTabs` never passes `first`/`skip` here → open quotes are **not** paginated at the source; the table slices locally.

##### 2.2 `usePoolHistoryQuotes` — `.../hooks/usePoolHistoryQuotes.ts`

- Same Apollo ANALYTICS client + same `source` derivation (`:27,32`).
- **Query**: `POOL_QUOTE_EVENTS_BY_SYMBOL_AND_SOURCE` (`src/apollo/queries.ts:429-494`), operation `PoolQuoteEvents`, root field `quoteEvents`, `where: { type_in: $typeIn, quote_: { symbolId: $symbolId, source: $source } }`. Selects `id, type, metadata, timestamp, quoteId, quote { … subAccount { address } … tradingFee closeFee }`.
- **`typeIn`** = `historyCloseTypeToEventTypes[HistoryCloseTypeFilter.AllStatus]` (`:35`) = `['FILL_CLOSE','FORCE_CLOSE','EMERGENCY_CLOSE','ADL_CLOSE','LIQUIDATE_PARTY_A','LIQUIDATE_PARTY_B','LIQUIDATE_CLEARING_HOUSE']` (`src/services/quotes/service.ts:34-49`). **Note: `CANCELED` / `EXPIRED` quotes are therefore absent from pool trade history** even though `HISTORY_QUOTE_STATUS` includes them.
- **Per-event mapping** (`:60-67`):
  ```ts
  const quote: HistoryQuote = toQuoteFromGraph(event.quote);
  applyHistoryCloseEventMetadata(quote, event.metadata, event.type);
  quote.statusModifyTimestamp = Number(event.timestamp);
  quote.closeEventType = event.type;
  quote.historyEventId = event.id;
  ```
  `applyHistoryCloseEventMetadata` (`src/utils/quoteEventMetadata.ts:52-94`) overlays the immutable event snapshot: forces `quoteStatus` from `EVENT_TYPE_TO_QUOTE_STATUS` (`:19-28`; all close types → `CLOSED`, all three liquidate types → `LIQUIDATED`), and, for snapshot-bearing types, sets `quantityToClose = closedAmount = fromWei(meta.amount)` (plus `liquidateAmount` when liquidated), `avgClosedPrice = fromWei(meta.closePrice)` (plus `liquidatePrice`), and `openedPrice = fromWei(meta.openedPrice)` — each only when `> 0`.
- **RQ**: key `['poolHistoryQuotes', symbolId, first, skip, orderBy, orderDirection]` (`:30`); `enabled: Boolean(symbolId && source)`; `staleTime: 30_000`; `refetchInterval: 60_000`; `fetchPolicy: 'no-cache'`.
- `first`/`skip` are **required** (no defaults); `orderBy='timestamp'`, `orderDirection='desc'` defaults.

##### 2.3 `useOpenOrders` — `.../hooks/useOpenOrders.ts`

- **HTTP**: `POST` via `SearchConditionalOrders(payload)` (`src/components/App/Pools/services/index.tsx:263-265`):
  ```ts
  return conditionalOrders.post<SearchConditionalOrdersResponse>(`/api/v4/search/`, payload);
  ```
- **Base URL constant**: axios instance `conditionalOrders` (`services/index.tsx:57-60`), `baseURL: TPSL_SERVICES[HedgerType.ENIGMA].domain`, timeout 20000. Resolves from `src/constants/misc.ts:45-51`:
  - `IS_SIMULATOR_MODE` → `SIMULATOR_TPSL_DOMAIN`
  - `IS_TEST_ENVIRONMENT` → `https://conditional-orders-handler-lowcap-stage.rasa.capital/api/v5/`
  - else → `https://conditional-orders-handler-lowcap85.rasa.capital/api/v5/`
- ⚠️ **URL bug**: baseURL already ends in `/api/v5/` and the request path is `/api/v4/search/`. axios `combineURLs` yields `https://conditional-orders-handler-lowcap85.rasa.capital/api/v5/api/v4/search/`. Duplicated `/api/vN` segment + v5-vs-v4 mismatch. (axios `^1.15.0`, `package.json:56`.) Consistent with the feature being shipped as "Coming Soon".
- **Request shape** `SearchConditionalOrdersPayload` (`services/types.ts:411-417`): `{ start: number; size: number; conditional_order_type?: string; state?: string[]; symbol_id?: number | null }`.
- **Response** `SearchConditionalOrdersResponse` (`:419-422`): `{ count: number; data: IConditionalOrder[] }`. `IConditionalOrder` (`:424-440`): `quote_id | null, coh_quote_id, party_a_address, symbol_id, conditional_order_type, quantity, price, conditional_order_price, order_type, state, action_price_type, position_type, leverage, create_time, modify_time` — `quantity`/`price`/`leverage` are `number` (already human units, no wei).
- **RQ**: key `['openOrders', payload]` — **the whole payload object is the key**, so `start`/`size` changes remount the query; `enabled: Boolean(payload.symbol_id)`; `staleTime: 30_000`; `refetchInterval: 60_000`. Returns `{ orders: query.data?.data ?? [], count: query.data?.count ?? 0, isLoading, isError, refetch }`.
- Auth: the `conditionalOrders` instance has **no** Authorization interceptor (only the `api` instance does, `services/index.tsx:62-77`).

##### 2.4 `useTransactionHistory` — `.../hooks/useTransactionHistory.ts`

- **HTTP**: `GET` via `GetTransactionHistory` (`services/index.tsx:236-249`):
  ```ts
  api.get<TransactionHistoryResponse>(`/market/transaction-history/${start}/${size}?${params}`);
  ```
  `params = constructQueryParams({ market_address, wallet_address })` — `constructQueryParams` (`src/utils/queryParams.ts`) drops `undefined`/`null`/`''`, so `wallet_address` disappears for the `All` filter. **Path template**: `{APP_POOLS_BACKEND_URL}market/transaction-history/{start}/{size}?market_address=…[&wallet_address=…]`.
- **Base URL constant**: `APP_POOLS_BACKEND_URL` (`src/constants/misc.ts:23-27`) = `https://listing-staging.enigma.bz/v2/` when `IS_BACKEND_STAGING_ENV`, else `https://listing85.enigma.bz/v2/` (both test and prod branches resolve to the same prod URL).
- **Auth**: `api` request interceptor (`services/index.tsx:62-77`) injects `Authorization: Bearer <listingAccessTokens[account]>` from `useUserStore`. Response interceptor (`:79-93`) clears the token on HTTP 401 and calls `captureAxiosError`.
- **Response** `TransactionHistoryResponse` (`services/types.ts:374-386`): `{ market_address: string; count: number; data: ITransactionHistory[] }`; `ITransactionHistory = { wallet_address, usdc_amount: string, token_amount: string, type: 'deposit'|'withdraw', status: 'pending'|'rejected'|'refund'|'success', time: number }` (`time` is unix seconds).
- **RQ**: key `['GetTransactionHistory', marketAddress, walletAddress, start, size]` (`:26`); `enabled: Boolean(marketAddress)`; `staleTime: 30_000`; **no `refetchInterval`**. Defaults `start = 0`, `size = 10`.
- Note: `PoolDetailTabs.tsx:68-70` calls the same hook with only `marketAddress` (→ key `[…, undefined, 0, 10]`) purely for the tab badge; when the table is on `All`/page 1 the keys coincide and RQ dedupes.
- Declared as `export const useTransactionHistory = (…) => {…}` — arrow-const, unlike the sibling `export function usePoolQuotes`.

##### 2.5 `useUserTransactions` — `src/services/pools/hooks/useUserTransactions.ts`

- **Not used by any Pool-detail table.** Its only consumer is `src/components/ReviewModal/RefundYourDepositModal/RefundYourDepositModal.tsx:8,35`.
- **HTTP**: `GET` via `getUserTransactions` (`src/services/pools/services.ts:38-64`):
  ```ts
  axios.get<SearchUserTransactionsResponse>(
    `${APP_POOLS_BACKEND_URL}market/user-transactions/${start}/${size}${params ? `?${params}` : ""}`,
    { headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` } },
  );
  ```
  Raw `axios` (not the shared `api` instance) with a manually attached bearer; `captureAxiosError(error, APP_POOLS_BACKEND_URL)` on failure.
- **Params** `GetUserTransactionsParams` (`src/services/pools/types.ts:11-23`): `accessToken`, `start?`, `size?`, `transaction_status?`, `transaction_type?`, `token_address?`, `token_name?`, `wallet?`, `chain_id?`, `create_time_gte?`, `create_time_lte?`. Defaults in the hook: `start = 0`, **`size = 150`**.
- **Response** `SearchUserTransactionsResponse` = `{ count: number; items: UserTransaction[] }` (`:40-43`); `UserTransaction` (`:25-38`) = `{ transaction_id, amount: string, transaction_type, transaction_status, create_time, token_address, chain_id, token_name, token_ticker, wallet, token_decimal, refund_address | null }` — a **different, richer shape** than `ITransactionHistory` (has `token_decimal` and `refund_address`, single `amount` instead of split `usdc_amount`/`token_amount`).
- **RQ**: key `['getUserTransactions', accessToken, start, size, rest]` (`:7`); `enabled: Boolean(accessToken && rest.token_address && rest.chain_id != null)`; **no `staleTime`, no `refetchInterval`** (RQ defaults).

---

#### 3. "Positions" vs "Open Quotes" vs "Open Orders" — the exact modelling difference

|                  | Positions                                                                                                   | Open Quotes                                                                                            | Open Orders (Limit Orders)                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Source of truth  | REST market-detail aggregate                                                                                | SYMMIO analytics **subgraph** `quotes`                                                                 | Conditional-Orders-Handler (COH) REST                                                                      |
| Endpoint         | `GET {APP_POOLS_BACKEND_URL}market?token_contract_address=…&deposit_chain=…` (`services/index.tsx:220-230`) | Goldsky `hyperevm_mainnet_analytics` GraphQL `PoolQuotes`                                              | `POST …/api/v4/search/`                                                                                    |
| Granularity      | **2 rows max**, aggregated per side                                                                         | **one row per on-chain quote**                                                                         | one row per pending conditional order                                                                      |
| Selector field   | `market.long_position_amount > 0` / `market.short_position_amount > 0` (`PoolPositionsTable.tsx:37,48`)     | `quoteStatus_in: [4,5,6]`                                                                              | `state: ['pending','new','triggered_pending']` + `conditional_order_type: 'send_quote'`                    |
| Status semantics | none — it is a sum, not a lifecycle object                                                                  | `OPEN_QUOTE_STATUS = [OPENED(4), CLOSE_PENDING(5), CANCEL_CLOSE_PENDING(6)]` (`src/types/quote.ts:17`) | off-chain COH `state` strings; the quote does not exist on chain yet (`quote_id: number \| null`)          |
| Side field       | string literal `'Longs' \| 'Shorts'`                                                                        | `item.positionType === PositionType.LONG` (enum `'LONG'\|'SHORT'`, `src/types/trade.ts:29-32`)         | `item.position_type === 0` (raw int; `getPositionTypeByIndex` maps `0→LONG`, `src/utils/quote.ts:273-275`) |
| Size expression  | `fromWei(market.long_position_amount)` — gross side exposure                                                | `quantity − closedAmount` (**remaining**, `PoolOpenQuotesTable.tsx:78`)                                | `item.quantity` (raw JSON number, un-scaled)                                                               |
| Time field       | none                                                                                                        | `statusModifyTimestamp` labelled "Open Time"                                                           | `create_time`                                                                                              |
| Leverage         | not shown                                                                                                   | `getQuoteLeverage(item)` chip                                                                          | `item.leverage` present in the type but **never rendered**                                                 |

Key semantics: the statuses `[0 PENDING, 1 LOCKED, 2 CANCEL_PENDING]` (`PENDING_QUOTE_STATUS`, `src/types/quote.ts:18`) — i.e. on-chain pending quotes — are shown in **no** pool-detail tab. "Open Orders" covers only the _pre-chain_ COH conditional orders, and "Open Quotes" covers only _filled and open_ quotes. So a submitted-but-unfilled on-chain quote is invisible on this page.

`QuoteStatus` numeric mapping used everywhere here comes from enum declaration order (`src/types/quote.ts:3-15`): `PENDING 0, LOCKED 1, CANCEL_PENDING 2, CANCELED 3, OPENED 4, CLOSE_PENDING 5, CANCEL_CLOSE_PENDING 6, CLOSED 7, LIQUIDATED 8, EXPIRED 9`, resolved at runtime via `Object.values(QuoteStatus).indexOf(s)` / `getQuoteStateByIndex` (`src/utils/quote.ts:277-279`) — a positional, declaration-order-fragile mapping.

---

#### 4. `StatusBadge.tsx` — exhaustive mapping

`statusMapper: Record<TransactionStatus, { color; bgColor; titleKey }>` (`StatusBadge.tsx:5-18`). `TransactionStatus = 'pending' | 'rejected' | 'refund' | 'success'` (`services/types.ts:371`). **All 4 members mapped; there are no other cases.**

| `status`   | `color`                              | `bgColor`                     | rendered label (`t(titleKey)`)      |
| ---------- | ------------------------------------ | ----------------------------- | ----------------------------------- |
| `pending`  | `var(--color-pending-base)`          | `bg-pending-fade`             | `Pending`                           |
| `success`  | `var(--color-brand-sub)`             | `bg-brand-fade`               | **`Completed`** (label ≠ key value) |
| `rejected` | `var(--color-additional-danger-400)` | `bg-additional-danger-400/15` | `Rejected`                          |
| `refund`   | `var(--color-neutrals-gray-100)`     | `bg-neutrals-dark-400`        | **`Refunded`**                      |

Render (`:29-33`): `<span className={cn('primary-caption-1-medium rounded-md px-2.5 py-1', info.bgColor)} style={{ color: info.color }}>`. Defensive `if (!info) return null` (`:27`) — unreachable given the exhaustive `Record`, i.e. dead branch unless the API returns an undeclared status.

**This badge is used only by the deposits/withdrawals table.** There is **no** quote/position→badge mapping anywhere in this slice: open quotes and trade history express state through arrow icon + text color, not a badge. `closeEventType` (`FILL_CLOSE` / `LIQUIDATE_PARTY_A` / …) is attached to every history row by `usePoolHistoryQuotes:64` and then **never rendered** by `PoolTradeHistoryTable` — no "Closed / Liquidated / ADL" column exists.

---

#### 5. Amount formatting, decimals, sign conventions

**Decimals source — three distinct regimes:**

1. **Wei (1e18) → human**: `fromWei(amount, decimals = 18)` (`src/utils/numbers.ts:46-53`) = `toBN(amount).div(BN_TEN.pow(18)).toString()`; returns `'0'` for `undefined/null/''` and `defaultOutput ?? '0'` for NaN strings. Used for: `PoolPositionsTable.tsx:41-44,51-55` (all 4 fields per side), `AmountCell.tsx:35-36`, and inside `toQuoteFromGraph` for every subgraph numeric (`src/apollo/service.ts:150-178`). **No `BigInt` / `viem formatUnits` anywhere in this slice — everything is `bignumber.js`.**
2. **Already-human numbers**: COH `IConditionalOrder.quantity/price` are used raw (`PoolOpenOrdersTable.tsx:63-65`).
3. **Display precision**: `symbolMarket?.quantityPrecision` / `symbolMarket?.pricePrecision` from `useMarket({ id: market.symbol_id })` (`src/types/market.ts:16`); when `symbolMarket` is undefined the value is `undefined` and `formatPrice` falls back to its own `decimalPoints = 2` (`src/utils/numbers.ts:120`). USD-ish columns use `DEFAULT_AMOUNT_PRECISION = 4` (`src/constants/misc.ts:116`); `AmountCell`'s USDC segment uses `DEFAULT_PRECISION = 2` (`:114`).

**`formatPrice` behavior** (`src/utils/numbers.ts:93-198`) — returns `{ price: string, priceValue: number|undefined }`; every call site in this slice reads `.price`:

- `null/undefined` or non-finite/NaN → `defaultValue` = `'-'`.
- **Default rounding is `'down'` → `BigNumber.ROUND_DOWN` (truncation)** (`:114`, `:171`). No call site in this slice overrides `roundingMode`.
- `useThousandsSeparator` defaults `true` → `toFormat(decimalPoints)` (`:180`), so trailing zeros are kept (`removeTrailingZeros` defaults false).
- `addDollarSign`: negatives render as `-$123.45` (sign hoisted before `$`, `:186-190`), positives `$123.45`.
- `showPlusSign` (unused here) would prefix `+`.

**Sign conventions:**

- **PnL (trade history)**: computed, not read. `pnl = isLong ? (closePrice - openPrice) * qty : (openPrice - closePrice) * qty` (`PoolTradeHistoryTable.tsx:132`). Rendered with `addDollarSign: false` + literal `USDC`, so the only sign is the numeric `-`. Color: `pnl >= 0 → text-main-light-blue`, else `text-main-pink` (`:133`) — **zero is colored as profit**.
- **UPNL (positions)**: read straight from `market.long_position_upnl` / `short_position_upnl`, rendered `addDollarSign: true`; color flips on `Number(item.upnl) < 0` (`PoolPositionsTable.tsx:127-129`).
- **Side**: `text-main-light-blue` = long, `text-main-pink` = short, in all four quote-ish tables.
- **Deposits/withdrawals** (`AmountCell.tsx:39-45,60-73`):
  ```ts
  const isWithdrawal = type === "withdraw";
  const isPending = status === "pending";
  const isPendingWithdrawal = isPending && isWithdrawal;
  const sign = isPendingWithdrawal ? "~" : isWithdrawal ? "-" : ""; // deposits get NO '+'
  ```
  Color: `isPendingWithdrawal → text-strong`, else `isWithdrawal → text-main-pink`, else `text-main-light-blue`.
  Two optional segments joined by `<span className="text-main-gray"> | </span>`: USDC segment rendered only when `isWithdrawal && usdcAmount > 0` (at `DEFAULT_PRECISION = 2`), token segment when `tokenAmount > 0` (at `DEFAULT_AMOUNT_PRECISION = 4`, unit `market.token_ticker ?? ''`). `AmountSegment` (`:16-24`) emits `sign + formatPrice(value, {decimalPoints, addDollarSign:false}).price + ' ' + <span className="text-main-gray">{unit}</span>`.
  Pending withdrawals also render a `CircleInfo` 16x16 button (`:74-78`) → `useToggleWithdrawalDetailModal()` (`src/stores/application/applicationHooks.ts:316-326`, `ApplicationModal.POOL_WITHDRAWAL_DETAIL`) with `{ entry: { daysLeft: getDaysLeft(time), tokenAmount, tokenTicker, usdcAmount, date: time }, market }`. `getDaysLeft` (`src/components/App/Pools/utils.ts:3-4`) = `Math.max(0, Math.ceil((createTime + WITHDRAWAL_COOLDOWN_DAYS*86400 - Date.now()/1000) / 86400))`, `WITHDRAWAL_COOLDOWN_DAYS = 14` (`src/components/App/Pools/constants.ts:3`).
- **Leverage**: `getQuoteLeverage` (`src/utils/quote.ts:59-72`) = `quantity * requestedOpenPrice / (initialCVA + initialPartyAMM + initialLF)` `.toFixed(0, ROUND_HALF_UP)` → integer string, rendered as `{leverage}x`.
- **Explorer link**: `getSymmioPositionUrl(chainId, item.id)` (`src/components/App/Pools/utils/explorerUtils.ts:34-39`) → `https://intent.symmscan.com/position-details/{TENANT}/{quoteId}`; tenant map `{ARBITRUM:'ARBITRUM', BASE:'BASE', BSC:'BNB', HYPEREVM:'HYPEREVM', SONIC:'SONIC'}` (`:26-32`). With `chainId = FALLBACK_CHAIN_ID = 999` this always resolves to `.../HYPEREVM/{id}`.

---

#### 6. Pagination workarounds, dead code, TODOs, stubs

##### 6.1 The trade-history pagination fix (branch `fix-pool-trade-history-table-pagination`)

The branch exists locally (`git branch` → `fix-pool-trade-history-table-pagination`), merged as PR #2834 (`d384e460b`); its commits are `5c6895fad` and `e95066a4f` ("fix: pools trade history table pagination"). `5c6895fad` touched exactly 4 files:

1. **`usePoolHistoryQuotes.ts` — created** (81 lines). Before the fix, history was fetched by `usePoolQuotes({ quoteStatuses: HISTORY_STATUS_NUMBERS, useQuoteEvents: true })`; the `useQuoteEvents` boolean branch inside `usePoolQuotes` was deleted and moved out.
2. **`usePoolQuotes.ts`** — the `useQuoteEvents?: boolean` param, its whole `quoteEvents` branch, and its presence in the query key were removed.
3. **`PoolDetailTabs.tsx`** — introduced `HISTORY_PAGE_SIZE = 10` / `HISTORY_FETCH_SIZE = 50`, `historyPage` state, `lastHistoryTotalCountRef`, and the two comment blocks. Dropped `HISTORY_STATUS_NUMBERS`.
4. **`PoolTradeHistoryTable.tsx`** — `interface Props extends PaginationProps`, added `page/setPage/perPage/totalCount` props and `noPaginationSetting`.

`HISTORY_FETCH_SIZE` was later raised `50 → 110` by an unrelated commit `701a6bfb1` ("fix: bug and improve posthog logging", 2026-06-01).

**The workaround itself** — `PoolDetailTabs.tsx:85-98`, verbatim comments included:

```ts
const historyPageData = useMemo(() => historyQuotes.slice(0, HISTORY_PAGE_SIZE), [historyQuotes]);
// Each request fetches FETCH_SIZE rows starting at skip; reporting skip + response.length
// as totalCount naturally exposes additional pages as the user advances, so the page
// count grows with selection instead of being frozen.
const computedHistoryTotalCount = (historyPage - 1) * HISTORY_PAGE_SIZE + historyQuotes.length;

if (!isHistoryQuotesLoading) {
  lastHistoryTotalCountRef.current = Math.max(lastHistoryTotalCountRef.current, computedHistoryTotalCount);
}
// Keep page controls stable during refetches — otherwise totalCount briefly collapses
// and the table shows the empty state while the next batch is in flight.
const historyTotalCount = isHistoryQuotesLoading
  ? Math.max(computedHistoryTotalCount, lastHistoryTotalCountRef.current)
  : computedHistoryTotalCount;
```

Mechanics: there is **no count endpoint** on the subgraph, so total is _synthesized_. Each page request over-fetches 110 rows at `skip = (page-1)*10` and **throws away 100 of them** (`historyPageData` keeps only the first 10). `totalCount` = `skip + returned.length`, so page 1 reports 110 → `lastPage = ceil(110/10) = 11`, and the horizon walks forward as the user pages. Consequences: the tab badge count (`PoolDetailTabs.tsx:107`) is a lower bound, not a real total (rendered as `+100` once >100 via `formatCount`); the pager never shows a truthful last page; the ratchet ref means the count can only grow within a session. `lastHistoryTotalCountRef.current` is **mutated during render** (`:91-93`) — not concurrent-safe.

Companion workarounds inside the shared component, same idea:

- `src/components/Table/index.tsx:226-239` — "Keep page controls stable while totals change during fetches." / "Avoid showing '1-0 of 0' when there is no data yet." / "Match the 'from' guard…"
- `src/components/Table/index.tsx:258` — "Prevent advancing when totals are temporarily unknown."
- `src/components/Table/index.tsx:265-267` — "Hide pagination when all rows fit on a single page. Keep it mounted on page > 1 so a transient dip in `total` (during refetch) doesn't yank the controls away."
- `src/components/Table/index.tsx:478` — `data.slice(totalCount ? 0 : (currentPage-1)*currentPerPage, currentPage*currentPerPage)`: the presence of `totalCount` is the implicit "server-paginated" switch. **Falsy-`0` hazard**: when a server-paginated table reports `totalCount === 0` (e.g. `PoolDepositsWithdrawalsTable`'s `transaction?.count ?? 0`, or `useOpenOrders`'s `count ?? 0`) the component silently reverts to client-side slicing of the server page.

##### 6.2 Dead / orphaned code

- **`PoolOpenOrdersTable.tsx` is entirely unreferenced.** Repo-wide grep finds the symbol only in its own file. `PoolDetailTabs.tsx:129-138` renders the "Coming Soon" block instead; the import was dropped in commit `fd076e6fb`. Its exclusive dependency `useOpenOrders` (and therefore `SearchConditionalOrders`, `SearchConditionalOrdersPayload/Response`, `IConditionalOrder`) is dead by transitivity.
- The `conditionalOrders` axios instance (`services/index.tsx:57-60,111-117`) exists only to serve that dead call.
- **`useUserTransactions` / `src/services/pools/services.ts::getUserTransactions`** are _not_ part of this slice despite the brief — sole consumer is `RefundYourDepositModal.tsx`.
- Commented-out columns kept in place rather than deleted: `PoolPositionsTable.tsx:70-72` + `:144-146` (`liqPrice/margin/funding` header + `<ComingSoonBadge/>` cells) and the matching `import { ComingSoonBadge }` commented at `:13`; identically `PoolOpenQuotesTable.tsx:45-48`, `:137-140`, `:17`.
- `StatusBadge.tsx:27` `if (!info) return null` — unreachable given an exhaustive `Record`.

##### 6.3 Stubs / "coming soon"

- `PoolOpenOrdersTable.tsx:99` — TP | SL column is a literal `- | -`.
- `ComingSoonColumnsPanel` (`src/components/App/Pools/components/ui/ComingSoonColumnsPanel.tsx`) is a fake 420px-wide right-hand table pane (`md:` only, `hidden` on mobile) that renders the _headers_ of unimplemented columns over a `Coming Soon` block: text `{{columns}} columns` + `will be available in the next update.` Mounted by positions (Liq. Price / Margin / Funding) and open quotes (UPNL (ROE%) / Liq. Price / Margin / Funding), and only when the table has rows.
- `PoolDetailTabs.tsx:106` — the Limit Orders badge count is hardcoded `0`.

##### 6.4 Other defects worth flagging

- **Duplicate React keys in trade history**: `PoolTradeHistoryTable.tsx:137` uses `key={item.id}` (= `Number(entity.quoteId)`), but the feed is `quoteEvents` — multiple partial closes of one quote produce multiple rows with the same `id`. `usePoolHistoryQuotes:65` already sets `quote.historyEventId = event.id`, documented in `src/types/quote.ts:114-115` as "unique per close event (supports multiple rows per quote id)", and it is unused here.
- **Precision loss in positions**: `PoolPositionsTable.tsx:37,41` does `const longSize = Number(market.long_position_amount)` then `fromWei(longSize)` — the wei string is coerced through a JS `number` (unsafe above 2^53) before division, while the sibling fields (`:42-44`) pass the raw string. Same at `:48,51`.
- **Sort does not reset the page**: `PoolOpenQuotesTable`'s `currentPage` state is untouched when `onSortChange` fires, so a re-sort keeps you on page N of a re-ordered list.
- **Split pagination in open quotes**: server-side `orderBy` + client-side slicing over a `first: 101` cap — quote #102+ is unreachable and uncounted.
- No `refetchInterval` on `useTransactionHistory` → the deposits/withdrawals tab and its badge only refresh on remount/focus, unlike every sibling.
- The trade-history feed excludes `CANCELED`/`EXPIRED` quotes (event-type filter, §2.2) even though the app's `HISTORY_QUOTE_STATUS` includes them.

---

#### 7. Cross-cutting: loading / empty / error contract

All five tables render through `ThemedTables.Simple` (`src/components/Table/index.tsx:395-677`). Its body has exactly three states (`:584-655`):

1. `isLoading` → single full-width row with `loadingComponent || <ThemedLoading.ThreeStaticDots size={6} color="var(--color-main-white)" />` inside a `min-h-[120px]` flex box.
2. `data && data.length > 0` → `displayData.map(renderRowContent)` (virtualization is available via `virtual` but **no pool table enables it**).
3. otherwise → the `emptyComponent`, centered with `py-14`. Every pool table supplies `EmptySleepingChepe` (`src/components/Table/index.tsx:378-393`) = `<LottieLoader name="_100_sleeping" height=144 width=100 />` + the message; the fallback (`Table` icon + `No data available`) is never reached here.

**There is no error state anywhere in this slice.** `usePoolQuotes` / `usePoolHistoryQuotes` / `useOpenOrders` / `useTransactionHistory` all return `isError`, and `grep -rn "isError" src/components/App/Pools/components/PoolDetail/` returns **zero hits** — a failed subgraph or REST call renders as an indistinguishable "empty" sleeping-Chepe. Likewise `refetch` is returned by all four hooks and never wired to a retry affordance in any table.

All five tables share `wrapperClassName="min-h-[200px]"`.

---

## 5. Create Pool wizard (permissionless listing)

### CREATE POOL wizard (permissionless listing) — Vibe-ui map

#### 0. Route, entry points, auth gate

| Thing                                                                                         | Anchor                                                                          |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Route constant `routes.pools.createPool = '/pools/create-pool'`                               | `src/constants/routes.ts:22`                                                    |
| Page = `<ListingAuthGuard><CreatePool /></ListingAuthGuard>`, default export `CreatePoolPage` | `src/pages/pools/create-pool.tsx:4-12`                                          |
| Entry 1: Discover tab "New Pool" button → `handleNewPool`                                     | `src/components/App/Pools/DiscoverPoolsContent.tsx:83-89`, button at `:159-169` |
| Entry 2: Your Pools tab "New Pool" button                                                     | `src/components/App/Pools/YourPoolsContent.tsx:80-86`, button at `:128-141`     |
| Entry 3: T&C modal "Agree & Continue" → `router.push(routes.pools.createPool)`                | `src/components/App/Pools/components/TermsAndConditionsModal/index.tsx:73-76`   |

`handleNewPool` is identical in both tabs: `if (hasSeenListingTerms) router.push(routes.pools.createPool) else toggleListingTermsAndConditions()`. `hasSeenListingTerms` is a persisted user-store bool (`src/stores/user/userTypes.ts:44`, `src/stores/user/user.ts:49,90`). Both New Pool buttons are `disabled={isLimitReached}` and wrapped in a `<Tooltip disabled={!isLimitReached} content={<WeeklyLimitTooltip …/>}>`.

**Auth gate** (`src/components/App/Pools/components/ListingAuthGuard.tsx`):

- Uses `useListingAuth()` → `{ isConnecting, isAuthenticated, triggerAuthFlow }` (`src/components/App/Pools/services/hooks/useListingAuth.ts:15-88`).
- `isAuthenticated = Boolean(account && activeAccount && accessToken)` (`useListingAuth.ts:24`), where `accessToken = useUserStore.use.listingAccessTokens()[account]` (`:21-22`).
- Auth ladder (`useListingAuth.ts:66-82`): not connected → `ApplicationModal.WAYS_TO_TRADE`; connected but no SYMMIO account → `ApplicationModal.CREATE_ACCOUNT`; account but no listing token → `ApplicationModal.LISTING_SIGNATURE_REQUEST`.
- Guard renders `null` while `!isAuthenticated` (`ListingAuthGuard.tsx:40-42`) — the wizard never mounts unauthenticated.
- If the user closes the auth modal without finishing: `router.replace({ pathname: routes.pools.index, query: { tab: 'discover' } }, undefined, { shallow: true })` (`ListingAuthGuard.tsx:31-38`).

**Listing login (SIWE-ish)** — `useListingLogin` (`src/components/App/Pools/services/hooks/useListingLogin.ts:17-50`), driven by `ListingSignatureRequestModal` (`src/components/App/Pools/components/ListingSignatureRequestModal/index.tsx:103`):

1. `GET /auth/sign-in-message?address={account}&domain={window.location.host}&uri={window.location.origin}` → `GetSignInMessageResponse { message, params: SignInMessageParams }` (`services/index.tsx:156-160`, types `services/types.ts:4-18`).
2. `signMessageCallback(message)` from `useSignMessageV2` (`src/callbacks/useSignMessage.ts:30-80`) — plain `personal_sign` via wagmi wallet client / Privy embedded wallet / Pimlico; **not** a contract call. Simulator mode returns `'0x' + '00'.repeat(65)` (`useSignMessage.ts:52-58`).
3. `POST /auth/login` body `{ message: params, signature }` → `LoginResponse { accessToken, tokenType }` (`services/index.tsx:162-164`).
4. `updateListingAccessToken(account, data.accessToken)` (`useListingLogin.ts:37`). Failure → toast `ToastType.ERROR`, title `'Listing Error'`, message `'Could not authenticate with the listing service.'`.

**Base URL / axios instances** (`src/components/App/Pools/services/index.tsx:41-60`):

- `api = axios.create({ baseURL: APP_POOLS_BACKEND_URL, timeout: 20000 })`.
- `APP_POOLS_BACKEND_URL` (`src/constants/misc.ts:23-27`) = `IS_BACKEND_STAGING_ENV ? 'https://listing-staging.enigma.bz/v2/' : IS_TEST_ENVIRONMENT ? 'https://listing85.enigma.bz/v2/' : 'https://listing85.enigma.bz/v2/'` (test and prod branches are identical — redundant ternary).
- `IS_BACKEND_STAGING_ENV = process.env.NEXT_PUBLIC_BACKEND_ENVIRONMENT === 'staging'`; `IS_TEST_ENVIRONMENT = process.env.NEXT_PUBLIC_IS_TEST_ENVIRONMENT === 'true'` (`src/constants/environment.ts:1-2`).
- `dexscreener = axios.create({ baseURL: 'https://api.dexscreener.com/latest', timeout: 20000 })` (`services/index.tsx:45-48`).
- Request interceptor injects `Authorization: Bearer ${listingAccessTokens[account]}` on every `api` call (`services/index.tsx:62-77`).
- Response interceptor: `captureAxiosError(err, APP_POOLS_BACKEND_URL)`; on **HTTP 401** it wipes the token via `updateListingAccessToken(account, '')` (`services/index.tsx:79-93`) — which flips `isAuthenticated` false and (via `CreatePool`'s effect) kicks the user out of the wizard.

**No on-chain reads or writes anywhere in this slice.** `grep` for `useReadContract|useWriteContract|readContract|writeContract|abi` across `CreatePool/`, `services/`, `utils/` returns nothing. The whole listing flow is REST + a manual off-chain token transfer to a custodial deposit address.

---

#### 1. The wizard step machine

Owner: `src/components/App/Pools/components/CreatePool/index.tsx`.

State: `const [activeStep, setActiveStep] = useState(1)` (`:30`) — 1-based, no URL sync, no persistence. `const [addMarketResponse, setAddMarketResponse] = useState<Partial<AddMarketResponse>>()` (`:31`).

Field groups gating advancement (`index.tsx:25-26`):

```ts
const STEP1_FIELDS: (keyof CreatePoolFormData)[] = ["TokenContractAddress", "DepositChain"];
const STEP2_FIELDS: (keyof CreatePoolFormData)[] = ["BuybackProfit", "MaxLeverage"];
```

Transitions (`index.tsx:48-64`):

```ts
const next = async () => {
  const fields = activeStep === 1 ? STEP1_FIELDS : STEP2_FIELDS;
  const ok = await methods.trigger(fields);
  if (ok) setActiveStep((s) => Math.min(3, s + 1));
};
const prev = (stepId: number) => setActiveStep(() => Math.max(1, stepId));
const onStepChange = async (stepId: number) => {
  if (stepId == activeStep) return;
  if (stepId > activeStep) {
    await next();
  } else {
    prev(stepId);
  }
};
```

Note `onStepChange` ignores the _magnitude_ of a forward jump — clicking step 3 from step 1 advances only to step 2.

Steps array (`index.tsx:66-74`):

| id  | title (desktop / mobile)     | component                                                           | advance control                                                                                            |
| --- | ---------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | `Token Basics` / `Basics`    | `<TokenBasics onStepChange={() => onStepChange(activeStep + 1)} />` | in-component `Continue` button (`TokenBasics.tsx:139-148`)                                                 |
| 2   | `Pool Settings` / `Settings` | `<MarketSettings />`                                                | `Create Pool` button in the wizard shell (`index.tsx:160-168`), `onClick={methods.handleSubmit(onSubmit)}` |
| 3   | `Deposit`                    | `<Review addMarketResponse={addMarketResponse} />`                  | `Done` button → `goBackToPoolsList()` (`index.tsx:170-179`)                                                |

**Step-1 gate** — two independent conditions:

- RHF: `trigger(['TokenContractAddress','DepositChain'])` — both `required` (messages `'Token contract address is required'` `TokenBasics.tsx:97`, `'Deposit chain is required'` `TokenBasics.tsx:87`). There is **no format/regex/checksum validation** of the address; a Solana base58 address and an EVM 0x address pass the same rule.
- Button disable predicate (`TokenBasics.tsx:144`): `disabled={(!isSupported && !isCreatedMarket) || isLimitReached || isOpeningDeposit}`.

**Step-2 gate**: `trigger(['BuybackProfit','MaxLeverage'])` with the rules in §4. But the real forward move on step 2 is the _submit_ (POST `/market/add-market`), and `next()` is called only from `onSuccess` (`index.tsx:92`).

**Step-3**: terminal. `Math.min(3, …)` caps it. `prev()` still lets you click back to steps 1/2 _after_ creation and re-submit — nothing locks the form once `addMarketResponse` is set.

**Stepper UI** — `src/components/App/Pools/components/CreatePool/components/Stepper/index.tsx`. Exports `Stepper` (named). Local interfaces `IStep { id: number; title: string }`, `StepperProps { steps, orintation?: 'vertical'|'horizontal' (sic, typo), activeStep, onStepChange? }`. Every step row is `onClick={() => onStepChange?.(step.id)}` and `cursor-pointer` — **all three steps are always clickable, with no completed/locked state**.

##### Gating holes worth flagging

1. **The Stepper bypasses the `isSupported` gate.** Clicking step 2 in the Stepper from step 1 calls `next()`, which only runs `methods.trigger(STEP1_FIELDS)`. An address that failed `token-support` (or was never validated) still advances, because `isSupported` is only consulted by the `Continue` button's `disabled` prop (`TokenBasics.tsx:144`). Same for `isLimitReached` — the weekly limit gate is button-only.
2. **The Stepper can skip the create request.** From step 2, clicking step 3 runs `next()` → `trigger(STEP2_FIELDS)` → `setActiveStep(3)` without ever calling `mutate`. `Review` then renders with `addMarketResponse === undefined`: `QrCodeWithLogo({ content: undefined as string })` (`Review.tsx:32`), `truncateAddress(undefined?.toString(), 6)` (`Review.tsx:92`), `"Only deposit undefined to this address."`.
3. **The existing-market branch has no step semantics.** When `isCreatedMarket`, the step-1 button label becomes `Deposit` and its onClick becomes `openDepositModal()` (`TokenBasics.tsx:141,146`) — a modal, not a step transition. The Stepper still lets you walk into steps 2/3 for a market that already exists.
4. `<form onSubmit={(e) => e.preventDefault()}>` (`index.tsx:157`) with the real handler commented out one line below (`index.tsx:158`): `{/* <form className="flex flex-col h-full justify-between" onSubmit={methods.handleSubmit(onSubmit)}> */}`. Enter-key submit is dead by design; submission is button-only.

---

#### 2. Full form model

Type (`src/components/App/Pools/types.ts:1-6`):

```ts
export type CreatePoolFormData = {
  TokenContractAddress: string;
  BuybackProfit: string;
  MaxLeverage: string;
  DepositChain: number;
};
```

Form config (`index.tsx:40-46`):

```ts
const methods = useForm<CreatePoolFormData>({
  mode: "onTouched",
  shouldUnregister: false, // keep values when steps unmount
  defaultValues: { MaxLeverage: "20" },
});
```

| Field                  | Declared type | Runtime type                                         | Default     | Unit                         | Input component                                          | Validation rules                                                                          | → payload key            |
| ---------------------- | ------------- | ---------------------------------------------------- | ----------- | ---------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------ |
| `DepositChain`         | `number`      | `number` (enum ordinal / chain id)                   | _undefined_ | chain id                     | `SearchableSelectForm` (`TokenBasics.tsx:82-92`)         | `{ required: t('Deposit chain is required') }`                                            | `deposit_chain`          |
| `TokenContractAddress` | `string`      | `string`                                             | _undefined_ | raw address string           | `TextInput` + `register(...)` (`TokenBasics.tsx:94-103`) | `{ required: t('Token contract address is required') }`                                   | `token_contract_address` |
| `BuybackProfit`        | `string`      | **`number`** (PresetInput coerces)                   | _undefined_ | percent (0–100, integer)     | `PresetInput` (`MarketSettings.tsx:14-50`)               | `required` + `min 0` (`'Must be at least 0%'`) + `max 100` (`'Cannot be more than 100%'`) | `buy_back_ratio`         |
| `MaxLeverage`          | `string`      | `'20'` initially, **`number`** after any slider drag | `'20'`      | x-multiplier (1–20, integer) | `SliderInput` (`MarketSettings.tsx:51-60`)               | `required` + `min 1` (`'Must be at least 1'`) + `max 20` (`'Cannot be more than 20'`)     | `max_leverage`           |

The declared `string` types for `BuybackProfit`/`MaxLeverage` are a **type lie**: `PresetInput` does `field.onChange(val === '' ? '' : Number(val))` (`PresetInput.tsx:49`) and `setValue(name, preset.value)` with a `number` behind `//@ts-ignore` (`PresetInput.tsx:62-63`); `SliderInput` does `field.onChange(val[0])` where `val: number[]` (`SliderInput.tsx:35`).

**Chain options** — `DEPOSIT_CHAIN_OPTIONS` (`src/components/App/Pools/constants.ts:6-12`), values from `enum DepositChain` (`types.ts:73-79`):

| label        | value                               | logo                             |
| ------------ | ----------------------------------- | -------------------------------- |
| Solana       | `DepositChain.Solana = 0`           | `/static/images/chains/SOL.svg`  |
| Base         | `DepositChain.Base = 8453`          | `/static/images/chains/BASE.svg` |
| BSC          | `DepositChain.BSC = 56`             | `/static/images/chains/BSC.png`  |
| Sonic        | `DepositChain.SONIC = 146`          | `/static/images/chains/S.svg`    |
| Arbitrum one | `DepositChain.ARBITRUM_ONE = 42161` | `/static/images/chains/ARB.svg`  |

Solana is `0`, so every `enabled` / truthiness check must use `chain != null` — and the hooks do (`useTokenMetaData.ts:21`, `useTokenValidate.ts:26`, `TokenBasics.tsx:62`). But `useAddDeposit` is fed `deposit_chain: DepositChain ?? 0` (`TokenBasics.tsx:73`), which silently means "Solana" when the chain is unset.

Placeholder for the chain select is `t('e.g. Solana')` and `searchable={false}`, `logoOnly={false}` (`TokenBasics.tsx:86-91`).

##### Payload mapping (`index.tsx:108-119`)

```ts
const onSubmit = (data: CreatePoolFormData) => {
  console.log("Final data:", data); // ← debug leftover, ships to prod
  const payload: AddMarketPayload = {
    buy_back_ratio: Number(data.BuybackProfit),
    is_tax: false, // hardcoded
    deposit_chain: data.DepositChain,
    max_leverage: Number(data.MaxLeverage),
    token_contract_address: data.TokenContractAddress,
    user_whitelist_tax: false, // hardcoded
  };
  mutate({ payload });
};
```

`AddMarketPayload` (`services/types.ts:155-162`) has exactly six keys — `token_contract_address`, `is_tax`, `user_whitelist_tax`, `buy_back_ratio`, `max_leverage`, `deposit_chain`. **`is_tax` and `user_whitelist_tax` are never surfaced in the UI** — no input exists for either; both are pinned `false`. The wizard collects no token name/ticker/decimals — the backend derives those from `token-meta-data`.

---

#### 3. Token validation

##### `useTokenValidate` — `src/components/App/Pools/services/hooks/useTokenValidate.ts`

File header comment says `// useValidateAndFetchTokenMetaData.ts` (stale filename). Input: `{ tokenAddress?: string; chain: number | null }`. Fires **three** react-query queries:

**(a) Support check — the gate.**

```
GET {APP_POOLS_BACKEND_URL}/market/token-support?contract_address={contract_address}&chain={chain}
```

`services/index.tsx:195-197`, `TokenSupport(...)` returns `api.get<string>` (response body typed as a bare `string`; nothing consumes the body).

- queryKey `['checkTokenSupport', tokenAddress, chain]` (`useTokenValidate.ts:18`)
- `enabled: Boolean(tokenAddress && chain != null)` (`:26`); `retry: false` (`:27`); no `staleTime`/`refetchInterval`
- Typed as `useQuery<string, AxiosError<TokenSupportError>>`
- Exposed as `isValidating = isLoading`, `isSupported = isSuccess`, `validationError = error`

**Acceptance rule: a token is "acceptable" iff `GET /market/token-support` returns 2xx.** There is zero client-side heuristic (no liquidity floor, no market-cap floor, no address checksum). `isSupported` drives (i) the green `CircleCheckmark` in the address input's `leftItem` (`TokenBasics.tsx:102`), (ii) `enabled` for the two enrichment queries, (iii) the `Continue` button's disabled state.

**(b) Metadata.**

```
GET {APP_POOLS_BACKEND_URL}/market/token-meta-data?contract_address={contract_address}&chain={chain}
```

`services/index.tsx:189-193` → `GetTokenMetaDataResponse { token_contract_address, chain, token_name, token_ticker, decimals, price }` (`services/types.ts:202-209`).

- queryKey `['tokenMetaData', tokenAddress, chain]` (`:36`), `enabled: isSupported` (`:44`), `retry: false`, `staleTime: 1000 * 60 * 5` (5 min)
- Exposed as `metaData`, `isMetaLoading`, `metaError`, `isMetaSuccess`

**(c) DexScreener market stats.**

```
GET https://api.dexscreener.com/latest/dex/tokens/{contract_address}
```

`services/index.tsx:199-201` → `GetTokenDexScreenerDataResponse { schemaVersion, pairs: DexScreenerPair[] }` (`services/types.ts:220-243`).

- queryKey `['tokenDexScreenerData', tokenAddress]` — **no `chain` in the key** (`:50`), `enabled: isSupported`, `retry: false`, `staleTime: 5 min`
- Reduction (`useTokenValidate.ts:56-70`): pick the pair with the highest `liquidity.usd` (`bestLiquidity = bestPair?.liquidity?.usd || 0`), then return `{ totalMarketCap: highestLiquidityPair?.marketCap || 0, totalLiquidity: highestLiquidityPair?.liquidity?.usd || 0 }`. Despite the `total*` names it is **single-pair**, not a sum across pairs.

Return shape (`useTokenValidate.ts:77-86`): `{ isValidating, validationError, isSupported, isDataLoading: isMetaLoading || isDexScreenerLoading, metaError, isMetaSuccess, metaData, DexScreenerData }`. `isDataLoading`, `metaError`, `isMetaSuccess` are **unused by the only consumer** (`TokenBasics.tsx:41` destructures only `isValidating, validationError, metaData, DexScreenerData, isSupported`).

##### Debouncing

`const [debouncedToken] = useDebounceValue(tokenAddress, 1200)` from `usehooks-ts` — comment `// ⏳ 1.2s debounce` (`TokenBasics.tsx:39`). All three validation queries and the existing-market query key off `debouncedToken`; the chain (`DepositChain`) is **not** debounced.

##### Existing-market pre-check (`TokenBasics.tsx:46-69`)

```
GET {APP_POOLS_BACKEND_URL}market/search?limit=20&offset=0&query={debouncedToken}
```

via `getMarketSearch({ query: debouncedToken, limit: 20, offset: 0 })` (`services/index.tsx:120-136`; query string built by `constructQueryParams`, `src/utils/queryParams.ts:1-14`, which drops `undefined|null|''`).

- queryKey `['existingCreatePoolMarket', debouncedToken, DepositChain]`, `enabled: Boolean(debouncedToken && DepositChain != null)`, `retry: false`, `staleTime: 30_000`
- Client-side match: `item.contract_address.toLowerCase() === debouncedToken!.toLowerCase() && item.chain_id === DepositChain`, else `null`
- Derived flags: `isCreatedMarket = existingMarket && existingMarket.market_status !== MarketStatus.Delisted` (`:66`); `isLiveMarket = market_status === MarketStatus.Listed` (`:68`); `isPendingMarket = market_status === MarketStatus.WaitingForDeposit` (`:69`, computed and passed to `ExistingPoolNotice` but **never read inside it** — dead prop, `TokenBasics.tsx:157,160`)
- `MarketStatus` enum (`types.ts:56-62`): `waiting_for_deposit | under_review | rejected | listed | delisted`

##### Error surfaces under the address field (`TokenBasics.tsx:105-134`), in priority order

1. `isValidating` → `<ThemedLoading.ThreeStaticDots size={4} color="var(--color-main-white)" /> {t('Validation')}`
2. `isExistingMarketLoading` → same dots + `t('Checking existing pool')`
3. `isCreatedMarket` → `<ExistingPoolNotice />` (see below)
4. `validationError?.response?.data.error_code === SUPPORT_TOKEN_ERROR.UNSUPPORTED_TOKEN` → red `CircleX` + i18n key `"We do not currently support this token. Please enter a supported token. <link>Get in touch</link>"` linking to `https://discord.gg/bTRU8EQCzq`
5. otherwise `''`

`SUPPORT_TOKEN_ERROR.UNSUPPORTED_TOKEN = 26` — `const enum` (`types.ts:53-55`). `TokenSupportError { error_code: number; error_detail: null|string|number; error_message: string }` (`services/types.ts:212-216`). **Any other `error_code` (or a network failure) renders nothing at all** — the button just stays disabled with no explanation.

RHF's own `errors.TokenContractAddress` / `errors.DepositChain` messages render inside `TextInput` (`TextInput.tsx:25`) and `SearchableSelectBase` (`SearchableSelect.tsx:166`) as `text-additional-danger-400 text-caption-2`.

##### `ExistingPoolNotice` (`TokenBasics.tsx:153-303`) — local, non-exported

Two visual variants keyed on `isLiveMarket`:

- **Listed**: blue (`rgba(41,98,255,…)`), label `t('Listed')`, headline `'This market is already live. Deposit directly instead of creating.'`, sub `'You can add liquidity now and earn fees as an LP.'`, plus a 4-stat grid — `APR` (`market.apr`), `Liquidity` (`market.liquidity`), `24h Vol` (`market.vol24h`), `Reward 24h` (`market.reward_24h`), each `formatPrice(marketSearchWeiToDisplay(x), { addDollarSign, decimalPoints, abbreviate: true }).price`. `marketSearchWeiToDisplay` = `fromWei(value)` with 18 decimals, `undefined` for null/empty (`src/components/App/Pools/utils/listingSearchMetrics.ts:3-6`; `fromWei` at `src/utils/numbers.ts:46-53`). Note APR is passed `addDollarSign: false` but is still divided by 1e18 as if it were a wei-scaled fraction.
- **Not listed** (amber `rgba(255,180,84,…)`): label `t('Pending Activation')`, headline `"Market exists but trading hasn't started."`, sub `'A small deposit of $5 or more will activate the market for everyone. Once active, you earn fees as an LP.'` — the `$5` is **hardcoded in the string**, not interpolated from `MIN_POOL_DEPOSIT_AMOUNT`. Uses a styled-jsx keyframe `existingPoolPendingPulse` (`:283-300`).

Helper `NoticeStat({ label, value, first })` (`TokenBasics.tsx:305-312`), also local.

##### `useTokenMetaData` — `src/components/App/Pools/services/hooks/useTokenMetaData.ts`

Standalone wrapper over the same endpoint, used only by `Review` (`Review.tsx:24-27`).

- `UseTokenMetaDataProps { accessToken?: string; tokenAddress?: string; chain: number | null }` — **`accessToken` is declared but never destructured or used** (`:6`, `:11`)
- queryKey `['tokenMetaData', tokenAddress, chain]` — _identical key to `useTokenValidate`'s (b)_, so `Review` reads from cache with no refetch (5-min `staleTime`); `enabled: Boolean(tokenAddress && chain != null)` (broader than the `enabled: isSupported` used in `useTokenValidate` — same cache entry, two different enable predicates)

##### `TokenDetails` panel — `src/components/App/Pools/components/CreatePool/components/TokenDetails.tsx`

Default export, rendered at `TokenBasics.tsx:135-137` inside a `mt-8` wrapper. Props: `{ metaData: GetTokenMetaDataResponse | undefined; dexScreenerData: { totalMarketCap: number; totalLiquidity: number } | undefined }`. Rows: `Token Detail` → `token_name (token_ticker)`; `Chain` → logo+label resolved by `DEPOSIT_CHAIN_OPTIONS.find(ch => ch?.value == metaData?.chain)` (loose `==`); `Price` (only when `metaData?.price` truthy) → `` `$${Number(metaData?.price).toPrecision(3)}` ``; `Mkt. Cap` → `formatPrice(dexScreenerData?.totalMarketCap, { addDollarSign: true, decimalPoints: 2, abbreviate: true }).price` else `'-'`; `Liquidity` likewise. The card renders unconditionally — with no token entered it shows an empty header and `'-'` for both metrics.

---

#### 4. Market settings math

`src/components/App/Pools/components/CreatePool/components/MarketSettings.tsx` — default export, no props, reads `errors` from `useFormContext<CreatePoolFormData>()`.

##### Buyback Profit — `PresetInput`

```tsx
<PresetInput
  name="BuybackProfit"
  rules={{ required: t('Buyback Profit is required'),
           min: { value: 0, message: t('Must be at least 0%') },
           max: { value: 100, message: t('Cannot be more than 100%') } }}
  id="buybackProfit" type="number" placeholder={t('e.g. 5%')}
  error={errors.BuybackProfit} label={t('Buyback Profit')}
  presets={[{title:'10%',value:10},{title:'25%',value:25},{title:'33%',value:33},{title:'50%',value:50},{title:'100%',value:100}]}
  description={<Trans i18nKey="This is the percentage of profit used to buy back your token to add to liquidity. <link>What is this?</link>" … href="https://discord.gg/bTRU8EQCzq" />}
/>
```

(`MarketSettings.tsx:14-50`.)

`PresetInput` internals (`src/components/App/Pools/components/FormInputs/PresetInput.tsx`) — default export `PresetInput`, also exports type `InputProps<TFieldValues, TName>` extending `React.InputHTMLAttributes<HTMLInputElement>` with `{ label?, error, name, rules?, presets: {title:string; value:number}[], description?: React.JSX.Element }`.

- **Input clamp/sanitize (`:45-51`)**: `const val = e.target.value; if (/^\d*$/.test(val)) { field.onChange(val === '' ? '' : Number(val)) }` — any non-match is _dropped entirely_ (the keystroke is swallowed, RHF state unchanged). This is a **digits-only integer filter**: no decimals (`5.5` rejected), no sign, no exponent. `''` is allowed through as the empty string, which then trips `required`.
- The `max: 100` rule is _not_ enforced at the input level — you can type `999`; only the RHF `max` rule flags it, and only on touch/submit (`mode: 'onTouched'`).
- **Preset buttons (`:57-71`)**: `onClick={() => setValue(name, preset.value, { shouldValidate: true })}` behind `//@ts-ignore` (`:62`). Selected state = `value === preset.value` with `value = watch(name)` — strict `===` on a number, so it only highlights because the change handler coerces to `Number`. Grid is hardcoded `grid-cols-5`.
- No formula, no derived notional cap, no fee math anywhere in this component.

##### Max Leverage — `SliderInput`

```tsx
<SliderInput
  label={t("Max Leverage Offered To Traders")}
  rules={{
    required: t("Max leverage is required"),
    min: { value: 1, message: t("Must be at least 1") },
    max: { value: 20, message: t("Cannot be more than 20") },
  }}
  name="MaxLeverage"
  error={errors.MaxLeverage}
/>
```

(`MarketSettings.tsx:51-60`.)

`SliderInput` internals (`src/components/App/Pools/components/FormInputs/SliderInput.tsx`) — default export; `InputProps` here is _not_ an HTML input props extension, just `{ label?, error, name, rules? }`.

- Radix slider config (`:32-39`): `value={field.value ? [Number(field.value)] : [5]}`, `onValueChange={(val) => field.onChange(val[0])}`, `min={1} max={20} step={1}` → integers 1..20 only; the clamp is the Radix primitive's, not code.
- Read-out box (`:41-42`): `{field.value ?? 5}` then a static `X`.
- **Three inconsistent defaults**: the form default is `'20'` (`index.tsx:44`), the slider's falsy-fallback is `[5]`, the read-out's nullish-fallback is `5`. Since `'20'` is truthy the initial render is coherent at 20, but any falsy value (`''`, `0`) desyncs the thumb (`[5]`) from the label (`0`).
- **Tick labels are hardcoded and misaligned** (`:46-53`): `2 / 5 / 10 / 15 / 20` rendered as a `justify-between` row over `w-[calc(100%-56px)]`, while the track runs 1→20. The first tick reads "2" for a slider whose minimum is 1, and the intermediate ticks are evenly spaced rather than positioned at their values. Colors: `2` = `text-main-light-blue`, `5` = `text-neutrals-dark-300`, `10` = `text-main-pink`, `15` = `text-neutrals-dark-300`, `20` = `text-additional-danger-400`.
- Underlying `Slider` (`src/components/App/Pools/components/ui/Slider/index.tsx:5-53`) is a thin `@radix-ui/react-slider` wrapper with `min = 0`, `max = 100` defaults (overridden here) and a `_values` memo that falls back to `[min, max]` (two thumbs) when neither `value` nor `defaultValue` is an array.

**There is no notional-cap input, no fee input, no maintenance-margin or funding input in this wizard.** The only two economic knobs are `buy_back_ratio` (%) and `max_leverage` (x). Everything else about the resulting market is decided server-side.

##### The other two FormInputs

- `TextInput` (`FormInputs/TextInput.tsx`) — arrow-const default export, `InputProps = React.InputHTMLAttributes<HTMLInputElement> & { label?, error?, leftItem? }`. Uncontrolled: it is spread with `{...register(...)}` at `TokenBasics.tsx:96-98`. `leftItem` slot holds the validation checkmark.
- `NumberInput` (`FormInputs/NumberInput.tsx`) — **dead code**. `grep -rn "NumberInput" src` matches only its own file. Same coercion pattern as `PresetInput` minus the regex: `field.onChange(val === '' ? '' : Number(val))` (`:33-36`).
- `SearchableSelect` (`FormInputs/SearchableSelect.tsx`) exports `OptionValue = string | number`, `ControlledProps`, `SearchableSelectBase`, `SearchableSelectForm`; internal `Option`, `BaseProps`, `UncontrolledProps`, `const PLACEHOLDER_LOGO_COUNT = 4` (`:45`). `SearchableSelectForm` (`:192-210`) wraps `Base` in an RHF `Controller`. **Gotcha:** `SearchableSelectBase` keeps its _own_ `useState` copy of the value (`:65`) seeded once from `externalValue`; it never syncs on prop change, so an RHF `reset`/`setValue` on `DepositChain` would not move the visible selection. `error` is passed through the `//@ts-ignore` at `TokenBasics.tsx:84` because `errors.DepositChain` for a `number` field doesn't structurally match `FieldError`. Multi-select chips + `CommandInput` search exist but are off here (`searchable={false}`, `multiple` defaults `false`).

---

#### 5. The submit path

##### 5.1 The single create request

Fired from the wizard shell's `Create Pool` button on **step 2** (`index.tsx:160-168`) → `methods.handleSubmit(onSubmit)` → `mutate({ payload })`.

```
POST {APP_POOLS_BACKEND_URL}/market/add-market
Authorization: Bearer <listingAccessTokens[account]>
Content-Type: application/json
```

`AddMarket({ payload })` at `services/index.tsx:166-168` → `api.post<AddMarketResponse>('/market/add-market', payload)`.

Request body (`AddMarketPayload`, `services/types.ts:155-162`):

```json
{ "token_contract_address": "<string>", "is_tax": false, "user_whitelist_tax": false,
  "buy_back_ratio": <number 0-100>, "max_leverage": <number 1-20>, "deposit_chain": <0|56|146|8453|42161> }
```

Response (`AddMarketResponse`, `services/types.ts:164-183`): `token_contract_address, user_address, token_name, token_ticker, is_tax, user_whitelist_tax, buy_back_ratio, max_leverage, deposit_chain, deposit_amount, field_amount, additional_chains, wallet_public_key, main_pool, cex_list, token_decimal, market_status, deposit_status`.

There is **exactly one** request on submit. No pre-flight, no signature, no transaction. The mutation is `useMutation({ mutationFn: AddMarket, … })` at `index.tsx:80-106` — note `mutate` is destructured but **`isPending` is not**, so the `Create Pool` button is never disabled while in flight (double-submit is possible).

##### 5.2 onSuccess (`index.tsx:82-93`) — invalidations, in order

```ts
queryClient.invalidateQueries({ queryKey: ["getMarketSearch"], refetchType: "all" });
queryClient.invalidateQueries({ queryKey: ["getUserMarketSearch"], refetchType: "all" });
queryClient.invalidateQueries({ queryKey: ["discoverPoolsCount"], refetchType: "all" });
setAddMarketResponse({ token_ticker, deposit_amount, wallet_public_key, deposit_chain });
next(); // → step 3
```

Targets:

- `['getMarketSearch', query, size, start, searchTerm, statusFilter, sortBy, orderBy, filters]` — `useDiscoverMarketSearch` (`services/hooks/useDiscoverMarketSearch.ts:58`), `staleTime: 0`, `refetchInterval: 90_000`
- `['getUserMarketSearch', accessToken, account, query, size, start, searchTerm, statusFilter, sortBy, orderBy]` — `useYourPoolsMarketDeposits` (`services/hooks/useYourPoolsMarketDeposits.ts:31-42`), `staleTime: 0`, `refetchInterval: 90_000`, `enabled: Boolean(accessToken && account)`
- `['discoverPoolsCount']` — `useDiscoverPoolsCount` (`services/hooks/useDiscoverPoolsCount.ts:10`), `staleTime: Infinity` with all `refetchOn*: false`

**Not invalidated**: `['weeklyListingLimit']` (so the remaining-slots counter stays stale until its own 30 s `staleTime`/`refetchInterval` fires), and `['existingCreatePoolMarket', …]` (so re-entering the same address within 30 s still says "no existing pool").

Only 4 of the 18 response fields are kept: `token_ticker`, `deposit_amount`, `wallet_public_key`, `deposit_chain`. Of those, **`deposit_amount` is stored and never rendered** — `grep -rn "deposit_amount" src` matches only `index.tsx:88` and the type. The Review step shows the hardcoded `MIN_POOL_DEPOSIT_AMOUNT = 5` instead of the server-returned amount.

`next()` is reused for the post-submit advance, so it re-runs `methods.trigger(STEP2_FIELDS)` before advancing (harmless, already valid).

##### 5.3 onError (`index.tsx:94-105`)

```ts
addPopup({
  content: {
    toastType: ToastType.ERROR,
    props: {
      errorTitle: t("Create new pool error"),
      //@ts-ignore
      errorMessage: error.response?.data?.error_message,
    },
  },
});
```

Raw backend `error_message` surfaced verbatim via the application-store popup; `//@ts-ignore` at `:100` because `AxiosError`'s `data` is `unknown`. No retry affordance, no field-level mapping, and the user stays on step 2 with the form intact.

##### 5.4 Where the deposit address comes from

`addMarketResponse.wallet_public_key` — a **custodial address minted by the listing backend**, one per (token, chain, user). It is rendered in `Review` (`src/components/App/Pools/components/CreatePool/components/Review.tsx`):

- QR built client-side with `qrcode-with-logos`: `new QrCodeWithLogo({ content: addMarketResponse?.wallet_public_key as string, nodeQrCodeOptions.color { dark:'#00000000', light:'#00000000' }, cornersOptions { type:'rounded', color:'#ffffff' }, dotsOptions { color:'#ffffff', type:'dot' }, width: 300, logo: { src: DEPOSIT_CHAIN_OPTIONS.find(ch => ch.value == addMarketResponse?.deposit_chain)?.logo || '', bgColor:'#ffffff00', borderWidth: 0 } })` → `.getCanvas().then(c => c.toDataURL()).then(setQRImageUrl)` (`Review.tsx:30-60`). Effect deps `[addMarketResponse?.deposit_chain, addMarketResponse?.wallet_public_key]`; the promise chain has **no `.catch`** and no unmount guard.
- Copy affordance: `<CopyToClipboard text={addMarketResponse?.wallet_public_key as string} …>` with `truncateAddress(…, 6)` (`Review.tsx:87-92`).
- Warning banner `t('Only deposit {{tokenTicker}} to this address.', { tokenTicker: addMarketResponse?.token_ticker })` (`Review.tsx:85`).
- Summary rows read from `getValues()` (`Review.tsx:23`) — `Token` (`meta?.token_name (meta?.token_ticker)` from the cached `useTokenMetaData`), `Chain`, `Token Address` (`truncateAddress(TokenContractAddress, 6)`), `${token_ticker} Buyback` → `{BuybackProfit}%`, `Max Leverage` → `{MaxLeverage}x` in a `tag tag-primary` pill.
- `<MinDepositWarning className="mb-3 lg:mt-auto" />` (`Review.tsx:145`).
- Header copy (desktop only): `t('Your market is automatically listed and will go live after a quick system check. Please review details before depositing.')` (`Review.tsx:71-74`).

**The deposit itself is entirely out-of-band.** The wizard never watches for the transfer; the only completion signal is the `Done` button, which just navigates away (`index.tsx:172`). There is no polling of `market/search` for `market_status` transitioning `waiting_for_deposit → under_review → listed`.

`MinDepositWarning` (`src/components/App/Pools/components/MinDepositWarning.tsx`) — named export, `Props { className?: string }`, renders `CircleInfo` + `t('Minimum deposit amount is ${{amount}}.', { amount: MIN_POOL_DEPOSIT_AMOUNT })`; `MIN_POOL_DEPOSIT_AMOUNT = 5` (`constants.ts:4`). Also used by `ListingDepositModal` (`ListingDepositModal/index.tsx:108`).

##### 5.5 The _other_ submit path — `useAddDeposit` (existing market)

`src/components/App/Pools/services/hooks/useAddUserDeposit.ts` (file name ≠ export name). Export: `useAddDeposit`.

Params: `{ token_contract_address: string; tokenName: string; deposit_chain: number; status: MarketStatus; refetchPoolsData?: () => void }`. **`status` is in the type but never destructured or used** (`:18`) — dead parameter, and `TokenBasics.tsx:75` computes a value for it (`(existingMarket?.market_status as MarketStatus) ?? MarketStatus.Listed`) that goes nowhere.

```
POST {APP_POOLS_BACKEND_URL}/market/deposit-address
Authorization: Bearer <token>
body: { token_contract_address, deposit_chain }
```

`AddDeposit` at `services/index.tsx:170-177` explicitly re-picks the two fields off the payload. Response `AddDepositResponse { token_contract_address, user_address, deposit_chain, wallet_public_key, token_decimal, market_status }` (`services/types.ts:191-198`).

`onSuccess` (`useAddUserDeposit.ts:32-44`) writes the zustand application store directly (not via a toggle helper):

```ts
useApplicationStore.setState({
  modalOptions: {
    [ApplicationModal.LISTING]: {
      tokenName,
      publicAddress: data.wallet_public_key,
      chain: deposit_chain,
      refetchPoolsData,
    },
  },
  openModal: ApplicationModal.LISTING,
});
```

— note this **replaces the whole `modalOptions` object**, dropping any other modal's options. Type at `src/stores/application/applicationHooks.ts:17-22`. The modal renders from `src/components/Layout/index.tsx:194`: `{showVibeListingDepositModal && <ListingDepositModal {...modalOptions?.LISTING} />}`.

`onError` (`:45-56`): `console.log('e', e)` (debug leftover) then a generic toast — title `t('Listing Deposit Error')`, message `t('Could not add with the provided information.')`. The server's `error_message` is discarded here (unlike `AddMarket`).

`ListingDepositModal` (`src/components/App/Pools/components/ListingDepositModal/index.tsx`) mirrors the Review step: same `QrCodeWithLogo` config at 300px rendered at 180×180 (`:29-58,79`), `truncateAddress(publicAddress, 10)`, `MinDepositWarning`, and a `Confirm Deposit` button that only does `refetchPoolsData?.(); toggleDepositModal()` (`:110-120`) with the caption `t('Click after sending your tokens. We will verify your deposit and begin the 24h review process.')`. **In the wizard's call site no `refetchPoolsData` is passed** (`TokenBasics.tsx:71-76`), so "Confirm Deposit" from the create-pool page is a pure close.

##### 5.6 Weekly listing limit

`useWeeklyListingLimit` (`services/hooks/useWeeklyListingLimit.ts`):

```
GET {APP_POOLS_BACKEND_URL}/market/weekly-listing-limit   →  WeeklyListingLimitResponse { limit, remaining, reset_at }
```

(`services/index.tsx:255-257`, types `services/types.ts:404-408`). queryKey `['weeklyListingLimit']`, `enabled: Boolean(accessToken)`, `staleTime: 30_000`, dynamic `refetchInterval`: `remaining <= NEAR_LIMIT_REMAINING(5) ? NEAR_LIMIT_REFETCH(60_000) : DEFAULT_REFETCH(300_000)` (`:6-8,20-25`). Returns `{ isLimitReached: data ? data.remaining <= 0 : false, limit, remaining, resetAt: data?.reset_at ?? null, isLoading, isError }` — note it **fails open** (`isLimitReached === false`) while loading or on error. Consumed in `TokenBasics.tsx:30` and in both pools tabs. Tooltip content `WeeklyLimitTooltip` (`src/components/App/Pools/components/WeeklyLimitTooltip.tsx`) counts down off `resetAt * 1000` via `getRemainingTime`, re-rendering on a 60 s `setInterval`, formatting `${day}d ${hours}h` / `${hours}h ${minutes}m` / `${minutes}m`.

##### 5.7 Redirect-out

`goBackToPoolsList` (`index.tsx:76-78`): `router.replace({ pathname: routes.pools.index, query: { tab: 'your_pools' } })` — used by the desktop Back button, the mobile title tap, and the step-3 `Done` button. Also `useEffect(() => { if (!accessToken) goBackToPoolsList() }, [accessToken, goBackToPoolsList])` (`index.tsx:121-125`) — a 401 mid-wizard (which the interceptor turns into `updateListingAccessToken(account, '')`) instantly ejects the user and **discards all form state**, including a just-returned `wallet_public_key` on step 3.

---

#### 6. Mobile behavior / desktop-only gating

`useIsMobile()` (`src/lib/hooks/useWindowSize.ts:9-13`) reads `useApplicationStore.use.display().isMobile`, set in `src/pages/_app.tsx:83-96` as **`window.innerWidth <= 960`** (with `isUpToSmall = <= 640`), updated on `resize` inside a `useLayoutEffect`.

Mobile-conditional behavior in the wizard:

| Behavior                                                                                                                                                                      | Anchor                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Step titles shortened: `Basics` / `Settings` instead of `Token Basics` / `Pool Settings` (step 3 stays `Deposit`)                                                             | `index.tsx:69,72,73`                                                                            |
| Stepper orientation `'horizontal'` on mobile, `'vertical'` on desktop (changes the connector pseudo-element from a vertical bar to a horizontal rule)                         | `index.tsx:150`; `Stepper/index.tsx:16,28-30,38-39`                                             |
| `DepositLottie` (framer-motion + `LottieLoader name="deposit"` 260×230) rendered **desktop only**                                                                             | `index.tsx:153`; `src/components/ReviewModal/OnboardingModal/components/DepositLottie.tsx:4-10` |
| Desktop shows a `Button variant="dark" size="xs"` Back with `<ChevronLeft/>`; mobile instead makes the `New Pool` title itself tappable with a `react-feather` `<ArrowLeft/>` | `index.tsx:131-143`                                                                             |
| All three primary CTAs get `wrapperClassName="max-lg:fixed max-lg:right-4 max-lg:bottom-4 max-lg:left-4"` — a fixed bottom action bar below Tailwind `lg` (1024px)            | `index.tsx:165,175`; `TokenBasics.tsx:143`                                                      |
| Container padding swaps: `py-12` → `max-lg:pt-4 max-lg:pb-16`; the two panels lose their `card`/`bg-background` chrome below `lg` (`lg:card lg:bg-background lg:p-8`)         | `index.tsx:129,146,155`                                                                         |
| Review: the `Deposit` heading + explainer paragraph are **hidden on mobile**                                                                                                  | `Review.tsx:67-76`                                                                              |
| Review: QR sized `174` on mobile vs `230` on desktop                                                                                                                          | `Review.tsx:81`                                                                                 |
| Review: the summary column gets a `card` wrapper only on mobile (`cn('flex grow flex-col gap-5', { ['card']: isMobile })`)                                                    | `Review.tsx:112`                                                                                |
| Review/ListingDepositModal copy control: inline copy icon `hidden sm:inline`, full-width `Copy address` button `sm:hidden`                                                    | `Review.tsx:94-105`; `ListingDepositModal/index.tsx:91-102`                                     |
| Discover tab's filter button is `max-md:hidden`; Your Pools' `FilterByStatus` is `max-md:hidden` while `FilterByMarketStatus` is `hidden max-md:block`                        | `DiscoverPoolsContent.tsx:113`; `YourPoolsContent.tsx:95,99`                                    |

**There is no mobile redirect and no desktop-only gating of the create-pool route.** The wizard is fully usable at any width; the only route-level redirects are the two auth ones (`ListingAuthGuard.tsx:34`, `index.tsx:121-125`). The 960px JS threshold and the 1024px `lg` CSS breakpoint disagree, so between 961–1023px the layout is in "mobile CSS / desktop JS" mode: vertical Stepper + long titles + DepositLottie + desktop Back button, but with the fixed bottom CTA bar and no card chrome.

---

#### 7. Dead code, hacks, TODOs, stubs in this slice

1. `src/components/App/Pools/components/FormInputs/NumberInput.tsx` — **entirely unreferenced**. Dead file.
2. `src/components/App/Pools/utils/depositUtils.ts` — both exports, `getEffectiveDeposit(history)` (`:4-7`, `fromWei(toBN(history.success).plus(toBN(history.transferred)))`) and `calcUserShare(userDeposit, totalDeposit)` (`:9-14`, `(Number(u)/Number(t))*100` → `formatPercentage(share, { decimalPoints: 4, removeTrailingZeros: true }).percentage`, `'-'` on non-finite), are **referenced nowhere**. Dead file.
3. `src/components/App/Pools/utils/marketSearchItemToStubIMarket.ts:13` — `// TODO: I think we can remove this function!`. It _is_ live, but **not in this slice** — only `YourPoolMobileCard.tsx:78` and `YourPoolTableItem.tsx:72` (refund-modal seeding). It fabricates `token_decimal: 18`, `is_tax: false`, `user_whitelist_tax: false`, `buy_back_ratio: 0`, `additional_chains/main_pool/cex_list: null` and an `EMPTY_DEPOSIT_HISTORY` where `user_deposit` is written into **both** `rejected` and `success` (`:19-22`) — a deliberate lie to satisfy `IMarket`.
4. `index.tsx:109` — `console.log('Final data:', data)` in the submit handler.
5. `useAddUserDeposit.ts:46` — `console.log('e', e)` in the error handler.
6. `index.tsx:158` — commented-out `<form … onSubmit={methods.handleSubmit(onSubmit)}>`; the live form is `onSubmit={(e) => e.preventDefault()}`.
7. Three `//@ts-ignore`s: `index.tsx:100` (`error.response?.data?.error_message`), `TokenBasics.tsx:84` (`error={errors.DepositChain}`), `PresetInput.tsx:62` (`setValue(name, preset.value)`).
8. `Stepper/index.tsx:9,14` — prop misspelled `orintation` (and `index.tsx:150` passes the typo).
9. `useTokenMetaData.ts:6` — `accessToken?: string` in `UseTokenMetaDataProps`, never used.
10. `useAddUserDeposit.ts:18` — required `status: MarketStatus` param, never used; `TokenBasics.tsx:75` computes it anyway.
11. `TokenBasics.tsx:69,157,160` — `isPendingMarket` computed, threaded through `ExistingPoolNotice`'s props, and never read in the body.
12. `useTokenValidate.ts:81-83` — `isDataLoading`, `metaError`, `isMetaSuccess` returned but unused by the sole consumer.
13. `index.tsx:88` — `deposit_amount` stored into `addMarketResponse` state and never rendered; the UI shows the hardcoded `MIN_POOL_DEPOSIT_AMOUNT = 5` instead. `field_amount` (`services/types.ts:175`) is never read at all.
14. `TokenBasics.tsx:222-224` — `'A small deposit of $5 or more will activate the market…'` hardcodes the `$5` rather than interpolating `MIN_POOL_DEPOSIT_AMOUNT`.
15. `useTokenValidate.ts:50` — DexScreener queryKey omits `chain`, so the same token address on two chains shares one cache entry.
16. `useTokenValidate.ts:67-69` — fields named `totalMarketCap` / `totalLiquidity` hold a single pair's values, not a total.
17. `misc.ts:23-27` — `APP_POOLS_BACKEND_URL`'s `IS_TEST_ENVIRONMENT` and default branches are the same string.
18. `useTokenValidate.ts:1` — stale header comment `// useValidateAndFetchTokenMetaData.ts`; `useTokenMetaData.ts:1` — redundant `// useTokenMetaData.ts`.
19. `SearchableSelectBase` holds an internal `useState` seeded only on mount (`SearchableSelect.tsx:65`) — no sync with the RHF `Controller`'s `field.value` on external change.
20. `Review.tsx:56-59` — QR promise chain with no `.catch` and no unmount guard; `Review.tsx:32,88,92` cast `wallet_public_key` with `as string` while it can be `undefined` (reachable via gating hole #2 in §1).
21. `index.tsx:80` — `useMutation` destructures only `mutate`; no `isPending` guard on the `Create Pool` button → double-submit is possible.
22. `ListingSignatureRequestModal/index.tsx:74` — the "You're signing" preview is a hand-built template string that ends in `Chain ID: ${activeAccount.accountAddress ? '' : ''}` (always empty either way) and does **not** show the actual message returned by `/auth/sign-in-message`.

---

## 6. Listing auth, deposit, and terms

### Vibe-ui — Listing AUTH / Deposit / Terms slice map

Repo root: `/symmio/Vibe-ui` (branch `staging`, HEAD `8ee8776fc`). All paths below are repo-relative.

---

#### 0. Backend + transport layer (foundation for everything else)

##### 0.1 Base URL

`src/constants/misc.ts:23-27`

```ts
export const APP_POOLS_BACKEND_URL = IS_BACKEND_STAGING_ENV
  ? "https://listing-staging.enigma.bz/v2/"
  : IS_TEST_ENVIRONMENT
    ? "https://listing85.enigma.bz/v2/"
    : "https://listing85.enigma.bz/v2/";
```

- Flags resolve in `src/constants/environment.ts:1-2`: `IS_TEST_ENVIRONMENT = process.env.NEXT_PUBLIC_IS_TEST_ENVIRONMENT === 'true'`, `IS_BACKEND_STAGING_ENV = process.env.NEXT_PUBLIC_BACKEND_ENVIRONMENT === 'staging'`.
- **Dead branch**: the `IS_TEST_ENVIRONMENT` ternary and the fallback produce the _identical_ string `https://listing85.enigma.bz/v2/`.
- Local `.env:14,20` sets `NEXT_PUBLIC_IS_TEST_ENVIRONMENT=true` and `NEXT_PUBLIC_BACKEND_ENVIRONMENT="staging"` → staging URL wins.

##### 0.2 Axios instance + token attachment (THE interceptor)

`src/components/App/Pools/services/index.tsx:41-44`

```ts
const api = axios.create({ baseURL: APP_POOLS_BACKEND_URL, timeout: 20000 });
```

**Request interceptor — `src/components/App/Pools/services/index.tsx:62-77`**

```ts
api.interceptors.request.use(
  (config) => {
    const account = useWalletStore.getState().account;
    const listingAccessTokens = useUserStore.getState().listingAccessTokens;
    const accessToken = account ? listingAccessTokens?.[account] : undefined;
    if (accessToken) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);
```

- Header name: `Authorization`, scheme `Bearer`.
- Token is looked up **per wallet address**, read imperatively via `useWalletStore.getState()` / `useUserStore.getState()` (not a hook), so it is always the live value at request time.
- No token → header simply omitted (request still fires; server decides).

**Response interceptor / implicit "expiry" handling — `src/components/App/Pools/services/index.tsx:79-93`**

```ts
api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    captureAxiosError(err, APP_POOLS_BACKEND_URL);
    if (err.response?.status === 401) {
      const { account } = useWalletStore.getState();
      const { updateListingAccessToken } = useUserStore.getState();
      if (account) updateListingAccessToken(account, ""); // wipe → re-auth
    }
    return Promise.reject(err);
  },
);
```

This is the **only** expiry mechanism. There is no `exp` claim inspection, no refresh token, no `/auth/me` probe, no TTL.

Other axios instances in the same file (no auth): `dexscreener` (`https://api.dexscreener.com/latest`, `:45-48`), `inventory` (`https://inventory-staging.enigma.bz/api` / `https://inventory85.enigma.bz/api`, `:49-56`), `conditionalOrders` (`TPSL_SERVICES[HedgerType.ENIGMA].domain`, `:57-60`).

##### 0.3 Second, hand-rolled attachment path (bypasses the interceptor)

`src/services/pools/services.ts` hits the _same_ `APP_POOLS_BACKEND_URL` with **raw `axios`** and manually built headers:

- `refundRejectedPool` — `POST ${APP_POOLS_BACKEND_URL}market/refund`, body `{market_address, deposit_chain, recipient_address}`, header `Authorization: Bearer ${token}` (`:14-27`). Token passed in as a param.
- `getUserTransactions` — `GET ${APP_POOLS_BACKEND_URL}market/user-transactions/${start}/${size}?${params}`, header `Authorization: Bearer ${accessToken}` (`:47-55`).

These get **no 401 handling** — a stale token here does _not_ clear itself. Callers: `src/services/pools/hooks/useRefundRejectedPool.ts`, `src/services/pools/hooks/useUserTransactions.ts` (query key `['getUserTransactions', accessToken, start, size, rest]`, `enabled: Boolean(accessToken && rest.token_address && rest.chain_id != null)`), both consumed by `src/components/ReviewModal/RefundYourDepositModal/RefundYourDepositModal.tsx:33-41,49`.

---

#### 1. The full auth handshake, step by step

##### Step 0 — state shape

`src/stores/user/userTypes.ts:43-44,67-68`

```ts
listingAccessTokens: { [account: string]: string }
hasSeenListingTerms: boolean
updateListingAccessToken: (account: string, token: string) => void
setHasSeenListingTerms: (hasSeenListingTerms: boolean) => void
```

`src/stores/user/user.ts:48-49` initial values `listingAccessTokens: {}`, `hasSeenListingTerms: false`.
`src/stores/user/user.ts:81-92` the two actions (immer; `state.listingAccessTokens[account] ||= ''` "backward compatibility" line then overwrite).

**Storage**: the user store is created with `isPersist = true` and **no `persistKeys`** (`src/stores/user/user.ts:165`), so `createZustandStore` (`src/utils/store.ts:29-59`) wraps it in zustand `persist` with:

```ts
name: `store-${name}-${STORE_VERSION}`; // src/utils/store.ts:40
export const STORE_VERSION = "0.0.5"; // src/utils/store.ts:9
```

→ **localStorage key `store-user-0.0.5`**, default zustand JSON storage, whole state persisted (no partialize). The listing token lives at `JSON.parse(localStorage['store-user-0.0.5']).state.listingAccessTokens[<wallet address>]`.

##### Step 1 — gate evaluation (`useListingAuth`)

`src/components/App/Pools/services/hooks/useListingAuth.ts:15-24`

```ts
const activeAccount = useActiveAccount(); // subaccount, on-chain
const account = useWalletStore.use.account(); // EOA / AA address
const isConnected = useWalletStore.use.isConnected();
const isConnecting = useWalletStore.use.isConnecting();
const { isLoading: isAccountsLoading } = useUserAccounts();
const listingAccessTokens = useUserStore.use.listingAccessTokens();
const accessToken = listingAccessTokens[account];

const isAuthenticated = Boolean(account && activeAccount && accessToken);
```

Three-part gate: **wallet connected AND a SYMM subaccount selected AND a listing JWT for that wallet**.

- `useActiveAccount()` (`src/stores/user/userHooks.ts:13-20`) returns `activeAccount` only if `isConnected && isEqual(account, activeAccount.owner)`.
- `useUserAccounts()` (`src/services/blockchain/hooks/useUserAccounts.ts:18-53`) — **contract read**: `AccountLayer.getUserSubAccounts(account, 0n, 9999n)`; address from `useAccountLayerContract()` → `ACCOUNT_LAYER_ADDRESS` + `ACCOUNT_LAYER_ABI` (`src/hooks/useContract.ts:46-48`); `enabled: Boolean(account) && isSupportedChainId && Boolean(accountLayerContract.address)`, `refetchInterval` 5 min (4 s when `ActiveChecking`), `placeholderData: []`.

`triggerAuthFlow(onComplete?)` — `src/components/App/Pools/services/hooks/useListingAuth.ts:54-85`:
| condition | action |
|---|---|
| `isAuthenticated` | call `onComplete?.()` immediately, return |
| — | set `isAuthFlowTriggeredRef.current = true`, stash `onComplete` in `pendingCallbackRef` |
| `isConnecting` | return (wait) |
| `!isConnected` | `openModal = ApplicationModal.WAYS_TO_TRADE` (`:71`) |
| `!isAccountsLoading && !activeAccount` | `openModal = ApplicationModal.CREATE_ACCOUNT` (`:76`) |
| `account && activeAccount && !accessToken` | `openModal = ApplicationModal.LISTING_SIGNATURE_REQUEST` (`:81`) |

Auto-advance effect (`:30-52`) re-runs the same ladder as state changes, and when `isAuthenticated` flips true it clears the ref and fires the stashed callback (`:33-41`).

Modals are mounted centrally in `src/components/Layout/index.tsx:194-198` (`ListingDepositModal`, `TermsAndConditionsModal`, `FilterPoolModal`, `ListingSignatureRequestModal`) plus `CreateAccountModal` (`:162`) and `WaysToTradeModal` (`:178`). Modal enum values: `src/stores/application/applicationTypes.ts:49-56` (`LISTING`, `LISTING_FILTER`, `LISTING_TERMS_AND_CONDITIONS`, `LISTING_SIGNATURE_REQUEST`).

##### Step 2 — nonce/message fetch

`src/components/App/Pools/services/index.tsx:156-160`

```ts
export async function SignInMessage({ address, domain, uri }: { address: string; domain: string; uri: string }) {
  return api.get<GetSignInMessageResponse>(`/auth/sign-in-message?address=${address}&domain=${domain}&uri=${uri}`);
}
```

- **Method/URL**: `GET https://listing85.enigma.bz/v2/auth/sign-in-message?address=<0x…>&domain=<window.location.host>&uri=<window.location.origin>`
- Query string is **hand-concatenated, not URL-encoded** (`uri` contains `https://` → raw `:` and `//` in the query). Flag.
- Call site supplies `domain: window.location.host`, `uri: window.location.origin` (`src/components/App/Pools/services/hooks/useListingLogin.ts:24-28`).
- **Response `GetSignInMessageResponse`** (`src/components/App/Pools/services/types.ts:4-18`):

```ts
interface GetSignInMessageResponse {
  message: string;
  params: SignInMessageParams;
}
interface SignInMessageParams {
  domain: string;
  address: string;
  uri: string;
  version: string;
  chainId: number;
  issuedAt: string;
  nonce: string;
  statement: string;
}
```

This is **SIWE / EIP-4361**: server returns both the rendered `message` string (to sign) and the structured `params` (to echo back). The nonce is `params.nonce` — server-issued, no separate `/nonce` POST (contrast: the "backed" service does POST `/nonce` first, `src/services/backed/service.ts:46-48`).

##### Step 3 — wallet signature (which method)

`src/components/App/Pools/services/hooks/useListingLogin.ts:31`

```ts
const signature = await signMessageCallback(message);
```

`signMessageCallback` comes from `useSignMessageV2()` — `src/callbacks/useSignMessage.ts:30-81`. It is **`personal_sign` / EIP-191**, never EIP-712 (`useSignTypeDataMessage` at `:83-98` exists but is not used by listing auth):

```ts
callback: async function onSign(message: string): Promise<string> {
  if (providerType === WalletConnectionType.WAGMI && provider)
    // viem WalletClient
    return provider.signMessage({ message }); // :64-67  → personal_sign
  else if (providerType === PRIVY && !accountLength && embeddedWallet)
    return embeddedWallet.sign(message); // :68-71
  else if (providerType === PRIVY && pimlicoClient) return pimlicoClient.signMessage({ message } as any); // :72-75  → ERC-4337/EIP-1271
  return "response"; // :77  ← dead-end sentinel, silently returns the literal string "response"
}
```

Guards: `if (!account || !chainId)` → `{ state: INVALID, callback: null }` (`:44-50`). `IS_SIMULATOR_MODE` short-circuits to a fake 65-byte zero signature `'0x' + '00'.repeat(65)` (`:52-58`).

Rejection normalization — `src/callbacks/useSignMessage.ts:13-28`:

```ts
const USER_REJECTED_MESSAGE = "Transaction rejected.";
// code === 4001 || code === 'ACTION_REJECTED'  →  new Error('Transaction rejected.')
```

Note the listing flow **never inspects this sentinel** — it treats every failure identically.

**The message the user actually signs is NOT what the modal displays.** `src/components/App/Pools/components/ListingSignatureRequestModal/index.tsx:74` renders a hand-written mock:

```tsx
{
  `Vibe wants to sign in with your Ethereum Account\n\nSign in to Vibe as Account : ${activeAccount.name}.\nURI: ${window.location.origin}\nVersion: 1\nChain ID: ${activeAccount.accountAddress ? "" : ""}`;
}
```

`Chain ID: ${cond ? '' : ''}` always renders empty — a stub. The real SIWE text (`data.message`) is fetched only inside the mutation, after the user has already clicked "Accept and Sign". **Flag: the signature preview is fabricated.** The green "Logged In" pill (`:65-67`) is likewise a hardcoded static label.

##### Step 4 — token exchange

`src/components/App/Pools/services/index.tsx:162-164`

```ts
export async function Login(payload: LoginPayload) {
  return api.post<LoginResponse>(`/auth/login`, payload);
}
```

- **`POST https://listing85.enigma.bz/v2/auth/login`**
- Body — `LoginPayload` (`src/components/App/Pools/services/types.ts:22-37`):

```ts
{ message: LoginMessage, signature: string }
LoginMessage = { domain, address, uri, version, chainId, issuedAt, nonce, statement, expirationTime?: string }
```

The client sends back **`params` (the object), not the rendered string** — `useListingLogin.ts:34`: `return await Login({ message: params, signature })`. `expirationTime` is declared optional and is never populated client-side.

- Response — `LoginResponse` (`types.ts:38-41`): `{ accessToken: string; tokenType: string }`. `tokenType` is **discarded**; `Bearer` is hardcoded in the interceptor.

##### Step 5 — storage

`src/components/App/Pools/services/hooks/useListingLogin.ts:36-38`

```ts
onSuccess: ({ data }) => {
  updateListingAccessToken(account, data.accessToken);
};
```

→ zustand `store-user-0.0.5` in localStorage, map keyed by wallet address. Switching wallets naturally re-prompts (different key). No expiry stored (contrast `vibeBackAccessToken: { accessToken, expirationTime }` — `src/stores/user/userTypes.ts:76-79` — which _does_ carry `expirationTime` and is checked at `src/stores/user/userHooks.ts:58`).

The mutation itself — `src/components/App/Pools/services/hooks/useListingLogin.ts:17-50`:

```ts
useMutation<Awaited<ReturnType<typeof Login>>, Error>({ mutationFn: async () => { … } })
```

No `mutationKey`. Preflight guard `if (!signMessageCallback || !account) throw new Error('Error')` (`:19`) — an untyped generic error.

##### Step 6 — attachment to subsequent requests

Automatic via the request interceptor (§0.2) for **every** function exported from `src/components/App/Pools/services/index.tsx` that uses `api`:

| fn                                 | method + path (relative to `…/v2/`)                                                       | response type                |
| ---------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------- |
| `getMarketSearch` `:120-136`       | `GET market/search?limit&offset&query&sort_by&chain_ids&market_status&order_by&<filters>` | `MarketSearchResponse`       |
| `getUserMarketSearch` `:138-154`   | `GET market/search-user?…`                                                                | `UserMarketSearchResponse`   |
| `SignInMessage` `:156-160`         | `GET /auth/sign-in-message?…`                                                             | `GetSignInMessageResponse`   |
| `Login` `:162-164`                 | `POST /auth/login`                                                                        | `LoginResponse`              |
| `AddMarket` `:166-168`             | `POST /market/add-market`                                                                 | `AddMarketResponse`          |
| `AddDeposit` `:170-177`            | `POST /market/deposit-address` body `{token_contract_address, deposit_chain}`             | `AddDepositResponse`         |
| `RetryMarketListing` `:179-181`    | `POST market/retry-listing`                                                               | `RetryMarketResponse`        |
| `GetRetryListingInfo` `:183-187`   | `GET market/retry-listing-info?token_contract_address&deposit_chain`                      | `RetryListingInfoResponse`   |
| `GetTokenMetaData` `:189-193`      | `GET /market/token-meta-data?contract_address&chain`                                      | `GetTokenMetaDataResponse`   |
| `TokenSupport` `:195-197`          | `GET /market/token-support?contract_address&chain`                                        | `string`                     |
| `GetMarketDetail` `:220-230`       | `GET /market?token_contract_address&deposit_chain`                                        | `MarketDetailResponse`       |
| `GetUserProfit` `:232-234`         | `GET /profit/{token_contract_address}`                                                    | `UserProfitResponse`         |
| `GetTransactionHistory` `:236-249` | `GET /market/transaction-history/{start}/{size}?market_address&wallet_address`            | `TransactionHistoryResponse` |
| `PostWithdraw` `:251-253`          | `POST /market/withdraw` body `WithdrawRequest`                                            | —                            |
| `GetWeeklyListingLimit` `:255-257` | `GET /market/weekly-listing-limit`                                                        | `WeeklyListingLimitResponse` |
| `ClaimProfit` `:259-261`           | `POST /claim` body `ClaimProfitRequest`                                                   | `ClaimProfitResponse`        |

Non-`api` calls in the same file: `GetTokenDexScreenerData` (`:199-201`, dexscreener), `GetAggregatedTvl` (`:203-205`, inventory `/v1/markets/tvl-aggregate`), `GetRevenue` (`:207-218`, raw axios against `HEDGER_DATA_MAP[ENIGMA].domain + revenue/{marketId}`), `SearchConditionalOrders` (`:263-264`, `POST /api/v4/search/`).

Note `SignInMessage`/`Login` go through the **same interceptor**, so a stale token is sent along with the login request — harmless but sloppy.

##### Step 7 — expiry / refresh / logout

- **Refresh**: none. No refresh token, no silent renewal.
- **Expiry detection**: only the 401 interceptor (`services/index.tsx:83-90`) which sets the token to `''`. Because `isAuthenticated` is `Boolean(…accessToken)`, `''` ⇒ false ⇒ `ListingAuthGuard`'s effect re-opens `LISTING_SIGNATURE_REQUEST`, or the next `triggerAuthFlow(cb)` does.
- **Logout**: there is **no explicit logout**. Grep over `src/` shows `listingAccessTokens` / `updateListingAccessToken` touched only in: `stores/user/user.ts:48,81-87`, `stores/user/userTypes.ts:43,67`, `useListingAuth.ts:21-22`, `useListingLogin.ts:13,37`, `services/index.tsx:65,85,88`, `YourPoolsContent.tsx:45,47`, `CreatePool/index.tsx:32,34`, `useWeeklyListingLimit.ts:12-13`, `RefundYourDepositModal.tsx:22,33`. Nothing clears it on wallet disconnect, account switch, or tab close — the JWT survives in localStorage indefinitely.
- Tokens for other wallets are never evicted; the map grows unbounded.

##### Step 8 — the signature modal UI

`src/components/App/Pools/components/ListingSignatureRequestModal/index.tsx`

- Renders only when `isOpen && activeAccount && account` (`:44`).
- `ThemedModal.Simple` title `"Signature Request"`, `size="sm"`, `noExitButton={isPending}` (`:47-53`).
- `handleClose` (`:39-42`) early-returns while `isPending`, so outside-click/Escape (which route to `onClose` in `src/components/Modal/index.tsx:95-113`) cannot dismiss it mid-signature.
- Button "Accept and Sign" → `listingLogin()` (`:103`). Pending → spinner + "Waiting for signature" (`:95-101`). Success → green banner "Success! You're authenticated", then `setTimeout(1500ms)` → `openModal: null` (`:26-37`). The timer is cleared by the effect cleanup on unmount, and `Layout` unmounts the modal as soon as `openModal` changes (e.g. to `LISTING`), so the success timer does not clobber a subsequently-opened deposit modal.
- Error UI (`:86-88`): `{isError && <p …>Signature was rejected. Please try again.</p>}` — shown for **every** failure mode (HTTP 5xx on `/auth/sign-in-message`, 4xx on `/auth/login`, timeout, missing callback), not just wallet rejection. Flag.

---

#### 2. Exactly which pools routes/actions are gated vs public

##### Pages

| route                           | file                                                                  | gate                               |
| ------------------------------- | --------------------------------------------------------------------- | ---------------------------------- |
| `/pools`                        | `src/pages/pools/index.tsx` → `src/components/App/Pools/index.tsx`    | **mixed** — see tabs               |
| `/pools?tab=discover` (default) | `Pools/index.tsx:28`                                                  | **PUBLIC**                         |
| `/pools?tab=your_pools`         | `Pools/index.tsx:23-27` wrapped in `<ListingAuthGuard>`               | **GATED**                          |
| `/pools/create-pool`            | `src/pages/pools/create-pool.tsx:6-8` wrapped in `<ListingAuthGuard>` | **GATED**                          |
| `/pools/[contractAddress]`      | `src/pages/pools/[contractAddress].tsx` → `PoolDetail`                | **PUBLIC page, per-widget gating** |

`routes.pools` — `src/constants/routes.ts:20-25`: `index: '/pools'`, `createPool: '/pools/create-pool'`, `poolDetail(contractAddress, depositChain?) => '/pools/{addr}?deposit_chain={chain}'`.

##### `ListingAuthGuard` behavior — `src/components/App/Pools/components/ListingAuthGuard.tsx`

```ts
useEffect(() => { if (!isConnecting && !isAuthenticated) triggerAuthFlow() }, [...])   // :17-21
useEffect(() => { if (!isAuthenticated && openModal !== null) authModalWasOpenRef.current = true }, [...])  // :24-28
useEffect(() => {                                                                      // :31-38
  if (authModalWasOpenRef.current && !isAuthenticated && openModal === null) {
    authModalWasOpenRef.current = false
    router.replace({ pathname: routes.pools.index, query: { tab: 'discover' } }, undefined, { shallow: true })
  }
}, [openModal, isAuthenticated, router])
if (!isAuthenticated) return null                                                      // :40-42
```

- Renders `null` (blank, no skeleton, no "connect" CTA) while unauthenticated.
- **Bail-out redirect**: closing _any_ modal while unauthenticated bounces you to `?tab=discover`. Flag: the ref at `:25` is set by **any** `openModal !== null`, not only auth modals — an unrelated modal opening and closing on a gated route triggers the redirect.
- **Flag**: `shallow: true` from `/pools/create-pool` → `/pools` is a cross-page navigation; Next.js ignores `shallow` when the page component changes.

##### Actions (all funnel through `triggerAuthFlow(callback)`)

| action                                   | call site                                                                                                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Deposit (Discover desktop row)           | `PoolsTable/DiscoverPoolTableItem.tsx:56-64,191` — `triggerAuthFlow(performAction)` where `performAction` = `if (canDeposit) mutate()`                                                     |
| Deposit (Discover mobile card)           | `PoolsList/DiscoverPoolMobileCard.tsx:54-62,138`                                                                                                                                           |
| Deposit (Your Pools desktop row)         | `PoolsTable/YourPoolTableItem.tsx:60-68,217`                                                                                                                                               |
| Deposit (Your Pools mobile card)         | `PoolsList/YourPoolMobileCard.tsx:57-74,164`                                                                                                                                               |
| Refund a rejected pool                   | `YourPoolTableItem.tsx:70-74,209` and `YourPoolMobileCard.tsx:76-80,154` — `triggerAuthFlow(() => usePoolsStore.setState({ selectedPoolForRefund: marketSearchItemToStubIMarket(item) }))` |
| Retry a rejected listing                 | `components/RetryListingButton.tsx:110-117` — `triggerAuthFlow(() => retryMutation.mutate({token_contract_address, deposit_chain}))`                                                       |
| Deposit from pool detail header          | `PoolDetail/index.tsx:40-42,82`                                                                                                                                                            |
| Withdraw from pool detail header         | `PoolDetail/index.tsx:44-47` — `triggerAuthFlow(() => toggleWithdrawModal({market, refetchPoolsData: refetch}))`                                                                           |
| "Sign to view your balance" placeholders | `PoolDetail/index.tsx:49-51`, rendered by `SummaryCards/AuthGatedPlaceholder.tsx:15-21`                                                                                                    |

##### Data gated by token presence (query `enabled`)

- `useYourPoolsMarketDeposits` — `enabled: Boolean(accessToken && account)`, key `['getUserMarketSearch', accessToken, account, query, size, start, searchTerm, statusFilter, sortBy, orderBy]`, `staleTime: 0`, `refetchInterval: 90_000` (`services/hooks/useYourPoolsMarketDeposits.ts:27-42`). Token is threaded in from `YourPoolsContent.tsx:47,57`.
- `useWeeklyListingLimit` — `enabled: Boolean(accessToken)`, key `['weeklyListingLimit']`, `staleTime: 30_000`, adaptive `refetchInterval`: `60_000` when `remaining <= 5` else `300_000` (`useWeeklyListingLimit.ts:15-26`).
- `useUserProfit` — `enabled: Boolean(contractAddress && isAuthenticated && marketStatus === MarketStatus.Listed)`, key `['userProfit', contractAddress]`, `staleTime`/`refetchInterval` `10 * 60 * 1000` (`useUserProfit.ts:10-19`). This is the only hook that gates on the **full** `isAuthenticated` triple, not just the token.
- `useUserTransactions` — `enabled: Boolean(accessToken && rest.token_address && rest.chain_id != null)` (`src/services/pools/hooks/useUserTransactions.ts:15`).

##### Public data (no gating)

- `useDiscoverMarketSearch` — no `enabled`, key `['getMarketSearch', query, size, start, searchTerm, statusFilter, sortBy, orderBy, filters]`, `staleTime: 0`, `refetchInterval: 90_000` (`useDiscoverMarketSearch.ts:55-58`). Filter values are `toWei()`-converted except `listing_time*` (`:49`).
- `useDiscoverPoolsCount` — key `['discoverPoolsCount']`, `staleTime: Infinity`, all `refetchOn*: false` (`useDiscoverPoolsCount.ts:5-19`).
- `useMarketDetail` — `enabled: Boolean(contractAddress)`, key `['marketDetail', contractAddress, depositChain]`, `staleTime: 30_000`, `refetchInterval: 60_000`; when `?deposit_chain` is absent it first does a `getMarketSearch({limit:1, query: contractAddress})` to resolve `chain_id` (`useMarketDetail.ts:10-37`).
- `useTransactionHistory` — `enabled: Boolean(marketAddress)`, key `['GetTransactionHistory', marketAddress, walletAddress, start, size]`, `staleTime: 30_000`, **no** `refetchInterval` (`useTransactionHistory.ts:25-38`).
- `useTokenMetaData` — key `['tokenMetaData', tokenAddress, chain]`, `enabled: Boolean(tokenAddress && chain != null)`, `staleTime: 5 min`.
- `useRetryListingInfo` — key `['retryListingInfo', token_contract_address, deposit_chain]`, `enabled: Boolean(enabled && token_contract_address && deposit_chain != null)`, `staleTime: 30_000`.

**Note**: `market/search-user`, `market/weekly-listing-limit`, `/profit/*`, `/claim`, `/market/withdraw`, `/market/add-market`, `/market/deposit-address`, `market/retry-listing`, `market/refund`, `market/user-transactions` are the server-side authenticated surface; only `search-user`, `weekly-listing-limit`, `/profit`, and `user-transactions` are additionally client-gated. `AddDeposit`, `AddMarket`, `ClaimProfit`, `PostWithdraw`, `RetryMarketListing` are gated only by the UI calling them behind `triggerAuthFlow`.

---

#### 3. The deposit modal flow

There are **two** deposit surfaces sharing one mechanism.

##### 3.1 Triggering — `useAddDeposit`

`src/components/App/Pools/services/hooks/useAddUserDeposit.ts:9-57`

```ts
export const useAddDeposit = ({
  token_contract_address,
  deposit_chain,
  tokenName,
  refetchPoolsData,
}: {
  token_contract_address: string;
  tokenName: string;
  deposit_chain: number;
  status: MarketStatus; // ← accepted, destructured nowhere, UNUSED. Flag.
  refetchPoolsData?: () => void;
}) => {
  return useMutation<Awaited<ReturnType<typeof AddDeposit>>, Error>({
    mutationFn: async () => AddDeposit({ payload: { token_contract_address, deposit_chain } }),
    onSuccess: ({ data }) => {
      useApplicationStore.setState({
        modalOptions: {
          [ApplicationModal.LISTING]: {
            tokenName,
            publicAddress: data.wallet_public_key,
            chain: deposit_chain,
            refetchPoolsData,
          },
        },
        openModal: ApplicationModal.LISTING,
      });
    },
    onError: (e) => {
      console.log("e", e);
      addPopup({
        content: {
          toastType: ToastType.ERROR,
          props: {
            errorTitle: t("Listing Deposit Error"),
            errorMessage: t("Could not add with the provided information."),
          },
        },
      });
    },
  });
};
```

- HTTP: **`POST https://listing85.enigma.bz/v2/market/deposit-address`**, body `{ token_contract_address, deposit_chain }` (`services/index.tsx:170-177`), Bearer-authed via interceptor.
- Response `AddDepositResponse` (`services/types.ts:191-198`): `{ token_contract_address, user_address, deposit_chain, wallet_public_key, token_decimal, market_status }`.
- **`wallet_public_key` is the per-user custodial deposit address** shown in the modal.
- Error path: generic toast, `console.log('e', e)` left in (**flag: debug log in prod path**), and the server's `error_message` is _not_ surfaced (unlike `useRetryMarketListing.ts:36-45` / `getListingApiErrorMessage`).
- No `mutationKey`; no query invalidation on success.

Modal options typing: `src/stores/application/applicationHooks.ts:17-22`

```ts
[ApplicationModal.LISTING]?: { publicAddress?: string; chain?: number; tokenName: string; refetchPoolsData?: () => void }
```

Mounted at `src/components/Layout/index.tsx:194`: `{showVibeListingDepositModal && <ListingDepositModal {...modalOptions?.LISTING} />}`.

##### 3.2 What the user sees — `ListingDepositModal`

`src/components/App/Pools/components/ListingDepositModal/index.tsx`

- Props `{ publicAddress = '', chain, tokenName, refetchPoolsData }` (`:16-23`).
- Title `t('Complete Your Deposit')`, `size="sm"`, close = `useToggleListingDepositModal()` = `useToggleModal(ApplicationModal.LISTING)` (`applicationHooks.ts:258-260`), which also resets `modalOptions: undefined` (`applicationHooks.ts:43`).
- Header rows (`:69-77`): **Chain** → `DEPOSIT_CHAIN_OPTIONS.find(ch => ch.value == chain)?.label`; **Deposit token** → `tokenName`.
- **QR code** (`:28-58`): `new QrCodeWithLogo({ content: publicAddress, width: 300, dotsOptions: {color:'#ffffff', type:'dot'}, cornersOptions:{type:'rounded', color:'#ffffff'}, logo: { src: DEPOSIT_CHAIN_OPTIONS.find(ch => ch.value == chain)?.logo || '' } })` → `getCanvas().then(c => c.toDataURL())` → `<Image src={qrImageUrl} width={180} height={180}/>`. Library: `qrcode-with-logos`. **Flag**: the effect runs unconditionally, so with `publicAddress === ''` it renders a QR of the empty string.
- **Address** (`:80-106`): copy-to-clipboard of the full `publicAddress`, displayed truncated via `truncateAddress(publicAddress.toString(), 10)`; desktop shows a `Copy` icon, mobile a "Copy address" button.
- Warning line: `t('Only deposit {{tokenName}} to this address.', { tokenName })` (`:82`).
- `<MinDepositWarning />` (`:108`) → `src/components/App/Pools/components/MinDepositWarning.tsx:19`: `t('Minimum deposit amount is ${{amount}}.', { amount: MIN_POOL_DEPOSIT_AMOUNT })` with `MIN_POOL_DEPOSIT_AMOUNT = 5` (`Pools/constants.ts:4`).
- **Confirm** (`:110-120`): `onClick={() => { refetchPoolsData?.(); toggleDepositModal() }}` + caption `t('Click after sending your tokens. We will verify your deposit and begin the 24h review process.')` (`:122`).

##### 3.3 Address + exact-amount rules

- **Address**: server-issued custodial address `wallet_public_key` per `(user, token, chain)`; unique to the authenticated user (`AddDepositResponse.user_address` also returned but unused).
- **Amount rules**: the only rule enforced/communicated is the **$5 minimum** (`MIN_POOL_DEPOSIT_AMOUNT`). There is **no exact-amount requirement, no memo/tag, and no client-side amount input** — the user sends an arbitrary amount ≥ $5 to the address.
- `AddMarketResponse` _does_ carry `deposit_amount` and `field_amount` (`services/types.ts:174-175`), and `CreatePool/index.tsx:86-91` stores `deposit_amount` into `addMarketResponse` state — but `Review.tsx` never renders it. **Flag: `deposit_amount` is captured and dropped (dead data), suggesting an exact-amount UX that was cut.**

##### 3.4 Chain / token checks

- **No wallet-chain check and no chain switch anywhere in the deposit flow.** The deposit chains are off-app: `DEPOSIT_CHAIN_OPTIONS` (`Pools/constants.ts:6-12`) = Solana(`DepositChain.Solana = 0`), Base(8453), BSC(56), Sonic(146), Arbitrum One(42161) — while the app's only supported _connected_ chain is HyperEVM 999 (`src/constants/chains.ts:50` `CHAIN_IDS = [SupportedChainId.HYPEREVM]`, `:52` `FALLBACK_CHAIN_ID`). Deposits are exchange-style transfers to a custodial address, not on-chain contract calls from the connected wallet — hence no `switchChain`, no ERC-20 `approve`, no `transfer`. `DepositChain` enum: `Pools/types.ts:73-79`.
- **Market-status check** — `src/components/App/Pools/utils/canDepositToMarket.ts:7-12`:

```ts
if (status === MarketStatus.Delisted) return false;
if (status === MarketStatus.Rejected) return Boolean(options?.allowRejected);
return true;
```

- Discover rows call it with `{ allowRejected: true }` (`DiscoverPoolTableItem.tsx:39`, `DiscoverPoolMobileCard.tsx:42`).
- Your Pools rows call it **without** the option (`YourPoolTableItem.tsx:43`, `YourPoolMobileCard.tsx:55`) → rejected pools show Retry + Refund instead (`YourPoolTableItem.tsx:206-212`, `YourPoolMobileCard.tsx:150-162`).
- `MarketStatus` values (`Pools/types.ts:56-62`): `waiting_for_deposit | under_review | rejected | listed | delisted`.
- **Trade check** (adjacent) — `utils/canTradeMarket.ts:3-5`: `status === Listed && symbolId != null`.
- **Token support check** (create-pool path only) — `useTokenValidate` (`services/hooks/useTokenValidate.ts:12-87`): `GET /market/token-support?contract_address&chain` (key `['checkTokenSupport', tokenAddress, chain]`, `retry: false`); on success chains into `GET /market/token-meta-data` (`enabled: isSupported`) and DexScreener (`enabled: isSupported`, picks the highest-`liquidity.usd` pair). Failure code `SUPPORT_TOKEN_ERROR.UNSUPPORTED_TOKEN = 26` (`Pools/types.ts:53-55`) renders the "We do not currently support this token… Get in touch" line with a Discord link (`TokenBasics.tsx:115-131`).

##### 3.5 Polling / detection

**There is no deposit-detection polling.** After "Confirm Deposit" the only thing that happens is a single `refetchPoolsData?.()` — which is whichever react-query `refetch` was threaded in:

- Discover list/table → `discoverQuery.refetch` (`DiscoverPoolsContent.tsx:179,190`) → `getMarketSearch`
- Your Pools list/table → `yourPoolsQuery.refetch` (`YourPoolsContent.tsx:153,164`) → `getUserMarketSearch`
- Pool detail → `useMarketDetail`'s `refetch` (`PoolDetail/index.tsx:37`)
- `TokenBasics.tsx:71-76` passes **no** `refetchPoolsData` at all.

Background freshness is the ambient `refetchInterval`s only: market search 90 s, market detail 60 s, weekly limit 60/300 s, user profit 10 min, transaction history none (30 s stale). Detection latency is therefore up to ~90 s plus the backend's own confirmation, and the modal's copy admits a "24h review process".

##### 3.6 The other deposit surface — create-pool step 3

`src/components/App/Pools/components/CreatePool/index.tsx`

- 3 steps: 1 `TokenBasics` (fields `TokenContractAddress`, `DepositChain`), 2 `MarketSettings` (`BuybackProfit`, `MaxLeverage`), 3 `Review` (`:66-74`, `STEP1_FIELDS`/`STEP2_FIELDS` at `:25-26`). RHF `mode: 'onTouched'`, `shouldUnregister: false`, `defaultValues: { MaxLeverage: '20' }` (`:40-46`).
- Submit → `useMutation({ mutationFn: AddMarket })` (`:80-106`) → `POST /market/add-market` with `AddMarketPayload { buy_back_ratio: Number(BuybackProfit), is_tax: false, deposit_chain, max_leverage: Number(MaxLeverage), token_contract_address, user_whitelist_tax: false }` (`:110-117`).
- `onSuccess` invalidates `['getMarketSearch']`, `['getUserMarketSearch']`, `['discoverPoolsCount']` with `refetchType: 'all'` (`:83-85`), stores `{token_ticker, deposit_amount, wallet_public_key, deposit_chain}`, advances to step 3.
- `onError` surfaces `error.response?.data?.error_message` behind an `//@ts-ignore` (`:94-105`).
- **Second auth guard, independent of `ListingAuthGuard`** — `:121-125`: `useEffect(() => { if (!accessToken) goBackToPoolsList() }, [...])` → `router.replace('/pools?tab=your_pools')`. So a 401-wiped token during create-pool ejects you.
- `Review.tsx:30-60` builds the same `QrCodeWithLogo` from `addMarketResponse.wallet_public_key`, shows Token / Chain / Token Address / `$TICKER Buyback %` / Max Leverage, plus `<MinDepositWarning/>` (`:145`). Copy text `t('Only deposit {{tokenTicker}} to this address.')` (`:85`).
- **Flag**: `console.log('Final data:', data)` at `CreatePool/index.tsx:109`; commented-out `<form onSubmit={methods.handleSubmit(onSubmit)}>` at `:158`.

---

#### 4. Terms & conditions gating

`src/components/App/Pools/components/TermsAndConditionsModal/index.tsx`

- Modal id `ApplicationModal.LISTING_TERMS_AND_CONDITIONS`; open state via `useIsModalOpen` (`:18`), toggle via `useToggleListingTermsAndConditionsModal()` (`:19`, defined `applicationHooks.ts:261-263`).
- Title: `t('Market Maker Terms & Conditions')` (`:29`). Body: `t('To continue creating markets on Vibe, you need to confirm that you have read and agree to our Terms & Conditions.')` (`:33-35`).
- **Two checkboxes**:
  1. `acceptTerms` — **local `useState(true)`, pre-checked, never persisted** (`:16,38-53`). Label is a `<Trans i18nKey="I have read and agree to the <terms>Terms & Conditions</terms>">` linking to `routes.info.terms` = `/info/terms-of-service` (`src/constants/routes.ts:19`). Only effect: `disabled={!acceptTerms}` on the CTA (`:70`).
  2. "Do not show this message again." — bound directly to the **persisted** `hasSeenListingTerms` (`:21-22,55-65`); `onChange` calls `setHasSeenListingTerms(!hasSeenListingTerms)` **immediately**, not on submit. Checking it and then dismissing the modal still persists it.
- CTA `t('Agree & Continue')` → `router.push(routes.pools.createPool)` then `toggleModal()` (`:73-76`).

**Where acceptance is persisted**: `hasSeenListingTerms: boolean` in the user zustand store (`stores/user/user.ts:49,88-92`; `userTypes.ts:44,68`) → localStorage `store-user-0.0.5`. It is a **global boolean, not per-wallet** (unlike `listingAccessTokens`).

**What it blocks**: exactly one thing — the "New Pool" button's navigation. Both content components implement the identical branch:

```ts
const handleNewPool = () => {
  hasSeenListingTerms ? router.push(routes.pools.createPool) : toggleListingTermsAndConditions();
};
```

`src/components/App/Pools/DiscoverPoolsContent.tsx:83-89` and `src/components/App/Pools/YourPoolsContent.tsx:80-86`.

It blocks **nothing else**: not deposits, not the API, not `/pools/create-pool` reached by direct URL (which is guarded only by `ListingAuthGuard`), and it is never sent to the backend. The terms gate and the auth gate are entirely independent — you can see the T&C modal while signed out (Discover tab is public), accept, and then hit the signature/create-account ladder on `/pools/create-pool`.

The "New Pool" button is _also_ independently disabled by the weekly limit: `disabled={isLimitReached}` with a `<WeeklyLimitTooltip limit resetAt/>` (`DiscoverPoolsContent.tsx:159-170`, `YourPoolsContent.tsx:128-143`), where `isLimitReached = data ? data.remaining <= 0 : false` (`useWeeklyListingLimit.ts:29`) and the tooltip counts down from `reset_at` every 60 s (`WeeklyLimitTooltip.tsx:30-34`).

---

#### 5. Every error / edge case handled (and not handled)

##### Handled

| case                                                    | where                                                                                                                          | behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Wallet not connected**                                | `useListingAuth.ts:70-73`                                                                                                      | opens `WAYS_TO_TRADE` modal (`src/components/ReviewModal/WaysToTradeModal.tsx` — Privy vs wagmi chooser; clears `localStorage` keys prefixed `wagmi`/`privy` on mount at `:15-25,37-40`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Wallet still connecting**                             | `useListingAuth.ts:66-68`                                                                                                      | `triggerAuthFlow` returns early; `ListingAuthGuard.tsx:18` also waits on `!isConnecting`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **No SYMM subaccount**                                  | `useListingAuth.ts:44-47,75-78`                                                                                                | opens `CREATE_ACCOUNT` modal (`src/components/ReviewModal/CreateAccountModal.tsx`); its `handleToggleModal` refuses outside-click/Escape close once `isConfirmed` (`:35-42`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Subaccounts still loading**                           | `!isAccountsLoading` guard `useListingAuth.ts:44,75`                                                                           | flow stalls rather than mis-routing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Connected but no listing token**                      | `useListingAuth.ts:49-51,80-82`                                                                                                | opens `LISTING_SIGNATURE_REQUEST`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Signature rejected by user**                          | normalized to `Error('Transaction rejected.')` at `src/callbacks/useSignMessage.ts:16-20`; surfaces as `isError`               | modal red text "Signature was rejected. Please try again." (`ListingSignatureRequestModal.tsx:86-88`) + error toast `errorTitle: 'Listing Error'`, `errorMessage: 'Could not authenticate with the listing service.'` (`useListingLogin.ts:39-49`)                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Missing signer / no account at mutation time**        | `useListingLogin.ts:19`                                                                                                        | `throw new Error('Error')` → same error UI                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Expired / invalid token (401)**                       | `services/index.tsx:83-90`                                                                                                     | token set to `''`, `isAuthenticated` flips false, guard/`triggerAuthFlow` re-prompts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Any listing API error**                               | `services/index.tsx:82`                                                                                                        | `captureAxiosError(err, APP_POOLS_BACKEND_URL)` → PostHog (`src/utils/error-tracking.ts:76+`); listing endpoints are **not** in `posthogExclusions`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **User closes an auth modal mid-flow on a gated route** | `ListingAuthGuard.tsx:31-38`                                                                                                   | `router.replace('/pools?tab=discover')`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Token wiped while inside create-pool**                | `CreatePool/index.tsx:121-125`                                                                                                 | `router.replace('/pools?tab=your_pools')`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Already-listed token during create-pool**             | `TokenBasics.tsx:46-76,113-114,141,146`                                                                                        | query `['existingCreatePoolMarket', debouncedToken, DepositChain]` matches `contract_address.toLowerCase()` + `chain_id`; `isCreatedMarket = existingMarket && status !== Delisted`; the CTA flips from "Continue" to **"Deposit"** and calls `openDepositModal()` (`useAddDeposit`) instead of advancing the stepper. `<ExistingPoolNotice>` (`:153-303`) distinguishes `isLiveMarket` (`listed` → "This market is already live. Deposit directly instead of creating." + APR/Liquidity/24h Vol/Reward 24h stats) from `isPendingMarket` (`waiting_for_deposit` → "Market exists but trading hasn't started." + "A small deposit of $5 or more will activate the market for everyone.") |
| **Unsupported token**                                   | `TokenBasics.tsx:115-131`                                                                                                      | `error_code === 26` → red "We do not currently support this token…" + Discord link `https://discord.gg/bTRU8EQCzq`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Delisted market**                                     | `canDepositToMarket.ts:8`                                                                                                      | Deposit button disabled (`YourPoolMobileCard.tsx:169-172`, `YourPoolTableItem.tsx:220-224`) or hidden (`DiscoverPoolMobileCard.tsx:137-142`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Rejected market**                                     | `YourPoolTableItem.tsx:206-212`, `YourPoolMobileCard.tsx:150-162`                                                              | Retry + Refund buttons replace Trade/Deposit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Retry cooldown / retry limit**                        | `RetryListingButton.tsx:58-108`                                                                                                | `isCooldownActive`, `isRetryLimitReached`, `isLoadingRetryInfo` → button disabled with distinct tooltips ("Retry is available after {time}." via `formatCooldown` `:21-34`, "Retry limit reached.", "Retry this listing. {count} retries left.")                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Weekly listing limit exhausted**                      | `useWeeklyListingLimit.ts:29`; `DiscoverPoolsContent.tsx:159-170` / `YourPoolsContent.tsx:128-143` / `TokenBasics.tsx:139-148` | "New Pool"/"Continue" disabled + countdown tooltip                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Deposit-address request fails**                       | `useAddUserDeposit.ts:45-56`                                                                                                   | toast `'Listing Deposit Error'` / `'Could not add with the provided information.'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Create-market request fails**                         | `CreatePool/index.tsx:94-105`                                                                                                  | toast with server `error_message`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Retry / withdraw failure**                            | `useRetryMarketListing.ts:36-45`, `usePoolWithdraw.ts:29-39`                                                                   | toast with `error.response?.data?.error_message ?? 'Something went wrong. Please try again.'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Generic listing error body**                          | `claim-rewards-modal/utils.ts:9-15`                                                                                            | `getListingApiErrorMessage(err, fallback)` reads `{error_code, error_message, error_detail}`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Simulator mode**                                      | `src/callbacks/useSignMessage.ts:52-58`, `stores/wallet/walletUpdater.tsx:19-27`                                               | signing returns 65 zero bytes; wallet forced to `SIMULATOR_MOCK_WALLET` on `FALLBACK_CHAIN_ID`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

##### NOT handled / gaps

- **Wrong chain is not handled at all in the listing auth flow.** `useSupportedChainId()` (`src/lib/hooks/useSupportedChainId.ts:7-19`) returns false for anything but HyperEVM 999, which disables `useUserAccounts` (`enabled` at `useUserAccounts.ts:31`). With `enabled: false` + `placeholderData: []`, wagmi's `isLoading` is false, so `useListingAuth.ts:44,75` evaluates `!isAccountsLoading && !activeAccount` → **true** and the user is pushed into the **CREATE_ACCOUNT** modal instead of being told to switch networks. No `switchChain`, no "wrong network" banner anywhere in this slice.
- **No expiry awareness** — the JWT has no client-visible `exp`; only a 401 round-trip reveals it. Contrast `VibeBackAuthorizationType { accessToken, expirationTime }` (`userTypes.ts:76-79`) checked at `userHooks.ts:58`, and the "backed" service's `checkBackedAuth` → `GET /auth/me` (`src/services/backed/service.ts:65-72`). The listing service has neither.
- **No logout / no clearing on disconnect or account switch** (see §1 Step 7).
- **`src/services/pools/services.ts` requests get no 401 auto-clear** (raw axios, no interceptor).
- **All signature-modal failures read as "Signature was rejected"** even for HTTP/network faults.
- **Signature preview is fabricated** (`ListingSignatureRequestModal.tsx:74`) and never shows the real SIWE `message`; `Chain ID:` renders blank.
- **Query string not encoded** in `SignInMessage` (`services/index.tsx:159`).
- **`ListingAuthGuard` bail-out ref is over-broad** — any modal open→close on a gated route redirects (`ListingAuthGuard.tsx:24-38`); and `shallow: true` is inert on the cross-page `/pools/create-pool` → `/pools` redirect.
- **`useSignMessageV2` silently returns the string `'response'`** when no provider branch matches (`src/callbacks/useSignMessage.ts:77`) — that would be POSTed as a "signature".

---

#### 6. Dead code / TODOs / stubs found in this slice

| item                                         | location                                                      | note                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getEffectiveDeposit`, `calcUserShare`       | `src/components/App/Pools/utils/depositUtils.ts:4-14`         | **Zero importers repo-wide** (grep for `getEffectiveDeposit\|calcUserShare\|depositUtils` returns only the definition file). Entirely dead. `getEffectiveDeposit` = `fromWei(toBN(history.success).plus(toBN(history.transferred)))`; `calcUserShare` = `formatPercentage(userDeposit/totalDeposit*100, {decimalPoints:4, removeTrailingZeros:true}).percentage`, `'-'` when either is `undefined` or non-finite. Depends on `IDepositHistory { waiting, deposited, rejected, refound, success, transferred, withdraw }` (`services/types.ts:144-152`) — a shape only present on `IMarket` (`types.ts:43-64`), which itself is unused by the current search endpoints. |
| `useToggleListingSignatureRequestModal`      | `src/stores/application/applicationHooks.ts:268-270`          | exported, never imported                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `IS_POOLS_ENABLED`                           | `src/constants/environment.ts:5`                              | defined from `NEXT_PUBLIC_POOLS_ENABLE`, **never referenced** in `src/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `NEXT_PUBLIC_POOLS_CLAIM_MOCK` / `_ERROR`    | `.env:22-23` (commented)                                      | no reader in `src/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `status: MarketStatus` param                 | `useAddUserDeposit.ts:18`                                     | required by every call site, never used in the hook                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `deposit_amount` / `field_amount`            | `services/types.ts:174-175`, stored `CreatePool/index.tsx:88` | captured, never rendered                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `accessToken?` prop                          | `useTokenMetaData.ts:6` (`UseTokenMetaDataProps`)             | declared, never destructured or used                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `expirationTime?: string`                    | `services/types.ts:36` (`LoginMessage`)                       | never set client-side                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `tokenType`                                  | `LoginResponse` (`services/types.ts:40`)                      | discarded; `Bearer` hardcoded                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| dead ternary branch                          | `src/constants/misc.ts:25-27`                                 | both non-staging branches identical                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `console.log` in prod paths                  | `useAddUserDeposit.ts:46`, `CreatePool/index.tsx:109`         | debug leftovers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| commented-out form handler                   | `CreatePool/index.tsx:158`                                    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `//@ts-ignore` on error body                 | `CreatePool/index.tsx:100`; also `TokenBasics.tsx:84`         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **"Coming Soon" stub**                       | `PoolDetail/PoolDetailTabs.tsx:129-138`                       | Limit Orders tab renders `t('Coming Soon')` + "Limit orders will be available in the next update."; its tab count is hardcoded `0` (`:106`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `ComingSoonBadge` / `ComingSoonColumnsPanel` | `src/components/App/Pools/components/ui/`                     | adjacent coming-soon UI primitives                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `useOpenOrders.ts`                           | `src/components/App/Pools/services/hooks/useOpenOrders.ts`    | exists but the Limit Orders tab renders the stub instead                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| stale JSDoc                                  | `services/types.ts:312,353,363,388`                           | comments say `GET /v2/market`, `GET /v2/profit/...`, `POST /v2/market/withdraw`, `POST /v2/claim` while the axios paths are `/market`, `/profit/{addr}`, `/market/withdraw`, `/claim` (the `/v2/` comes from `baseURL`)                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| hardcoded "Logged In" pill                   | `ListingSignatureRequestModal.tsx:65-67`                      | static, not derived from any state                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

---

#### 7. Compact handshake diagram

```
[user clicks Deposit / Retry / Refund / Withdraw / opens ?tab=your_pools or /pools/create-pool]
        │
        ▼  triggerAuthFlow(cb)        useListingAuth.ts:54
   isAuthenticated? ── yes ──► cb()                      // Boolean(account && activeAccount && accessToken)
        │ no
        ├─ isConnecting ──────────────► wait
        ├─ !isConnected ──────────────► modal WAYS_TO_TRADE           (Privy | wagmi)
        ├─ no subaccount ─────────────► modal CREATE_ACCOUNT          (AccountLayer.getUserSubAccounts read)
        └─ no token ──────────────────► modal LISTING_SIGNATURE_REQUEST
                                            │  "Accept and Sign"
                                            ▼  useListingLogin.mutate()
        GET  /v2/auth/sign-in-message?address&domain=host&uri=origin   → { message, params(nonce,chainId,issuedAt,statement,…) }
                                            ▼
        personal_sign(message)   via viem walletClient.signMessage | Privy embedded | Pimlico(EIP-1271)
                                            ▼
        POST /v2/auth/login  { message: params, signature }            → { accessToken, tokenType }
                                            ▼
        updateListingAccessToken(account, accessToken)
          → zustand `user` store → localStorage["store-user-0.0.5"].state.listingAccessTokens[account]
                                            ▼
        every api.* request:  Authorization: Bearer <token>            (services/index.tsx:62-77)
        any 401:              updateListingAccessToken(account, '')    (services/index.tsx:83-90) → re-prompt
                                            ▼
        useListingAuth effect sees isAuthenticated → fires pendingCallbackRef  → e.g.
        POST /v2/market/deposit-address {token_contract_address, deposit_chain}
              → { wallet_public_key }  → modalOptions.LISTING + openModal=LISTING
                                            ▼
        ListingDepositModal: chain label, token name, QR(wallet_public_key), copy address,
        "Minimum deposit amount is $5.", "Confirm Deposit" → refetchPoolsData() + close.
        (no amount input, no memo, no chain switch, no detection polling)
```

---

## 7. Withdraw and claim rewards

### Vibe-ui — Pool WITHDRAW + CLAIM REWARDS slice map

Everything below is anchored to `/symmio/Vibe-ui`. Paths are repo-relative.

---

#### 0. Headline answer to question 3 (backend-mediated vs contract write)

**Both flows are 100% backend-mediated HTTP POSTs to the Enigma "listing" service. There is not a single contract write anywhere in either flow.**

Proof: `grep -rn "writeContract|useSendTransaction|useContractWrite|prepareTransaction|sendTransaction" src/components/App/Pools/` returns **zero matches**.

- Withdraw = `POST {APP_POOLS_BACKEND_URL}/market/withdraw` — `src/components/App/Pools/services/index.tsx:251-253`.
- Claim = `POST {APP_POOLS_BACKEND_URL}/claim` — `src/components/App/Pools/services/index.tsx:259-261`.

The only wallet interaction in the whole slice is an **off-chain SIWE-style `personal_sign`** used once to obtain a bearer token (`src/components/App/Pools/services/hooks/useListingLogin.ts:24-37`), explicitly labelled "does not initiate a transaction or cost any gas" (`src/components/App/Pools/components/ListingSignatureRequestModal/index.tsx:82`).

The only **contract reads** in the slice are in the claim modal's account list (see §2.3): `getUserSubAccounts` (AccountLayer), `balanceOf` (Diamond/LowcapDiamond), `getPartyAOpenPositions` (Diamond) — all read-only, all for display.

---

#### 1. Shared plumbing (auth, axios instance, base URL)

##### 1.1 Axios instance and base URL

`src/components/App/Pools/services/index.tsx:41-44`

```ts
const api = axios.create({ baseURL: APP_POOLS_BACKEND_URL, timeout: 20000 });
```

`APP_POOLS_BACKEND_URL` resolves in `src/constants/misc.ts:23-27`:

```ts
export const APP_POOLS_BACKEND_URL = IS_BACKEND_STAGING_ENV
  ? "https://listing-staging.enigma.bz/v2/"
  : IS_TEST_ENVIRONMENT
    ? "https://listing85.enigma.bz/v2/"
    : "https://listing85.enigma.bz/v2/";
```

- `IS_BACKEND_STAGING_ENV = process.env.NEXT_PUBLIC_BACKEND_ENVIRONMENT === 'staging'` (`src/constants/environment.ts:2`)
- `IS_TEST_ENVIRONMENT = process.env.NEXT_PUBLIC_IS_TEST_ENVIRONMENT === 'true'` (`src/constants/environment.ts:1`)
- **Dead branch:** the `IS_TEST_ENVIRONMENT` ternary and the fallback are the _same_ string `https://listing85.enigma.bz/v2/`. `IS_TEST_ENVIRONMENT` is a no-op for this URL.
- Pools are also feature-flagged globally by `IS_POOLS_ENABLED = process.env.NEXT_PUBLIC_POOLS_ENABLE === 'true'` (`src/constants/environment.ts:5`).

So real request URLs are `https://listing85.enigma.bz/v2/market/withdraw` and `https://listing85.enigma.bz/v2/claim` (note leading `/` in the paths + trailing `/` in baseURL — axios resolves this to `/v2/market/withdraw`, i.e. the `/v2/` prefix is preserved only because axios joins baseURL path + relative path; `PostWithdraw` uses `'/market/withdraw'` and `getMarketSearch` uses `'market/search'` — **inconsistent leading slashes across the file**, e.g. `index.tsx:135` vs `index.tsx:252`).

##### 1.2 Bearer token injection (request interceptor)

`src/components/App/Pools/services/index.tsx:62-77`

```ts
const account = useWalletStore.getState().account;
const listingAccessTokens = useUserStore.getState().listingAccessTokens;
const accessToken = account ? listingAccessTokens?.[account] : undefined;
if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
```

Token store shape: `listingAccessTokens: { [account: string]: string }` (`src/stores/user/userTypes.ts:43`), written by `updateListingAccessToken` (`src/stores/user/user.ts:81-86`). The user store is `createZustandStore(..., true)` with **no partialize**, so tokens are persisted to localStorage under `store-user-0.0.5` (`src/utils/store.ts:9,40`).

##### 1.3 401 handling (response interceptor)

`src/components/App/Pools/services/index.tsx:79-93` — on `401` it calls `updateListingAccessToken(account, '')`, wiping the token. Consequence for this slice: `isAuthenticated` flips false → `useUserProfit` becomes `enabled: false` → withdraw/claim modals immediately show `'0'`/`'—'` and disable their CTA. Every error is also piped to PostHog via `captureAxiosError(err, APP_POOLS_BACKEND_URL)` (`src/utils/error-tracking.ts`).

##### 1.4 Auth gate

`src/components/App/Pools/services/hooks/useListingAuth.ts`

- `isAuthenticated = Boolean(account && activeAccount && accessToken)` (`:24`) — wallet address AND an active SubAccount AND a listing bearer token.
- `triggerAuthFlow(cb?)` (`:54-85`) advances: not connected → `ApplicationModal.WAYS_TO_TRADE`; connected but no subaccount → `CREATE_ACCOUNT`; subaccount but no token → `LISTING_SIGNATURE_REQUEST`. Callback fires once fully authed via a `useEffect` watcher (`:30-52`) using `pendingCallbackRef`/`isAuthFlowTriggeredRef`.

##### 1.5 The signature (the only wallet prompt)

`src/components/App/Pools/services/hooks/useListingLogin.ts:10-38`

1. `GET /auth/sign-in-message?address={account}&domain={window.location.host}&uri={window.location.origin}` → `GetSignInMessageResponse { message, params: SignInMessageParams }` (`services/index.tsx:156-160`, types `services/types.ts:4-18`).
2. `signMessageCallback(message)` from `useSignMessageV2()` (`src/callbacks/useSignMessage.ts:30-80`) — wagmi `provider.signMessage({message})`, or Privy embedded wallet, or Pimlico smart account. In `IS_SIMULATOR_MODE` it returns a fake `'0x' + '00'.repeat(65)` (`src/callbacks/useSignMessage.ts:52-58`).
3. `POST /auth/login` body `{ message: params, signature }` → `LoginResponse { accessToken, tokenType }` (`services/index.tsx:162-164`, types `:22-41`).

**Hack/dead code:** `ListingSignatureRequestModal/index.tsx:74` renders a _fake preview_ of the message it is about to sign, hard-coded and ending in `Chain ID: ${activeAccount.accountAddress ? '' : ''}` — a ternary whose both branches are `''`. The real message from the server is never shown. The whole modal is also un-i18n'd (raw English strings) unlike the rest of the Pools tree.

---

#### 2. WITHDRAW FLOW — end to end

##### 2.1 Entry point & gating

- Button: `src/components/App/Pools/components/PoolDetail/PoolDetailHeader.tsx:52-55` (`<Upload/>` + `t('Withdraw')`, `variant="dark"`), rendered in both mobile and desktop layouts (`:105-125`).
- Handler: `src/components/App/Pools/components/PoolDetail/index.tsx:44-47`
  ```ts
  const handleWithdraw = useCallback(() => {
    if (!market) return;
    triggerAuthFlow(() => toggleWithdrawModal({ market, refetchPoolsData: refetch }));
  }, [triggerAuthFlow, toggleWithdrawModal, market, refetch]);
  ```
  `refetch` = `useMarketDetail(contractAddress).refetch` (query key `['marketDetail', contractAddress, depositChain]`, `services/hooks/useMarketDetail.ts:11`).
- Store toggler: `src/stores/application/applicationHooks.ts:304-314` (`useTogglePoolWithdrawModal`) sets `openModal: POOL_WITHDRAW` + `modalOptions: { POOL_WITHDRAW: { market, refetchPoolsData } }`.
- Mount: `src/components/Layout/index.tsx:200` — `{showPoolWithdrawModal && <PoolWithdrawModal {...modalOptions?.POOL_WITHDRAW} />}`.
- `ApplicationModal.POOL_WITHDRAW = 'POOL_WITHDRAW'` (`src/stores/application/applicationTypes.ts:57`).

**There is NO withdraw entry point on the pools list / "Your Pools" table** — only the pool-detail header. (grep for `PoolWithdrawModal|toggleWithdrawModal` finds nothing in `YourPoolsContent.tsx`, `PoolsTable/*`, `PoolsList/*`.)

##### 2.2 Data source: `useUserProfit`

`src/components/App/Pools/services/hooks/useUserProfit.ts`
| aspect | value |
|---|---|
| call | `GET /profit/{token_contract_address}` (`services/index.tsx:232-234`) |
| response type | `UserProfitResponse` (`services/types.ts:354-361`) |
| query key | `['userProfit', contractAddress]` (`:11`) |
| enabled | `Boolean(contractAddress && isAuthenticated && marketStatus === MarketStatus.Listed)` (`:16`) |
| staleTime | `10 * 60 * 1000` (10 min) (`:17`) |
| refetchInterval | `10 * 60 * 1000` (10 min) (`:18`) |

`UserProfitResponse` fields (`services/types.ts:354-361`):

```ts
user_balance_in_tokens: string; // 1e18
user_balance_in_usdc: string; // 1e18
claimable_reward: string; // NOT 1e18 — plain decimal (see §3.2)
user_deposited_token_amount: string;
user_lp_amount: string; // 1e18
pending_withdraw_lp_amount: string; // 1e18, already included in user_lp_amount but locked
```

`MarketStatus.Listed = 'listed'` (`src/components/App/Pools/types.ts:60`).

**Eligibility rules, precisely:**

1. Wallet connected + active SubAccount exists + listing bearer token present (else `triggerAuthFlow` intercepts before the modal opens at all).
2. `market.market_status === 'listed'` — otherwise `useUserProfit` is disabled, `userProfit` is `undefined`, all balances read `'0'`, `hasBalance === false`, CTA disabled. (The modal still opens and still renders the pool card with e.g. `Under Review` status — there is no explicit "not withdrawable" message.)
3. `availableLp > 0` (`PoolWithdrawModal/index.tsx:62`).
4. `percentage > 0`.
5. A valid recipient address.

##### 2.3 Max-amount math — transcribed verbatim

`src/components/App/Pools/components/PoolWithdrawModal/index.tsx:48-67`

```ts
const totalLp = toBN(userProfit?.user_lp_amount ?? "0"); // :48
const pendingLp = toBN(userProfit?.pending_withdraw_lp_amount ?? "0"); // :49
const availableLp = totalLp.minus(pendingLp); // :50
const availableRatio = totalLp.isZero() ? BN_ZERO : availableLp.div(totalLp); // :51
const pendingRatio = totalLp.isZero() ? BN_ZERO : pendingLp.div(totalLp); // :52

const totalTokenBalanceWei = userProfit?.user_balance_in_tokens ?? "0"; // :54
const totalUsdcBalanceWei = userProfit?.user_balance_in_usdc ?? "0"; // :55
const pendingTokenBalanceWei = toBN(totalTokenBalanceWei).times(pendingRatio).toFixed(0); // :56
const pendingUsdcBalanceWei = toBN(totalUsdcBalanceWei).times(pendingRatio).toFixed(0); // :57
const tokenBalanceWei = toBN(totalTokenBalanceWei).times(availableRatio).toFixed(0); // :58
const usdcBalanceWei = toBN(totalUsdcBalanceWei).times(availableRatio).toFixed(0); // :59
const tokenBalance = Number(fromWei(tokenBalanceWei)); // :60
const usdcBalance = Number(fromWei(usdcBalanceWei)); // :61
const hasBalance = availableLp.gt(0); // :62

const estimatedToken = (tokenBalance * percentage) / 100; // :66
const estimatedUsdc = (usdcBalance * percentage) / 100; // :67
```

And the **actually submitted amount** (`:101`):

```ts
const withdrawLpAmount = availableLp.times(percentage).div(100).toFixed(0);
```

i.e. `amount = (user_lp_amount − pending_withdraw_lp_amount) × percentage / 100`, in **1e18 LP units**, stringified integer.

Rounding: `src/utils/numbers.ts:5` only configures `BigNumber.config({ EXPONENTIAL_AT: 30 })`; `ROUNDING_MODE` is left at BigNumber's default `ROUND_HALF_UP(4)`. So `.toFixed(0)` **rounds half-up**, not floor — it can theoretically emit 1 wei more than available. At `percentage === 100` the value is exactly `availableLp`, so "max" is exact.

`toBN`/`fromWei`/`toWei` definitions: `src/utils/numbers.ts:7-9`, `:46-53`, `:34-36`. `BN_ZERO` `:11`.

The **same pending-ratio math is duplicated** in `PoolDetail/SummaryCards/BalanceCard.tsx:22-25` (`pendingWithdrawalRate = pendingWithdrawalLpAmount / userLpAmount`, then `× usdcBalance` / `× tokenBalance`) — copy of the modal's logic, not shared.

##### 2.4 Percentage input UI

- `PERCENTAGE_PRESETS = [10, 25, 50, 75, 100] as const` (`PoolWithdrawModal/index.tsx:24`), rendered as 5 buttons (`:287-299`).
- Radix slider `min=0 max=100 step=1` (`:267-274`), component at `src/components/App/Pools/components/ui/Slider/index.tsx`.
- Free-text numeric input clamped by `handlePercentageInput` (`:117-125`): `''` → 0; `NaN` → ignored (value not applied but the input is controlled by `percentage`, so typing a letter is silently dropped); otherwise `Math.min(100, Math.max(0, Math.round(num)))`.

##### 2.5 Recipient address rules

`PoolWithdrawModal/index.tsx:69-86`

```ts
const isSolanaMarket = market?.deposit_chain === DepositChain.Solana; // :69   (DepositChain.Solana === 0)
const recipientAddress = isSolanaMarket || !useConnectedWalletAddress ? withdrawAddress.trim() : connectedWalletAddress; // :70-71
const addressError = useMemo(() => {
  if (!market) return null;
  if (!recipientAddress) return t("Withdraw address is required.");
  if (isSolanaMarket) return isSolanaAddress(recipientAddress) ? null : t("Enter a valid Solana address.");
  try {
    getAddress(recipientAddress);
    return null;
  } catch {
    // @ethersproject/address checksum
    return t("Enter a valid EVM address.");
  }
}, [isSolanaMarket, market, recipientAddress, t]); // :72-86
```

- `DepositChain` enum: `Solana = 0, Base = 8453, BSC = 56, ARBITRUM_ONE = 42161, SONIC = 146` (`src/components/App/Pools/types.ts:73-79`).
- For Solana markets the "Connected / Other address" toggle is hidden entirely (`:333`) and manual entry is forced (`:406`).
- Reset-on-open effect (`:90-97`): `shouldUseConnectedWallet = market?.deposit_chain !== DepositChain.Solana`; sets `withdrawAddress` to `connectedWalletAddress` or `''`; clears `isWithdrawAddressTouched`.
- Paste helper `handlePasteWithdrawAddress` (`:127-135`) uses `navigator.clipboard.readText()`, swallows rejection. Copy helper `handleCopyConnectedAddress` (`:137-144`) uses `navigator.clipboard.writeText`.
- Input `onChange` does `e.target.value.trim()` (`:413`) — trims _while typing_, so a leading space can never be typed (benign but note it).

**`isSolanaAddress` is a weak, unanchored regex** — `src/utils/validate.ts:26-28`:

```ts
export const isSolanaAddress = (address: string) => /[1-9A-HJ-NP-Za-km-z]{32,44}/.test(address);
```

No `^...$` anchors, no length cap enforcement, no base58 checksum. Any string _containing_ ≥32 base58 chars passes — including many EVM addresses that happen not to contain `0`, `I`, `O`, or `l` in a 32-char run.

##### 2.6 The write (submit)

`PoolWithdrawModal/index.tsx:99-115`

```ts
const handleWithdraw = () => {
  if (!market || isDisabled) return;
  const withdrawLpAmount = availableLp.times(percentage).div(100).toFixed(0);
  mutate(
    { amount: withdrawLpAmount, market_address: market.token_contract_address, withdraw_address: recipientAddress },
    {
      onSuccess: () => {
        refetchPoolsData?.();
        toggleModal();
      },
    },
  );
};
```

`isDisabled = percentage === 0 || isPending || !hasBalance || Boolean(addressError)` (`:88`).

Hook: `src/components/App/Pools/services/hooks/usePoolWithdraw.ts`

```ts
useMutation({
  mutationFn: (payload: WithdrawRequest) => PostWithdraw(payload), // :15
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["GetTransactionHistory"] }); // :17
    queryClient.invalidateQueries({ queryKey: ["userProfit"] }); // :18
    addPopup({
      content: {
        toastType: ToastType.SUCCESS,
        props: {
          successTitle: t("Withdrawal Submitted"),
          successMessage: t("Your withdrawal request has been submitted successfully."),
        },
      },
    }); // :19-27
  },
  onError: (error: AxiosError<TokenSupportError>) => {
    addPopup({
      content: {
        toastType: ToastType.ERROR,
        props: {
          errorTitle: t("Withdrawal Failed"),
          errorMessage: error.response?.data?.error_message ?? t("Something went wrong. Please try again."),
        },
      },
    }); // :29-39
  },
});
```

- No `mutationKey`.
- `['userProfit']` is a **prefix** invalidation → invalidates every market's profit query, not just this one.
- `['GetTransactionHistory']` prefix matches the full key `['GetTransactionHistory', marketAddress, walletAddress, start, size]` (`services/hooks/useTransactionHistory.ts:26`).

**The HTTP call itself** — `src/components/App/Pools/services/index.tsx:251-253`:

```ts
export async function PostWithdraw(data: WithdrawRequest) {
  return api.post("/market/withdraw", data);
}
```

| field         | value                                                                                                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| method / URL  | `POST https://listing85.enigma.bz/v2/market/withdraw`                                                                                                                  |
| auth          | `Authorization: Bearer <listingAccessTokens[account]>` via interceptor                                                                                                 |
| body          | `WithdrawRequest` (`services/types.ts:363-369`): `{ amount: string /* LP in 1e18 */, market_address: string, withdraw_address: string, description?: string \| null }` |
| response type | **untyped** — `api.post(...)` has no generic; returns `AxiosResponse<any>`. The response body is discarded entirely.                                                   |
| timeout       | 20 000 ms                                                                                                                                                              |

`description` is declared optional in the type and **never sent** by any caller — dead field.

##### 2.7 Cooldown / lock rules

- Hard-coded client-side constant: `export const WITHDRAWAL_COOLDOWN_DAYS = 14` (`src/components/App/Pools/constants.ts:3`). It is **not** returned by any API — the client asserts 14 days on its own.
- Displayed pre-submit in the "Available in" row: `PoolWithdrawModal/index.tsx:320-326` → `<Clock size={14} /> {WITHDRAWAL_COOLDOWN_DAYS} {t('Day')}` — **copy bug: renders "14 Day" (singular)**. The detail modal uses `t('Days')` (plural) at `WithdrawalDetailModal/index.tsx:112`.
- Countdown math: `src/components/App/Pools/utils.ts:3-4`
  ```ts
  export const getDaysLeft = (createTime: number) =>
    Math.max(0, Math.ceil((createTime + WITHDRAWAL_COOLDOWN_DAYS * 86400 - Date.now() / 1000) / 86400));
  ```
  `createTime` is `ITransactionHistory.time` (unix seconds).

##### 2.8 Pending state & how the UI reflects each phase

**Phase A — before submit (locked LP visible).** `pending_withdraw_lp_amount` is subtracted from the max and surfaced in two places:

- Two "Available · Token" / "Available · USDC" tiles wrapped in `AvailableBalanceTooltip` (`PoolWithdrawModal/index.tsx:229-261`, component at `:473-503`), whose tooltip shows three rows: `Total` / `Pending Withdrawal` / `Available` (`:491-494`), rendered by `BalanceTooltipRow` (`:505-514`).
- The pool-detail `BalanceCard` tooltip adds a "Pending Withdrawal ({rate}%)" block when `pendingWithdrawalLpAmount > 0` (`SummaryCards/BalanceCard.tsx:25, 57-62`), showing `~USDC` and `~token` amounts.

**Phase B — in-flight.** `isPending` from the mutation → button text `t('Withdrawing...')` and the `{percentage}%` chip is hidden (`PoolWithdrawModal/index.tsx:459-462`); button disabled via `isDisabled`.

**Phase C — accepted.** Success toast + `refetchPoolsData()` (market detail) + modal close + two query invalidations. Modal state is _not_ reset on close (percentage keeps its value; only the address block resets on next open via the `isOpen` effect at `:90-97`).

**Phase D — pending row in history.** `GET /market/transaction-history/{start}/{size}?market_address=..&wallet_address=..` (`services/index.tsx:236-249`) → `TransactionHistoryResponse { market_address, count, data: ITransactionHistory[] }` where `ITransactionHistory = { wallet_address, usdc_amount, token_amount, type: 'deposit'|'withdraw', status: 'pending'|'rejected'|'refund'|'success', time }` (`services/types.ts:371-386`).

- Hook `useTransactionHistory` — key `['GetTransactionHistory', marketAddress, walletAddress, start, size]`, `enabled: Boolean(marketAddress)`, `staleTime: 30_000`, **no refetchInterval** (`services/hooks/useTransactionHistory.ts:19-38`).
- Table `PoolDepositsWithdrawalsTable.tsx` — columns `action / amount / date / status`, paginated 10/page, `ActionFilter.All | ActionFilter.Yours` (`:11-14`), `Yours` passes `wallet_address = connected EOA` (`:29`).
- Row `TransactionRow.tsx:14-48`; status pill `StatusBadge.tsx:5-11` maps `pending → 'Pending'` (`--color-pending-base`), `success → 'Completed'`, `rejected → 'Rejected'`, `refund → 'Refunded'`.
- Amount cell `AmountCell.tsx:31-81`: for a pending withdrawal the sign prefix is `'~'` (approximate) instead of `'-'` (`:42`), colour switches to `text-strong`, and an info button appears (`:74-78`) that opens the detail modal with a **snapshot** payload (`:47-58`):
  ```ts
  toggleWithdrawalDetail({
    entry: { daysLeft: getDaysLeft(time), tokenAmount, tokenTicker, usdcAmount, date: time },
    market,
  });
  ```

**Phase E — detail modal.** `WithdrawalDetailModal/index.tsx`

- `WithdrawalDetailEntry = { daysLeft: number; tokenAmount: number; tokenTicker: string; usdcAmount: number; date: number }` (`:15-21`) — exported and re-imported by the store (`src/stores/application/applicationHooks.ts:1,29`).
- Opens on `ApplicationModal.POOL_WITHDRAWAL_DETAIL` (`:30`), toggler `useToggleWithdrawalDetailModal` (`applicationHooks.ts:316-326`), mounted at `src/components/Layout/index.tsx:201`.
- Renders: pool identity + status dot from `poolStatusMapper` (`constants.ts:19-40`), chain badge from `DEPOSIT_CHAIN_OPTIONS` (`constants.ts:6-12`), "Your Balance" from `useUserProfit` **totals (not pending-adjusted)** (`:45-46`), `Requested at` = `dayjs(entry.date * 1000).format('YYYY/MM/DD - HH:mm')` (`:43`), `Available in {entry.daysLeft} Days` (`:110-114`), estimated token/USDC prefixed with `~` (USDC row only when `> 0`, `:127`), and the disclaimer `t('Amounts might differ at withdrawal fulfillment')` (`:141`).
- `daysLeft` is **frozen at click time** (computed in `AmountCell` and stored in `modalOptions`); it does not tick while the modal is open.

**No claim/finalize step exists for the matured withdrawal.** Nothing in the codebase lets the user "collect" after 14 days — the backend is assumed to push funds to `withdraw_address` and the history row flips `pending → success`.

##### 2.9 Withdraw disclaimers

`PoolWithdrawModal/index.tsx:464-466`: `t('Final withdrawal amounts may vary slightly at fulfillment time.')`; and in the manual-address branch `t('Double-check the address. Withdrawals are irreversible.')` (`:442`), which is shown as the _default_ (yellow `TriangleAlert`) state and replaced by the red error only when touched+invalid (`:433-445`).

---

#### 3. CLAIM REWARDS FLOW — end to end

##### 3.1 Entry point

- Card: `PoolDetail/SummaryCards/ClaimableRewardsCard.tsx:16-51`. Value = `userProfit?.claimable_reward ?? '0'` formatted with `abbreviate: true` + literal `USDC` (`:22-37`). Button disabled iff `claimableReward === '0'` — a **strict string comparison**, so `'0.0'`, `'0.00'`, or `''` from the backend would leave the button enabled (`:43`).
- Click → `openClaimRewardsModal({ market })` (`:44`) → `useToggleClaimRewardsModal` (`src/stores/application/applicationHooks.ts:275-284`) sets `openModal: CLAIM_REWARDS` + `modalOptions: { CLAIM_REWARDS: { market } }`.
- The whole card is auth-gated: `SummaryCards/index.tsx:46-50` renders `<AuthGatedPlaceholder label="Claimable Rewards" onSignIn={onSignIn}/>` when `!isAuthenticated` ("Sign to view your balance", `AuthGatedPlaceholder.tsx:15`).
- Mount: `src/components/Layout/index.tsx:196` — `{showClaimRewardsModal && <ClaimRewardsModal />}` (takes **no props**; it reads `modalOptions` itself).

##### 3.2 Claimable amount computation

There is **no client-side computation**. `claimable_reward` comes straight from `GET /profit/{token_contract_address}` and is rendered as-is:
`claim-rewards-modal/index.tsx:45-47`

```ts
const claimableRewardsAmount = userProfit?.claimable_reward
  ? formatPrice(userProfit.claimable_reward, { addDollarSign: false, abbreviate: true }).price
  : "—";
```

Note: **no `fromWei`** here nor in `ClaimableRewardsCard.tsx:22-37`, while every other `UserProfitResponse` field is passed through `fromWei` — so `claimable_reward` is a **plain decimal USDC string**, unlike the sibling 1e18 fields. Confirmed by the submit path, which re-multiplies it: `amount: toWei(claimableReward)` (`:84`, `toWei` = `toBN(x).times(10^18).toFixed(0)`, `src/utils/numbers.ts:34-44`) — i.e. **the API takes 1e18 but returns decimal**.

**Claiming is all-or-nothing.** There is no amount input, slider, or partial claim; the payload always carries the full `claimable_reward`.

##### 3.3 What an "account item" is — per-account fan-out

An account item is a **SubAccount**, not a virtual account. Source: `useUserAccounts()` (`src/services/blockchain/hooks/useUserAccounts.ts:9-63`):

- **Contract read** — `AccountLayer` (`useAccountLayerContract()` → `ACCOUNT_LAYER_ADDRESS` + `ACCOUNT_LAYER_ABI`, `src/hooks/useContract.ts:46-48`), `functionName: 'getUserSubAccounts'`, `args: [account, 0n, 9999n]` (`:22-23`).
- `select` filters `item.isExists`, then classifies by `item.symmioCore.toLowerCase() === LOWCAP_DIAMOND_ADDRESS[chainId].toLowerCase() ? SubAccountType.Vibecaps : SubAccountType.Major` and maps to `Account { type, name, owner, accountAddress }` (`:32-49`; `Account`/`SubAccountType` in `src/types/user.ts:3-13`).
- `refetchInterval` 5 min (or 4 s when `ActiveChecking`), `staleTime` = half of that, `placeholderData: []`, `refetchOnEachLastTxHash: true` (`:16-31, 52`).

The modal's list (`claim-rewards-modal/index.tsx:146-159`) renders one `ClaimRewardsAccountItem` per SubAccount. **Each row independently fans out two more reads** (`ClaimRewardsAccountItem.tsx:24-25`):

1. `useBalanceOf({ account })` (`src/services/blockchain/hooks/use-balance-of.ts:14-46`) — Diamond `balanceOf(account.accountAddress)`; contract chosen by **that row's** type: `useDiamondContract(account?.type === SubAccountType.Vibecaps)` → `LOWCAP_DIAMOND_ADDRESS` else `DIAMOND_ADDRESS`, ABI `SYMMIO_ABI` (`src/hooks/useContract.ts:34-38`). `refetchInterval: balanceFetchRate` (`REFRESH_RATES.IDLE = 12500`, `HIGH = 4000`; `src/checker/quotes/FetchRateChecker.tsx:9-12`, default `src/stores/quotes/quotes.ts:114`), `placeholderData: keepPreviousData`, `refetchOnEachLastTxHash: true`.
2. `useUpnl(account.accountAddress)` (`src/hooks/quotes/useUpnl.ts:9-34`) → `useOpenPositions(accountAddress, undefined)` → Diamond `getPartyAOpenPositions(accountAddress, 0n, 200n)`, `refetchInterval 15_000`, `staleTime 7_500` (`src/services/quotes/hooks/useOpenPositions.ts:25-35`), then sums `getQuoteUpnlAndPnl` per position against `useHedgerStore.prices()`.

**Bug in the fan-out:** `useUpnl` is called _without_ `subAccountType` (`ClaimRewardsAccountItem.tsx:25`). In `useOpenPositions`, `targetAddress = subAccountType ? diamondAddress : diamondContract.address` (`:19`) — so it falls back to `useDiamondContract()` **with no argument**, which resolves off the globally _active_ account's type (`src/hooks/useContract.ts:35-37`), not the row's. It also loses the `isVibecaps` short-circuit (`useOpenPositions.ts:23,31` — "VibeCaps positions live in VAs, not the SubAccount itself, so querying the SubAccount always returns empty. Skip the RPC call entirely."). Result: lowcap rows issue a pointless RPC against whichever diamond the active account implies and always display `Unrealized PNL $0.00`.

Row UI: name + `<ThemedTag.Subaccount type={account.type}/>`, uPNL coloured `text-main-light-blue` (>0) / `text-main-pink` (<0), an `ThemedSwitch.OnOff` bound to selection, and `{depositedBalance} {symbol}` where `symbol = getTokenWithFallbackChainId(COLLATERAL_TOKEN, chainId)?.symbol ?? 'USDC'` (`ClaimRewardsAccountItem.tsx:26-29, 41-66`; `src/utils/token.ts:52-55`, `src/constants/tokens.ts:10-16`).

Selection: `hasAppliedOpenDefaultsRef` guards a one-shot default to `accounts[0]` on open (`index.tsx:25, 56-69`); the ref resets when the modal closes. Search box appears only when `accounts.length > 4` (`:49`), filtered by `filterSubaccounts(accounts, search)` (`src/components/App/Sidebars/components/AccountsAndInProgress/components/subaccountSearchUtils.ts:11-46` — matches name substring, 1-based index, `0x1234…abcd` ellipsis prefix/suffix form, and address substring when `query.length >= 3`, plus a punctuation-stripped normalized match). Empty-state copy `t('No subaccounts found')` (`:157`).

##### 3.4 The claim call

`claim-rewards-modal/index.tsx:75-120`

```ts
const contractAddress = market?.token_contract_address
const claimableReward = userProfit?.claimable_reward
if (!selectedAccount || !contractAddress || market.deposit_chain == null || !claimableReward) return   // :79-81

const claimPayload: ClaimProfitRequest = {
  amount: toWei(claimableReward),                       // :84  → 1e18 integer string
  deposit_chain: market.deposit_chain,                  // :85
  token_contract_address: contractAddress,              // :86
  account_address: selectedAccount.accountAddress,      // :87  ← destination SubAccount
}
await claimProfitMutation.mutateAsync(claimPayload)                                    // :91
queryClient.invalidateQueries({ queryKey: ['userProfit', contractAddress] })           // :93
onClose()                                                                              // :95
addPopup(SUCCESS: t('Rewards claimed') / t('Rewards have been sent to {{accountName}}.', { accountName: selectedAccount.name })) // :97-107
```

Hook `services/hooks/useClaimProfit.ts:5-10` — `mutationKey: ['ClaimProfit']`, `mutationFn: (payload) => ClaimProfit(payload).then(res => res.data)`. **No `onSuccess`/`onError`** in the hook; everything is handled at the call site.

| field          | value                                                                                                                                                                                                     |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| method / URL   | `POST https://listing85.enigma.bz/v2/claim` (`services/index.tsx:259-261`)                                                                                                                                |
| auth           | `Authorization: Bearer <listing token>` via interceptor                                                                                                                                                   |
| request type   | `ClaimProfitRequest { token_contract_address: string; deposit_chain: number; account_address: string; amount: number \| string }` (`services/types.ts:389-394`)                                           |
| response type  | `ClaimProfitResponse { status: string; amount: string; claim_request_id: string }` (`services/types.ts:396-401`) — doc comment: _"success means USDC was moved to the subaccount; claim is synchronous."_ |
| response usage | resolved and **discarded**; `status` / `claim_request_id` are never read                                                                                                                                  |
| timeout        | 20 000 ms                                                                                                                                                                                                 |

**Batching: none.** One request per click, for exactly one `account_address`. There is no multi-select, no per-pool aggregation, no "claim all". The only fan-out is read-side (balances/uPNL per row).

**Invalidation on claim:** only `['userProfit', contractAddress]` (`:93`). It does **not** invalidate `['GetTransactionHistory']`, does **not** call `refetchPoolsData`/`marketDetail`, and does **not** refetch the destination subaccount's on-chain `balanceOf` — that row only updates on its own `balanceFetchRate` timer (12.5 s idle) or the `refetchOnEachLastTxHash` hook, which never fires here because no tx hash is produced.

##### 3.5 Claim gating & button states

```ts
const isSubmitting = claimProfitMutation.isPending; // :122
const isSelectedInFiltered = filteredAccounts.some((a) => a.accountAddress === selectedAccount?.accountAddress); // :123
const canRequest =
  isSelectedInFiltered &&
  market?.token_contract_address &&
  market?.deposit_chain != null &&
  userProfit?.claimable_reward &&
  !isUserProfitLoading; // :125-130
const isRequestDisabled = !canRequest || isSubmitting; // :132
```

In-flight the button shows `t('Request sent')` + `ThemedLoading.ThreeStaticDots` (`:162-166`) — **misleading copy**: it says "Request sent" while the request is still pending, not after.

##### 3.6 Claim error path

`:108-119` → `getListingApiErrorMessage(err, t('Something went wrong. Please try again.'))` with `key: 'claim-rewards-error'` for popup dedupe.
`claim-rewards-modal/utils.ts:9-15`:

```ts
export function getListingApiErrorMessage(err: unknown, fallback: string) {
  if (!isAxiosError(err)) return fallback;
  const data = err.response?.data as ListingApiErrorBody | undefined;
  return data?.error_message ?? fallback;
}
```

with `ListingApiErrorBody = { error_code?: number; error_message?: string; error_detail?: string | null }` (`:3-7`) — a duplicate of `TokenSupportError` in `services/types.ts:212-216` (which the withdraw hook uses instead). **Two parallel error-body types for the same API.** `getListingApiErrorMessage` is used in exactly one place.

Note the modal closes (`onClose()` at `:95`) _before_ the success popup; on error it stays open.

---

#### 4. All error & edge cases (consolidated)

**Withdraw**

1. `market` undefined → `PoolWithdrawModal` returns `null` after hooks (`:146`); `Layout` still gates on `showPoolWithdrawModal`, so an open modal with no `modalOptions` renders nothing (empty overlay-less state).
2. `market_status !== 'listed'` → profit query disabled → all zeros → CTA permanently disabled with **no explanatory message**.
3. `user_lp_amount === '0'` → `availableRatio = pendingRatio = BN_ZERO` via the `totalLp.isZero()` guards (`:51-52`) — divide-by-zero avoided.
4. `pendingLp === totalLp` (everything already queued) → `availableLp = 0` → `hasBalance false` → disabled, but the _tooltip_ correctly shows Total/Pending/Available.
5. Connected-wallet mode with an empty `connectedWalletAddress` → `addressError = 'Withdraw address is required.'` → button disabled, **but the error text is only rendered inside the manual-input branch** (`:433-445`), so the user sees a disabled button with no reason.
6. Non-checksummed / mixed-case EVM address → `getAddress()` throws → `'Enter a valid EVM address.'`. A lowercase address is accepted (ethers normalizes).
7. Solana validation is a loose unanchored regex (§2.5) — false positives possible.
8. Clipboard API rejection (permissions / non-secure context) is swallowed silently in both paste and copy (`:132-134`, `:141-143`).
9. `.toFixed(0)` is ROUND_HALF_UP, not floor (§2.3).
10. The displayed estimate uses JS floats (`Number(fromWei(...)) * pct / 100`) while the submitted amount uses BigNumber LP math — the two can disagree in the last digits; the "amounts may vary" disclaimer covers this.
11. HTTP 401 → interceptor clears the token mid-session; the open modal silently degrades to zeros.
12. Error toast surfaces `error.response?.data?.error_message`; network timeout (20 s) or a non-JSON body falls back to `t('Something went wrong. Please try again.')`.
13. `onSuccess` calls `refetchPoolsData?.()` — optional chaining, so a modal opened without it (impossible today, only `PoolDetail` opens it) silently skips the refresh.
14. **Latent smell:** `ThemedModal.Simple onClose={toggleModal}` (`:184`) passes React's `MouseEvent` as the toggler's `options` argument (`src/components/Modal/index.tsx:145,170` wire `onClose` to `onClick`), so closing via the X writes `modalOptions: { POOL_WITHDRAW: <SyntheticEvent> }` into the zustand store. Harmless today because `openModal` becomes `null` and the application store persists only `['chainId','walletConnectionType','avatarVersion']` (`src/stores/application/application.ts` tail). `WithdrawalDetailModal:51` and the claim modal both wrap it correctly (`() => toggleModal()`).
15. Any toggler in this family overwrites the _entire_ shared `modalOptions` object (`applicationHooks.ts:279-283, 308-313, 320-325`), clobbering other modals' stashed options.
16. Withdraw modal state is not reset after a successful submit — reopening shows the previous `percentage` (only the address block is reset by the `isOpen` effect).

**Claim** 17. `accounts.length === 0` (no SubAccount) → nothing selected → `isSelectedInFiltered false` → disabled; list renders empty and the "No subaccounts found" message only appears when `shouldShowSearch && search` (`:156`), so the zero-account case shows a blank list. 18. Typing a search that excludes the selected account → `isSelectedInFiltered` false → button disables until re-selection. Selection is _not_ auto-cleared or auto-moved. 19. `claimable_reward` falsy (`'0'`, `''`, `undefined`) → `canRequest` false and header shows `'—'`. But the _card_ that opens this modal uses `claimableReward === '0'` strict equality (`ClaimableRewardsCard.tsx:43`), so `'0.0'` opens a modal whose button is then disabled — inconsistent gating between card and modal. 20. `market.deposit_chain == null` → early return in `handleClaim` (`:79`) and `canRequest` false — note `DepositChain.Solana === 0`, so the `!= null` (not `!`) check is deliberate and correct. 21. Claim success does not refresh the destination subaccount balance shown in the very list the user just used (§3.4). 22. Lowcap (`Vibecaps`) rows always show `$0.00` uPNL because of the missing `subAccountType` argument (§3.3). 23. The claim modal never checks that the selected SubAccount's type matches the pool (a Major subaccount can be picked as the destination for a lowcap pool's rewards, and vice-versa) — the backend is the only arbiter. 24. `useUpnl(...) ?? {}` at `ClaimRewardsAccountItem.tsx:25` — `useUpnl` always returns an object, so the `?? {}` is dead defensive code.

**Shared** 25. Both flows depend on a bearer token in localStorage; there is no expiry check client-side — expiry is discovered only as a 401. 26. `useUserProfit` polls at 10 min, so a queued withdrawal's effect on `pending_withdraw_lp_amount` is visible immediately only because `usePoolWithdraw` invalidates `['userProfit']`; the claim path invalidates only its own market key. 27. `PostWithdraw` has no response generic (`AxiosResponse<any>`) while every sibling request in `services/index.tsx` is typed — the only untyped endpoint in the file. 28. `WithdrawRequest.description` — declared, never used. 29. Adjacent but distinct flow (do not confuse): `refundRejectedPool` → `POST {APP_POOLS_BACKEND_URL}market/refund` with `{ market_address, deposit_chain, recipient_address }` and a _manually_ attached `Authorization` header (`src/services/pools/services.ts:7-36`), consumed by `src/components/ReviewModal/RefundYourDepositModal/RefundYourDepositModal.tsx` alongside `getUserTransactions` (`GET market/user-transactions/{start}/{size}`, `src/services/pools/services.ts:38-64`). That is the _rejected-deposit refund_ path, not the LP withdraw path, and it uses a second, different transaction-list endpoint/shape (`UserTransaction`, `src/services/pools/types.ts:25-43`) than the pool-detail history table (`ITransactionHistory`).

---

#### 5. Quick reference — every network/contract call in this slice

| #   | Kind          | Call                                                                         | Where                                                    | Key / cadence                                                                                  |
| --- | ------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1   | HTTP GET      | `/auth/sign-in-message?address=&domain=&uri=`                                | `services/index.tsx:159`                                 | inside login mutation                                                                          |
| 2   | HTTP POST     | `/auth/login` `{message, signature}`                                         | `services/index.tsx:163`                                 | mutation, no key                                                                               |
| 3   | HTTP GET      | `/profit/{token_contract_address}`                                           | `services/index.tsx:233`                                 | `['userProfit', contractAddress]`, stale/refetch 10 min, enabled = authed && status==='listed' |
| 4   | HTTP **POST** | `/market/withdraw` `{amount, market_address, withdraw_address}`              | `services/index.tsx:252`                                 | mutation; invalidates `['GetTransactionHistory']`, `['userProfit']`                            |
| 5   | HTTP **POST** | `/claim` `{token_contract_address, deposit_chain, account_address, amount}`  | `services/index.tsx:260`                                 | mutationKey `['ClaimProfit']`; invalidates `['userProfit', contractAddress]`                   |
| 6   | HTTP GET      | `/market/transaction-history/{start}/{size}?market_address=&wallet_address=` | `services/index.tsx:248`                                 | `['GetTransactionHistory', mkt, wallet, start, size]`, staleTime 30 s                          |
| 7   | HTTP GET      | `/market?token_contract_address=&deposit_chain=`                             | `services/index.tsx:227`                                 | `['marketDetail', addr, chain]`, stale 30 s / refetch 60 s (the `refetchPoolsData` target)     |
| 8   | Contract READ | `AccountLayer.getUserSubAccounts(account, 0, 9999)`                          | `src/services/blockchain/hooks/useUserAccounts.ts:22-23` | refetch 5 min                                                                                  |
| 9   | Contract READ | `Diamond\|LowcapDiamond.balanceOf(accountAddress)` (`SYMMIO_ABI`)            | `src/services/blockchain/hooks/use-balance-of.ts:21-24`  | refetch `balanceFetchRate` (12.5 s idle / 4 s hot)                                             |
| 10  | Contract READ | `Diamond.getPartyAOpenPositions(accountAddress, 0, 200)`                     | `src/services/quotes/hooks/useOpenPositions.ts:25-35`    | refetch 15 s                                                                                   |

No contract writes. No signature is attached to the withdraw or claim payload — the bearer token _is_ the authorization.

---

## 8. Service / API layer — the endpoint catalog

### Vibe-ui — POOLS SERVICE / API LAYER (exhaustive map)

Repo root for all paths: `/symmio/Vibe-ui`. All line refs are `path:LINE`.

---

#### 0. FILE INVENTORY (verified via `ls`)

**`src/components/App/Pools/services/`** — `index.tsx` (265 lines), `types.ts` (440 lines), `hooks/` (21 files, not 22):

```
useAddUserDeposit.ts      useAggregatedTvl.ts     useClaimProfit.ts
useDiscoverMarketSearch.ts useDiscoverPoolsCount.ts useListingAuth.ts
useListingLogin.ts        useMarketDetail.ts      useOpenOrders.ts
usePoolHistoryQuotes.ts   usePoolQuotes.ts        usePoolWithdraw.ts
useRetryListingInfo.ts    useRetryMarketListing.ts useRevenue.ts
useTokenMetaData.ts       useTokenValidate.ts     useTransactionHistory.ts
useUserProfit.ts          useWeeklyListingLimit.ts useYourPoolsMarketDeposits.ts
```

**`src/services/pools/`** — `services.ts` (64), `types.ts` (43), `hooks/useUserTransactions.ts`, `hooks/useRefundRejectedPool.ts`. This is a **second, parallel pools service module** that does NOT use the shared axios instance (see §1.3).

---

#### 1. SHARED CLIENT SETUP

##### 1.1 Four axios instances — `src/components/App/Pools/services/index.tsx:41-60`

| const               | baseURL expression                                                                                                                                                           | timeout | file:line         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------- |
| `api`               | `APP_POOLS_BACKEND_URL`                                                                                                                                                      | 20000   | `index.tsx:41-44` |
| `dexscreener`       | hardcoded `'https://api.dexscreener.com/latest'`                                                                                                                             | 20000   | `index.tsx:45-48` |
| `inventory`         | `IS_BACKEND_STAGING_ENV ? 'https://inventory-staging.enigma.bz/api' : IS_TEST_ENVIRONMENT ? 'https://inventory-staging.enigma.bz/api' : 'https://inventory85.enigma.bz/api'` | 20000   | `index.tsx:49-56` |
| `conditionalOrders` | `TPSL_SERVICES[HedgerType.ENIGMA].domain`                                                                                                                                    | 20000   | `index.tsx:57-60` |

`GetRevenue` (`index.tsx:207-218`) uses **bare module-level `axios`**, not an instance — it builds an absolute URL via `joinUrl(HEDGER_DATA_MAP[HedgerType.ENIGMA].domain, ...)`.

##### 1.2 Interceptors

**Auth header injection — `index.tsx:62-77`** (request interceptor, `api` only):

```ts
const account = useWalletStore.getState().account;
const listingAccessTokens = useUserStore.getState().listingAccessTokens;
const accessToken = account ? listingAccessTokens?.[account] : undefined;
if (accessToken) {
  config.headers.Authorization = `Bearer ${accessToken}`;
}
```

Token is keyed by **wallet address** (not sub-account) and read imperatively from the zustand store at request time.

**401 handling — `index.tsx:79-93`** (response interceptor, `api`): calls `captureAxiosError(err, APP_POOLS_BACKEND_URL)`, and on `err.response?.status === 401` calls `updateListingAccessToken(account, '')` (blanks the token, forcing re-login). Then re-rejects.

**Error-only response interceptors**: `dexscreener` `index.tsx:95-101` (`captureAxiosError(err, 'https://api.dexscreener.com/latest')`), `inventory` `index.tsx:103-109` (`captureAxiosError(err)` — no baseUrl arg, so PostHog URL will be relative), `conditionalOrders` `index.tsx:111-117`.

**No response-body normalization anywhere.** Errors surface as raw `AxiosError`. Two ad-hoc error-shape readers exist:

- `TokenSupportError` (`services/types.ts:212-216`) read at `usePoolWithdraw.ts:35`, `useRetryMarketListing.ts:42`, `TokenBasics.tsx:115`.
- `getListingApiErrorMessage(err, fallback)` — `src/components/App/Pools/components/claim-rewards-modal/utils.ts:9-15`, reads `err.response.data.error_message`.

**`captureAxiosError`** — `src/utils/error-tracking.ts:76-115`. Builds `fullUrl` from `error.config.url` + optional baseUrl via `joinUrl`, serializes `error.config.params`, applies `normalizeUrl` (`posthogNormalizations.ts` — **no rule matches any listing/inventory/dexscreener URL**, so pool URLs go to PostHog unnormalized, with ids in the path), checks `posthogExclusions`, then `posthog.captureException` with `error_type: 'axios'`, `fingerprints`, `request_body`, `response_body`, `active_account`.

**Global axios wrapper NOT used by pools**: `src/lib/axios.ts:4-12` exports an `axios` instance with a `captureAxiosError` response interceptor; the pools module imports raw `'axios'` instead (`index.tsx:10`).

##### 1.3 `src/services/pools/services.ts` — no shared instance at all

Both functions use **bare `axios`** with a **manually built absolute URL and a hand-injected `Authorization` header**, bypassing the `api` instance and its 401 handling:

- `refundRejectedPool` — `services.ts:7-36`; `axios.post(`${APP_POOLS_BACKEND_URL}market/refund`, body, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } })`; try/catch → `captureAxiosError(error, APP_POOLS_BACKEND_URL)` then rethrow.
- `getUserTransactions` — `services.ts:38-64`; same pattern, token passed in as `accessToken` param.

##### 1.4 react-query global defaults — `src/components/Layout/Providers/ReactQueryProvider.tsx:7-16`

```ts
defaultOptions: { queries: {
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchIntervalInBackground: false,
  retryDelay: (i) => Math.min(1_000 * 2 ** i, 30_000),
}}
```

Consequence: `staleTime: 0` on the market-search hooks does **not** produce a mount refetch — only key changes and the 90 s interval fetch. `retry` is left at the RQ default (3) everywhere except where explicitly `retry: false`. **No hook in the whole slice sets `gcTime`** (default 5 min).

##### 1.5 Query param builder — `src/utils/queryParams.ts:1-14`

`constructQueryParams(payload)` — drops `undefined | null | ''`, expands arrays into **repeated keys** (`chain_ids=8453&chain_ids=56`), joins with `&`. **No URL-encoding** of values.

`joinUrl(base, path)` — `src/utils/url.ts:1-3`, strips trailing `/` from base and leading `/` from path.

---

#### 2. BASE URL / ENV RESOLUTION

##### `src/constants/environment.ts`

```ts
IS_TEST_ENVIRONMENT = process.env.NEXT_PUBLIC_IS_TEST_ENVIRONMENT === "true"; // :1
IS_BACKEND_STAGING_ENV = process.env.NEXT_PUBLIC_BACKEND_ENVIRONMENT === "staging"; // :2
IS_POOLS_ENABLED = process.env.NEXT_PUBLIC_POOLS_ENABLE === "true"; // :5
IS_SIMULATOR_MODE = process.env.NEXT_PUBLIC_SIMULATOR_MODE === "true"; // :12
SIMULATOR_HEDGER_DOMAIN = NEXT_PUBLIC_SIMULATOR_HEDGER_DOMAIN || "http://localhost:4000"; // :13
SIMULATOR_TPSL_DOMAIN = NEXT_PUBLIC_SIMULATOR_TPSL_DOMAIN || "http://localhost:4001/api/v4/"; // :14
```

##### `APP_POOLS_BACKEND_URL` — `src/constants/misc.ts:23-27`

```ts
export const APP_POOLS_BACKEND_URL = IS_BACKEND_STAGING_ENV
  ? "https://listing-staging.enigma.bz/v2/"
  : IS_TEST_ENVIRONMENT
    ? "https://listing85.enigma.bz/v2/"
    : "https://listing85.enigma.bz/v2/";
```

- staging (`NEXT_PUBLIC_BACKEND_ENVIRONMENT=staging`) → `https://listing-staging.enigma.bz/v2/`
- everything else → `https://listing85.enigma.bz/v2/`
- **FLAG (dead ternary):** the `IS_TEST_ENVIRONMENT` branch and the production branch are the identical string — the test branch is a no-op.

##### `TPSL_SERVICES[HedgerType.ENIGMA].domain` — `src/constants/misc.ts:45-59`

simulator → `SIMULATOR_TPSL_DOMAIN` (`http://localhost:4001/api/v4/`); `IS_TEST_ENVIRONMENT` → `https://conditional-orders-handler-lowcap-stage.rasa.capital/api/v5/`; else → `https://conditional-orders-handler-lowcap85.rasa.capital/api/v5/`. (`apiVersion: 'v5'` at `misc.ts:58`.)

##### `HEDGER_DATA_MAP[HedgerType.ENIGMA].domain` — `src/constants/hedgers.ts:86-90`

simulator → `SIMULATOR_HEDGER_DOMAIN`; `IS_TEST_ENVIRONMENT` → `https://solver-staging.enigma.bz/api`; else → `https://solver.enigma.bz/api`. (`chainId: SupportedChainId.HYPEREVM`, `partyBAddress` test `0xf62a670cda28FfAE65eE2a42D6cf6CF05EC5E775` / prod `0x76bc5889c0cfcC20960b0D81F541595d81a95122`, `hedgers.ts:91-93`.)

##### Subgraph URLs — `src/apollo/client/apolloClients.ts:12-25`

`ANALYTICS` prod: `https://api.goldsky.com/api/public/project_cm1hfr4527p0f01u85mz499u8/subgraphs/hyperevm_mainnet_analytics/latest/gn`; test (`IS_TEST_ENVIRONMENT`): `.../subgraphs/hyperevm_analytics/latest/gn`. Selection at `apolloClients.ts:27-29`; `getApolloClient(chainId, clientType)` returns `undefined` unless `chainId === FALLBACK_CHAIN_ID` (`apolloClients.ts:31-41`).

##### Chain / address constants

- `CHAIN_IDS = [SupportedChainId.HYPEREVM]`, `FALLBACK_CHAIN_ID = CHAIN_IDS[0]` = **999** — `src/constants/chains.ts:50-52`.
- `LOWCAP_DIAMOND_ADDRESS[HYPEREVM]` = `IS_TEST_ENVIRONMENT ? '0x99641E06d38F327166b3a48f86Ca2cbB3B4fB7EB' : '0x57331038c21982116EE9b0906E4a5c5cB52dcE2e'` — `src/constants/addresses.ts:51-57`. Used **lowercased** as the subgraph `source` filter.

##### Checked-in `.env` (dev machine state) — `/symmio/Vibe-ui/.env`

`NEXT_PUBLIC_POOLS_ENABLE=true` (:13), `NEXT_PUBLIC_IS_TEST_ENVIRONMENT=true` (:14), `NEXT_PUBLIC_BACKEND_ENVIRONMENT="staging"` (:20). Commented-out `# NEXT_PUBLIC_POOLS_CLAIM_MOCK=true` / `# NEXT_PUBLIC_POOLS_CLAIM_MOCK_ERROR=true` (:22-23) — **FLAG: no code anywhere reads either var (grep-verified) → dead env vars.**

**FLAG:** `IS_POOLS_ENABLED` (`environment.ts:5`) is **never referenced anywhere in `src/`** (grep-verified) → dead feature flag; the `/pools` routes are always live.

---

#### 3. ENDPOINT CATALOG

Unless noted, `{BASE}` = `APP_POOLS_BACKEND_URL` = `https://listing85.enigma.bz/v2/` (prod) / `https://listing-staging.enigma.bz/v2/` (staging), and the `api` instance auto-attaches `Authorization: Bearer <listingAccessTokens[walletAddress]>`.

---

##### E1 — `GET {BASE}market/search?limit=&offset=&query=&sort_by=&chain_ids=&market_status=&order_by=&<filters>`

- **Caller:** `getMarketSearch` — `services/index.tsx:120-136`. `limit` default 20, `offset` default 0; query string via `constructQueryParams`.
- **Auth:** technically public, but the shared `api` instance still attaches the bearer if present.
- **Request params type** (`index.tsx:124-132`):
  ```ts
  { limit?: number; offset?: number; query?: string; sort_by?: string
    chain_ids?: string[]; market_status?: string; order_by?: 'asc' | 'desc' } & MarketSearchFilters
  ```
- **Response:** `MarketSearchResponse` → `{ total, limit, offset, items: MarketSearchItem[] }`.

**Wrapper A — `useDiscoverMarketSearch(params)`** — `services/hooks/useDiscoverMarketSearch.ts:39-76`

- Query key (`:58`): `['getMarketSearch', query, size, start, searchTerm, statusFilter, sortBy, orderBy, filters]` where `query` is the **entire Next.js `router.query` object** (`useRouter()` at `:42`).
- `staleTime: 0` (`:56`), `refetchInterval: 90_000` (`:57`), no `enabled` (always on), retry = default 3.
- Params interface (`:31-37`): `{ size?: number; start?: number; searchTerm?: string; sortBy?: DiscoverMarketSearchSortBy; orderBy?: QuoteOrder }`; defaults `size = 10`, `start = 0` (`:40`).
- `limit = Math.min(size, 100)` (`:60`), `offset = start`.
- `statusFilter` (`:44`): `query.status` unless `'all'`.
- Filters (`:45-53`): for each key in `MARKET_SEARCH_FILTER_KEYS`, take `router.query[key]`; **non-`listing_time` keys are converted with `toWei(value)` (18 dec)**, `listing_time*` passed raw (unix seconds).
- **`MARKET_SEARCH_FILTER_KEYS`** exported at `useDiscoverMarketSearch.ts:8-29`: `market_cap__ge/le`, `user_revenue__ge/le`, `tvl__ge/le`, `apr_24h__ge/le`, `apr_30d__ge/le`, `apr__ge/le`, `liquidity__ge/le`, `open_interest__ge/le`, `vol24h__ge/le`, `listing_time__ge/le` (20 keys).
- **FLAG:** the UI filter modal only exposes 8 of those pairs (`FilterPoolModal/helpers.ts:17-41`: market_cap, tvl, vol24h, liquidity, open_interest, apr, listing_time). `user_revenue__*`, `apr_24h__*`, `apr_30d__*` are only reachable by hand-editing the URL.
- **FLAG:** putting the whole `router.query` object in the key means **any unrelated query-param change (e.g. `tab`) refetches** the market list.
- Consumer: `DiscoverPoolsContent.tsx:60-66`.

**Wrapper B — `useDiscoverPoolsCount()`** — `services/hooks/useDiscoverPoolsCount.ts:4-20`

- Key: `['discoverPoolsCount']`; `staleTime: Infinity`, `refetchOnMount/Reconnect/WindowFocus: false`; `limit: 1, offset: 0`; returns `res.data.total`. Consumer `DiscoverPoolsContent.tsx:57`.

**Wrapper C — inside `useMarketDetail`** (chain discovery fallback) — `useMarketDetail.ts:18-26`: `getMarketSearch({ limit: 1, offset: 0, query: contractAddress })` → takes `items[0].chain_id`.

**Wrapper D — inline in create-pool** — `CreatePool/components/TokenBasics.tsx:47-66`

- Key: `['existingCreatePoolMarket', debouncedToken, DepositChain]`; `getMarketSearch({ query: debouncedToken, limit: 20, offset: 0 })`, then client-side `.find(item => item.contract_address.toLowerCase() === debouncedToken.toLowerCase() && item.chain_id === DepositChain)`; `enabled: Boolean(debouncedToken && DepositChain != null)`, `retry: false`, `staleTime: 30_000`. Token debounce 1200 ms (`TokenBasics.tsx:39`).

---

##### E2 — `GET {BASE}market/search-user?limit=&offset=&query=&sort_by=&chain_ids=&market_status=&order_by=` (AUTHENTICATED)

- **Caller:** `getUserMarketSearch` — `services/index.tsx:138-154`.
- **Request params type** (`:142-150`): same as E1 **minus** `MarketSearchFilters` — **FLAG: the "Your Pools" tab cannot send any numeric filters at all**, even though `user_revenue__*` / `apr_24h__*` / `apr_30d__*` exist only on this endpoint's row type.
- **Response:** `UserMarketSearchResponse` → `{ total, limit, offset, items: UserMarketSearchItem[] }`.
- **Wrapper:** `useYourPoolsMarketDeposits(params)` — `hooks/useYourPoolsMarketDeposits.ts:20-59`
  - Key (`:31-42`): `['getUserMarketSearch', accessToken, account, query, size, start, searchTerm, statusFilter, sortBy, orderBy]` — **FLAG: the raw bearer token is a cache-key member** (leaks into RQ devtools / any key serialization).
  - `staleTime: 0` (`:28`), `refetchInterval: 90_000` (`:29`), `enabled: Boolean(accessToken && account)` (`:30`).
  - Params (`:7-15`): `{ accessToken?, account?, searchTerm?, size = 10, start = 0, sortBy?: UserMarketSearchSortBy, orderBy?: QuoteOrder }`; `limit = Math.min(size, 100)`.
  - Consumer `YourPoolsContent.tsx:56-64`.

---

##### E3 — `GET {BASE}auth/sign-in-message?address={address}&domain={domain}&uri={uri}`

- **Caller:** `SignInMessage({ address, domain, uri })` — `services/index.tsx:156-160`. Path written as `/auth/sign-in-message`, hand-concatenated (not via `constructQueryParams`).
- Callers pass `domain = window.location.host`, `uri = window.location.origin` (`useListingLogin.ts:24-28`) — the commented-out hint sits at `index.tsx:157-158`.
- **Response:** `GetSignInMessageResponse` `{ message: string; params: SignInMessageParams }`; `SignInMessageParams { domain, address, uri, version, chainId, issuedAt, nonce, statement }` (SIWE).

##### E4 — `POST {BASE}auth/login`

- **Caller:** `Login(payload: LoginPayload)` — `services/index.tsx:162-164`.
- **Payload:** `LoginPayload { message: LoginMessage; signature: string }`; `LoginMessage { domain, address, uri, version, chainId, issuedAt, nonce, statement, expirationTime? }`.
- **Response:** `LoginResponse { accessToken: string; tokenType: string }`.
- **Wrapper (E3+E4 as one mutation):** `useListingLogin()` — `hooks/useListingLogin.ts:10-51`. No `mutationKey`. `mutationFn` (`:18-35`): 1) `SignInMessage` 2) `signMessageCallback(message)` from `useSignMessageV2()` (`src/callbacks/useSignMessage.ts:30-80`; in `IS_SIMULATOR_MODE` returns a fake `'0x' + '00'.repeat(65)` at `:52-58`) 3) `Login({ message: params, signature })`. **Note it signs `data.message` but posts `data.params`.**
- `onSuccess` (`:36-38`): `updateListingAccessToken(account, data.accessToken)` — **no query invalidation**.
- `onError` (`:39-49`): toast `'Listing Error' / 'Could not authenticate with the listing service.'`.
- Consumer: `ListingSignatureRequestModal/index.tsx:20`.

---

##### E5 — `POST {BASE}market/add-market`

- **Caller:** `AddMarket({ payload })` — `services/index.tsx:166-168`.
- **Payload** `AddMarketPayload` (`types.ts:155-162`): `{ token_contract_address, is_tax, user_whitelist_tax, buy_back_ratio, max_leverage, deposit_chain }`.
- **Response** `AddMarketResponse` (`types.ts:164-183`): `{ token_contract_address, user_address, token_name, token_ticker, is_tax, user_whitelist_tax, buy_back_ratio, max_leverage, deposit_chain, deposit_amount, field_amount, additional_chains, wallet_public_key, main_pool, cex_list, token_decimal, market_status, deposit_status }`.
- **Wrapper: NO dedicated hook.** Inline `useMutation` in `CreatePool/index.tsx:80-106`.
  - **Invalidates on success** (`:83-85`): `['getMarketSearch']`, `['getUserMarketSearch']`, `['discoverPoolsCount']` — all with `refetchType: 'all'`.
  - Then stores `{ token_ticker, deposit_amount, wallet_public_key, deposit_chain }` into local state and advances the stepper.
  - `onError` reads `error.response.data.error_message` behind an `//@ts-ignore` (`:100-101`).
  - Payload built at `:110-117`: `is_tax: false`, `user_whitelist_tax: false` are **hardcoded**; `buy_back_ratio`/`max_leverage` from the form. `console.log('Final data:', data)` left in at `:109` — **FLAG**.

##### E6 — `POST {BASE}market/deposit-address`

- **Caller:** `AddDeposit({ payload })` — `services/index.tsx:170-177`. Destructures and re-sends only `{ token_contract_address, deposit_chain }`.
- **Payload** `AddDepositPayload` (`types.ts:186-189`). **Response** `AddDepositResponse` (`types.ts:191-198`): `{ token_contract_address, user_address, deposit_chain, wallet_public_key, token_decimal, market_status }`.
- **Wrapper:** `useAddDeposit({ token_contract_address, deposit_chain, tokenName, status, refetchPoolsData })` — `hooks/useAddUserDeposit.ts:9-58`. `useMutation<..., Error>`, no key.
  - `onSuccess` (`:32-44`): **no invalidation**; instead `useApplicationStore.setState({ modalOptions: { [ApplicationModal.LISTING]: { tokenName, publicAddress: data.wallet_public_key, chain: deposit_chain, refetchPoolsData } }, openModal: ApplicationModal.LISTING })` → opens the QR deposit modal (`ListingDepositModal/index.tsx:23-58`, QR via `qrcode-with-logos`).
  - `onError` (`:45-56`): `console.log('e', e)` (**FLAG**) + toast `'Listing Deposit Error'`.
  - **FLAG:** the `status: MarketStatus` param is declared (`:18`) and never used in the hook body.
  - Consumers: `PoolsTable/YourPoolTableItem.tsx:52`, `PoolsList/YourPoolMobileCard.tsx:48`, `PoolDetail/index.tsx:32`, `PoolsTable/DiscoverPoolTableItem.tsx`, `CreatePool/components/TokenBasics.tsx:71`.

---

##### E7 — `POST {BASE}market/retry-listing`

- **Caller:** `RetryMarketListing(payload)` — `services/index.tsx:179-181`.
- **Payload** `RetryMarketPayload { token_contract_address: string; deposit_chain: number }` (`types.ts:117-120`). **Response** `RetryMarketResponse { market_status: string }` (`types.ts:122-124`).
- **Wrapper:** `useRetryMarketListing({ onSuccess })` — `hooks/useRetryMarketListing.ts:13-48`. No mutation key.
  - **Invalidates on success** (`:21-23`): `['getUserMarketSearch']`, `['getMarketSearch']`, `['retryListingInfo']`; then `onSuccess?.()`; toast `'Retry Submitted'`.
  - `onError: (error: AxiosError<TokenSupportError>)` → `error.response?.data?.error_message ?? 'Something went wrong. Please try again.'`.
  - Consumer: `RetryListingButton.tsx:56`.

##### E8 — `GET {BASE}market/retry-listing-info?token_contract_address=&deposit_chain=`

- **Caller:** `GetRetryListingInfo(payload)` — `services/index.tsx:183-187` (uses `constructQueryParams`; note it always emits `?${params}` even if empty).
- **Payload** `RetryListingInfoPayload { token_contract_address: string; deposit_chain: number }` (`types.ts:126-129`).
- **Response** `RetryListingInfoResponse { retry_limit: number; remaining_retries: number; remaining_cooldown_seconds: number }` (`types.ts:131-135`).
- **Wrapper:** `useRetryListingInfo({ token_contract_address, deposit_chain, enabled })` — `hooks/useRetryListingInfo.ts:9-20`.
  - Key: `['retryListingInfo', token_contract_address, deposit_chain]`; `enabled: Boolean(enabled && token_contract_address && deposit_chain != null)`; `staleTime: 30_000`; no interval.
  - Consumer `RetryListingButton.tsx:51-55` with `enabled: isRejected` (`item.market_status == MarketStatus.Rejected`). Falls back to `item.remaining_retry_limit` / `item.remaining_cooldown_seconds` from the search row (`RetryListingButton.tsx:58-63`).

---

##### E9 — `GET {BASE}market/token-meta-data?contract_address={addr}&chain={chainId}`

- **Caller:** `GetTokenMetaData({ chain, contract_address })` — `services/index.tsx:189-193` (hand-concatenated query).
- **Response** `GetTokenMetaDataResponse { token_contract_address, chain, token_name, token_ticker, decimals, price }` (`types.ts:202-209`).
- **Wrapper 1:** `useTokenMetaData({ tokenAddress, chain })` — `hooks/useTokenMetaData.ts:11-24`. Key `['tokenMetaData', tokenAddress, chain]`; `enabled: Boolean(tokenAddress && chain != null)`; `staleTime: 300_000`. Consumer `CreatePool/components/Review.tsx:24`.
  - **FLAG:** the `accessToken?` prop in `UseTokenMetaDataProps` (`:6`) is declared and never used; file opens with a stale `// useTokenMetaData.ts` comment.
- **Wrapper 2:** inside `useTokenValidate` — `hooks/useTokenValidate.ts:35-47`, **same key** `['tokenMetaData', tokenAddress, chain]` but `enabled: isSupported`, `retry: false`, `staleTime: 300_000`.
  - **FLAG (cache collision):** two hooks share one query key with different `enabled`/`retry` options; RQ merges by first-registered observer, so the retry policy is non-deterministic.

##### E10 — `GET {BASE}market/token-support?contract_address={addr}&chain={chainId}`

- **Caller:** `TokenSupport({ chain, contract_address })` — `services/index.tsx:195-197`. **Response typed as bare `string`** (`api.get<string>`).
- **Error body** `TokenSupportError { error_code: number; error_detail: null | string | number; error_message: string }` (`types.ts:212-216`); sentinel `SUPPORT_TOKEN_ERROR.UNSUPPORTED_TOKEN = 26` (`Pools/types.ts:53-55`, a `const enum`), compared at `TokenBasics.tsx:115`.
- **Wrapper:** first query inside `useTokenValidate` — `hooks/useTokenValidate.ts:13-28`. `useQuery<string, AxiosError<TokenSupportError>>`, key `['checkTokenSupport', tokenAddress, chain]`, `enabled: Boolean(tokenAddress && chain != null)`, `retry: false`, **no staleTime** (so 0). Its `isSuccess` gates E9 and E11.

##### E11 — `GET https://api.dexscreener.com/latest/dex/tokens/{contract_address}`

- **Caller:** `GetTokenDexScreenerData({ contract_address })` — `services/index.tsx:199-201`, on the `dexscreener` instance.
- **Response** `GetTokenDexScreenerDataResponse { schemaVersion: string; pairs: DexScreenerPair[] }` (`types.ts:220-223`); `DexScreenerPair` at `types.ts:225-243` — `{ chainId, dexId, url, pairAddress, labels, baseToken: EToken, quoteToken: EToken, priceNative, priceUsd, txns: Txns, volume: Volume, priceChange: PriceChange, liquidity: Liquidity, fdv, marketCap, pairCreatedAt, info: Info }`. Sub-interfaces (all **non-exported**, `types.ts:245-297`): `EToken {address,name,symbol}`, `Info {imageUrl,header,openGraph,websites: Website[],socials: Social[]}`, `Social {type,url}`, `Website {label,url}`, `Liquidity {usd,base,quote}`, `PriceChange {h6,h24}`, `Txns {m5,h1,h6,h24: H1}`, `H1 {buys,sells}`, `Volume {h24,h6,h1,m5}`.
- **Wrapper:** third query in `useTokenValidate` — `hooks/useTokenValidate.ts:49-75`. Key `['tokenDexScreenerData', tokenAddress]`, `enabled: isSupported`, `retry: false`, `staleTime: 300_000`. `select`-in-queryFn: reduces `pairs` to the **highest-`liquidity.usd` pair** (`:56-65`) and returns `{ totalMarketCap, totalLiquidity }`.
- `useTokenValidate` return shape (`:77-86`): `{ isValidating, validationError, isSupported, isDataLoading, metaError, isMetaSuccess, metaData, DexScreenerData }`. Consumer `TokenBasics.tsx:41`.

---

##### E12 — `GET {inventory}/v1/markets/tvl-aggregate`

- Full URL: prod `https://inventory85.enigma.bz/api/v1/markets/tvl-aggregate`; staging **and** test → `https://inventory-staging.enigma.bz/api/v1/markets/tvl-aggregate`.
- **Caller:** `GetAggregatedTvl()` — `services/index.tsx:203-205`. No auth header (separate instance).
- **Response** `AggregatedTvlResponse { tvl: string }` (`types.ts:300-302`).
- **Wrapper:** `useAggregatedTvl()` — `hooks/useAggregatedTvl.ts:5-22`. Key `['GetAggregatedTvl']`; `staleTime: 120_000`, `refetchInterval: 120_000`; no `enabled`. Returns `{ aggregatedTvl, isLoading, isError, refetch }`. Consumer `PoolsInfo/GeneralInfo.tsx:34`.

---

##### E13 — `GET {ENIGMA_SOLVER}/revenue/{marketId}[?time_range=24h]`

- Full URL: prod `https://solver.enigma.bz/api/revenue/{marketId}`; test `https://solver-staging.enigma.bz/api/revenue/{marketId}`.
- **Caller:** `GetRevenue(marketId: number, timeRange?: '24h')` — `services/index.tsx:207-218`. Built with `joinUrl(HEDGER_DATA_MAP[HedgerType.ENIGMA].domain, `revenue/${marketId}`)` + `?time_range=24h`; uses **bare `axios`** with its own try/catch → `captureAxiosError(error)` → rethrow.
- **Response** `RevenueResponse { total_revenue: string; hedger_fee_revenue: string; funding_revenue: string; record_count: number }` (`types.ts:305-310`).
- **Wrapper:** `useRevenue(marketId = DEFAULT_MARKET_ID)` — `hooks/useRevenue.ts:11-32`. `DEFAULT_MARKET_ID = 1` (`constants/misc.ts:62`).
  - Key `['GetRevenue', marketId]`; `staleTime: 120_000`, `refetchInterval: 120_000`.
  - queryFn fires **two** requests via `Promise.allSettled([GetRevenue(marketId), GetRevenue(marketId, '24h')])` (`:15`) → `{ lifetime: RevenueResponse | null, day: RevenueResponse | null }` (local `interface RevenueData`, `:6-9`).
  - **FLAG:** only consumer is `PoolsInfo/GeneralInfo.tsx:35` calling `useRevenue()` with **no argument → always market id 1**, i.e. a hardcoded single market, not an aggregate.

---

##### E14 — `GET {BASE}market?token_contract_address={addr}&deposit_chain={chainId}`

(Comment in `types.ts:312` says `GET /v2/market`; the `v2` comes from the base URL.)

- **Caller:** `GetMarketDetail({ token_contract_address, deposit_chain })` — `services/index.tsx:220-230`.
- **Response `MarketDetailResponse` — EVERY FIELD** (`types.ts:313-351`):
  ```ts
  export interface MarketDetailResponse {
    token_contract_address: string;
    token_name: string;
    token_ticker: string | null;
    is_tax: boolean | null;
    symbol_id: number | null;
    user_whitelist_tax: boolean | null;
    buyback_ratio: number;
    max_leverage: number;
    deposit_chain: number;
    additional_chains: number[] | null;
    main_pool: string | null;
    cex_list: string[] | null;
    token_decimal: number;
    market_status: MarketStatus;
    listing_time: number | null;
    tvl: string;
    apy_24h: string;
    apy_30d: string;
    apy_lifetime: string;
    reward_24h: string;
    reward_30d: string;
    reward_lifetime: string;
    solver_revenue_24h: string;
    solver_revenue_30d: string;
    solver_revenue_lifetime: string;
    active_lps: number;
    total_usdc_in_pool: string;
    total_token_in_pool: string;
    age: number | null;
    long_position_amount: string;
    long_position_value: string;
    long_position_avg_open_price: string;
    long_position_upnl: string;
    short_position_amount: string;
    short_position_value: string;
    short_position_avg_open_price: string;
    short_position_upnl: string;
  }
  ```
  All `string` money/rate fields are 18-decimal wei (consumers use `fromWei` — e.g. `PoolStatsCard.tsx:26,64`, `pool-stats.ts:35-36`). Note the spelling split: this type says **`buyback_ratio`** while `IMarket`/`AddMarketPayload` say **`buy_back_ratio`**.
- **Wrapper:** `useMarketDetail(contractAddress)` — `hooks/useMarketDetail.ts:6-45`.
  - Key: `['marketDetail', contractAddress, depositChain]` where `depositChain = router.query.deposit_chain ? Number(...) : undefined` (`:8`).
  - `enabled: Boolean(contractAddress)`; `staleTime: 30_000`; `refetchInterval: 60_000`.
  - queryFn: if `deposit_chain` is absent from the URL it **first calls E1** (`getMarketSearch({limit:1, offset:0, query: contractAddress})`) to discover `chain_id`, returning `null` if nothing found (`:17-26`), then calls `GetMarketDetail`.
  - Consumer `PoolDetail/index.tsx:27`; `PoolDetail` then `router.replace(routes.pools.poolDetail(contractAddress, market.deposit_chain), …, {shallow:true})` to pin `deposit_chain` into the URL (`PoolDetail/index.tsx:53-57`). Route builder: `src/constants/routes.ts:20-25`.

---

##### E15 — `GET {BASE}profit/{token_contract_address}` (AUTHENTICATED)

- **Caller:** `GetUserProfit(token_contract_address)` — `services/index.tsx:232-234`.
- **Response `UserProfitResponse`** (`types.ts:354-361`) — all 1e18:
  ```ts
  {
    user_balance_in_tokens: string;
    user_balance_in_usdc: string;
    claimable_reward: string;
    user_deposited_token_amount: string;
    user_lp_amount: string;
    pending_withdraw_lp_amount: string;
  }
  ```
  (`pending_withdraw_lp_amount` is documented as already included in `user_lp_amount` but locked — `types.ts:360`.)
- **Wrapper:** `useUserProfit(contractAddress, marketStatus)` — `hooks/useUserProfit.ts:7-27`.
  - Key: `['userProfit', contractAddress]` — **note `marketStatus` is NOT in the key** though it gates `enabled`.
  - `enabled: Boolean(contractAddress && isAuthenticated && marketStatus === MarketStatus.Listed)` where `isAuthenticated` comes from `useListingAuth()` (`:8`).
  - `staleTime: 600_000`, `refetchInterval: 600_000` (10 min).
  - Consumers: `PoolDetail/index.tsx:28`, `PoolWithdrawModal/index.tsx:46`, `WithdrawalDetailModal/index.tsx:36`, `claim-rewards-modal/index.tsx:40`.

---

##### E16 — `GET {BASE}market/transaction-history/{start}/{size}?market_address=&wallet_address=`

- **Caller:** `GetTransactionHistory({ start = 0, size = 150, market_address, wallet_address })` — `services/index.tsx:236-249`. **`start`/`size` are path segments**; only `market_address`/`wallet_address` go through `constructQueryParams`.
- **Response** `TransactionHistoryResponse { market_address: string; count: number; data: ITransactionHistory[] }` (`types.ts:374-378`); `ITransactionHistory { wallet_address, usdc_amount, token_amount, type: TransactionType, status: TransactionStatus, time }` (`types.ts:379-386`). `TransactionStatus = 'pending' | 'rejected' | 'refund' | 'success'`, `TransactionType = 'deposit' | 'withdraw'` (`types.ts:371-372`).
- **Wrapper:** `useTransactionHistory({ marketAddress, walletAddress, start = 0, size = 10 })` — `hooks/useTransactionHistory.ts:19-46`.
  - Key: `['GetTransactionHistory', marketAddress, walletAddress, start, size]`; `enabled: Boolean(marketAddress)`; `staleTime: 30_000`; **no refetchInterval**.
  - Returns `{ transaction: TransactionHistoryResponse | null, isLoading, isError, refetch }` (local `interface Result`, `:12-17`).
  - Consumers: `PoolDetail/PoolDetailTabs.tsx:68-70` (no wallet → public count for the tab badge), `PoolDetail/tables/PoolDepositsWithdrawalsTable.tsx:27-32` (paginated; `walletAddress` set only when `filter === ActionFilter.Yours`, `ActionFilter` enum at `PoolDepositsWithdrawalsTable.tsx:11-14`).
  - **FLAG:** service default `size = 150` vs hook default `size = 10` — divergent defaults.

---

##### E17 — `POST {BASE}market/withdraw`

- **Caller:** `PostWithdraw(data: WithdrawRequest)` — `services/index.tsx:251-253`. **Untyped response** (`api.post(...)` with no generic).
- **Payload** `WithdrawRequest` (`types.ts:364-369`): `{ amount: string /* LP amount in 1e18 */; market_address: string; withdraw_address: string; description?: string | null }`.
- **Wrapper:** `usePoolWithdraw()` — `hooks/usePoolWithdraw.ts:9-41`. No mutation key.
  - **Invalidates on success** (`:17-18`): `['GetTransactionHistory']`, `['userProfit']`; toast `'Withdrawal Submitted'`.
  - `onError: (error: AxiosError<TokenSupportError>)` → `error.response?.data?.error_message ?? 'Something went wrong. Please try again.'`.
  - Consumer `PoolWithdrawModal/index.tsx:64`; amount computed as `availableLp.times(percentage).div(100).toFixed(0)` where `availableLp = user_lp_amount − pending_withdraw_lp_amount` (`PoolWithdrawModal/index.tsx:48-51, 101`). Recipient defaults to the connected wallet except on Solana pools (`DepositChain.Solana === 0`), validated with `isSolanaAddress` / `getAddress` (`:69-86`). Modal-level `onSuccess` also calls `refetchPoolsData?.()` and closes (`:108-113`). Cooldown copy uses `WITHDRAWAL_COOLDOWN_DAYS = 14` (`Pools/constants.ts:3`), day math in `Pools/utils.ts:3-4`.

---

##### E18 — `GET {BASE}market/weekly-listing-limit` (AUTHENTICATED)

- **Caller:** `GetWeeklyListingLimit()` — `services/index.tsx:255-257`.
- **Response** `WeeklyListingLimitResponse { limit: number; remaining: number; reset_at: number }` (`types.ts:404-408`).
- **Wrapper:** `useWeeklyListingLimit()` — `hooks/useWeeklyListingLimit.ts:10-36`.
  - Key: `['weeklyListingLimit']` — **FLAG: not keyed by account**, although it is per-user (gated by `enabled: Boolean(accessToken)` where `accessToken = listingAccessTokens[account]`). Switching wallets serves the previous wallet's cached limit.
  - `staleTime: 30_000`; **dynamic** `refetchInterval: (query) => data.remaining <= 5 ? 60_000 : 300_000` (constants `NEARLIMIT_REMAINING=5`, `NEAR_LIMIT_REFETCH=60_000`, `DEFAULT_REFETCH=300_000` at `:6-8`).
  - Returns `{ isLimitReached, limit, remaining, resetAt, isLoading, isError }`. Consumers: `DiscoverPoolsContent.tsx:51`, `YourPoolsContent.tsx:49`, `TokenBasics.tsx:30`.

---

##### E19 — `POST {BASE}claim` (AUTHENTICATED)

- **Caller:** `ClaimProfit(payload)` — `services/index.tsx:259-261`.
- **Payload** `ClaimProfitRequest { token_contract_address: string; deposit_chain: number; account_address: string; amount: number | string }` (`types.ts:389-394`).
- **Response** `ClaimProfitResponse { status: string; amount: string; claim_request_id: string }` (`types.ts:397-401`); comment at `types.ts:396` states "success means USDC was moved to the subaccount; claim is synchronous."
- **Wrapper:** `useClaimProfit()` — `hooks/useClaimProfit.ts:5-10`. `mutationKey: ['ClaimProfit']`; returns `res.data`. **No onSuccess/onError, no invalidation in the hook.**
- Invalidation is done by the caller: `claim-rewards-modal/index.tsx:93` → `queryClient.invalidateQueries({ queryKey: ['userProfit', contractAddress] })`. Payload built at `:83-88` with `amount: toWei(claimableReward)` and `account_address: selectedAccount.accountAddress` (a SYMM sub-account chosen in the modal). Errors → `getListingApiErrorMessage`.

---

##### E20 — `POST {conditionalOrders}/api/v4/search/` — **BROKEN URL**

- **Caller:** `SearchConditionalOrders(payload)` — `services/index.tsx:263-265`, on the `conditionalOrders` instance whose baseURL is `TPSL_SERVICES[ENIGMA].domain` = `https://conditional-orders-handler-lowcap85.rasa.capital/api/v5/`.
- Axios `combineURLs` → resolved URL is **`https://conditional-orders-handler-lowcap85.rasa.capital/api/v5/api/v4/search/`** (base keeps `/api/v5`, path adds `/api/v4`).
- **FLAG (bug):** the rest of the app builds this same endpoint as `` `${baseUrl}search/` `` — see `src/services/triggerMarketOrders/service.ts:219` (`listTriggerMarketOrdersRequest`) with the identical body shape (`start`, `size`, `conditional_order_type: 'send_quote'`, `state: ['pending','new','triggered_pending']`, plus `party_a_address`). The pools variant is the only one with the doubled version prefix.
- **Payload** `SearchConditionalOrdersPayload { start: number; size: number; conditional_order_type?: string; state?: string[]; symbol_id?: number | null }` (`types.ts:411-417`) — **no `party_a_address`**, so it queries all parties for a symbol (pool-wide), unlike the trader-scoped variant.
- **Response** `SearchConditionalOrdersResponse { count: number; data: IConditionalOrder[] }` (`types.ts:419-422`); `IConditionalOrder` (`types.ts:424-439`): `{ quote_id: number|null, coh_quote_id: string, party_a_address: string, symbol_id: number, conditional_order_type: string, quantity: number, price: number, conditional_order_price: number, order_type: number, state: string, action_price_type: string, position_type: number, leverage: number, create_time: number, modify_time: number }`.
- **Wrapper:** `useOpenOrders(payload)` — `hooks/useOpenOrders.ts:5-24`. Key `['openOrders', payload]` (object in key); `enabled: Boolean(payload.symbol_id)`; `staleTime: 30_000`, `refetchInterval: 60_000`. Returns `{ orders: data.data ?? [], count: data.count ?? 0, isLoading, isError, refetch }`.
- Consumer `PoolDetail/tables/PoolOpenOrdersTable.tsx:29-35`: `{ symbol_id, start: (page-1)*perPage, size: perPage, conditional_order_type: 'send_quote', state: ['pending','new','triggered_pending'] }`.
- **FLAG:** the "Limit Orders" tab badge is hardcoded `count: 0` at `PoolDetail/PoolDetailTabs.tsx:106` — the real `count` is never surfaced to the tab strip.

---

##### E21 — `POST {BASE}market/refund` (AUTHENTICATED, hand-rolled)

- **Caller:** `refundRejectedPool({ marketAddress, depositChain, recipientAddress, token })` — `src/services/pools/services.ts:7-36`.
- **Wire body** (`:16-20`): `{ market_address, deposit_chain, recipient_address }` — the camelCase params are renamed here; `token` becomes the manual `Authorization: Bearer` header. **Response untyped** (`result.data`, `any`).
- **Wrapper:** `useRefundRejectedPool()` — `src/services/pools/hooks/useRefundRejectedPool.ts:7-32`. No mutation key.
  - **Invalidates on success** (`:28-29`): `['getUserTransactions']`, `['getUserMarketSearch']`; success toast `'Refunded' / 'Refund request has been sent successfully.'`.
  - `onError: (error: any)` → `error.response.data.error_message` — **FLAG: unguarded deref; a network error with no `response` throws inside the error handler.**
  - Consumer `src/components/ReviewModal/RefundYourDepositModal/RefundYourDepositModal.tsx:26,45-52`; selected pool comes from `usePoolsStore.selectedPoolForRefund` (`src/stores/pools/pools.ts:4-10`, `IMarket | null`).

##### E22 — `GET {BASE}market/user-transactions/{start}/{size}?<filters>` (AUTHENTICATED, hand-rolled)

- **Caller:** `getUserTransactions({ accessToken, start = 0, size = 150, ...rest })` — `src/services/pools/services.ts:38-64`. `start`/`size` are path segments; everything else is `constructQueryParams(rest)`.
- **Params type** `GetUserTransactionsParams` (`src/services/pools/types.ts:11-23`):
  ```ts
  { accessToken: string; start?: number; size?: number
    transaction_status?: UserTransactionStatus; transaction_type?: UserTransactionType
    token_address?: string; token_name?: string; wallet?: string; chain_id?: number
    create_time_gte?: number; create_time_lte?: number }
  ```
- **Response** `SearchUserTransactionsResponse { count: number; items: UserTransaction[] }` (`types.ts:40-43`); `UserTransaction` (`types.ts:25-38`): `{ transaction_id, amount, transaction_type, transaction_status, create_time, token_address, chain_id, token_name, token_ticker, wallet, token_decimal, refund_address: string | null }`.
- **Wrapper:** `useUserTransactions({ accessToken, start = 0, size = 150, ...rest })` — `src/services/pools/hooks/useUserTransactions.ts:5-17`.
  - Key: `['getUserTransactions', accessToken, start, size, rest]` — **FLAG: bearer token in the key again.**
  - `enabled: Boolean(accessToken && rest.token_address && rest.chain_id != null)`.
  - **No `staleTime`, no `refetchInterval`, no `retry` override** → RQ defaults (staleTime 0, gcTime 5 min, retry 3), but `refetchOnMount:false` globally, so it fetches once per key.
  - Consumer `RefundYourDepositModal.tsx:35-41` with `transaction_status: 'rejected'`, `transaction_type: 'deposit'`.
  - **FLAG (type duplication):** `UserTransactionStatus`/`UserTransactionType` (`src/services/pools/types.ts:8-9`) are byte-identical to `TransactionStatus`/`TransactionType` (`Pools/services/types.ts:371-372`).

---

##### E23 / E24 — GraphQL (Goldsky ANALYTICS subgraph, HyperEVM)

Client: `getApolloClient(FALLBACK_CHAIN_ID /* 999 */, ClientType.ANALYTICS)` — `src/apollo/client/apolloClients.ts:31-41`; a **new `ApolloClient` is constructed on every call** (`createClient` at `:27-29` → `createApolloClient` at `src/apollo/client/index.ts:5-24`, `InMemoryCache` + `onError` link → `captureGraphQLError`). Both hooks use `fetchPolicy: 'no-cache'`, so the fresh-client-per-call is mostly wasted allocation — **FLAG**.

**E23 — `usePoolQuotes`** — `hooks/usePoolQuotes.ts:18-62`

- Document `POOL_QUOTES_BY_SYMBOL_AND_SOURCE` — `src/apollo/queries.ts:372-427`, operation `PoolQuotes`, variables `($symbolId: String!, $source: String!, $quoteStatuses: [Int!]!, $first: Int!, $skip: Int!, $orderBy: String!, $orderDirection: String!)`, selection `quotes(first, skip, orderBy, orderDirection, where: { symbolId, source, quoteStatus_in: $quoteStatuses })` returning `orderTypeOpen partyAmm partyBmm lf cva partyA partyB quoteId quoteStatus symbol positionType quantity orderTypeClose openedPrice requestedOpenPrice closedPrice quantityToClose timestamp openDeadline timestampSendQuote closePrice partyBsWhiteList symbolId fillAmount marketPrice averageClosedPrice liquidateAmount liquidatePrice closedAmount initialCva initialLf initialPartyAmm initialPartyBmm initialOpenedPrice tradingFee leverage`.
- `source = LOWCAP_DIAMOND_ADDRESS[FALLBACK_CHAIN_ID]?.toLowerCase()` (`:26`).
- Key: `['poolQuotes', symbolId, quoteStatuses, first, skip, orderBy, orderDirection]` (`:29`). Defaults `first = 101`, `skip = 0`, `orderBy = 'timestamp'`, `orderDirection = 'desc'` (`:22-25`).
- `enabled: Boolean(symbolId && source)`; `staleTime: 30_000`; `refetchInterval: 60_000`.
- Maps rows with `toQuoteFromGraph` (`src/apollo/service.ts:140-180`). Returns `{ quotes, chainId: FALLBACK_CHAIN_ID, isLoading, isError, refetch }`.
- Caller passes statuses `[4,5,6]` computed as `OPEN_QUOTE_STATUS.map(s => Object.values(QuoteStatus).indexOf(s))` — `PoolDetailTabs.tsx:17`, enums at `src/types/quote.ts:3-17`.

**E24 — `usePoolHistoryQuotes`** — `hooks/usePoolHistoryQuotes.ts:20-81`

- Document `POOL_QUOTE_EVENTS_BY_SYMBOL_AND_SOURCE` — `src/apollo/queries.ts:429-494`, operation `PoolQuoteEvents`, variables `($symbolId: String!, $source: String!, $typeIn: [String!]!, $first, $skip, $orderBy, $orderDirection)`, selection `quoteEvents(..., where: { type_in: $typeIn, quote_: { symbolId: $symbolId, source: $source } }) { id type metadata timestamp quoteId quote { …same field set + subAccount { address } + closeFee } }`.
- `typeIn = historyCloseTypeToEventTypes[HistoryCloseTypeFilter.AllStatus]` (`:35`) = `['FILL_CLOSE','FORCE_CLOSE','EMERGENCY_CLOSE','ADL_CLOSE','LIQUIDATE_PARTY_A','LIQUIDATE_PARTY_B','LIQUIDATE_CLEARING_HOUSE']` — `src/services/quotes/service.ts:34-50`.
- Key: `['poolHistoryQuotes', symbolId, first, skip, orderBy, orderDirection]`; `enabled: Boolean(symbolId && source)`; `staleTime: 30_000`; `refetchInterval: 60_000`.
- Per row (`:60-67`): `toQuoteFromGraph(event.quote)` → `applyHistoryCloseEventMetadata(quote, event.metadata, event.type)` (`src/utils/quoteEventMetadata.ts:52-94`, overlays snapshot `amount`/`closePrice`/`openedPrice` and forces status from the event type) → sets `statusModifyTimestamp = Number(event.timestamp)`, `closeEventType = event.type`, `historyEventId = event.id`.
- Pagination hack in the consumer: `PoolDetailTabs.tsx:72-98` fetches `HISTORY_FETCH_SIZE = 110` per page but renders `HISTORY_PAGE_SIZE = 10`, synthesizes `totalCount = (page-1)*10 + rows.length` and keeps a `useRef` high-water mark so the pager doesn't collapse during refetch — **FLAG: no real total count from the subgraph.**

---

#### 4. ADJACENT SERVICES THE POOLS UI ALSO HITS (not in the pools service module)

| Hook                                                                                                | Endpoint / source                                                                                                                                                                                                                                                                                                    | Key, timing                                                                                                                                                                    | Where used in Pools                                                                                                           |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `useNotionalCap` — `src/services/markets/hooks/useNotionalCap.ts:35-52`                             | `GET {ENIGMA_SOLVER}/notional_cap/{marketId}` (`src/services/markets/service.ts:9-17`, route `hedgers.ts:124`)                                                                                                                                                                                                       | `['getNotionalCap', hedgerType, marketId]`, `refetchInterval: 60_000`, `enabled: Boolean(marketId) && !bulk`                                                                   | `PoolStatsCard.tsx:28-32` (`hedgerType: ENIGMA`, `isLowcap: true`)                                                            |
| `useNotionalCap({fetchAll:true})` bulk — `useNotionalCap.ts:54-59`                                  | `GET {ENIGMA_SOLVER}/notional_cap` (`service.ts:19-27`, route `hedgers.ts:125`)                                                                                                                                                                                                                                      | `['getNotionalCaps', hedgerType]`, `refetchInterval: 120_000`                                                                                                                  | `PoolsInfo/GeneralInfo.tsx:33` (`total_open_interest`, `total_used`)                                                          |
| `useMarketInfo` — `src/services/hedger/hooks/useMarketInfo.ts:11-16`                                | `GET {ENIGMA_SOLVER}/get_market_info` (`src/services/hedger/services/market-info.ts:9`)                                                                                                                                                                                                                              | `['getMarketInfo']`, `staleTime`+`refetchInterval` `120_000`                                                                                                                   | `PoolStatsCard.tsx:34,46` (`marketInfo[token_ticker].trading_volume`)                                                         |
| `useDexscreenerTokenDetails` — `src/services/dexscreener/hooks/useDexscreenerTokenDetails.ts:35-41` | **Not dexscreener.com** — `GET {PRICE_SERVICE}/metadata` (`src/services/dexscreener/service.ts:166`); base from `src/services/price-service/constants.ts:8-22`: staging `https://lowcap-price-staging.enigma.bz/api/v1`, else `https://lowcap-price.enigma.bz/api/v1`; simulator `${SIMULATOR_HEDGER_DOMAIN}/api/v1` | `['tokenDetails', tokenRequests]`, `refetchInterval: 45_000`, `retry: 3`, `enabled: tokenRequests.length > 0`; module-level `cachedSnapshot` fallback (`service.ts:6,188-191`) | `PoolStatsCard.tsx:44-45` (token USD price)                                                                                   |
| `useTokenVendors` — `src/hooks/markets/useMarketsImage.ts:6-12`                                     | `GET {APP_BACKEND_URL}/vibe_back/token-vendor/tokens/` (`src/services/markets/service.ts:34-38`); `APP_BACKEND_URL` = `https://api-staging.vibe.trading` (staging) / `https://api.vibe.trading` (`constants/misc.ts:21`)                                                                                             | `['getTokenVendors']`, `staleTime: Infinity`                                                                                                                                   | via `useTokenImageByContract` in `PoolWithdrawModal.tsx:42`, `RefundYourDepositModal.tsx:28`                                  |
| `usePrice`, `useMarket` — `src/stores/hedger/hedgerHooks`                                           | Enigma lowcap price WS `wss://lowcap-price.enigma.bz/ws` (`hedgers.ts:106-112`) + hedger market registry                                                                                                                                                                                                             | store-driven                                                                                                                                                                   | `PoolPositionsTable.tsx:30-31`, `PoolOpenQuotesTable.tsx:31-32`, `PoolOpenOrdersTable.tsx:21`, `PoolTradeHistoryTable.tsx:88` |
| `useBalanceOf` — `src/services/blockchain/hooks/use-balance-of.ts:14-46`                            | **contract READ**: `balanceOf(account.accountAddress)` on the Diamond (`useDiamondContract(account.type === SubAccountType.Vibecaps)` → `LOWCAP_DIAMOND_ADDRESS` for lowcap), abi from the contract hook                                                                                                             | `refetchInterval: balanceFetchRate` (quotes store), `staleTime: max(rate/2, 1000)`, `placeholderData: keepPreviousData`, `refetchOnEachLastTxHash: true`                       | `claim-rewards-modal/ClaimRewardsAccountItem.tsx:24`                                                                          |

**Contract calls owned by the pools slice itself: NONE.** Grep for `useReadContract|useWriteContract|writeContract|readContract|Abi` across `src/components/App/Pools` + `src/services/pools` returns exactly one hit — the `useBalanceOf` import above. Deposits are made by sending tokens to a **custodial address returned by E6 (`wallet_public_key`)**, withdrawals/claims/refunds are **REST calls to the listing backend**, not on-chain transactions.

---

#### 5. EXTERNAL SERVICES TOUCHED (complete list)

1. **Listing backend (Enigma)** — `listing85.enigma.bz/v2/` | `listing-staging.enigma.bz/v2/`. E1–E10, E14–E19, E21–E22. Bearer auth per wallet address.
2. **Inventory service (Enigma)** — `inventory85.enigma.bz/api` | `inventory-staging.enigma.bz/api`. E12 only.
3. **DexScreener public API** — `api.dexscreener.com/latest`. E11 only (`useTokenValidate`, create-pool flow).
4. **Enigma solver / hedger** — `solver.enigma.bz/api` | `solver-staging.enigma.bz/api`. E13 (`revenue/{id}`), plus `notional_cap`, `notional_cap/{id}`, `get_market_info`.
5. **Conditional-orders handler (Rasa lowcap)** — `conditional-orders-handler-lowcap85.rasa.capital/api/v5/` | `…-lowcap-stage…`. E20 (with the doubled `/api/v4` path bug).
6. **Goldsky analytics subgraph (HyperEVM)** — E23/E24 via Apollo.
7. **Lowcap price service (Enigma)** — `lowcap-price.enigma.bz/api/v1/metadata` (REST, token prices) and `wss://lowcap-price.enigma.bz/ws` (live price for pool tables).
8. **Vibe backend** — `api.vibe.trading` `/vibe_back/token-vendor/tokens/` (token logos).
9. **RPC / on-chain** — only via `useBalanceOf` (Diamond `balanceOf`) in the claim modal.
10. **PostHog** — every axios/GraphQL failure in the slice (`captureAxiosError`, `captureGraphQLError`).
11. **SymmScan explorer** (link-out only) — `https://intent.symmscan.com/position-details/{TENANT}/{quoteId}`, `Pools/utils/explorerUtils.ts:24-38`.

---

#### 6. POLLING LOOPS & INTERVALS (complete)

| Interval        | Hook(s)                                                                                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 45 s            | `useDexscreenerTokenDetails` (price-service metadata)                                                                                                                      |
| 60 s            | `useMarketDetail`, `useOpenOrders`, `usePoolQuotes`, `usePoolHistoryQuotes`, `useNotionalCap` (single), `useWeeklyListingLimit` **when `remaining ≤ 5`**                   |
| 90 s            | `useDiscoverMarketSearch`, `useYourPoolsMarketDeposits`                                                                                                                    |
| 120 s           | `useAggregatedTvl`, `useRevenue` (2 requests per tick), `useNotionalCap` bulk, `useMarketInfo`                                                                             |
| 300 s           | `useWeeklyListingLimit` default                                                                                                                                            |
| 600 s           | `useUserProfit`                                                                                                                                                            |
| block/tx-driven | `useBalanceOf` (`balanceFetchRate`, refetch on last tx hash)                                                                                                               |
| **no polling**  | `useTransactionHistory`, `useRetryListingInfo`, `useTokenMetaData`, `useTokenValidate` (3 queries), `useUserTransactions`, `useDiscoverPoolsCount` (`staleTime: Infinity`) |

All intervals are suspended in background tabs (`refetchIntervalInBackground: false`).

---

#### 7. TYPE INVENTORY

##### 7.1 `src/components/App/Pools/services/types.ts` — every exported symbol

`GetSignInMessageResponse` (:4), `SignInMessageParams` (:9), `LoginPayload` (:22), `LoginMessage` (:27), `LoginResponse` (:38), `IMarket` (:43), `MarketSearchItem` (:67), `MarketSearchResponse` (:94), `UserMarketSearchItem` (:102), `RetryMarketPayload` (:117), `RetryMarketResponse` (:122), `RetryListingInfoPayload` (:126), `RetryListingInfoResponse` (:131), `UserMarketSearchResponse` (:137), `IDepositHistory` (:144), `AddMarketPayload` (:155), `AddMarketResponse` (:164), `AddDepositPayload` (:186), `AddDepositResponse` (:191), `GetTokenMetaDataResponse` (:202), `TokenSupportError` (:212), `GetTokenDexScreenerDataResponse` (:220), `DexScreenerPair` (:225), `AggregatedTvlResponse` (:300), `RevenueResponse` (:305), `MarketDetailResponse` (:313), `UserProfitResponse` (:354), `WithdrawRequest` (:364), `TransactionStatus` (:371), `TransactionType` (:372), `TransactionHistoryResponse` (:374), `ITransactionHistory` (:379), `ClaimProfitRequest` (:389), `ClaimProfitResponse` (:397), `WeeklyListingLimitResponse` (:404), `SearchConditionalOrdersPayload` (:411), `SearchConditionalOrdersResponse` (:419), `IConditionalOrder` (:424).
Non-exported: `EToken`, `Info`, `Social`, `Website`, `Liquidity`, `PriceChange`, `Txns`, `H1`, `Volume` (:245-297).

**Key transcriptions not already given:**

```ts
// types.ts:43-64  — legacy full market shape (mostly superseded by MarketSearchItem/MarketDetailResponse)
export interface IMarket {
  contract_address: string;
  chain_id: number;
  token_name: string;
  token_ticker: string;
  token_decimal: number;
  is_tax: boolean;
  user_whitelist_tax: boolean;
  buy_back_ratio: number;
  max_leverage: number;
  symmio_symbol_id?: number | null; // authenticated endpoint field
  symbol_id?: number | null; // public endpoint field
  additional_chains: number[] | null;
  main_pool: string | null;
  cex_list: string[] | null;
  market_status: string;
  deposit_history: IDepositHistory;
  user_deposit_history?: IDepositHistory;
  listing_time: number | null;
}

// types.ts:67-92  — row of GET market/search; all money/rate strings are 18-decimal
export interface MarketSearchItem {
  contract_address: string;
  symbol_id: number | null;
  token_ticker: string;
  token_name: string;
  chain_id: number;
  max_leverage: number;
  price_usd: string | null;
  market_cap: string | null;
  vol24h: string | null;
  apr: string | null;
  tvl: string | null;
  reward_24h?: string | null;
  liquidity: string | null;
  open_interest: string | null;
  listing_time: number | null;
  market_status: string;
}

// types.ts:102-115 — row of GET market/search-user (extends the above)
export interface UserMarketSearchItem extends MarketSearchItem {
  apr_24h: string | null;
  apr_30d: string | null;
  user_deposit: string | null;
  user_share_percentage: number | null;
  user_revenue: string | null;
  retry_limit?: number | null;
  remaining_retry_limit?: number | null;
  remaining_cooldown_seconds?: number | null;
}

// types.ts:144-152
export interface IDepositHistory {
  waiting: string;
  deposited: string;
  rejected: string;
  refound: string; // sic: "refound"
  success: string;
  transferred: string;
  withdraw: string;
}
```

##### 7.2 `src/services/pools/types.ts` — full file (43 lines)

`RefundRejectedPoolParams { marketAddress: string; depositChain: number; recipientAddress: string; token: string }` (:1-6); `UserTransactionStatus = 'pending'|'rejected'|'refund'|'success'` (:8); `UserTransactionType = 'deposit'|'withdraw'` (:9); `GetUserTransactionsParams` (:11-23, transcribed in E22); `UserTransaction` (:25-38, transcribed in E22); `SearchUserTransactionsResponse { count: number; items: UserTransaction[] }` (:40-43).

##### 7.3 `src/components/App/Pools/types.ts` (domain enums the services depend on)

```ts
CreatePoolFormData { TokenContractAddress: string; BuybackProfit: string; MaxLeverage: string; DepositChain: number }   // :1-6
ActiveTabKeys = 'pools' | 'your_deposits' | 'discover' | 'your_pools'                                                   // :8
DiscoverMarketSearchSortBy = 'tvl'|'liquidity'|'market_cap'|'vol24h'|'open_interest'|'apr'|'listing_time'               // :11-18
UserMarketSearchSortBy = DiscoverMarketSearchSortBy | 'apr_24h'|'apr_30d'|'user_deposit'|'user_share_percentage'|'user_revenue'  // :21-27
MarketSearchFilterKey = 20 keys (market_cap__ge/le, user_revenue__ge/le, tvl__ge/le, apr_24h__ge/le, apr_30d__ge/le, apr__ge/le, liquidity__ge/le, open_interest__ge/le, vol24h__ge/le, listing_time__ge/le)  // :29-49
MarketSearchFilters = Partial<Record<MarketSearchFilterKey, string>>                                                    // :51
const enum SUPPORT_TOKEN_ERROR { UNSUPPORTED_TOKEN = 26 }                                                               // :53-55
enum MarketStatus { WaitingForDeposit='waiting_for_deposit', UnderReview='under_review', Rejected='rejected', Listed='listed', Delisted='delisted' }  // :56-62
enum DepositStatus { Waiting='waiting', Deposited='deposited', Rejected='rejected', Refound='refound', Success='success', Withdraw='withdraw' }       // :64-71
enum DepositChain { Solana=0, Base=8453, BSC=56, ARBITRUM_ONE=42161, SONIC=146 }                                        // :73-79
```

**FLAG:** `market_status` is typed as bare `string` on `MarketSearchItem`/`IMarket` but as `MarketStatus` on `MarketDetailResponse` — every consumer casts (`PoolDetail/index.tsx:36`, `TokenBasics.tsx:51`).
**FLAG:** `DepositStatus` is exported and never imported anywhere (grep-verified) → dead enum. `ActiveTabKeys` includes `'pools'`/`'your_deposits'` but `tabs` (`Pools/constants.ts:14-17`) only ships `discover` and `your_pools`.

---

#### 8. AUTH FLOW (the gate in front of every authenticated endpoint)

`useListingAuth()` — `hooks/useListingAuth.ts:15-88`. Returns `{ isConnecting, isAuthenticated, triggerAuthFlow }`.

- `isAuthenticated = Boolean(account && activeAccount && accessToken)` (`:24`) where `accessToken = listingAccessTokens[account]` (`:22`).
- `triggerAuthFlow(onComplete?)` (`:54-85`) walks: not connected → `ApplicationModal.WAYS_TO_TRADE`; connected but no SYMM sub-account → `CREATE_ACCOUNT`; account but no listing token → `LISTING_SIGNATURE_REQUEST`. A `useEffect` (`:30-52`) auto-advances the remaining steps and fires the stored callback once fully authenticated (refs `isAuthFlowTriggeredRef`, `pendingCallbackRef`).
- Token store: `useUserStore.listingAccessTokens: { [account: string]: string }` — `src/stores/user/userTypes.ts:43`, initial `{}` at `src/stores/user/user.ts:48`, setter `updateListingAccessToken` at `user.ts:52-58`.
- Route guard: `ListingAuthGuard` (`components/ListingAuthGuard.tsx:11-45`) renders `null` until authenticated and bounces to `/pools?tab=discover` if the user dismisses the modal; wraps only `/pools/create-pool` (`src/pages/pools/create-pool.tsx:4-10`). `/pools` and `/pools/[contractAddress]` are unguarded.

---

#### 9. MUTATION → INVALIDATION MATRIX

| Mutation (file:line)                                       | Invalidates                                                                                                 |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `AddMarket` inline (`CreatePool/index.tsx:80-106`)         | `['getMarketSearch']`, `['getUserMarketSearch']`, `['discoverPoolsCount']` — all `refetchType: 'all'`       |
| `useAddDeposit` (`useAddUserDeposit.ts:24-57`)             | **none** — opens `ApplicationModal.LISTING`, passes `refetchPoolsData` through modalOptions                 |
| `useListingLogin` (`useListingLogin.ts:17-50`)             | **none** — writes the token to the user store                                                               |
| `useRetryMarketListing` (`useRetryMarketListing.ts:18-47`) | `['getUserMarketSearch']`, `['getMarketSearch']`, `['retryListingInfo']`                                    |
| `usePoolWithdraw` (`usePoolWithdraw.ts:14-40`)             | `['GetTransactionHistory']`, `['userProfit']`                                                               |
| `useClaimProfit` (`useClaimProfit.ts:6-9`)                 | **none in hook**; caller invalidates `['userProfit', contractAddress]` (`claim-rewards-modal/index.tsx:93`) |
| `useRefundRejectedPool` (`useRefundRejectedPool.ts:11-31`) | `['getUserTransactions']`, `['getUserMarketSearch']`                                                        |

**FLAG (gaps):** nothing invalidates `['marketDetail', …]`, `['poolQuotes', …]`, `['poolHistoryQuotes', …]`, `['GetAggregatedTvl']`, `['weeklyListingLimit']`, or `['openOrders', …]` after any mutation. `AddMarket` does not invalidate `['weeklyListingLimit']` even though it consumes a weekly slot. Withdraw/claim rely on ad-hoc `refetchPoolsData?.()` callbacks (`PoolWithdrawModal/index.tsx:110`, `PoolDetail/index.tsx:37,46`) instead of the cache.

---

#### 10. FLAGS — bugs, dead code, TODOs, stubs (consolidated)

**Bugs / likely bugs**

1. `SearchConditionalOrders` builds `…/api/v5/api/v4/search/` (`index.tsx:264` vs base `misc.ts:50`); canonical form is `` `${baseUrl}search/` `` (`triggerMarketOrders/service.ts:219`).
2. Bearer tokens are embedded in react-query keys: `useYourPoolsMarketDeposits.ts:33`, `useUserTransactions.ts:7`.
3. `useWeeklyListingLimit` key `['weeklyListingLimit']` is not account-scoped (`useWeeklyListingLimit.ts:16`) — stale across wallet switches.
4. `useUserProfit` key omits `marketStatus` (`useUserProfit.ts:11`) though it gates `enabled`.
5. Duplicate query key `['tokenMetaData', tokenAddress, chain]` with conflicting options in `useTokenMetaData.ts:13` and `useTokenValidate.ts:36`.
6. `useRefundRejectedPool.ts:17` dereferences `error.response.data.error_message` unguarded.
7. `useDiscoverMarketSearch.ts:58` puts the whole `router.query` in the key → over-refetching on unrelated param changes.
8. `PoolDetailTabs.tsx:106` hardcodes the Limit-Orders tab count to `0` while `useOpenOrders` returns a real `count`.
9. `constructQueryParams` does not URL-encode (`src/utils/queryParams.ts:9`) — a `query=` search term with `&`/`#` breaks the URL.
10. `PostWithdraw` has no response generic (`index.tsx:252`).
11. `AddMarketPayload.is_tax`/`user_whitelist_tax` are hardcoded `false` in the only caller (`CreatePool/index.tsx:112,116`) despite being form-modelled.

**Dead / vestigial** 12. `IS_POOLS_ENABLED` (`environment.ts:5`) — never referenced. 13. `NEXT_PUBLIC_POOLS_CLAIM_MOCK` / `_ERROR` (`.env:22-23`) — never referenced. 14. `APP_POOLS_BACKEND_URL` test-vs-prod ternary branches are identical (`misc.ts:25-27`). 15. `DepositStatus` enum (`Pools/types.ts:64-71`) — unused. 16. `useAddDeposit`'s `status: MarketStatus` param (`useAddUserDeposit.ts:18`) — unused. 17. `UseTokenMetaDataProps.accessToken` (`useTokenMetaData.ts:6`) — unused. 18. `IMarket.symmio_symbol_id`, `deposit_history`, `user_deposit_history` are only ever produced by the stub converter, never consumed from a real response. 19. Explicit TODO: `marketSearchItemToStubIMarket.ts:13` — `// TODO: I think we can remove this function!` 20. `services/index.tsx:157-158` — commented-out `domain`/`uri` hint left in the signature. 21. `console.log` left in production paths: `CreatePool/index.tsx:109` (`'Final data:'`), `useAddUserDeposit.ts:46` (`'e'`), `apolloClients.ts:36`. 22. `Pools/services/types.ts:312` comment says `GET /v2/market` while the code path is `market?…`; `types.ts:353` says `/v2/profit/...` — comments carry the `/v2` that actually lives in the base URL.

**"Coming soon" stubs in the pools UI** 23. `components/ui/ComingSoonBadge.tsx` and `components/ui/ComingSoonColumnsPanel.tsx` — render "Coming Soon"/"…will be available in the next update" panels for unimplemented table columns. 24. `PoolChartCard.tsx` — full TVL/Rewards + Pool/Your-performance tab chrome rendered over `ChartPlaceholder` (`PoolsInfo/ChartPlaceholder.tsx`); **no data hook at all** (`PoolChartCard.tsx:20-24` holds only local tab state). 25. History pagination is synthetic (`PoolDetailTabs.tsx:86-98`) because the subgraph query returns no total.

---

## 9. State, on-chain surface, routing, GraphQL

I have everything needed. Producing the map.

---

### Vibe-ui — Pools slice: STATE, ON-CHAIN, ROUTING, GraphQL

All paths relative to `/symmio/Vibe-ui`.

---

#### 1. The pools zustand store

##### 1.1 Definition — `src/stores/pools/pools.ts` (10 lines, entire file)

```ts
import { IMarket } from "@/components/App/Pools/services/types"; // :1
import { createZustandStore } from "@/utils/store"; // :2

interface PoolsStore {
  // :4
  selectedPoolForRefund: IMarket | null; // :5
}

export const usePoolsStore = createZustandStore<PoolsStore>("pools", {
  // :8
  selectedPoolForRefund: null, // :9
});
```

**Full state shape**: exactly one key, `selectedPoolForRefund: IMarket | null`.

`IMarket` is defined at `src/components/App/Pools/services/types.ts:43-64`:
`contract_address`, `chain_id`, `token_name`, `token_ticker`, `token_decimal`, `is_tax`, `user_whitelist_tax`, `buy_back_ratio`, `max_leverage`, `symmio_symbol_id?`, `symbol_id?`, `additional_chains`, `main_pool`, `cex_list`, `market_status`, `deposit_history: IDepositHistory`, `user_deposit_history?: IDepositHistory`, `listing_time`. (`services/types.ts:53` comments that the authenticated endpoint uses `symmio_symbol_id` while the public one uses `symbol_id`.)

##### 1.2 Actions — **there are none**

`createZustandStore(name, initialState, actions?, isPersist = false, persistKeys?)` (`src/utils/store.ts:29-35`). The pools call passes **only** `name` and `initialState`:

- **no `actions` creator** → no action methods on the store;
- **`isPersist` defaults to `false`** → the store is **NOT persisted**; it goes through `devtools(immer(...))` only, with `devtools` `enabled: process.env.NODE_ENV === 'development'` (`src/utils/store.ts:61-71`). There is no `store-pools-0.0.5` localStorage key (`STORE_VERSION = '0.0.5'`, `src/utils/store.ts:9`).

All writes therefore go through the raw `usePoolsStore.setState({...})` escape hatch.

##### 1.3 Selector hooks

`createSelectors` (`src/utils/store.ts:15-25`) auto-generates one `use.<key>()` hook per state key. Since the state has one key, the store exposes exactly one selector hook:

- `usePoolsStore.use.selectedPoolForRefund()`

##### 1.4 Every reader / writer (repo-wide, exhaustive)

| File:line                                                                         | Direction | What                                                                                                                                           |
| --------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/Layout/index.tsx:103`                                             | **read**  | `const selectedPoolForRefund = usePoolsStore.use.selectedPoolForRefund()`                                                                      |
| `src/components/Layout/index.tsx:202`                                             | **read**  | `{selectedPoolForRefund && <RefundYourDepositModal />}` — the store value _is_ the modal's open-flag (this modal is not in `ApplicationModal`) |
| `src/components/App/Pools/components/PoolsTable/YourPoolTableItem.tsx:70-74`      | **write** | `handleRefundClick` → `triggerAuthFlow(() => usePoolsStore.setState({ selectedPoolForRefund: marketSearchItemToStubIMarket(item) }))`          |
| `src/components/App/Pools/components/PoolsList/YourPoolMobileCard.tsx:76-80`      | **write** | same pattern, `marketSearchItemToStubIMarket(pool)`                                                                                            |
| `src/components/ReviewModal/RefundYourDepositModal/RefundYourDepositModal.tsx:23` | **read**  | `usePoolsStore.use.selectedPoolForRefund()`                                                                                                    |
| `RefundYourDepositModal.tsx:52`                                                   | **write** | `usePoolsStore.setState({ selectedPoolForRefund: null })` after a successful refund mutation                                                   |
| `RefundYourDepositModal.tsx:73`                                                   | **write** | `onClose={() => usePoolsStore.setState({ selectedPoolForRefund: null })}`                                                                      |

`marketSearchItemToStubIMarket` (`src/components/App/Pools/utils/marketSearchItemToStubIMarket.ts:15-43`) builds a fake `IMarket` from a `MarketSearchItem`/`UserMarketSearchItem` row — it hardcodes `token_decimal: 18`, `is_tax: false`, `buy_back_ratio: 0`, `main_pool: null`, `cex_list: null`, and fabricates `user_deposit_history` from `user_deposit`. **Flagged**: line 13 carries `// TODO: I think we can remove this function!`.

##### 1.5 Other global state the pools feature actually depends on

The pools store is a stub; the real pools state lives in three other stores.

**`src/stores/application/application.ts`** — `createZustandStore('application', {...}, actions, true, ['chainId','walletConnectionType','avatarVersion'])` (`application.ts:12`, `:18-19`). `openModal` and `modalOptions` are **not** in `persistKeys`, so modal state is memory-only. Defaults: `openModal: null`, `modalOptions: {} as any` (`application.ts:16-17` — note the `as any` cast, the declared type is `ToggleModalOptions` which is `| undefined`).

Pools-owned `ApplicationModal` members (`src/stores/application/applicationTypes.ts`):

- `LISTING = 'LISTING'` (:49) — deposit-address modal
- `LISTING_FILTER = 'LISTING_FILTER'` (:50)
- `LISTING_TERMS_AND_CONDITIONS = 'LISTING_TERMS_AND_CONDITIONS'` (:51)
- `LISTING_SIGNATURE_REQUEST = 'LISTING_SIGNATURE_REQUEST'` (:56)
- `CLAIM_REWARDS = 'CLAIM_REWARDS'` (:54)
- `POOL_WITHDRAW = 'POOL_WITHDRAW'` (:57)
- `POOL_WITHDRAWAL_DETAIL = 'POOL_WITHDRAWAL_DETAIL'` (:58)

Pools-owned `ToggleModalOptions` payloads (`src/stores/application/applicationHooks.ts:11-32`):

```ts
[ApplicationModal.CLAIM_REWARDS]?:  { market: MarketDetailResponse }                                  // :12
[ApplicationModal.LISTING]?:        { publicAddress?: string; chain?: number; tokenName: string;
                                      refetchPoolsData?: () => void }                                 // :17-22
[ApplicationModal.POOL_WITHDRAW]?:  { market?: MarketDetailResponse; refetchPoolsData?: () => void }   // :24-27
[ApplicationModal.POOL_WITHDRAWAL_DETAIL]?: { entry?: WithdrawalDetailEntry;
                                              market?: MarketDetailResponse }                          // :28-31
```

Note `applicationHooks.ts:1-2` imports `WithdrawalDetailEntry` from `@/components/App/Pools/components/WithdrawalDetailModal` and `MarketDetailResponse` from `@/components/App/Pools/services/types` — the global store types depend on Pools component files (inverted dependency; flagged).

Pools modal togglers in `applicationHooks.ts`:

- `useToggleListingDepositModal()` :258
- `useToggleListingTermsAndConditionsModal()` :261
- `useToggleListingFilterModal()` :265
- `useToggleListingSignatureRequestModal()` :268 — **dead**: nothing imports it (the signature modal is opened by direct `setState` in `useListingAuth.ts:50` and `:81`, and closed by `useApplicationStore.setState({ openModal: null })` in `ListingSignatureRequestModal/index.tsx:31,41`)
- `useToggleClaimRewardsModal()` :275-283 (option-carrying)
- `useTogglePoolWithdrawModal()` :304-314 (option-carrying)
- `useToggleWithdrawalDetailModal()` :316-326 (option-carrying)

Also relevant: `useToggleModal` (`applicationHooks.ts:39-46`) always resets `modalOptions: undefined` when toggling — so opening a pools modal via the plain toggler wipes any options previously set.

**`src/stores/user/user.ts`** — created with `isPersist = true` and **no `persistKeys`** (`user.ts:9-10`, terminal `true` at tail line 69) → the _entire_ user state persists to `localStorage['store-user-0.0.5']`. Pools-relevant keys:

- `listingAccessTokens: { [account: string]: string }` (`userTypes.ts:43`, default `{}` at `user.ts:48`), written by `updateListingAccessToken` (`user.ts:84-85`). **Bearer tokens are persisted in localStorage** — flagged.
- `hasSeenListingTerms: boolean` (`userTypes.ts:44`, default `false` at `user.ts:49`), setter `setHasSeenListingTerms` (`userTypes.ts:68`, `user.ts:90`).

Readers of `listingAccessTokens`: `YourPoolsContent.tsx:45-47`, `CreatePool/index.tsx:32-34`, `useListingAuth.ts:21-22`, `useWeeklyListingLimit.ts:12-13`, `RefundYourDepositModal.tsx:22,33`, and the axios request interceptor `src/components/App/Pools/services/index.tsx:62-77`. The response interceptor clears the token on HTTP 401 (`services/index.tsx:79-93`).

Readers of `hasSeenListingTerms`: `DiscoverPoolsContent.tsx:49,84`, `YourPoolsContent.tsx:46,81`, `TermsAndConditionsModal/index.tsx:21,58-59`.

**`src/stores/wallet/wallet.ts`** — `useWalletStore.use.account()` / `.isConnected()` / `.isConnecting()` / `.chainId()` are read throughout the pools feature (`useListingAuth.ts:17-19`, `services/index.tsx:64`, `PoolWithdrawModal/index.tsx:35`, `ClaimRewardsAccountItem.tsx:22`, etc.).

---

#### 2. ON-CHAIN interactions reachable from the Pools feature

##### 2.1 Proof of scope

Full import inventory of `src/components/App/Pools/**` (all 100+ files) contains **only these** chain-touching module specifiers:

```
src/components/App/Pools/components/claim-rewards-modal/index.tsx:7        @/services/blockchain/hooks/useUserAccounts
src/components/App/Pools/components/claim-rewards-modal/ClaimRewardsAccountItem.tsx:4  @/hooks/quotes/useUpnl
src/components/App/Pools/components/claim-rewards-modal/ClaimRewardsAccountItem.tsx:5  @/services/blockchain/hooks/use-balance-of
src/components/App/Pools/services/hooks/useListingAuth.ts:1               @/services/blockchain/hooks/useUserAccounts
src/components/App/Pools/services/hooks/useListingLogin.ts:1              @/callbacks/useSignMessage
src/components/App/Pools/services/hooks/usePoolQuotes.ts:4                @/constants/addresses (LOWCAP_DIAMOND_ADDRESS — used as a GraphQL `source` filter, not an RPC target)
src/components/App/Pools/services/hooks/usePoolHistoryQuotes.ts:4         @/constants/addresses (idem)
src/components/App/Pools/components/PoolDetail/PoolStatsCard.tsx:1,13     @/constants/addresses (COLLATERAL_SYMBOL), viem (type-only `Address`)
src/components/App/Pools/utils/explorerUtils.ts:1                         @/constants/addresses (SCANNER_URLS — block-explorer link strings)
```

There is **zero** `wagmi` import, **zero** `useWriteContract` / `useSimulateContract` / `useSendTransaction` / `writeContract` / `encodeFunctionData`, and **zero** `useReadContract` anywhere under `src/components/App/Pools/**` or `src/services/pools/**` (verified by grep for `wagmi|useReadContract|useWriteContract|useSimulateContract|useSendTransaction|readContract|writeContract|useAccount|useBalance|usePublicClient|useWalletClient|useSignTypedData|useSwitchChain|multicall|encodeFunctionData|useChainId` over both trees — only the 2 hits at `useListingLogin.ts:1,12` and `ClaimRewardsAccountItem.tsx:5,24` came back).

**There are NO on-chain WRITES anywhere in the Pools feature.** Every mutating pools action (deposit, withdraw, claim, refund, list, retry-list) is an HTTP call to the Enigma listing backend. See §2.3.

##### 2.2 The three on-chain READS (all indirect, all inside the Claim-Rewards modal + the auth guard)

**(a) `getUserSubAccounts` — AccountLayer**

- Hook: `useUserAccounts()` — `src/services/blockchain/hooks/useUserAccounts.ts:9-63`
- wagmi hook: `useReadContractExtended` → `wagmi`'s `useReadContract` (`src/hooks/contract/useReadContractExtended.ts:5,32`), with `{ refetchOnEachLastTxHash: true }` (`useUserAccounts.ts:52`)
- Contract: **AccountLayer**, via `useAccountLayerContract()` = `useContract(ACCOUNT_LAYER_ADDRESS, ACCOUNT_LAYER_ABI)` (`src/hooks/useContract.ts:46-48`)
- Address source: `ACCOUNT_LAYER_ADDRESS` (`src/constants/addresses.ts:69-75`) — HyperEVM `0x46493c376758Da47823D7E3Ae5d417eA6546eEB3` (prod) / `0x812e98F31A4EfFC09dD82e6e87ff7456151a0dFB` (`IS_TEST_ENVIRONMENT`)
- ABI file: `src/constants/abi/account-layer.ts` (exported as `ACCOUNT_LAYER_ABI` from `src/constants/abi/index.ts`)
- Function / args: `getUserSubAccounts(account, 0n, 9999n)` — **read** (`useUserAccounts.ts:22-23`)
- `enabled: Boolean(account) && isSupportedChainId && Boolean(accountLayerContract.address)`; `refetchInterval` 5 min (or 4 s with `ActiveChecking`); `staleTime = refetchInterval/2`; `placeholderData: []` (`:16, :26-31`)
- `select` classifies each subaccount by comparing `item.symmioCore` against `LOWCAP_DIAMOND_ADDRESS[chainId]` → `SubAccountType.Vibecaps` else `Major` (`:35-41`)
- Pools call sites: `useListingAuth.ts:20` (only for `isLoading` gating) and `claim-rewards-modal/index.tsx:32` (the account list rendered in the modal)

**(b) `balanceOf` — SYMMIO diamond**

- Hook: `useBalanceOf({ account })` — `src/services/blockchain/hooks/use-balance-of.ts:14-46`
- wagmi hook: `useReadContractExtended` → `useReadContract`, with `{ refetchOnEachLastTxHash: true, refetchOnEachBlock: options?.refetchOnEachBlock }` (`:32-35`)
- Contract: `useDiamondContract(account?.type === SubAccountType.Vibecaps)` (`use-balance-of.ts:16`) → `useContract(isLowcap ? LOWCAP_DIAMOND_ADDRESS : DIAMOND_ADDRESS, SYMMIO_ABI)` (`src/hooks/useContract.ts:34-38`)
- Address source: `LOWCAP_DIAMOND_ADDRESS` (`src/constants/addresses.ts:51-57`) HyperEVM `0x57331038c21982116EE9b0906E4a5c5cB52dcE2e` (prod) / `0x99641E06d38F327166b3a48f86Ca2cbB3B4fB7EB` (test); or `DIAMOND_ADDRESS` (`addresses.ts:47-50`) which **has no HyperEVM entry** — only BASE `0xa805FE5baA301D4e72C789694F3967452c77D6fD` and POLYGON. On HyperEVM a `Major` account resolves to `undefined` here.
- ABI file: `src/constants/abi/symmio.ts` (`SYMMIO_ABI`)
- Function / args: `balanceOf(account.accountAddress)` — **read** (`use-balance-of.ts:21-24`)
- `enabled: isSupportedChainId && Boolean(account?.accountAddress)`; `refetchInterval: useQuotesStore.use.balanceFetchRate()`; `staleTime: max(rate/2, 1000)`; `placeholderData: keepPreviousData`
- Pools call site: `src/components/App/Pools/components/claim-rewards-modal/ClaimRewardsAccountItem.tsx:24` — one read per rendered sub-account row

**(c) `getPartyAOpenPositions` — SYMMIO diamond (transitively, via uPnL)**

- Hook chain: `ClaimRewardsAccountItem.tsx:25` → `useUpnl(account.accountAddress)` (`src/hooks/quotes/useUpnl.ts:9-33`) → `useOpenPositions(accountAddress, subAccountType)` (`src/services/quotes/hooks/useOpenPositions.ts:10-48`)
- wagmi hook: raw `useReadContract` from `'wagmi'` (`useOpenPositions.ts:8, :25`)
- Contract/ABI: `useDiamondContract()` → `SYMMIO_ABI`; target address `subAccountType ? (Vibecaps ? LOWCAP_DIAMOND_ADDRESS[chainId] : DIAMOND_ADDRESS[chainId]) : diamondContract.address` (`useOpenPositions.ts:11-19`)
- Function / args: `getPartyAOpenPositions(accountAddress, 0n, 200n)` — **read** (`:28-29`)
- `enabled: !isVibecaps` where `isVibecaps = subAccountType === SubAccountType.Vibecaps` (`:23, :31`); `refetchInterval: 15_000`, `staleTime: 7_500`
- **Bug flag**: the Pools call site passes **no** `subAccountType` (`ClaimRewardsAccountItem.tsx:25` → `useUpnl(account.accountAddress)`), so (i) the Vibecaps skip at `useOpenPositions.ts:23,31` never fires and the RPC always runs, and (ii) `targetAddress` falls back to `diamondContract.address`, which is derived from the _globally active_ account's type (`useContract.ts:35-37`), not the row's account. Every row in the claim modal is therefore read against the same diamond regardless of that row's own type. The file's own comment at `useOpenPositions.ts:21-22` says VibeCaps positions live in VAs and querying the SubAccount always returns empty — so the uPnL shown in the claim-rewards rows is systematically 0 / wrong for lowcap accounts.

##### 2.3 Wallet signature (not a contract call, but a wallet interaction)

- `useSignMessageV2()` — `src/callbacks/useSignMessage.ts:30-81`. Uses wagmi's `useWalletClient()` (`:37`) and calls `provider.signMessage({ message })` for `WalletConnectionType.WAGMI` (`:64-67`), `embeddedWallet.sign(message)` or `pimlicoClient.signMessage(...)` for `PRIVY` (`:68-76`). Under `IS_SIMULATOR_MODE` it returns a stub `'0x' + '00'.repeat(65)` (`:52-58`).
- Consumed only by `src/components/App/Pools/services/hooks/useListingLogin.ts:1,12,31`. `SIWE`-style: `GET /auth/sign-in-message` → sign → `POST /auth/login`.

##### 2.4 Explicitly: the pools money flows are **off-chain**

| Action                         | Mechanism                                                                                                                | Evidence                                                                                                                                                                                                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deposit into a pool            | Backend hands back a **custodial deposit address**; the user transfers manually (QR code shown). No tx built by the app. | `useAddUserDeposit.ts:24-44` → `AddDeposit` → `POST /market/deposit-address` (`services/index.tsx:170-177`) → opens `ApplicationModal.LISTING` with `publicAddress: data.wallet_public_key`; `ListingDepositModal/index.tsx:29-58` renders it as a QR, `:119-123` "Click after sending your tokens." |
| Withdraw from a pool           | `POST /market/withdraw` with `{ amount (LP, 1e18), market_address, withdraw_address, description? }`                     | `usePoolWithdraw.ts:14-15` → `PostWithdraw` (`services/index.tsx:251-253`); payload built at `PoolWithdrawModal/index.tsx:105-106`; type `WithdrawRequest` at `services/types.ts:364-369`                                                                                                            |
| Claim rewards                  | `POST /claim` with `{ token_contract_address, deposit_chain, account_address, amount }`                                  | `useClaimProfit.ts:8` → `ClaimProfit` (`services/index.tsx:259-261`); payload at `claim-rewards-modal/index.tsx:83-88` (`amount: toWei(claimableReward)`); `services/types.ts:396` comments "success means USDC was moved to the subaccount; claim is synchronous"                                   |
| Refund a rejected pool deposit | `POST market/refund` with `{ market_address, deposit_chain, recipient_address }` + `Authorization: Bearer`               | `src/services/pools/services.ts:14-27`                                                                                                                                                                                                                                                               |
| List a new pool                | `POST /market/add-market`                                                                                                | `services/index.tsx:166-168`                                                                                                                                                                                                                                                                         |
| Retry a rejected listing       | `POST market/retry-listing`                                                                                              | `services/index.tsx:179-181`                                                                                                                                                                                                                                                                         |

##### 2.5 Chain-related constants used by pools that are _not_ RPC

- `LOWCAP_DIAMOND_ADDRESS[FALLBACK_CHAIN_ID].toLowerCase()` used as the GraphQL `source` variable (§4) — `usePoolQuotes.ts:26`, `usePoolHistoryQuotes.ts:27`.
- `SCANNER_URLS` (`src/constants/addresses.ts:144-155`) → `getTokenExplorerUrl(chain, address)` builds `${base}/token/${address}` (`explorerUtils.ts:15-20`), mapping `DepositChain` → `CCTPDomain`/`SupportedChainId` keys (`explorerUtils.ts:7-13`).
- `getSymmioPositionUrl(chain, quoteId)` → `https://intent.symmscan.com/position-details/${tenant}/${quoteId}` with tenant from `SYMMIO_EXPLORER_TENANT_BY_CHAIN` (`explorerUtils.ts:24-38`).
- `COLLATERAL_SYMBOL` (`addresses.ts:19-23`) in `PoolStatsCard.tsx:1`.

##### 2.6 Pool-shaped entries in `src/constants/abi/symmio.ts` — **unrelated to the Pools feature**

Grep for `pool` in the 17k-line ABI returns 8 hits, all protocol-treasury/struct plumbing, none used by Pools code:

- `SetInvalidBridgedAmountsPool` event (`symmio.ts:3564-3582`) with `oldInvalidBridgedAmountsPool` / `newInvalidBridgedAmountsPool`
- `getInvalidBridgedAmountsPool() view returns (address)` (`symmio.ts:7007-7019`)
- `setInvalidBridgedAmountsPool(address pool)` nonpayable (`symmio.ts:16845-16857`)
- `deallocatedPool` struct member (`symmio.ts:6863`, `symmio.ts:7291`)

**There is no listing/AMM/LP pool ABI in this repo.** Pool liquidity is entirely a backend concept.

---

#### 3. Routing

##### 3.1 Route table — `src/constants/routes.ts:20-25`

```ts
pools: {
  index: '/pools',
  createPool: '/pools/create-pool',
  poolDetail: (contractAddress: string, depositChain?: number) =>
    depositChain != null
      ? `/pools/${contractAddress}?deposit_chain=${depositChain}`
      : `/pools/${contractAddress}`,
},
```

Note `poolDetail` hand-builds the query string rather than using a Next router query object.

##### 3.2 Next.js pages

| File                                        | Component                                             | Guard              |
| ------------------------------------------- | ----------------------------------------------------- | ------------------ |
| `src/pages/pools/index.tsx:1-7`             | `<Pools />` from `@/components/App/Pools`             | none at page level |
| `src/pages/pools/create-pool.tsx:1-12`      | `<ListingAuthGuard><CreatePool /></ListingAuthGuard>` | **auth guard**     |
| `src/pages/pools/[contractAddress].tsx:1-7` | `<PoolDetail />`                                      | none               |

Dynamic segment name is **`contractAddress`** (read at `PoolDetail/index.tsx:24`: `const { contractAddress } = router.query as { contractAddress: string }`).

`next.config.mjs` `redirects()` (`:46-107`) contains **no** pools entry. Global redirect `/` → `/vibecaps/1` (`:48-52`).

##### 3.3 Query params consumed on `/pools`

| Param                    | Values                                                                                                                                                                                                                                                                              | Read at                                                                                                                                                   | Written at                                                                                                                                                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tab`                    | `'discover' \| 'your_pools'` (from `tabs` in `src/components/App/Pools/constants.ts:14-17`; `ActiveTabKeys` also declares unused `'pools' \| 'your_deposits'` at `types.ts:8`)                                                                                                      | `components/App/Pools/index.tsx:17` — falls back to `'discover'` if not in `tabs`                                                                         | `index.tsx:14` `router.push({pathname, query:{tab}}, undefined, {shallow:true})`; `CreatePool/index.tsx:77` `router.replace(... query:{tab:'your_pools'})`; `ListingAuthGuard.tsx:34` `router.replace(... query:{tab:'discover'})` |
| `status`                 | `'all'` or a `MarketStatus` value (`listed`, `waiting_for_deposit`, `under_review`, `rejected`, `delisted`)                                                                                                                                                                         | `useDiscoverMarketSearch.ts:44`, `useYourPoolsMarketDeposits.ts:25` → sent as API `market_status`                                                         | `Filters/FilterByStatus.tsx:25-34` (`{...query, status}`, shallow), `Filters/FilterByMarketStatus.tsx:20-38` (toggles off by `delete nextQuery.status`)                                                                            |
| `chains`                 | array of `DepositChain` ids (`0` Solana, `8453` Base, `56` BSC, `42161` Arbitrum, `146` Sonic — `types.ts:73-79`)                                                                                                                                                                   | `useDiscoverMarketSearch.ts:68`, `useYourPoolsMarketDeposits.ts:52` → API `chain_ids` (repeated `chain_ids=` per element, `src/utils/queryParams.ts:5-8`) | `Filters/FilterByChain.tsx:13-15` (`{...query, chains}`, shallow)                                                                                                                                                                  |
| 20 numeric range filters | `market_cap__ge/le`, `tvl__ge/le`, `vol24h__ge/le`, `liquidity__ge/le`, `open_interest__ge/le`, `apr__ge/le`, `apr_24h__ge/le`, `apr_30d__ge/le`, `user_revenue__ge/le`, `listing_time__ge/le` (`types.ts:29-49`, `MARKET_SEARCH_FILTER_KEYS` at `useDiscoverMarketSearch.ts:8-29`) | `useDiscoverMarketSearch.ts:45-53` — non-`listing_time` values are `toWei()`'d before being sent                                                          | `FilterPoolModal/index.tsx` via `FILTER_FIELD_KEYS` (`FilterPoolModal/helpers.ts:44`); the active count badge reads them at `DiscoverPoolsContent.tsx:58`                                                                          |
| `deposit_chain`          | number                                                                                                                                                                                                                                                                              | `useMarketDetail.ts:8` (`router.query.deposit_chain`), `PoolDetail/index.tsx:54`                                                                          | `routes.pools.poolDetail(addr, chain)`; self-healing replace at `PoolDetail/index.tsx:53-57`                                                                                                                                       |

Note: only the `discover`/`your_pools` filters are URL-driven; the pool-detail tab (`PoolDetailTabs`) is plain `useState` (`PoolDetailTabs.tsx:40`).

##### 3.4 Guards & redirects

**`ListingAuthGuard`** — `src/components/App/Pools/components/ListingAuthGuard.tsx:11-45`

- Wraps `/pools/create-pool` (page level, `create-pool.tsx:6-8`) and the `your_pools` tab body (`components/App/Pools/index.tsx:23-26`).
- `useEffect` :17-21 — if `!isConnecting && !isAuthenticated` → `triggerAuthFlow()`.
- `useEffect` :24-28 — tracks `authModalWasOpenRef` when any modal is open while unauthenticated.
- `useEffect` :31-38 — if the user closed the auth modal without completing → `router.replace({ pathname: routes.pools.index, query: { tab: 'discover' } }, undefined, { shallow: true })`.
- `:40-42` — renders `null` while unauthenticated.

**`useListingAuth`** — `src/components/App/Pools/services/hooks/useListingAuth.ts:15-88`

- `isAuthenticated = Boolean(account && activeAccount && accessToken)` (`:24`), where `accessToken = listingAccessTokens[account]` (`:22`).
- Auth ladder (both in the auto-advance effect `:30-52` and in `triggerAuthFlow` `:54-85`):
  1. not connected → `openModal: ApplicationModal.WAYS_TO_TRADE` (`:71`)
  2. connected, accounts loaded, no `activeAccount` → `ApplicationModal.CREATE_ACCOUNT` (`:45`, `:76`)
  3. account + activeAccount but no token → `ApplicationModal.LISTING_SIGNATURE_REQUEST` (`:50`, `:81`)
- `triggerAuthFlow(onComplete?)` stashes the callback in `pendingCallbackRef` and fires it once `isAuthenticated` flips (`:33-40`). This is the mechanism behind every pools "deposit / withdraw / refund" button.

**`PoolDetail` self-heal + not-found** — `src/components/App/Pools/components/PoolDetail/index.tsx`

- `:53-57` — if `router.isReady && contractAddress && market && router.query.deposit_chain == null`, `router.replace(routes.pools.poolDetail(contractAddress, market.deposit_chain), undefined, { shallow: true })` — back-fills the `deposit_chain` param.
- `:59-66` — loading state (`LottieLoader`, "Loading pool details…").
- `:68-77` — if `!market`, renders "Pool details not found" + a **Back to Pools** button → `router.push(routes.pools.index)`.

**Terms gate before Create Pool** — `DiscoverPoolsContent.tsx:83-89` / `YourPoolsContent.tsx:80-86`: `handleNewPool()` pushes `routes.pools.createPool` only if `hasSeenListingTerms`, otherwise opens `ApplicationModal.LISTING_TERMS_AND_CONDITIONS`. That modal's Agree button (`TermsAndConditionsModal/index.tsx:73-76`) does `router.push(routes.pools.createPool)` then toggles itself closed. Note the "Agree" checkbox `acceptTerms` is local `useState(true)` (`:16`) — pre-checked and never persisted; only the "do not show again" checkbox writes `hasSeenListingTerms`.

**On successful pool creation** — `CreatePool/index.tsx:76-78` `goBackToPoolsList()` → `router.replace({ pathname: routes.pools.index, query: { tab: 'your_pools' } })`.

##### 3.5 Nav entry — `src/components/Layout/NavbarLinksList.tsx:41-56`

```ts
pools: {
  index: routes.pools.index,                                             // :42
  text: 'Pools',                                                         // :43
  isActive: (router) => router.pathname.includes(routes.pools.index),    // :44
  icon: ({isActive, isMobile}) => <Switcher ... fill={isActive ? 'var(--color-main-pink)'
                                                             : 'var(--color-main-gray)'} />, // :45-51
  onClick: (router, callback) => { callback?.(); router.push(routes.pools.index) },          // :52-55
}
```

It has **no `isHidden` and no `isDisabled`** — unlike `points` which is gated by `isHidden: !IS_EARN_POINTS_ENABLED` (`:72`) and `account` which is gated by `isDisabled: (activeAccount) => !activeAccount` (`:89`). So the Pools link is always visible and always enabled.

Rendered by:

- desktop `src/components/Layout/NavBar/components/NavbarLinks/NavBarLinks.tsx:14-32` (uses `NavbarLinksList.main` unless on `/info/*`)
- mobile `src/components/App/Sidebars/MobileHamburgerSidebar.tsx:41-58` (skips `link.isHidden`)

`NavbarLinksList.main` order: `vibecaps`, `pools`, `points`, `account`. `majors` is not in the navbar at all.

##### 3.6 `IS_POOLS_ENABLED` is DEAD CODE

`src/constants/environment.ts:5`: `export const IS_POOLS_ENABLED = process.env.NEXT_PUBLIC_POOLS_ENABLE === 'true'`. `.env:13` sets `NEXT_PUBLIC_POOLS_ENABLE=true`. Repo-wide grep (excluding `node_modules`/`.next`/`.git`) finds **no importer** — the only other occurrences are illustrative snippets in `Docs/CLAUDE_WORKFLOW.md:1033,1036`. Nothing in the app is gated by it.

Similarly `.env:22-23` carry commented-out `# NEXT_PUBLIC_POOLS_CLAIM_MOCK=true` / `# NEXT_PUBLIC_POOLS_CLAIM_MOCK_ERROR=true` with **zero** code references anywhere in the repo — leftover scaffolding.

##### 3.7 Pools affects the price WebSocket routing

`src/stores/hedger/hedgerUpdater.ts:203-209`:

```ts
const shouldOpenLowcapSocket = useMemo(() => {
  if (pathname?.startsWith(routes.account.index)) return true;
  if (pathname?.startsWith(routes.majors.index)) return false;
  if (pathname?.startsWith(routes.vibecaps.index)) return true;
  if (pathname?.startsWith(routes.pools.index)) return true; // :207  ← pools
  return false;
}, [pathname]);
```

`shouldOpenBinanceSocket` (`:196-201`) does **not** mention `/pools`, but its `return true` default (`:200`) means **both** sockets open on `/pools`. The lowcap endpoint is `HEDGER_DATA_MAP[HedgerType.ENIGMA].wsPriceEndpoint` = `wss://lowcap-price.enigma.bz/ws` (`hedgerUpdater.ts:161`, `src/constants/hedgers.ts:106-112`); the Binance one is `wss://fstream.binance.com/stream` (`hedgers.ts:59`). Both connections are `reconnectAttempts: 10` with `shouldReconnect` bound to the same flags (`hedgerUpdater.ts:222-255`).

---

#### 4. GraphQL / subgraph queries the Pools feature depends on

Two documents in `src/apollo/queries.ts`, both used **only** by pools. Both are keyed by `symbolId` + `source` (the lowcap diamond), i.e. all quotes on that market across _all_ traders — this is the pool's book, not the user's.

##### 4.1 `POOL_QUOTES_BY_SYMBOL_AND_SOURCE` — `src/apollo/queries.ts:372-427`

```graphql
query PoolQuotes(
  $symbolId: String!
  $source: String!
  $quoteStatuses: [Int!]!
  $first: Int!
  $skip: Int!
  $orderBy: String!
  $orderDirection: String!
) {
  quotes(
    first: $first
    skip: $skip
    orderBy: $orderBy
    orderDirection: $orderDirection
    where: { symbolId: $symbolId, source: $source, quoteStatus_in: $quoteStatuses }
  ) {
    orderTypeOpen
    partyAmm
    partyBmm
    lf
    cva
    partyA
    partyB
    quoteId
    quoteStatus
    symbol
    positionType
    quantity
    orderTypeClose
    openedPrice
    requestedOpenPrice
    closedPrice
    quantityToClose
    timestamp
    openDeadline
    timestampSendQuote
    closePrice
    partyBsWhiteList
    symbolId
    fillAmount
    marketPrice
    averageClosedPrice
    liquidateAmount
    liquidatePrice
    closedAmount
    initialCva
    initialLf
    initialPartyAmm
    initialPartyBmm
    initialOpenedPrice
    tradingFee
    leverage
  }
}
```

Consumer: `src/components/App/Pools/services/hooks/usePoolQuotes.ts:18-62`

- client: `getApolloClient(FALLBACK_CHAIN_ID, ClientType.ANALYTICS)` (`:31`)
- `source = LOWCAP_DIAMOND_ADDRESS[FALLBACK_CHAIN_ID]?.toLowerCase()` (`:26`) — `FALLBACK_CHAIN_ID = CHAIN_IDS[0] = SupportedChainId.HYPEREVM (999)` (`src/constants/chains.ts:50-52`) → `'0x57331038c21982116ee9b0906e4a5c5cb52dce2e'` in prod
- **react-query key**: `['poolQuotes', symbolId, quoteStatuses, first, skip, orderBy, orderDirection]` (`:29`)
- `enabled: Boolean(symbolId && source)` (`:50`), `staleTime: 30_000`, `refetchInterval: 60_000` (`:51-52`)
- Apollo `fetchPolicy: 'no-cache'` (`:45`)
- Defaults `first = 101`, `skip = 0`, `orderBy = 'timestamp'`, `orderDirection = 'desc'` (`:22-24`)
- Rows mapped through `toQuoteFromGraph` (`src/apollo/service.ts:140`)
- Caller: `PoolDetailTabs.tsx:60-65` with `symbolId: market.symbol_id` and `quoteStatuses: OPEN_STATUS_NUMBERS`. `OPEN_STATUS_NUMBERS = OPEN_QUOTE_STATUS.map(s => Object.values(QuoteStatus).indexOf(s))` (`PoolDetailTabs.tsx:17`) → **`[4, 5, 6]`** = `OPENED`, `CLOSE_PENDING`, `CANCEL_CLOSE_PENDING` (`src/types/quote.ts:3-17`). `orderBy`/`orderDirection` come from the table's sort state (`PoolDetailTabs.tsx:42-43, :63-64`).

##### 4.2 `POOL_QUOTE_EVENTS_BY_SYMBOL_AND_SOURCE` — `src/apollo/queries.ts:429-494`

```graphql
query PoolQuoteEvents(
  $symbolId: String!
  $source: String!
  $typeIn: [String!]!
  $first: Int!
  $skip: Int!
  $orderBy: String!
  $orderDirection: String!
) {
  quoteEvents(
    first: $first
    skip: $skip
    orderBy: $orderBy
    orderDirection: $orderDirection
    where: { type_in: $typeIn, quote_: { symbolId: $symbolId, source: $source } }
  ) {
    id
    type
    metadata
    timestamp
    quoteId
    quote {
      orderTypeOpen
      partyAmm
      partyBmm
      lf
      cva
      partyA
      partyB
      subAccount {
        address
      }
      quoteId
      quoteStatus
      symbol
      positionType
      quantity
      orderTypeClose
      openedPrice
      requestedOpenPrice
      closedPrice
      quantityToClose
      timestamp
      openDeadline
      timestampSendQuote
      closePrice
      partyBsWhiteList
      symbolId
      fillAmount
      marketPrice
      averageClosedPrice
      liquidateAmount
      liquidatePrice
      closedAmount
      initialCva
      initialLf
      initialPartyAmm
      initialPartyBmm
      initialOpenedPrice
      tradingFee
      closeFee
    }
  }
}
```

Consumer: `src/components/App/Pools/services/hooks/usePoolHistoryQuotes.ts:20-81`

- **react-query key**: `['poolHistoryQuotes', symbolId, first, skip, orderBy, orderDirection]` (`:30`) — **note `typeIn` is not in the key** (it is constant here, so benign, but brittle)
- `enabled: Boolean(symbolId && source)` (`:69`), `staleTime: 30_000`, `refetchInterval: 60_000`
- `typeIn = historyCloseTypeToEventTypes[HistoryCloseTypeFilter.AllStatus]` (`:35`) = **`['FILL_CLOSE','FORCE_CLOSE','EMERGENCY_CLOSE','ADL_CLOSE','LIQUIDATE_PARTY_A','LIQUIDATE_PARTY_B','LIQUIDATE_CLEARING_HOUSE']`** (`src/services/quotes/service.ts:40-48`)
- Per row: `toQuoteFromGraph(event.quote)` then `applyHistoryCloseEventMetadata(quote, event.metadata, event.type)` (`src/utils/quoteEventMetadata`), then `quote.statusModifyTimestamp = Number(event.timestamp)`, `quote.closeEventType = event.type`, `quote.historyEventId = event.id` (`:60-67`)
- Caller: `PoolDetailTabs.tsx:75-83` with `first: HISTORY_FETCH_SIZE = 110`, `skip: (historyPage - 1) * HISTORY_PAGE_SIZE` where `HISTORY_PAGE_SIZE = 10` (`PoolDetailTabs.tsx:18-19`). **Flag**: fetch size 110 vs page size 10 with a `skip` stepped by 10 means each page re-fetches ~100 overlapping rows and only `.slice(0, 10)` is displayed (`PoolDetailTabs.tsx:85`); the total count is synthesised as `(page-1)*10 + rows.length` with a `useRef` high-water mark to stop the pager collapsing during refetches (`:86-98`, with explanatory comments).

##### 4.3 GraphQL transport

`src/apollo/client/apolloClients.ts`:

- `enum ClientType { VIBE, ANALYTICS, EVENTS }` (`:6-10`)
- prod `subgraphUrlMap.ANALYTICS` = `https://api.goldsky.com/api/public/project_cm1hfr4527p0f01u85mz499u8/subgraphs/hyperevm_mainnet_analytics/latest/gn` (`:14-15`)
- test (`IS_TEST_ENVIRONMENT`) `testSubgraphUrlMap.ANALYTICS` = `.../subgraphs/hyperevm_analytics/latest/gn` (`:22-23`)
- `getApolloClient(chainId, clientType = ClientType.ANALYTICS)` returns `undefined` and `console.log`s when `chainId !== FALLBACK_CHAIN_ID` (`:31-41`) — both pools hooks guard with `if (!client) return []`.
- **A new `ApolloClient` is constructed on every `queryFn` invocation** (`createClient` at `:27-29` → `createApolloClient` at `src/apollo/client/index.ts:5-23`, `new InMemoryCache()` each time). Combined with `fetchPolicy: 'no-cache'` the Apollo cache is inert; react-query is the only cache. Flagged as wasteful.
- Error link forwards to `captureGraphQLError` with `operationName`, `variables`, `uri` (`client/index.ts:8-16`).

##### 4.4 Not used by pools

`SUBGRAPH_META` (`queries.ts:496-504`) and `QUOTE_EVENTS_FOR_HISTORY` (`src/services/quotes/service.ts:148`) belong to the account/history slice, not pools.

---

#### 5. The bridge from a pool row to the trading UI

##### 5.1 The Trade button

`src/components/App/Pools/components/PoolsTable/components/TradeButton.tsx` (entire file, 31 lines):

```ts
interface TradeButtonProps { symbolId: IMarket['symbol_id']; disabled?: boolean }   // :9-12
export const TradeButton = ({ symbolId, disabled = false }: TradeButtonProps) => {  // :14
  ... <Button wrapperClassName="size-6" size="xs" variant="dark" disabled={!symbolId || disabled}>
        <TradingViewCandles fill="white" width={16} height={16} />                   // :17-20
  if (!symbolId || disabled)
    return <Tooltip content={t('Market not available')} ...>{buttonContent}</Tooltip> // :22-28
  return <Link href={routes.vibecaps.symbolId(symbolId.toString())}>{buttonContent}</Link>  // :30
}
```

**It is a plain `next/link` to `/vibecaps/{symbol_id}`. There is no modal, no store write, no prefetch of market data.**

Enable predicate — `src/components/App/Pools/utils/canTradeMarket.ts:3-5`:

```ts
export function canTradeMarket({ status, symbolId }) {
  return status === MarketStatus.Listed && symbolId != null;
}
```

(`MarketStatus.Listed = 'listed'`, `src/components/App/Pools/types.ts:60`.)

##### 5.2 Where the Trade button is rendered (desktop tables only)

- `src/components/App/Pools/components/PoolsTable/DiscoverPoolTableItem.tsx:40` computes `canTrade`, `:189` renders `<TradeButton symbolId={item.symbol_id ?? undefined} disabled={!canTrade} />`
- `src/components/App/Pools/components/PoolsTable/YourPoolTableItem.tsx:44` / `:215` — same, but only in the non-`Rejected` branch (`:206-226`); a `Rejected` row shows `<RetryListingButton>` + the refund button instead
- **Mobile has no trade path**: neither `PoolsList/DiscoverPoolMobileCard.tsx` nor `PoolsList/YourPoolMobileCard.tsx` imports `TradeButton` or `canTradeMarket` (verified by repo-wide grep). Mobile cards only route to the pool detail page (`DiscoverPoolMobileCard.tsx:69`, `YourPoolMobileCard.tsx:69`).
- **The pool detail page has no Trade button either** — `PoolDetailHeader.tsx:50-60` offers only Withdraw and Deposit.

##### 5.3 What the trading UI needs on arrival

`routes.vibecaps.symbolId(id)` = `/vibecaps/${id}` (`src/constants/routes.ts:3`). The page file is `src/pages/vibecaps/[symbol].tsx` (dynamic segment is **`symbol`**, while the route builder is named `symbolId` — mismatch is harmless but confusing).

`src/pages/vibecaps/[symbol].tsx`:

- `:31` `const symbol = router.query.symbol`
- `:50` `useFeeRates(symbol ? Number(symbol) : DEFAULT_MARKET_ID)` — prefetch fee rates
- `:55-64` effect: looks up `marketsById[Number(symbol)]` from `useActiveHedgerMarkets()`; if the market's `symbol` is in `EXCLUDED_TOKENS` (`['XMR']`, `src/constants/misc.ts:63`) → `router.replace(routes.vibecaps.symbolId('1'))`; else `setLocalStorageItem('LAST_VIBECAPS_SYMBOL_ID', Number(symbol))` and **`useTradeStore.setState({ marketId: Number(symbol) })`** — this is the single handoff point
- `:99-101` gates the whole page on `useIsCurrentHedgerValid()`, rendering `<CheckSymbol />` until the hedger market list is loaded

**So the contract of the bridge is: the listing backend's `symbol_id` must equal the Enigma hedger's `marketId`.** The pool row supplies `symbol_id` (`MarketSearchItem.symbol_id: number | null`, `services/types.ts:69`; `MarketDetailResponse.symbol_id: number | null`, `services/types.ts:318`; `IMarket` carries both `symbol_id?` and `symmio_symbol_id?`, `services/types.ts:53-55`). A `null` `symbol_id` = not yet listed on-chain by the solver → button disabled with the "Market not available" tooltip.

##### 5.4 The other direction — market picker → trade (`LowcapMarketModal`)

Not reachable from `/pools`, but it is the sibling bridge and it exposes pool addresses:

- `src/components/ReviewModal/LowcapMarketModal/LowcapMarketModal.tsx:16-103` — opened via `ApplicationModal.LOWCAP_MARKET` (mounted at `src/components/Layout/index.tsx:180`), data from `useLowcapMarketsFilter()` (`:17-31`), rendered as `VibecapsMarketsTable` (desktop, `:96`) or `VirtualizedMarketsList` (mobile, `:94`).
- Row click — `components/VibecapsMarketsTable/VibecapsMarketTableRow/index.tsx:60-67`:
  ```ts
  const handleMarketClick = () => {
    navigateToSymbol(market.id);
    useSelectedQuotesStore.setState({ activeQuoteId: null });
    onSelectToken?.();
  };
  ```
- `useNavigateToSymbol` (`src/hooks/router/useNavigateToSymbol.ts:6-31`) routes to `routes.vibecaps.symbolId(...)` when `useCurrentTradingType() === TradingType.Shitcoins` (i.e. path starts with `/vibecaps`, `applicationHooks.ts:246-256`), else `routes.majors.symbolId(...)`, preserving `?refcode` if present (`:22, :27`). **Note**: `useCurrentTradingType()` returns `undefined` on `/pools` (it only matches `/vibecaps` and `/majors`), so if this hook were used from a pools page without an explicit `preferredHedgerTradingType`/`hedgerTradingType`, it would fall through to the **majors** branch — which is exactly why `TradeButton` uses a hardcoded `routes.vibecaps.symbolId(...)` `Link` instead.
- `components/VibecapsMarketsTable/VibecapsMarketTableRow/components/TokenAddresses.tsx:11-42` — a two-row copy widget labelled `Token` / **`Pool`**, the latter being `liquidityPairAddress` (the DEX LP pair address, unrelated to a listing pool).

---

#### 6. The other explicitly-listed files

##### 6.1 `src/constants/environment.ts` (full, 25 lines)

```
:1  IS_TEST_ENVIRONMENT       = NEXT_PUBLIC_IS_TEST_ENVIRONMENT === 'true'
:2  IS_BACKEND_STAGING_ENV    = NEXT_PUBLIC_BACKEND_ENVIRONMENT === 'staging'
:3  ALPHA_TESTING_MODE        = NEXT_PUBLIC_IS_ALPHA_TESTING_MODE === 'true'
:4  BETA_TESTING_MODE         = NEXT_PUBLIC_IS_BETA_TESTING_MODE === 'true'
:5  IS_POOLS_ENABLED          = NEXT_PUBLIC_POOLS_ENABLE === 'true'          ← DEAD, see §3.6
:6  IS_AA_ENABLED             = NEXT_PUBLIC_AA_ENABLE === 'true'
:7  IS_RPC_DEBUGGER_ENABLED   = NEXT_PUBLIC_RPC_DEBUGGER === 'true'
:8  IS_SUBGRAPH_DEBUGGER_ENABLED = NEXT_PUBLIC_SUBGRAPH_DEBUGGER === 'true'
:9  IS_EARN_POINTS_ENABLED    = NEXT_PUBLIC_EARN_POINTS_ENABLE === 'true'
:12 IS_SIMULATOR_MODE         = NEXT_PUBLIC_SIMULATOR_MODE === 'true'
:13-19 SIMULATOR_HEDGER_DOMAIN / _TPSL_DOMAIN / _PRICE_WS / _NOTIFICATION_WS / _RPC_URL / _MOCK_WALLET
:22-25 SIMULATOR_RASA_DOMAIN / _RASA_NOTIFICATION_WS / _RASA_PRICE_WS
```

Pools reads `IS_BACKEND_STAGING_ENV` + `IS_TEST_ENVIRONMENT` (via `APP_POOLS_BACKEND_URL` and the `inventory` axios base at `services/index.tsx:50-54`).

##### 6.2 `src/constants/misc.ts` — the one pools constant

`misc.ts:23-27`:

```ts
export const APP_POOLS_BACKEND_URL = IS_BACKEND_STAGING_ENV
  ? "https://listing-staging.enigma.bz/v2/"
  : IS_TEST_ENVIRONMENT
    ? "https://listing85.enigma.bz/v2/"
    : "https://listing85.enigma.bz/v2/";
```

**Flag**: the `IS_TEST_ENVIRONMENT` and default branches are identical — the ternary is a no-op.

It is consumed as the `axios.create({ baseURL: APP_POOLS_BACKEND_URL, timeout: 20000 })` base (`src/components/App/Pools/services/index.tsx:41-44`) and directly in `src/services/pools/services.ts:15` and `:48`.

Pools-adjacent constants that live in `src/components/App/Pools/constants.ts` rather than `misc.ts`: `WITHDRAWAL_COOLDOWN_DAYS = 14` (:3), `MIN_POOL_DEPOSIT_AMOUNT = 5` (:4), `DEPOSIT_CHAIN_OPTIONS` (:6-12), `tabs` (:14-17), `poolStatusMapper` (:19-40).

Other `misc.ts` values reached from pools: `DEFAULT_PRECISION`/`DEFAULT_AMOUNT_PRECISION` (:114,:116) in `PoolWithdrawModal`/`WithdrawalDetailModal`/`PoolStatsCard`, `DEFAULT_MARKET_ID = 1` (:62) as `useRevenue`'s default marketId, `DEFAULT_TOKEN_IMAGE = '/static/images/default-token.svg'` (:203) in `useTokenImageByContract`, `TPSL_SERVICES[HedgerType.ENIGMA].domain` (:45-59) as the `conditionalOrders` axios base.

##### 6.3 `src/services/markets/hooks/useNotionalCap.ts` — pools usage

Params (`:10-15`): `{ hedgerType?, marketId?, isLowcap = false, fetchAll = false }`; `fetchAll` is annotated `// When true, fetch all markets via bulk endpoint (for pools/modal)` (`:14`).

Two react-query queries:
| | single | bulk |
|---|---|---|
| key | `['getNotionalCap', effectiveHedgerType, effectiveMarketId]` (:36) | `['getNotionalCaps', effectiveHedgerType]` (:55) |
| fn | `getNotionalCap(hedgerType, marketId)` → `GET {hedger.domain}/notional_cap/{marketId}` (`src/services/markets/service.ts:9-17`, route at `src/constants/hedgers.ts:124`) | `getNotionalCaps(hedgerType)` → `GET {hedger.domain}/notional_cap` (`service.ts:19-27`, route `notionalCaps: 'notional_cap'` at `hedgers.ts:125` — **only ENIGMA defines it**, RASA does not) |
| enabled | `Boolean(effectiveMarketId) && !shouldUseBulkFetch` (:38) | `shouldUseBulkFetch` (:57) |
| refetchInterval | `60_000` (:39) | `120_000` (:58) |

`shouldUseBulkFetch = fetchAll && Boolean(getHedgerInfo(hedgerType).routes.notionalCaps)` (`:30-33`). ENIGMA domain = `https://solver.enigma.bz/api` prod / `https://solver-staging.enigma.bz/api` test (`hedgers.ts:86-90`).

`isLowcap: true` changes the derived math (`:42-49`, `:63-70`): `total = available_to_long + available_to_short + used` and `availableLiquidity = available_to_long + available_to_short` (instead of `total_cap` / `total_cap - used`).

Pools call sites:

- `src/components/App/Pools/components/PoolsInfo/GeneralInfo.tsx:33` — `useNotionalCap({ isLowcap: true, fetchAll: true })`, consuming `total_open_interest` and `total_used` (returned at `useNotionalCap.ts:109-110`) for the "Vibecaps TVL / Available OI" toggle tile and the "Total OI" tile
- `src/components/App/Pools/components/PoolDetail/PoolStatsCard.tsx:28-32` — `useNotionalCap({ hedgerType: HedgerType.ENIGMA, marketId: market.symbol_id, isLowcap: true })`, fed into `getPoolStatsCardValues` (`PoolDetail/pool-stats.ts`)

`useTotalHedgersLiquidity` (`:121-138`) is **not** used by pools (it hardcodes `HedgerType.RASA`).

**Flag**: the single-fetch query calls `getNotionalCap(effectiveHedgerType, effectiveMarketId!)` with a non-null assertion (`:37`) while `effectiveMarketId` can be `undefined`; it is protected only by `enabled`.

##### 6.4 `src/hooks/markets/useTokenImageByContract.ts` — the pools token-logo resolver

`useTokenImageByContract({ contractAddress, tokenTicker })` → `{ image, getImage, isLoading }` (`:67-83`).

Data source: `useTokenVendors()` (`src/hooks/markets/useMarketsImage.ts:6-12`) — react-query key `['getTokenVendors']`, `staleTime: Infinity`, `queryFn: getTokenVendors()` → `GET {APP_BACKEND_URL}/vibe_back/token-vendor/tokens/` (`src/services/markets/service.ts:34-38`), `APP_BACKEND_URL = 'https://api.vibe.trading'` or `https://api-staging.vibe.trading` (`misc.ts:21`), response `TokenVendor[]`.

Index built at `:11-26` — two maps: `byTokenAddress` (lowercased `vendor.tokenAddress`) and `byMajorLiquidityPool` (lowercased `vendor.token_metadata.major_liquidity_pool`, skipping `'0x0'`).

Resolution order (`resolveImage`, `:34-60`, with in-code comments):

1. `byMajorLiquidityPool.get(contractAddress.toLowerCase())` — "Covers SFLOW pool entries whose stored pool address happens to equal the value the caller passed in" (`:38-41`)
2. `byTokenAddress.get(\`${tokenTicker}::${addr.slice(2,4)}..${addr.slice(-2)}\_sflow\`.toLowerCase())` — "The vendor backend encodes pool entries this way, using the first/last 2 hex chars of the token contract address" (`:44-50`)
3. `byTokenAddress.get(\`${tokenTicker}usdt\`.toLowerCase())` — "Perp listing fallback … registered under the perp diamond instead of the SFLOW pool diamond" (`:52-56`)
4. `DEFAULT_TOKEN_IMAGE = '/static/images/default-token.svg'` (`:35`, `:59`)

Pools consumers: `YourPoolTableItem.tsx:47`, `DiscoverPoolTableItem.tsx:43`, `PoolDetailHeader.tsx:29`, `PoolWithdrawModal/index.tsx:42`, `WithdrawalDetailModal/index.tsx:32`, `RefundYourDepositModal.tsx:28`, plus `PoolsList/*MobileCard` (image passed in as a prop).

##### 6.5 `src/stores/hedger/hedgerUpdater.ts`

Single pools reference: `:207` (see §3.7). No other pools coupling in the hedger store.

---

#### 7. Complete HTTP surface reachable from Pools (for completeness)

Four axios instances in `src/components/App/Pools/services/index.tsx:41-60`:

| Instance            | baseURL                                                                                                                                                           | Resolution      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `api`               | `APP_POOLS_BACKEND_URL` = `https://listing85.enigma.bz/v2/` (prod/test) or `https://listing-staging.enigma.bz/v2/` (staging)                                      | `misc.ts:23-27` |
| `dexscreener`       | `https://api.dexscreener.com/latest`                                                                                                                              | literal, `:46`  |
| `inventory`         | `https://inventory85.enigma.bz/api` (prod) / `https://inventory-staging.enigma.bz/api` (staging **and** test)                                                     | `:50-54`        |
| `conditionalOrders` | `TPSL_SERVICES[HedgerType.ENIGMA].domain` = `https://conditional-orders-handler-lowcap85.rasa.capital/api/v5/` prod, `...-lowcap-stage.rasa.capital/api/v5/` test | `misc.ts:45-59` |

| Method + path                                                                                      | fn                                                             | Response type                     | react-query key                                                                                                                                        | staleTime / refetchInterval                                               | enabled                                                                                                                              |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `GET market/search?limit&offset&query&sort_by&chain_ids&market_status&order_by&<20 range filters>` | `getMarketSearch` :120-136                                     | `MarketSearchResponse`            | `['getMarketSearch', query, size, start, searchTerm, statusFilter, sortBy, orderBy, filters]` (`useDiscoverMarketSearch.ts:58`)                        | `0` / `90_000`                                                            | always                                                                                                                               |
| same, `limit:1`                                                                                    | `getMarketSearch`                                              | `.total`                          | `['discoverPoolsCount']` (`useDiscoverPoolsCount.ts:10`)                                                                                               | `Infinity`, all refetch-on-\* disabled                                    | always                                                                                                                               |
| `GET market/search-user?…` (auth)                                                                  | `getUserMarketSearch` :138-154                                 | `UserMarketSearchResponse`        | `['getUserMarketSearch', accessToken, account, query, size, start, searchTerm, statusFilter, sortBy, orderBy]` (`useYourPoolsMarketDeposits.ts:31-42`) | `0` / `90_000`                                                            | `Boolean(accessToken && account)`                                                                                                    |
| `GET /auth/sign-in-message?address&domain&uri`                                                     | `SignInMessage` :156-160                                       | `GetSignInMessageResponse`        | (mutation)                                                                                                                                             | —                                                                         | —                                                                                                                                    |
| `POST /auth/login` `{message, signature}`                                                          | `Login` :162-164                                               | `LoginResponse`                   | mutation in `useListingLogin.ts:17`                                                                                                                    | —                                                                         | —                                                                                                                                    |
| `POST /market/add-market`                                                                          | `AddMarket` :166-168                                           | `AddMarketResponse`               | mutation `CreatePool/index.tsx:80-106`; invalidates `getMarketSearch`, `getUserMarketSearch`, `discoverPoolsCount` (`:83-85`)                          | —                                                                         | —                                                                                                                                    |
| `POST /market/deposit-address` `{token_contract_address, deposit_chain}`                           | `AddDeposit` :170-177                                          | `AddDepositResponse`              | mutation `useAddUserDeposit.ts:24`                                                                                                                     | —                                                                         | —                                                                                                                                    |
| `POST market/retry-listing`                                                                        | `RetryMarketListing` :179-181                                  | `RetryMarketResponse`             | mutation `useRetryMarketListing.ts:18`; invalidates `getUserMarketSearch`, `getMarketSearch`, `retryListingInfo` (`:21-23`)                            | —                                                                         | —                                                                                                                                    |
| `GET market/retry-listing-info?token_contract_address&deposit_chain`                               | `GetRetryListingInfo` :183-187                                 | `RetryListingInfoResponse`        | `['retryListingInfo', token_contract_address, deposit_chain]` (`useRetryListingInfo.ts:12`)                                                            | `30_000`                                                                  | `enabled && token_contract_address && deposit_chain != null`                                                                         |
| `GET /market/token-meta-data?contract_address&chain`                                               | `GetTokenMetaData` :189-193                                    | `GetTokenMetaDataResponse`        | `['tokenMetaData', tokenAddress, chain]` (`useTokenMetaData.ts:13`, `useTokenValidate.ts:36`)                                                          | `5 min`                                                                   | `Boolean(tokenAddress && chain != null)` / `isSupported`                                                                             |
| `GET /market/token-support?contract_address&chain`                                                 | `TokenSupport` :195-197                                        | `string`                          | `['checkTokenSupport', tokenAddress, chain]` (`useTokenValidate.ts:18`)                                                                                | — , `retry: false`                                                        | `Boolean(tokenAddress && chain != null)`                                                                                             |
| `GET https://api.dexscreener.com/latest/dex/tokens/{contract_address}`                             | `GetTokenDexScreenerData` :199-201                             | `GetTokenDexScreenerDataResponse` | `['tokenDexScreenerData', tokenAddress]` (`useTokenValidate.ts:50`)                                                                                    | `5 min`, `retry:false`                                                    | `isSupported`                                                                                                                        |
| `GET {inventory}/v1/markets/tvl-aggregate`                                                         | `GetAggregatedTvl` :203-205                                    | `AggregatedTvlResponse`           | `['GetAggregatedTvl']` (`useAggregatedTvl.ts:7`)                                                                                                       | `120_000` / `120_000`                                                     | always                                                                                                                               |
| `GET {ENIGMA solver domain}/revenue/{marketId}[?time_range=24h]`                                   | `GetRevenue` :207-218                                          | `RevenueResponse`                 | `['GetRevenue', marketId]` (`useRevenue.ts:13`); fires both variants via `Promise.allSettled` (`:15`)                                                  | `120_000` / `120_000`                                                     | always; default `marketId = DEFAULT_MARKET_ID` (=1)                                                                                  |
| `GET /market?token_contract_address&deposit_chain`                                                 | `GetMarketDetail` :220-230                                     | `MarketDetailResponse`            | `['marketDetail', contractAddress, depositChain]` (`useMarketDetail.ts:11`)                                                                            | `30_000` / `60_000`                                                       | `Boolean(contractAddress)`; falls back to a `market/search` lookup to discover `chain_id` when `?deposit_chain` is absent (`:17-26`) |
| `GET /profit/{token_contract_address}` (auth)                                                      | `GetUserProfit` :232-234                                       | `UserProfitResponse`              | `['userProfit', contractAddress]` (`useUserProfit.ts:11`)                                                                                              | `10 min` / `10 min`                                                       | `contractAddress && isAuthenticated && marketStatus === MarketStatus.Listed`                                                         |
| `GET /market/transaction-history/{start}/{size}?market_address&wallet_address`                     | `GetTransactionHistory` :236-249                               | `TransactionHistoryResponse`      | `['GetTransactionHistory', marketAddress, walletAddress, start, size]` (`useTransactionHistory.ts:26`)                                                 | `30_000`                                                                  | `Boolean(marketAddress)`                                                                                                             |
| `POST /market/withdraw`                                                                            | `PostWithdraw` :251-253                                        | —                                 | mutation `usePoolWithdraw.ts:14`; invalidates `GetTransactionHistory`, `userProfit` (`:17-18`)                                                         | —                                                                         | —                                                                                                                                    |
| `GET /market/weekly-listing-limit`                                                                 | `GetWeeklyListingLimit` :255-257                               | `WeeklyListingLimitResponse`      | `['weeklyListingLimit']` (`useWeeklyListingLimit.ts:16`)                                                                                               | `30_000` / dynamic `60_000` if `remaining <= 5` else `300_000` (`:20-25`) | `Boolean(accessToken)` — **flag**: the key omits the account, so switching wallets serves a stale limit                              |
| `POST /claim`                                                                                      | `ClaimProfit` :259-261                                         | `ClaimProfitResponse`             | mutationKey `['ClaimProfit']` (`useClaimProfit.ts:7`); caller invalidates `['userProfit', contractAddress]` (`claim-rewards-modal/index.tsx:93`)       | —                                                                         | —                                                                                                                                    |
| `POST {conditionalOrders}/api/v4/search/`                                                          | `SearchConditionalOrders` :263-265                             | `SearchConditionalOrdersResponse` | `['openOrders', payload]` (`useOpenOrders.ts:7`)                                                                                                       | `30_000` / `60_000`                                                       | `Boolean(payload.symbol_id)` — **DEAD** (§8)                                                                                         |
| `POST {APP_POOLS_BACKEND_URL}market/refund` `{market_address, deposit_chain, recipient_address}`   | `refundRejectedPool` (`src/services/pools/services.ts:7-36`)   | `any`                             | mutation `useRefundRejectedPool.ts:11`; invalidates `getUserTransactions`, `getUserMarketSearch` (`:28-29`)                                            | —                                                                         | —                                                                                                                                    |
| `GET {APP_POOLS_BACKEND_URL}market/user-transactions/{start}/{size}?<filters>`                     | `getUserTransactions` (`src/services/pools/services.ts:38-64`) | `SearchUserTransactionsResponse`  | `['getUserTransactions', accessToken, start, size, rest]` (`useUserTransactions.ts:7`)                                                                 | default                                                                   | `Boolean(accessToken && rest.token_address && rest.chain_id != null)`                                                                |

Auth: `api` attaches `Authorization: Bearer ${listingAccessTokens[account]}` in a request interceptor (`services/index.tsx:62-77`); `src/services/pools/services.ts` passes the token **manually** in the headers instead (`:24`, `:52`) because it does not use the shared `api` instance — duplicated auth logic, flagged.

`conditionalOrders` **double-prefixes the API version**: baseURL already ends in `/api/v5/` (or `/api/v4/` for RASA) and the path adds `/api/v4/search/` (`services/index.tsx:58, :264`) → `https://conditional-orders-handler-lowcap85.rasa.capital/api/v4/search/` (the leading `/` resets the path). Since the endpoint is dead code this never fires; flagged.

---

#### 8. Dead code / TODOs / hacks / "coming soon" — inventory

| Item                                                 | Location                                                                                                                                                                            | Detail                                                                                                                                                                                                                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IS_POOLS_ENABLED`                                   | `src/constants/environment.ts:5`                                                                                                                                                    | never imported anywhere in `src/`; `.env:13` sets it. Only appears in `Docs/CLAUDE_WORKFLOW.md` prose                                                                                                                                                           |
| `NEXT_PUBLIC_POOLS_CLAIM_MOCK` / `_ERROR`            | `.env:22-23` (commented)                                                                                                                                                            | zero code references repo-wide                                                                                                                                                                                                                                  |
| `APP_POOLS_BACKEND_URL` no-op ternary                | `src/constants/misc.ts:25-27`                                                                                                                                                       | `IS_TEST_ENVIRONMENT` branch === default branch                                                                                                                                                                                                                 |
| `useOpenOrders` + `PoolOpenOrdersTable`              | `services/hooks/useOpenOrders.ts`, `PoolDetail/tables/PoolOpenOrdersTable.tsx`                                                                                                      | `PoolOpenOrdersTable` is imported by **nobody**; `PoolDetailTabs.tsx:129-138` renders a hardcoded "Coming Soon / Limit orders will be available in the next update." block for the `OPEN_ORDERS` tab (whose `count` is hardcoded `0` at `:106`)                 |
| `useToggleListingSignatureRequestModal`              | `applicationHooks.ts:268-270`                                                                                                                                                       | exported, never imported                                                                                                                                                                                                                                        |
| `marketSearchItemToStubIMarket`                      | `utils/marketSearchItemToStubIMarket.ts:13`                                                                                                                                         | `// TODO: I think we can remove this function!`                                                                                                                                                                                                                 |
| `ActiveTabKeys` unused members                       | `components/App/Pools/types.ts:8`                                                                                                                                                   | `'pools'` and `'your_deposits'` are declared but `tabs` (`constants.ts:14-17`) only has `discover` / `your_pools`                                                                                                                                               |
| `AddressZero` TODO                                   | `src/constants/misc.ts:90-91`                                                                                                                                                       | `// TODO: use viem zeroAddress`                                                                                                                                                                                                                                 |
| Signature-preview is fabricated                      | `ListingSignatureRequestModal/index.tsx:74`                                                                                                                                         | The block shown to the user is a hand-built template string, **not** the `message` returned by `GET /auth/sign-in-message` that is actually signed. It also contains the no-op `Chain ID: ${activeAccount.accountAddress ? '' : ''}` which always renders empty |
| "Coming Soon" tiles                                  | `PoolsInfo/GeneralInfo.tsx:95` (`Top Chain`), `:122-132` (**all 10** `yourInfoItems` except `Active Pools`), `:180-184` (chart placeholder card), `PoolDetail/PoolChartCard.tsx:83` | `ComingSoonBadge` renders wherever `item.value === undefined` (`GeneralInfo.tsx:164-167`)                                                                                                                                                                       |
| `ComingSoonColumnsPanel`                             | `PoolPositionsTable.tsx:152`, `PoolOpenQuotesTable.tsx:147`                                                                                                                         | plus commented-out `<ComingSoonBadge/>` `<td>`s at `PoolPositionsTable.tsx:144-146` and `PoolOpenQuotesTable.tsx:137-140`, and a commented-out import at `PoolPositionsTable.tsx:13` / `PoolOpenQuotesTable.tsx:17`                                             |
| `console.log` left in                                | `CreatePool/index.tsx:109` (`console.log('Final data:', data)`), `useAddUserDeposit.ts:46` (`console.log('e', e)`), `apolloClients.ts:36`                                           |                                                                                                                                                                                                                                                                 |
| `@ts-ignore`                                         | `CreatePool/index.tsx:100`                                                                                                                                                          | on `error.response?.data?.error_message`                                                                                                                                                                                                                        |
| Unsafe error access                                  | `useRefundRejectedPool.ts:17`                                                                                                                                                       | `error.response.data.error_message` — no optional chaining; a network error (no `response`) throws inside the toast handler                                                                                                                                     |
| `modalOptions: {} as any`                            | `src/stores/application/application.ts:17`                                                                                                                                          | initial value cast away from `ToggleModalOptions`                                                                                                                                                                                                               |
| `RefundYourDepositModal` bypasses `ApplicationModal` | `Layout/index.tsx:202`, `stores/pools/pools.ts`                                                                                                                                     | it is the only modal in `Modals` driven by a bespoke store rather than `openModal`; means it can be open _simultaneously_ with any `ApplicationModal`                                                                                                           |
| `useUpnl` mis-targeting in claim modal               | `ClaimRewardsAccountItem.tsx:25`                                                                                                                                                    | see §2.2(c) — wrong diamond + Vibecaps skip disabled                                                                                                                                                                                                            |
| History over-fetch                                   | `PoolDetailTabs.tsx:18-19, :79-85`                                                                                                                                                  | fetches 110 rows per page to display 10                                                                                                                                                                                                                         |
| `typeIn` missing from query key                      | `usePoolHistoryQuotes.ts:30`                                                                                                                                                        | constant today, brittle                                                                                                                                                                                                                                         |
| New `ApolloClient` per query                         | `apolloClients.ts:27-29` + `fetchPolicy:'no-cache'`                                                                                                                                 | Apollo cache never used                                                                                                                                                                                                                                         |
| `weeklyListingLimit` key omits account               | `useWeeklyListingLimit.ts:16`                                                                                                                                                       | stale across wallet switches                                                                                                                                                                                                                                    |
| `getNotionalCap` non-null assertion                  | `useNotionalCap.ts:37`                                                                                                                                                              | `effectiveMarketId!`                                                                                                                                                                                                                                            |
| `DIAMOND_ADDRESS` has no HyperEVM entry              | `src/constants/addresses.ts:47-50`                                                                                                                                                  | `useDiamondContract(false)` resolves to `undefined` on chain 999                                                                                                                                                                                                |
| Bearer tokens in localStorage                        | `src/stores/user/user.ts:9-10` + tail `:69`                                                                                                                                         | user store persists **everything** (no `persistKeys`), including `listingAccessTokens`                                                                                                                                                                          |
| Duplicated auth header logic                         | `src/services/pools/services.ts:24, :52`                                                                                                                                            | bypasses the `api` interceptor and the 401 token-clear at `services/index.tsx:83-90`                                                                                                                                                                            |
| `conditionalOrders` double `/api/vN/`                | `services/index.tsx:58` + `:264`                                                                                                                                                    | dead path, but wrong                                                                                                                                                                                                                                            |

---

## 10. Repo documentation and test coverage

### Vibe-ui — Pools Documentation + Test Suite Map

Everything below is read-only observation. No file in `/symmio/Vibe-ui` was modified.

---

### PART 0 — Document inventory (what exists)

| Path                                                                 | Lines | Pools relevance                                            |
| -------------------------------------------------------------------- | ----- | ---------------------------------------------------------- |
| `Docs/Pool_Detail_Page.md`                                           | 174   | Primary pools doc (DES-105) — detail page arch + data flow |
| `Docs/Pools_Discover_Table_Data_Sources.md`                          | 39    | Column→endpoint map + env URL table                        |
| `Docs/Pools_and_Permissionless_Listing.md`                           | 39    | Product-level listing flow                                 |
| `Docs/VibeCaps.md`                                                   | 51    | Lowcap product surface; links pools                        |
| `Docs/VibeCaps_Token_List.md`                                        | 204   | 3-endpoint token-list composition recipe                   |
| `Docs/Routes_and_Pages.md`                                           | 59    | `/pools`, `/pools/create-pool`                             |
| `Docs/Data_Sources_and_Services.md`                                  | 84    | Service inventory (pools not named; listing absent)        |
| `Docs/Third_Party_Services.md`                                       | 91    | Listing Service, Enigma solver, Inventory service URLs     |
| `Docs/Architecture_Overview.md`                                      | 104   | `src/pages/pools/*` + `NEXT_PUBLIC_POOLS_ENABLE`           |
| `Docs/analytics-subgraph-usages.md`                                  | 199   | §6 = `usePoolQuotes()` field list                          |
| `Docs/RPC_Calls_Investigation.md`                                    | —     | Pool hook refetch intervals (L159–162, L294)               |
| `Docs/00_README.md`                                                  | 75    | Index; lists both pools docs (L27, L63)                    |
| `Docs/technichal-docs-back-end/instant-layer-v2-solver.md`           | 113   | Backend REST spec (NOT pools)                              |
| `Docs/technichal-docs-back-end/v5-conditional-orders-api-example.md` | 476   | Backend REST spec (NOT pools)                              |
| `Docs/design-docs/instant-layer-v2.md`                               | 412   | Design doc (NOT pools)                                     |
| `Docs/design-docs/session-key.md`                                    | 242   | Design doc (NOT pools)                                     |

**`ls Docs/design-docs` and `ls Docs/technichal-docs-back-end` contain ZERO pools/listing documents.** Both directories are entirely about InstantLayer v2 signature execution, session keys, and v5 conditional orders (TP/SL + trigger-market). There is no design doc for pool creation, deposit-address listing, pool withdraw, or reward claiming anywhere in the repo.

---

### PART 1 — Faithful digest of the pools documentation

#### 1.1 What pools ARE (`Docs/Pools_and_Permissionless_Listing.md`)

- `Pools_and_Permissionless_Listing.md:5` — "Pools are the UI surface for permissionless listing / liquidity provisioning (VibeCaps-focused)."
- Four user capabilities (`:8-11`): discover pools/markets; create a new pool (**desktop-first**); deposit required assets to list a token; "later claim fees (**future roadmap; depends on backend support**)" ← explicit roadmap stub.
- Routes (`:15-16`): `/pools`, `/pools/create-pool` — "(mobile currently redirects back to VibeCaps)", pointing at `src/pages/pools/create-pool.tsx` (`:18`).
- **High-level listing flow, UI perspective** (`:22-27`), verbatim ordering:
  1. User selects token and clicks "New Pool"
  2. UI shows deposit address + required data
  3. User deposits required token(s)
  4. User confirms deposit
  5. Market appears as pending/in-review until **admin acceptance**
  6. After approval, **solver ingests data** and market becomes tradable
- Code pointers (`:31-34`): `src/pages/pools/*`, `src/components/App/Pools/*`, `src/services/markets/*`, `src/services/token/*`.
- UX rules (`:38-39`): deposit instructions must emphasize sending the **exact amount** to the specified address; "The pools/discover page **may be** public while 'new pool' and 'your pools' require auth (depending on implementation and design flags)" ← hedged, unverified.

#### 1.2 VibeCaps ↔ lowcap ↔ pools relationship

- `Docs/VibeCaps.md:5` — "VibeCaps is the lowcap trading experience where markets can be permissionlessly listed." Optimized for discovery/search+sorting, memecoin risk cues (liquidity, price impact), cross-chain coverage **EVM + Solana** (`:8-11`).
- Routes `/vibecaps`, `/vibecaps/[symbol]` (`:14-15`).
- Data sources (`:21-24`): hedger/solver market info + funding rates ("lowcap funding can come from **inventory service behind the solver**"); token metadata `src/services/token/*`; Dexscreener `src/services/dexscreener/*` + API proxy; OHLC via Moralis `src/utils/moralis/*`.
- Funding split (`:48-50`): majors → solver sources funding from external exchange feed; VibeCaps → solver sources from **inventory service logic**; frontend reads via `src/services/hedger/hooks/useActiveFundingRates.ts`.
- Price impact hook named at `VibeCaps.md:29`: `src/services/hedger/hooks/usePriceImpact.ts`.
- `Docs/00_README.md:14` — VibeCaps = "memecoins / lowcaps with permissionless listing, high volatility, and market-specific UX (liquidity caps, price impact, different chart data sources)."
- `Docs/Product_Overview.md:25` — "Anyone can propose/list a new lowcap market. Markets may go through review / enablement before being tradable (implementation details **depend on the listing backend and admin flow**)."

**Bottom line the docs assert:** _pools = the listing/LP UI for the VibeCaps (lowcap) market family; a pool is 1:1 with a permissionlessly-listed lowcap market, and the lowcap diamond is the subgraph `source` for its quotes._

#### 1.3 Pool Detail page (`Docs/Pool_Detail_Page.md`, ticket DES-105)

**Route** (`:5`, `:13`): click a pool row → `/pools/[contractAddress]` → `src/pages/pools/[contractAddress].tsx` (thin wrapper, default export).

**Components claimed** (`:17-29`, all under `src/components/App/Pools/components/PoolDetail/`):

| File                                      | Doc'd purpose                                                                                                                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.tsx`                               | orchestrator; reads `contractAddress` from router                                                                                                                                     |
| `PoolDetailHeader.tsx`                    | back (`ArrowRight` rotated), `TokenImage`, chain logo, `ArrowUpRightFromSquare`, share (`CopyToClipboard` + `ShareAndroid`), status badge, Withdraw (`Upload`) / Deposit (`Download`) |
| `SummaryCards.tsx`                        | 4 cards: **TVL (placeholder)**, **30D APY (placeholder)**, Your Balance (Radix tooltip breakdown), **Claimable Rewards (placeholder + Claim button)**                                 |
| `PoolStatsCard.tsx`                       | Total APY, Lifetime Rewards, OI (Longs/Shorts), Available Liquidity, Vol 24H, Buyback Ratio, Active LPs, Age, Pool Balance bar                                                        |
| `PoolChartCard.tsx`                       | TVL/Rewards tabs (`ThemedSwitch.Underline`), Pool/Your Performance (`ThemedSwitch.Primary`), timeframe `Button`+`ChevronDown`, **Coming Soon state (`ChartPlaceholder`)**             |
| `PoolDetailTabs.tsx`                      | `.tabs`/`.tab`/`.selected` CSS classes                                                                                                                                                |
| `tables/PoolPositionsTable.tsx`           | aggregated long/short positions, **`quoteStatus = 4`**                                                                                                                                |
| `tables/PoolOpenQuotesTable.tsx`          | pending quotes, **`quoteStatus in [0, 2]`**                                                                                                                                           |
| `tables/PoolOpenOrdersTable.tsx`          | open limit orders = pending quotes filtered by **`orderTypeOpen === 0`**                                                                                                              |
| `tables/PoolTradeHistoryTable.tsx`        | **`quoteStatus in [3, 7, 8, 9]`** — "**pool-wide, not user-specific**"                                                                                                                |
| `tables/PoolDepositsWithdrawalsTable.tsx` | deposit/withdrawal history                                                                                                                                                            |

**Hooks claimed** (`:35-36`):

- `src/components/App/Pools/services/hooks/usePoolDetail.ts` — "Fetch single pool via `GetMarketDeposits({ query: contractAddress, size: 1 })` + DexScreener enrichment"
- `src/components/App/Pools/services/hooks/usePoolQuotes.ts` — "Query analytics subgraph for quotes by `symbolId` + `source` + `quoteStatus`"

**Modified-files ledger** (`:44-48`):

- `src/constants/routes.ts` — added ``poolDetail: (contractAddress: string) => `/pools/${contractAddress}` ``
- `src/apollo/queries.ts` — added `POOL_QUOTES_BY_SYMBOL_AND_SOURCE` GQL query
- `.../PoolsTable/DiscoverPoolTableItem.tsx` — rows clickable, `router.push(routes.pools.poolDetail(...))`, `cursor-pointer`, `stopPropagation` on action buttons
- `.../PoolsList/DiscoverPoolMobileCard.tsx` — card header clickable
- `src/components/Switch/index.tsx` — new `ThemedSwitch.Underline` variant

**Shared utilities the page leans on** (`:55-73`): `ThemedTables.Simple`, `Skeleton`, `EmptySleepingChepe` (empty state), `ComingSoonBadge` (`Pools/components/ui/`), `ChartPlaceholder` (`Pools/components/PoolsInfo/`), Radix `Tooltip`, `CopyToClipboard`, `TokenImage`, `useNotionalCap` (`services/markets/hooks/useNotionalCap`), `useMarketInfo` (`services/hedger/hooks/useMarketInfo`), `formatPrice` (`utils/numbers`), `formatListingAge` (`Pools/utils/formatListingAge`), `poolStatusMapper` (`Pools/constants`), `DEPOSIT_CHAIN_OPTIONS` (`Pools/constants`), **`LOWCAP_DIAMOND_ADDRESS` (`constants/addresses`) used as the `source` param for subgraph queries**.

##### Data flows as documented

**(a) Pool metadata** (`:82-86`):

```
router.query.contractAddress
  → usePoolDetail
    → GetMarketDeposits({ query: contractAddress, only_current_user: false, size: 1 })
    → GetTokenDexScreenerData({ contract_address })
    → enriched IMarket
```

**(b) Token images / per-surface source table** (`:93-100`) — the single densest claim in the pools docs:

| Context                            | Source                                                                 | Hook/component                                | Lookup key         |
| ---------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------- | ------------------ |
| Pools discover (desktop)           | Listing `GET market/search` (`MarketSearchItem`)                       | `useDiscoverMarketSearch`                     | `contract_address` |
| Pools discover (mobile)            | same                                                                   | `useDiscoverMarketSearch`                     | `contract_address` |
| Pools your pools (desktop)         | `GET market/market-deposits/summary` (`IMarket`) + hedger volume/OI    | `useYourPoolsMarketDeposits`, table row       | `contract_address` |
| Pools your pools (mobile)          | deposits summary + Dexscreener metadata (header price) + notional caps | `useYourPoolsMarketDeposits`, `YourPoolsList` | `contract_address` |
| Pool Detail header                 | DexScreener API (`pairs[].info.imageUrl`)                              | `usePoolDetail`                               | `contract_address` |
| Market modal (`LowcapMarketModal`) | Token vendors service (`getTokenVendors()`)                            | `useMarketsImage`                             | `market.name`      |

`:102` — "Discover list rows do **not** hydrate DexScreener `tokenImage` onto the model; avatars resolve via `useTokenImageByContract`."

**(c) Pool stats** (`:106-118`):

- Discover (desktop+mobile): OI/liquidity/24h vol come from listing `GET market/search`, fields `open_interest`, `liquidity`, `vol24h` on `MarketSearchItem`.
- Your pools:

```
IMarket.symmio_symbol_id → useNotionalCap({ marketId, isLowcap: true })
  → GET notional_cap/{symbolId}
  → { used (OI), available_to_long, available_to_short, total_cap }

IMarket.token_ticker → useMarketInfo()
  → GET get_market_info
  → data[token_ticker].trading_volume   (Vol 24H)
```

**(d) Positions/quotes tables** (`:123-135`):

```
IMarket.symmio_symbol_id (symbolId) + LOWCAP_DIAMOND_ADDRESS[BASE] (source)
  → usePoolQuotes({ symbolId, source, quoteStatuses })
    → Analytics subgraph: POOL_QUOTES_BY_SYMBOL_AND_SOURCE
    → SubGraphData[] → toQuoteFromGraph() → SubgraphQuote[]
```

Hard rule stated at `:130` — raw subgraph rows are `SubGraphData` (camelCase, raw wei, numeric enums) and **must** pass through `toQuoteFromGraph()` from `apollo/service`, yielding `SubgraphQuote` with PascalCase fields (`initialCVA`, `LF`, `partyAMM`), `fromWei()`-applied values, typed `PositionType` / `QuoteStatus` / `OrderType`, and compatibility with `getQuoteLeverage(quote)` from `utils/quote`.

**(e) Deposits & withdrawals** (`:140-141`): `IMarket.contract_address → GetUserDeposit({ contract_address })` "from existing listing API".

##### Key design decisions recorded (`:148-156`)

1. URL param is `contractAddress` (always present, unique) **not** `symmio_symbol_id` (can be `null` for unlisted pools).
2. Single-pool fetch reuses `GetMarketDeposits` with a `query` filter — explicitly "avoids new backend endpoint".
3. Subgraph `source` = `LOWCAP_DIAMOND_ADDRESS[BASE]` "since VibeCaps pools use the lowcap diamond".
4. **Chart starts as Coming Soon — "no TVL/rewards history endpoints yet"** (backend gap).
5. Tab switching is `useState` + conditional render.
6. **Unlisted pools (`symmio_symbol_id === null`) → position/quote tabs render empty state.**
7. Share button must use the `CopyToClipboard` component, not raw `navigator.clipboard`.
   8/9. Switch variants; all icons from `components/Icons/` (no inline SVG).

##### Manual verification checklist (`:162-174`)

14 numbered manual steps — navigate/click-through, header correctness "from listing API", share-copy popover, icon hover, **"OI and Available Liquidity values match `notional_cap/{symbolId}` response"**, **"Vol 24H matches `get_market_info`"**, rapid tab switching, chart tab animations, Positions tab shows subgraph quotes, empty-pool state, mobile stacked layout, then `yarn tsc --noEmit`, `yarn eslint "src/components/App/Pools/components/PoolDetail/**/*.tsx" --no-warn-ignored`, `yarn prettier --check ...`. **There is no automated-test step anywhere in this checklist.**

#### 1.4 Discover-table column → endpoint map (`Docs/Pools_Discover_Table_Data_Sources.md`)

Three declared sources (`:9-11`): **Listing Service** keyed off the constant **`APP_POOLS_BACKEND_URL`**; **Price Service** (metadata endpoint); **Enigma Solver** (volume, liquidity, OI).

| Column    | Field in code                                                                | Source                            | Endpoint                                                    |
| --------- | ---------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------- |
| Pool      | `item.token_ticker`, `item.token_name`, `item.chain_id`, `item.max_leverage` | Listing (`IMarket`)               | `GET /market/public-market-deposits/summary/{start}/{size}` |
| Price     | `marketMetaData.priceUsd`                                                    | Price Service                     | `GET {PRICE_SERVICE}/api/v1/metadata`                       |
| Mkt. Cap  | `marketMetaData.marketCap`                                                   | Price Service                     | same                                                        |
| Vol 24H   | `vol24h`                                                                     | Enigma (`useMarketInfo`)          | `GET {ENIGMA_SOLVER}/get_market_info`                       |
| **APR**   | —                                                                            | **Coming Soon (not implemented)** | —                                                           |
| Liquidity | `notionalCap.available_to_long + available_to_short`                         | Enigma (`useNotionalCap`)         | `GET {ENIGMA_SOLVER}/notional_cap`                          |
| Open Int. | `notionalCap.used`                                                           | Enigma (`useNotionalCap`)         | same                                                        |
| Listed    | `item.listing_time`                                                          | Listing                           | `GET /market/public-market-deposits/summary/{start}/{size}` |
| Status    | `item.market_status`                                                         | Listing                           | same                                                        |
| Action    | —                                                                            | UI buttons (Trade, Deposit)       | —                                                           |

**Environment URL table** (`:35-39`) — the only env-URL table in the pools docs:

| Service         | Production                        | Staging                                        |
| --------------- | --------------------------------- | ---------------------------------------------- |
| Listing Service | `https://listing85.enigma.bz/v2/` | `https://listing-staging.enigma.bz/v2/`        |
| Price Service   | `https://lowcap-price.enigma.bz`  | `https://lowcap-price-staging.enigma.bz`       |
| Enigma Solver   | `https://solver.enigma.bz/api`    | `https://staging-solver.superflow.trading/api` |

No react-query keys, no `staleTime`, no `refetchInterval`, and no `enabled` gating conditions are documented for **any** pools query. The only cadence numbers anywhere are in `Docs/RPC_Calls_Investigation.md:159-162` — `60_000 ms` for "Pool hooks", `120_000 ms` for Pool `GeneralInfo`, `600_000 ms` for Pool `useTokenProfit` — plus `:294` `useMarketInfo → hedger/get_market_info`, refetch `10,000 ms`, staleTime "❌ Missing / Should cache 10-30s".

#### 1.5 VibeCaps token list recipe (`Docs/VibeCaps_Token_List.md`)

Three endpoints, combined client-side (`:26-34`):

```
GET https:/symmio-api.Enigma.trading/bsapi/contract-symbols      # tradeable symbols
GET https://lowcap-price.enigma.bz/api/v1/metadata                # addresses, chains, liquidity, prices
GET https://api.vibe.trading/vibe_back/token-vendor/tokens/       # icons + token_metadata
```

Testnet (`:41`): `GET https://test.defilytics.xyz/papi/contract-symbols`.

Join algorithm (`:110-135`): `metadataMap = Map(metadata.map(m => [m.name, m]))`; `tokenVendorMap = Map(tokenVendor.filter(t => t.is_active).map(t => [t.token_metadata.symbol_id, t]))`; then `contractSymbols.symbols.filter(m => m.is_valid).map(...)` dropping any entry without `meta.base_token.address`, producing `{ symbolId, symbolName, tokenAddress, chainId, decimals (meta.decimal ?? 18), priceUsd, liquidity, marketCap, pairAddress, priceChange24h, iconUrl }`.

Typed contracts (`:143-194`): `ContractSymbol { symbol_id, name, symbol, is_valid, price_precision, quantity_precision }`; `TokenMetadata { name, chain_id, dex_id, pair_address, base_token{address,name,symbol}, price_native, price_usd, decimal, liquidity{usd}|null, price_change{h24}|null, market_cap, pair_created_at, updated_at, source }`; `TokenVendorItem { tokenAddress, wallet, public_download_url, token_metadata{ name, chain, diamond, symbol_id, major_liquidity_pool }, is_active }`.

Caching recommendation (`:199-202`): **5 minutes** stale for the token list, **45 seconds** for live price/liquidity.

Note the sample vendor payload (`:98`) carries `diamond: "0xC6a7cc26fd84aE573b705423b7d1831139793025"` and `chain: 8453` — i.e. the doc's implied lowcap diamond on Base, which is the same value class `Pool_Detail_Page.md:150` calls `LOWCAP_DIAMOND_ADDRESS[BASE]`.

#### 1.6 Backend service directory (`Docs/Third_Party_Services.md`)

- Rasa (Majors, Base): `https://base-hedger82.rasa.capital`, docs `/docs/` (`:15-16`).
- **Enigma (VibeCaps/lowcap, described as "HyperEVM")** (`:20-25`): prod `https://solver.enigma.bz/api`, staging `https://staging-solver.superflow.trading/api`.
- Vibe backend (`:33-36`): `https://api.vibe.trading/vibe_back/docs`, staging `https://api-staging.vibe.trading/vibe_back/docs`.
- Conditional Orders Handler: Rasa/majors `https://conditional-orders-handler.rasa.capital/api/v4/`; **Enigma/VibeCaps `https://conditional-orders-handler-lowcap85.rasa.capital/api/v5/`, staging `https://conditional-orders-handler-lowcap-stage.rasa.capital/api/v5/`** (`:48-55`).
- **Inventory Service** — "Manages token inventory and availability for VibeCaps markets. Operated by Rasa." prod `https://inventory85.enigma.bz/docs`, staging `https://inventory-staging.enigma.bz/docs` (`:59-66`).
- **Listing Service** — "Handles permissionless token listing requests for VibeCaps pools." Only pointer given: **`https://listing.vibe.trading/docs`** (`:70-74`).
- Explorers (not called by FE): `https://prod-perps.orbs.network/positions`, `https://explorer-symmio.vercel.app/` (`:82-91`).

#### 1.7 Architecture / routes / env flags

- `Docs/Architecture_Overview.md:55` — "Pools/listing: `src/pages/pools/*`". `:86-93` — flags live in `src/constants/environment.ts`: `NEXT_PUBLIC_AA_ENABLE`, **`NEXT_PUBLIC_POOLS_ENABLE`**, `NEXT_PUBLIC_BACKEND_ENVIRONMENT`, alpha/beta; chains/addresses in `src/constants/chains.ts`, `addresses.ts`, `abi/*`.
- `Docs/CLAUDE_WORKFLOW.md:1033-1036` shows the gating idiom: `import { IS_AA_ENABLED, IS_POOLS_ENABLED } from 'constants/environment'` → `{IS_POOLS_ENABLED && <PoolsSection />}`.
- `Docs/Routes_and_Pages.md:37-38` — `/pools`, `/pools/create-pool` "(desktop-only; mobile redirects to VibeCaps)". Proxy routes `:49-50`: `/api/dexscreener/pair-details`, `/api/token/ohlc`.
- `Docs/FRONTEND_ONBOARDING_PLAN.md:401-402` — `/pools` → `src/pages/pools/index.tsx`, `/pools/create-pool` → `src/pages/pools/create-pool.tsx`, both "Main Layout". **No `/pools/[contractAddress]` row** in that route table.
- `Docs/Dependency_Update.md:122` — post-upgrade smoke checklist item: "Main pages load (VibeCaps, Majors, Account, Pools)" — manual only.

#### 1.8 Subgraph contract for pool quotes (`Docs/analytics-subgraph-usages.md`)

Config (`:5-7`): `ClientType.ANALYTICS` in `src/apollo/client/apolloClients.ts`; subgraph URL `base_analytics` **on Goldsky**; `getApolloClient()` defaults to ANALYTICS.

§6 `usePoolQuotes()` (`:96-115`): file `src/components/App/Pools/services/hooks/usePoolQuotes.ts:31`, query `POOL_QUOTES_BY_SYMBOL_AND_SOURCE`, entity `quotes`. Selected fields: `orderTypeOpen, orderTypeClose, partyAmm, partyBmm, lf, cva, partyA, partyB, partyBsWhiteList, quoteId, quoteStatus, symbol, symbolId, positionType, quantity, fillAmount, openedPrice, requestedOpenPrice, closedPrice, closePrice, marketPrice, quantityToClose, closedAmount, timestamp, openDeadline, timestampSendQuote, averageClosedPrice, liquidateAmount, liquidatePrice, initialCva, initialLf, initialPartyAmm, initialPartyBmm, initialOpenedPrice, tradingFee, leverage` — i.e. the standard quote projection **plus `tradingFee` and `leverage`**, which #2/#3/#5 do not select. The doc records **no** filter clause for #6 (unlike `quoteStatus_in: [4,5,6]` for `getOpenQuotes`, `[0,2]` for `getPendingQuotes`, `[3,7,8,9]` for `getHistoricQuotes`) — the status filter is passed by the caller per `Pool_Detail_Page.md:126`.

---

### PART 2 — DISCREPANCY LIST (flag for verification against code)

Ranked most load-bearing first. Where I incidentally observed contradicting code while locating files, I cite it as evidence — but each item still needs a proper verification pass.

##### D1. `usePoolDetail` hook does not appear to exist

`Docs/Pool_Detail_Page.md:35` and `:99` name `src/components/App/Pools/services/hooks/usePoolDetail.ts`. Directory listing of `src/components/App/Pools/services/hooks/` shows **no `usePoolDetail.ts`**; the nearest is `useMarketDetail.ts`. Verify which hook actually drives `PoolDetail/index.tsx`.

##### D2. `GetMarketDeposits` / `GetUserDeposit` service functions do not appear to exist

`Pool_Detail_Page.md:35`, `:84`, `:149` (Key Decision #2) and `:141` depend on `GetMarketDeposits(...)` and `GetUserDeposit({ contract_address })`. `src/components/App/Pools/services/index.tsx` exports (lines 120–265): `getMarketSearch`, `getUserMarketSearch`, `SignInMessage`, `Login`, `AddMarket`, `AddDeposit`, `RetryMarketListing`, `GetRetryListingInfo`, `GetTokenMetaData`, `TokenSupport`, `GetTokenDexScreenerData`, `GetAggregatedTvl`, `GetRevenue`, `GetMarketDetail`, `GetUserProfit`, `GetTransactionHistory`, `PostWithdraw`, `GetWeeklyListingLimit`, `ClaimProfit`, `SearchConditionalOrders`. Neither documented name is present. **The entire "single pool fetch" decision (#2) may be obsolete.**

##### D3. The documented single-pool endpoint contradicts the shipped one

Docs say a filtered deposits-summary call. Code at `src/components/App/Pools/services/index.tsx:220-230` has `GetMarketDetail({ token_contract_address, deposit_chain })` → `GET /market?token_contract_address=…&deposit_chain=…` returning `MarketDetailResponse`. Verify whether `Pool_Detail_Page.md` §"Pool Metadata" is simply stale, and whether `deposit_chain` is now a **required second identifier** (which would also invalidate Key Decision #1's "contractAddress … always present, unique" reasoning).

##### D4. `GET /market/public-market-deposits/summary/{start}/{size}` — no trace in code

`Pools_Discover_Table_Data_Sources.md:19,29` makes this the backbone of the Discover table. `grep 'market/'` over `src/components/App/Pools/services/index.tsx` returns only: `market/search` (:135), `market/search-user` (:153), `/market/add-market` (:167), `/market/deposit-address` (:173), `market/retry-listing` (:180), `market/retry-listing-info` (:186), `/market/token-meta-data` (:191), `/market/token-support` (:196), `/market/transaction-history/{start}/{size}` (:248), `/market/withdraw` (:252), `/market/weekly-listing-limit` (:256). **No `public-market-deposits` and no `market-deposits/summary`.** Verify and retire.

##### D5. Two pools docs contradict each other on the Discover data source

- `Pools_Discover_Table_Data_Sources.md:19-30`: Discover columns come from listing deposits-summary + Price Service `/api/v1/metadata` + Enigma `get_market_info` / `notional_cap`.
- `Pool_Detail_Page.md:91,95-96,106`: "Discover tab metrics come from listing **`GET market/search`**" with `open_interest`, `liquidity`, `vol24h` served **by the listing service itself**, via `useDiscoverMarketSearch`.

These describe different networks of calls for the same table. `useDiscoverMarketSearch.ts` and `getMarketSearch` (`services/index.tsx:135`) exist, suggesting `Pools_Discover_Table_Data_Sources.md` is the stale one — **but the whole Price-Service price/mktcap column mapping needs re-derivation**, since `market/search` may or may not carry `priceUsd`/`marketCap`.

##### D6. `GET market/market-deposits/summary` (Your Pools) — same problem

`Pool_Detail_Page.md:97-98` sources the Your-Pools table/cards from it. Not present in `services/index.tsx`. Verify what `useYourPoolsMarketDeposits.ts` actually calls.

##### D7. `routes.pools.poolDetail` signature is documented wrong

Doc `Pool_Detail_Page.md:44`: `` poolDetail: (contractAddress: string) => `/pools/${contractAddress}` ``. Code `src/constants/routes.ts:23-24`:

```ts
poolDetail: (contractAddress: string, depositChain?: number) =>
  depositChain != null ? `/pools/${contractAddress}?deposit_chain=${depositChain}` : `/pools/${contractAddress}`,
```

The `deposit_chain` query param is undocumented and ties into D3 (detail fetch needs a chain).

##### D8. `SummaryCards.tsx` is documented as a file; it is a directory

`Pool_Detail_Page.md:21` lists `SummaryCards.tsx`. On disk: `PoolDetail/SummaryCards/` containing `index.tsx`, `BalanceCard.tsx`, `ClaimableRewardsCard.tsx`, **`AuthGatedPlaceholder.tsx`**. The last one implies an auth-gating behavior for balance/rewards cards that **no doc mentions** (see also `Pools_and_Permissionless_Listing.md:39`'s hedged auth statement).

##### D9. Undocumented PoolDetail table internals

`PoolDetail/tables/` also contains `AmountCell.tsx`, `StatusBadge.tsx`, `TransactionRow.tsx` — absent from the doc's component table (`:25-29`).

##### D10. Whole feature areas of Pools have zero documentation

Present on disk, unmentioned in any doc: `components/CreatePool/**` (Stepper, TokenBasics, TokenDetails, MarketSettings, Review), `ListingDepositModal/`, `ListingSignatureRequestModal/`, `ListingAuthGuard.tsx`, `TermsAndConditionsModal/`, `MinDepositWarning.tsx`, `WeeklyLimitTooltip.tsx`, `RetryListingButton.tsx`, `PoolWithdrawModal/`, `WithdrawalDetailModal/`, `claim-rewards-modal/**`, `FilterPoolModal/`, `Filters/*`, `PoolsTab/`, `ComingSoonColumnsPanel.tsx`, and 22 hooks in `services/hooks/` (only 2 of which the docs name). In particular the **actual** listing flow (`AddMarket` → `AddDeposit` → `RetryMarketListing` → `GetRetryListingInfo` → weekly limit) is nowhere described beyond the 6 bullet points in `Pools_and_Permissionless_Listing.md:22-27`.

##### D11. Undocumented pools endpoints (needs a doc, not just verification)

From `services/index.tsx`: `POST /market/add-market` (:167), `POST /market/deposit-address` (:173) ← this is the "UI shows deposit address" step, `POST market/retry-listing` (:180), `GET market/retry-listing-info` (:186), `GET /market/token-meta-data?contract_address=&chain=` (:191), `GET /market/token-support?contract_address=&chain=` (:196), `GET /market/transaction-history/{start}/{size}` (:248), `POST /market/withdraw` (:252), `GET /market/weekly-listing-limit` (:256), `GET /profit/{token_contract_address}` (:233), `POST /claim` (:261), plus two **cross-service** calls: `GetAggregatedTvl` → `inventory` client `GET /v1/markets/tvl-aggregate` (:204), and `GetRevenue` → Enigma hedger `GET {ENIGMA_DOMAIN}/revenue/{marketId}?time_range=24h` (:207-210).

##### D12. "Chart: no TVL/rewards history endpoints yet" vs. shipped revenue/TVL endpoints

`Pool_Detail_Page.md:151` (Decision #4) says the chart is Coming Soon because history endpoints don't exist. But `GetAggregatedTvl` (`/v1/markets/tvl-aggregate`) and `GetRevenue` (`revenue/{marketId}?time_range=24h`) now exist. Verify whether the Coming Soon state and `ComingSoonBadge`/`ChartPlaceholder` usage are still warranted, and whether `SummaryCards` TVL/APY/Claimable are still placeholders (`:21`).

##### D13. Conditional-orders API version mismatch for lowcap

`Third_Party_Services.md:54` says Enigma/VibeCaps COH is **`/api/v5/`**, and `src/constants/misc.ts:44-49` confirms v5 for `HedgerType.ENIGMA`. But `services/index.tsx:263-264` — `SearchConditionalOrders` inside the **Pools** service — posts to **`/api/v4/search/`**. Verify whether the pools open-orders table is querying the wrong COH version.

##### D14. Listing Service documentation URL is unrelated to the actual base URL

`Third_Party_Services.md:74` gives `https://listing.vibe.trading/docs`, while `Pools_Discover_Table_Data_Sources.md:37` and `src/constants/misc.ts:23-27` both resolve `APP_POOLS_BACKEND_URL` to `https://listing85.enigma.bz/v2/` (prod) / `https://listing-staging.enigma.bz/v2/` (staging). Verify whether `listing.vibe.trading` is a live Swagger for the same service or a dead legacy host — this is the only pointer to a listing OpenAPI spec anywhere in the repo.

##### D15. `IS_TEST_ENVIRONMENT` branch of `APP_POOLS_BACKEND_URL` is a no-op

`src/constants/misc.ts:23-27` — the `IS_TEST_ENVIRONMENT ? 'https://listing85.enigma.bz/v2/' : 'https://listing85.enigma.bz/v2/'` ternary returns the same value on both branches. **Dead branch / likely a missing test-listing host.** Undocumented either way.

##### D16. `NEXT_PUBLIC_POOLS_ENABLE` is documented but missing from `.env.example`

`Architecture_Overview.md:90`, `Local_Dev_and_Testing.md:39`, and `src/constants/environment.ts:5` (`IS_POOLS_ENABLED = process.env.NEXT_PUBLIC_POOLS_ENABLE === 'true'`) all reference it. `.env.example` (49 lines) does **not** list it. A fresh clone therefore boots with pools **disabled** and no hint. Also affects whether any future pools e2e test can even reach `/pools` in CI.

##### D17. Enigma is documented as two mutually exclusive chains

`Third_Party_Services.md:20` — "Enigma is the hedger for VibeCaps (low-cap) markets on **HyperEVM**". `Docs/Enigma_Hedger.md:191-193` — `chainId: 8453, // BASE mainnet`. `Pool_Detail_Page.md:150` — pools use `LOWCAP_DIAMOND_ADDRESS[**BASE**]`. Verify which chain pools actually live on; this determines whether the analytics subgraph (`base_analytics`, Goldsky) can even see pool quotes.

##### D18. Enigma domain literal looks like a botched find-and-replace

`VibeCaps_Token_List.md:28,48` and `Enigma_Hedger.md:127,190` all write `https:/symmio-api.**Enigma**.trading/bsapi` — mid-hostname capital `E`, which is not a valid-looking DNS label for a real host and reads as a rename artifact (the sibling testnet host is `test.defilytics.xyz/papi`). Verify the real production `bsapi` host before copying it anywhere.

##### D19. Two "metadata" endpoints described inconsistently

`Pools_Discover_Table_Data_Sources.md:23` → `GET {PRICE_SERVICE}/api/v1/metadata` yielding `marketMetaData.priceUsd` / `.marketCap` (camelCase). `VibeCaps_Token_List.md:58,157-176` → same URL yielding **snake_case** `price_usd`, `market_cap`, `liquidity.usd`, `price_change.h24`. Verify whether a transform layer renames these or the Discover doc is describing a derived view model.

##### D20. DexScreener access path documented two ways

`Routes_and_Pages.md:49` and `Data_Sources_and_Services.md:70` say DexScreener goes through the Next proxy `/api/dexscreener/pair-details`. `Pool_Detail_Page.md:99` says the Pool Detail header hits the "DexScreener API (`pairs[].info.imageUrl`)" via `usePoolDetail`, and `services/index.tsx:199-201` shows `GetTokenDexScreenerData` calling a `dexscreener` client at `/dex/tokens/${contract_address}` — a **different path**, and a token endpoint rather than a pair endpoint. Verify whether pools bypass the proxy (CORS/rate-limit exposure) and whether `pairs[].info.imageUrl` is even in the `/dex/tokens` response shape.

##### D21. `src/apollo/queries/*` vs `src/apollo/queries.ts`

`Data_Sources_and_Services.md:44` says "Queries: `src/apollo/queries/*`". Reality: `src/apollo/` contains `client/`, `queries.ts`, `service.ts` — a single file. (`POOL_QUOTES_BY_SYMBOL_AND_SOURCE` is at `src/apollo/queries.ts:372`, which **does** match `Pool_Detail_Page.md:45`.)

##### D22. `src/services/markets/*` and `src/services/token/*` pointers

`Pools_and_Permissionless_Listing.md:33-34` and `VibeCaps.md:40-42` route readers to `src/services/markets/*` / `src/services/token/*` for pools work, while the actual pools service layer is `src/components/App/Pools/services/` (index + 22 hooks + `types.ts`). `Pool_Detail_Page.md:67-68` also cites `services/markets/hooks/useNotionalCap` and `services/hedger/hooks/useMarketInfo`. Verify these paths still exist and which layer owns pool market data.

##### D23. `usePoolQuotes.ts:31` line anchor drift

`analytics-subgraph-usages.md:98` pins the hook to line 31; in the current file the query import is line 2 and the `query: POOL_QUOTES_BY_SYMBOL_AND_SOURCE` usage is line 35. Cosmetic, but signals the doc has not been re-verified since edits.

##### D24. Quote-status filter semantics need re-checking against v0.8.5

`Pool_Detail_Page.md:25-28` hardcodes `quoteStatus=4` (positions), `[0,2]` (pending), `[3,7,8,9]` (history). `Docs/Event_Changelog_v0_8_4_to_v0_8_5.md` and `Core_Upgrade_v0_8_5.md` exist in the same folder and describe a core upgrade. Verify the enum ordinals are still correct post-0.8.5 and that the trade-history table's "pool-wide, not user-specific" claim matches the actual GQL `where` clause (a pool-wide read has privacy/perf implications worth confirming).

##### D25. `only_current_user: false` parameter

`Pool_Detail_Page.md:84` passes `only_current_user: false` — a parameter name that appears in no other doc and, per D2, on no surviving service function. Verify whether the listing API still supports it (it is the mechanism that makes the Discover/Your-Pools split work).

##### D26. Docs claim a `yarn test:all` script that does not exist

`Unit_Test.md:40-41` documents `yarn test:all # Run all tests (unit + E2E)`. `package.json` scripts (lines 8–32) define `test`, `test:unit`, `test:watch`, `test:coverage`, `e2e`, `e2e:ui`, `e2e:debug`, `e2e:headed`, `e2e:cache`, `e2e:report`, `e2e:mobile`, `e2e:mobile:headed`, `e2e:desktop` — **no `test:all`**. `Local_Dev_and_Testing.md:16-25` correctly avoids it.

##### D27. Docs name a setup file that does not exist

`Unit_Test.md:109` — "**jest.setup.ts**: Test setup file (used by Vitest)". No `jest.setup.ts` at repo root. The real setup file is `.storybook/vitest.setup.ts`, wired only into the _storybook_ project (`vitest.config.mts:46`); the **unit project has no `setupFiles` at all** (`vitest.config.mts:16-23`) — so no `@testing-library/jest-dom` matchers, no global mocks, for any unit test including the pools one.

##### D28. Unit-test import convention documented ≠ practiced

`Unit_Test.md:16` prescribes `import { foo } from 'utils/foo'`. The pools test uses `@/components/...` and `@/utils/numbers` (`pool-stats.test.ts:1-2`), which is what `test/tsconfig.json` `paths` actually maps (`"@/*": ["src/*"]`).

##### D29. `E2E.md` file tree omits `test/utils/shared.ts`

`E2E.md:147-164` lists the tree; `test/utils/shared.ts` (a one-line `sleep` helper) is missing from it. Also `test/tsconfig.json` is undocumented, and `test/tsconfig.json:9` carries a stale inline "REVIEWER NOTE: we can also remove test from base tsconfig.json to avoid duplication".

##### D30. `FRONTEND_ONBOARDING_PLAN.md` route table predates the pool detail page

`:401-402` lists only `/pools` and `/pools/create-pool`; `/pools/[contractAddress]` (shipped, `src/pages/pools/[contractAddress].tsx`) is absent.

---

### PART 3 — TEST INVENTORY

#### 3.1 Complete test-file census

`find test -type f` (20 files) + `find src -name '*.test.*'`:

**Unit (Vitest)** — `vitest.config.mts:21` includes `src/**/*.test.{ts,tsx}` and `test/**/*.test.{ts,tsx}`:

1. `test/unit/components/App/Pools/components/PoolDetail/pool-stats.test.ts` ← **the only pools test in the repo**
2. `test/unit/utils/close-distribution.test.ts` (~45+ cases, `distributeCloseAmount`)
3. `test/unit/utils/isPlainObject.test.ts` (~30 cases)
4. `test/unit/hooks/useIsOnline.test.ts` (6 cases)
5. `test/unit/lib/hooks/useThrottle.test.ts` (~20 cases)
6. `src/services/session-key/session-key-service.test.ts` (~22 cases; the only colocated test)

**E2E (Playwright + Synpress)** — `playwright.config.ts:12-15`, `testDir: './test/e2e'`, `testMatch: '**/*.e2e.ts'`: 7. `test/e2e/smoke.e2e.ts` — 2 tests, **both `test.skip`** (`:9`, `:16`) 8. `test/e2e/majors.e2e.ts` — 1 test, **`test.skip`** (`:14`) 9. `test/e2e/vibecaps.e2e.ts` — 6 tests: active at `:24`, `:134`, `:389`; skipped at `:84`, `:155`, `:221`

**Support**: `test/utils/{account,fixedMetaMaskFixtures,metamask,metamaskPopups,metamaskSetup,modal,navigation,shared,synpress,viewports}.ts`, `test/wallet-setup/basic.setup.ts`, `test/tsconfig.json`.

**Storybook-as-test project** (`vitest.config.mts:24-48`, browser mode, chromium headless): stories are the test corpus. Existing stories: `src/components/Button/Button.stories.tsx`, `src/components/Icons/Icons.stories.tsx`, `src/shared/components/DataGrid/DataGrid.stories.tsx`, `src/shared/components/typography/typography.stories.tsx`, `src/shared/shadcn/components/stories/{badge,buttons}.stories.tsx`, `src/styles/design-system/stories/{Colors,Palette,SemanticTokens,Typography}.stories.tsx`. **Zero Pools stories** — `find src -ipath '*Pools*' \( -name '*.test.*' -o -name '*.stories.*' \)` returns nothing.

Net: **3 executing E2E tests in the whole repo, all VibeCaps; 6 unit test files; 1 pools test.**

#### 3.2 The one pools test, in full detail

`test/unit/components/App/Pools/components/PoolDetail/pool-stats.test.ts` — pure-function test of `getPoolStatsCardValues` from `@/components/App/Pools/components/PoolDetail/pool-stats` (`:1`). No mocks, no renderer, no network.

| #   | Title                                                           | Inputs                                                                                                                                                                                                 | Assertions                                                                                                                 |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| 1   | `uses token decimals when normalizing the token balance` (`:6`) | `total_token_in_pool: toWei('250', 6)`, `total_usdc_in_pool: toWei('1000')`, `token_decimal: 6`; `notionalCap {used: 321.45, available_to_long: 123.45, available_to_short: 67.89}`; `tokenPrice: '4'` | `openInterest === 321.45`; `tokenBalance.toString() === '250'`; `usdcBalance.toString() === '1000'`; `tokenPercent === 50` |
| 2   | `clamps exhausted liquidity sides to zero` (`:27`)              | zero balances, `token_decimal: 18`; `available_to_long: -12`, `available_to_short: 45`; `tokenPrice: '1'`                                                                                              | `availableLiquidityLong === 0`; `availableLiquidityShort === 45`                                                           |
| 3   | `keeps a neutral split when token price is unavailable` (`:46`) | `toWei('250')`/`toWei('1000')`, `token_decimal: 18`, `tokenPrice: null`                                                                                                                                | `tokenPercent === 50`                                                                                                      |

##### ⚠️ FINDING — this test is currently RED (regression, not a doc issue)

`src/components/App/Pools/components/PoolDetail/pool-stats.ts:35` reads:

```ts
const tokenBalance = fromWeiBN(market.total_token_in_pool);
```

`fromWeiBN` (`src/utils/numbers.ts:55`) is `fromWeiBN(amount, decimals = 18, defaultOutput?)`. **`market.token_decimal` is never passed**, so a 6-decimal token is divided by `1e18`.

Git history proves this is a regression against the test:

- `886bace6d` _"fix(pools): cover pool stats edge cases"_ (Rowan Brooks, 2026-04-15) **added** the test **and** changed the line to `fromWeiBN(market.total_token_in_pool, market.token_decimal)`, widening the `Pick<MarketDetailResponse, …>` to include `'token_decimal'`.
- `ebc1d08c7` _"fix: calculate token balance in right way"_ (Alit, 2026-06-16) — a **1-line commit** — reverted it back to `fromWeiBN(market.total_token_in_pool)`, without touching the test.

Consequence for case 1: `toWei('250', 6)` = `"250000000"`; `250000000 / 1e18 = 2.5e-10`. With `BigNumber.config({ EXPONENTIAL_AT: 30 })` (`src/utils/numbers.ts:5`) that stringifies as `"0.00000000025"`, so `expect(values.tokenBalance.toString()).toBe('250')` fails; `tokenPercent` also collapses to ≈`1e-10` rather than `50`, so the fourth assertion fails too. `token_decimal` is now an unused member of the params type (`pool-stats.ts:14`).

Because `.github/workflows/unit-test.yml:41-42` runs `yarn test:unit` on every PR and on push to `main`, either the pools test is failing in CI on every run, or CI has been red/ignored since 2026-06-16. **This is the single highest-value thing to verify in this slice.** Whichever way it is resolved, it is a live correctness question about pool token balances for non-18-decimal tokens (i.e. most Base/Solana lowcaps — USDC-style 6-decimal tokens are exactly case 1).

#### 3.3 What the E2E suite actually asserts (none of it pools)

`test/e2e/vibecaps.e2e.ts` — the only file with executing tests:

- `describe('vibecaps markets modal Desktop')` → `test('should open vibecaps markets modal and display market data')` (`:24`): asserts `[data-testid="vibecaps-market-bar"]` visible; reads `[data-testid="vibecaps-current-market-name"]`; clicks `[data-testid="vibecaps-open-markets-modal-button"]`; asserts `[data-testid="vibecaps-markets-modal-table"]` visible with `[data-testid="table-row"]` count ≥ 1; asserts first row `[data-testid="market-name"]` non-empty; if >1 market, clicks a different row and asserts the market bar name updates.
- `test.skip('search and filter markets in the vibecaps markets modal')` (`:84`) — skip reason in-comment: _"requires chain-category and dex-category data-testid values which are not yet implemented in the filter components."_
- `describe('Vibecaps Account Desktop')` → `test('should successfully login and load account overview')` (`:134`): connects MetaMask, navigates `routes.account.index`, asserts "Balance"/"Accounts" text, asserts `[data-testid^="account-row-"]` count ≥ 2.
- `test.skip('should deposit and increase balance')` (`:155`) — full USDC deposit flow incl. `Approve and Deposit`, `confirmTransaction(metamask)`, `waitForTwoStepProgress(page, TwoStepProgressType.Deposit)`, balance-delta assertion with 15% tolerance (`:16-17`).
- `test.skip('should withdraw and increase wallet balance')` (`:221`) — withdraw incl. fast-withdrawal enablement, two-tx instant path, "Pending Transactions" tab resume-withdraw recovery.
- `describe('Vibecaps Mobile')` → `test('should load the vibecaps page on mobile')` (`:389`): only asserts `toHaveTitle(/.*Vibe.*/i)` and takes a 360×740 full-page screenshot. **No pool/market assertions.**

`test/e2e/majors.e2e.ts` — single `test.skip` (`:14`) covering the full open/close position round-trip on symbolId 4 (XRP), including 1-click-trading enablement and a 10×5s retry loop on `[data-testid="close-position-button"]`.

`test/e2e/smoke.e2e.ts` — both tests skipped: landing-page load + "Connect/Log in" visibility, and MetaMask connect.

`grep -rin "pool" test/` returns **only** hits inside `pool-stats.test.ts` (the filename plus `total_token_in_pool` / `total_usdc_in_pool` field names). `routes.pools` is never referenced in `test/`.

#### 3.4 CI wiring

- `.github/workflows/unit-test.yml` — triggers `push: [main]` + all `pull_request`. Steps: corepack → node 20 → `yarn install --immutable` → **`yarn playwright install --with-deps chromium`** → **`yarn build-storybook`** → `yarn storybook --ci --port 6006 &` → `./.github/actions/wait-for-storybook` → `yarn test:unit` (`:41-42`). Coverage upload is **commented out** (`:44-49`). Note the unit job is coupled to a full Storybook build+serve because `vitest.config.mts` declares the storybook browser project inside the same config.
- `.github/workflows/e2e.yml` — triggers on `deployment_status` where `state == 'success'` (i.e. post-Vercel-deploy), single worker, `BASE_URL` = the deployment's `environment_url`, `CI: true`; runs `xvfb-run npx synpress` for the wallet cache then `yarn run e2e`. Uploads `playwright-report/` always and `test-results/` on failure. Secrets: `E2E_SEED_PHRASE`, `E2E_WALLET_PASSWORD`, `VERCEL_AUTOMATION_BYPASS_SECRET`.
- `playwright.config.ts:58-71` — projects `Desktop Chrome` (`grepInvert: /Mobile/`) and `Mobile Chrome` (**which also uses `devices['Desktop Chrome']`** — likely a bug; the "mobile-ness" comes only from `setViewportSize` inside specs), `workers: 1`, `fullyParallel: false`, 2-minute per-test and per-expect timeouts, 4-hour global timeout, `baseURL` default `https://localhost:3000`.

#### 3.5 Pools flows with **ZERO** test coverage

Everything except the three pure arithmetic assertions in `pool-stats.test.ts`. Explicitly:

**Routing / page shell**

- `/pools` (`src/pages/pools/index.tsx`) never loaded by any test.
- `/pools/[contractAddress]` — the entire DES-105 page; no render test, no e2e, no story.
- `/pools/create-pool` and the documented mobile→VibeCaps redirect (`Routes_and_Pages.md:38`) — untested.
- `routes.pools.poolDetail(contractAddress, depositChain?)` URL construction incl. the `?deposit_chain=` branch (`routes.ts:23-24`) — untested despite being trivially unit-testable.
- Row-click navigation from `DiscoverPoolTableItem.tsx` / `DiscoverPoolMobileCard.tsx` and the `stopPropagation` guard on action buttons (`Pool_Detail_Page.md:46-47`) — untested; this is exactly the class of bug (button click also navigating) that a click test catches.

**Data layer** — no test touches network at all; there is **no MSW/nock/fetch-mock anywhere in the repo**, and the unit project has no `setupFiles`.

- All 20 exported functions in `src/components/App/Pools/services/index.tsx` — zero coverage of URL construction, query-param encoding (`constructQueryParams`), or response typing.
- All 22 hooks in `services/hooks/` — `useDiscoverMarketSearch`, `useYourPoolsMarketDeposits`, `useMarketDetail`, `usePoolQuotes`, `usePoolHistoryQuotes`, `useOpenOrders`, `useTransactionHistory`, `useNotionalCap`-consumers, `useAggregatedTvl`, `useRevenue`, `useUserProfit`, `useClaimProfit`, `usePoolWithdraw`, `useAddUserDeposit`, `useWeeklyListingLimit`, `useListingAuth`, `useListingLogin`, `useTokenValidate`, `useTokenMetaData`, `useRetryListingInfo`, `useRetryMarketListing`, `useDiscoverPoolsCount` — **none tested**. No query-key, staleTime, or `enabled`-gating assertion exists for any pools query.
- `toQuoteFromGraph()` normalization — the doc's most emphatic correctness rule (`Pool_Detail_Page.md:130-135`: PascalCase remap, `fromWei` application, enum typing) — **has no test**, in pools or elsewhere.
- Quote-status filter sets (`4`, `[0,2]`, `[3,7,8,9]`, `orderTypeOpen === 0`) — untested.
- Unlisted-pool path (`symmio_symbol_id === null` → empty tables, `Pool_Detail_Page.md:153`) — untested.

**Pure helpers that are trivially testable and untested** — `utils/canDepositToMarket.ts`, `utils/canTradeMarket.ts`, `utils/depositUtils.ts`, `utils/explorerUtils.ts`, `utils/formatListingAge.ts`, `utils/listingSearchMetrics.ts`, `utils/marketSearchItemToStubIMarket.ts`, `utils/truncateToSignificant.ts`, `components/FilterPoolModal/helpers.ts`, `components/claim-rewards-modal/utils.ts`, `constants.ts` (`poolStatusMapper`, `DEPOSIT_CHAIN_OPTIONS`), `PoolsTable/constants.ts`. `canDepositToMarket` / `canTradeMarket` are gating predicates — the highest-risk untested logic after `pool-stats`.

**Write flows (highest business risk, all untested end-to-end and in unit)**

- Create-pool wizard: `CreatePool/index.tsx` + `Stepper` + `TokenBasics` → `TokenDetails` → `MarketSettings` → `Review`.
- Token validation gate (`useTokenValidate`, `TokenSupport`, `GetTokenMetaData`).
- Weekly listing limit enforcement (`useWeeklyListingLimit` / `WeeklyLimitTooltip` / `MinDepositWarning`).
- **Deposit-address issuance and the "exact amount" UX rule** (`Pools_and_Permissionless_Listing.md:38`) — `AddDeposit` → `POST /market/deposit-address` → `ListingDepositModal` → `useAddUserDeposit`. This is the step where a user can lose funds; it has no test of any kind.
- Listing auth: `ListingAuthGuard`, `useListingAuth`, `useListingLogin`, `SignInMessage`/`Login`, `ListingSignatureRequestModal`, `TermsAndConditionsModal`, `SummaryCards/AuthGatedPlaceholder`.
- Retry listing: `RetryListingButton`, `useRetryMarketListing`, `useRetryListingInfo`.
- Pool withdraw: `PoolWithdrawModal`, `usePoolWithdraw`, `PostWithdraw`, `WithdrawalDetailModal`.
- Reward claiming: `claim-rewards-modal/**`, `useClaimProfit`, `ClaimProfit` (`POST /claim`), `useUserProfit`.
- Filtering/sorting: `FilterPoolModal`, `Filters/FilterByChain|FilterByMarketStatus|FilterByStatus`, `MobilePoolsSort`.

**No visual/regression coverage**: zero Pools stories, so the storybook-vitest browser project asserts nothing about pools; the only screenshot in the whole suite is `test-results/mobile-screenshots/vibecaps-spec/mobile/screenshot-360x740.png` (`vibecaps.e2e.ts:392-395`), and it is a VibeCaps page, unasserted.

**Testability blockers to note for anyone adding pools coverage**: (a) `NEXT_PUBLIC_POOLS_ENABLE` is absent from `.env.example` (D16), so a CI-built app may render no pools UI at all; (b) the unit project has no `setupFiles` / no jest-dom, so component tests need that wiring first; (c) e2e only runs post-deploy against a live Vercel URL, so any pools e2e would hit **production listing/solver backends** with a real wallet.

---

### PART 4 — Backend API spec documents found, transcribed

There is **no listing-service / pools API spec document in this repo**. The only pointer is the bare URL `https://listing.vibe.trading/docs` (`Third_Party_Services.md:74`) — see D14. The pools request/response contracts must be reconstructed from `src/components/App/Pools/services/index.tsx` + `services/types.ts`.

#### 4.1 Pools/listing endpoint contracts as they exist in code (no doc counterpart)

Base: `APP_POOLS_BACKEND_URL` (`src/constants/misc.ts:23-27`) = `https://listing-staging.enigma.bz/v2/` when `IS_BACKEND_STAGING_ENV`, else `https://listing85.enigma.bz/v2/` (both remaining ternary branches identical — D15).

| Function (`services/index.tsx:L`)  | Method + path                                                                    | Request                          | Response type                                        |
| ---------------------------------- | -------------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------- |
| `getMarketSearch` (:120,135)       | `GET market/search?{params}`                                                     | query params object              | `MarketSearchResponse`                               |
| `getUserMarketSearch` (:138,153)   | `GET market/search-user?{params}`                                                | query params object              | `UserMarketSearchResponse`                           |
| `SignInMessage` (:156)             | (auth)                                                                           | `{ address, domain, uri }`       | —                                                    |
| `Login` (:162)                     | (auth)                                                                           | `LoginPayload`                   | —                                                    |
| `AddMarket` (:166)                 | `POST /market/add-market`                                                        | `AddMarketPayload`               | `AddMarketResponse`                                  |
| `AddDeposit` (:170,173)            | `POST /market/deposit-address`                                                   | `AddDepositPayload`              | `AddDepositResponse`                                 |
| `RetryMarketListing` (:179)        | `POST market/retry-listing`                                                      | `RetryMarketPayload`             | `RetryMarketResponse`                                |
| `GetRetryListingInfo` (:183,186)   | `GET market/retry-listing-info?{params}`                                         | `RetryListingInfoPayload`        | `RetryListingInfoResponse`                           |
| `GetTokenMetaData` (:189)          | `GET /market/token-meta-data?contract_address=&chain=`                           | —                                | (token metadata)                                     |
| `TokenSupport` (:195)              | `GET /market/token-support?contract_address=&chain=`                             | —                                | `string`                                             |
| `GetTokenDexScreenerData` (:199)   | `GET {dexscreener}/dex/tokens/{contract_address}`                                | —                                | `GetTokenDexScreenerDataResponse`                    |
| `GetAggregatedTvl` (:203)          | `GET {inventory}/v1/markets/tvl-aggregate`                                       | —                                | `AggregatedTvlResponse`                              |
| `GetRevenue` (:207)                | `GET {ENIGMA hedger domain}/revenue/{marketId}[?time_range=24h]`                 | —                                | `RevenueResponse` (errors → `captureAxiosError`)     |
| `GetMarketDetail` (:220)           | `GET /market?token_contract_address=&deposit_chain=`                             | —                                | `MarketDetailResponse`                               |
| `GetUserProfit` (:232)             | `GET /profit/{token_contract_address}`                                           | —                                | `UserProfitResponse`                                 |
| `GetTransactionHistory` (:236,248) | `GET /market/transaction-history/{start}/{size}?{market_address,wallet_address}` | defaults `start=0`, `size=150`   | `TransactionHistoryResponse`                         |
| `PostWithdraw` (:251)              | `POST /market/withdraw`                                                          | `WithdrawRequest`                | —                                                    |
| `GetWeeklyListingLimit` (:255)     | `GET /market/weekly-listing-limit`                                               | —                                | `WeeklyListingLimitResponse`                         |
| `ClaimProfit` (:259)               | `POST /claim`                                                                    | `ClaimProfitRequest`             | `ClaimProfitResponse`                                |
| `SearchConditionalOrders` (:263)   | `POST {COH}/api/v4/search/`                                                      | `SearchConditionalOrdersPayload` | `SearchConditionalOrdersResponse` (**v4 — see D13**) |

Solver-side contracts that the pools docs depend on but only stub:

- `GET {domain}/get_market_info` — `Rasa_Hedger.md:305`, `Enigma_Hedger.md:213`. **Response shape is documented nowhere**; `Pool_Detail_Page.md:117` only asserts `data[token_ticker].trading_volume`.
- `GET {domain}/notional_cap/{marketId}` — `Rasa_Hedger.md:317`, `Enigma_Hedger.md:216`; plural `notional_cap` (all markets) exists only for Enigma (`Enigma_Hedger.md:217`). Fields asserted by `Pool_Detail_Page.md:113`: `{ used, available_to_long, available_to_short, total_cap }`; the pools code's `NotionalCapSnapshot` (`pool-stats.ts:7-11`) uses only the first three.
- Enigma route map (`Enigma_Hedger.md:212-219`): `marketInfo: 'get_market_info'`, `fundingInfo: 'get_funding_info'`, `openInterest: ''` **(explicitly not supported — `openInterestSupport: false`, `:205`)**, `notionalCap: (id) => \`notional_cap/${id}\``, `notionalCaps: 'notional_cap'`, `contractSymbols: 'contract-symbols'`, `nukeAll: 'bulk_instant_close'`. **The `openInterestSupport: false`flag is worth flagging against`Pools_Discover_Table_Data_Sources.md:28`, which sources the Open Int. column from `notional_cap.used` rather than an open-interest endpoint — consistent, but only by accident of routing.\*\*
- Sample response fixtures live at `tools/contract-symbol-rasa.json`, `tools/contract-symbols-perps.json`, `tools/contract-symbol-enigma.json`, `tools/metadata.json` (`Data_Sources_and_Services.md:33-36`).

#### 4.2 `Docs/technichal-docs-back-end/instant-layer-v2-solver.md` (113 lines) — NOT pools

Canonical EIP-712 data model + solver REST for InstantLayer (Accounts Layer V2). Go impl at `deps/symmio-dev/go/eip712`.

**Roles**: _Signer_ = temporary FE-generated address holding the signing key; _SignerAccount.Addr_ = subaccount address; _Target_ = Symmio PartyB (diamond) address; _CallData_ = ABI-encoded selector + params.

**Types**: `eip712.Account{Addr}`, `eip712.ReplayHeader{Nonce, Deadline *big.Int, Salt [32]byte}`, `eip712.SignedOperation{Signer, Target, CallData, SignerAccount, ReplayHeader}`. Contract/binding names `ReplayAttackHeader`, `InstantLayerSignedOperation`. API: `eip712.NewDomain(chainId, instantLayerAddress)`, `NewReplayHeader(nonce, deadline)` (random salt), `SignOperation(privateKey, domain, op)` → 65 bytes, `ToBindingSignedOp(op)`, then `instantLayer.ExecuteBatch(ops, signatures)` or `ExecuteTemplate(templateId, ops, signatures)`. Helpers `GetOperationHash`, `RecoverOperationSigner`, `Selector("func(uint256)")`.

**Domain**: name `"SymmioInstantLayer"`, version `"1"`, chainId, verifyingContract. Type hashes exposed: `AccountTypeHash`, `ReplayHeaderTypeHash`, `SignedOperationTypeHash`.

**Validation**: `signer == SignerAccount.Addr`; `len(CallData) >= 4`; nonce sequential if > 0; deadline > `block.timestamp` if > 0; salt unique per signer. Encoding: EIP-55 addresses, `0x`+hex bytes, `nonce/deadline == 0` ⇒ salt-only / no deadline. **Self-execution** (`signer == msg.sender`): contract skips verification; pass `"0x"` or a zero 65-byte signature.

**REST** — base path `/v2/instant_layer`; auth "same as existing trading API (e.g. JWT or TPSL where applicable)".

`POST /v2/instant_layer/execute` — request:

```json
{
  "type": "open",
  "items": [
    {
      "id": "addmargin",
      "signedOperation": {
        "signer": "0x...",
        "target": "0x...",
        "callData": "0x...",
        "signerAccount": { "addr": "0x..." },
        "replayAttackHeader": { "nonce": "0", "deadline": "0", "salt": "0x..." }
      },
      "signature": "0x..."
    },
    { "id": "sendquote", "signedOperation": {}, "signature": "0x..." }
  ]
}
```

`type` ∈ `"open" | "close"`; `items[].id` names the step (`"addmargin"`, `"sendquote"`); server runs them in order as one batch; `signature` is 0x + 130 hex, or `"0x"` for self-execution.

Response:

```json
{
  "txHash": "0x...",
  "success": true,
  "type": "open",
  "results": [
    { "id": "addmargin", "ok": true },
    { "id": "sendquote", "ok": true }
  ]
}
```

or `{ "success": false, "error": "..." }` with an appropriate HTTP status. The doc cross-references `./instant-layer-partyb-integration.md`, **which does not exist in this repo** (broken link).

#### 4.3 `Docs/technichal-docs-back-end/v5-conditional-orders-api-example.md` (476 lines) — NOT pools

Base URL `/api/v5`. Endpoints (`:5-11`):

- `POST /api/v5/` — create/update: `takeProfit` only, `stopLoss` only, or both (close on existing position); `sendQuote` only (trigger market); `sendQuote` + TP and/or SL (trigger market with TP/SL on the new position).
- `DELETE /api/v5/` — cancel a conditional order.
- `GET /api/v5/signing-spec` — canonical EIP-712 `domain`, `types`, `primaryType` + test vector.
- `GET /api/v5/{cohQuoteId}/` — get by encoded coh-quote id (e.g. `coh123`).
- `POST /api/v5/search/` — search by party address, state, type, pagination.

Field rules (`:19-23`): at least one of `takeProfit` / `stopLoss` / `sendQuote` must be present. TP/SL-only ⇒ `quoteId` **must** be set. Any `sendQuote` combination ⇒ `quoteId` unused / `null`; the backend generates a synthetic coh-quote.

EIP-712 spec (`:55-95`, repeated `:145-190`): `primaryType: "ConditionalOrder"`; domain `{ name: "ConditionalOrder", version: "1", chainId, verifyingContract }` (example `chainId: 999`, `verifyingContract: 0x99641E06d38F327166b3a48f86Ca2cbB3B4fB7EB`).

```
ConditionalOrder: partyAAddress address, salt uint256, quoteId uint256, symbolId uint256,
                  positionType uint8, affiliate address,
                  takeProfit TakeProfit, stopLoss StopLoss, sendQuote SendQuote
TakeProfit / StopLoss: quantity uint256, price uint256, orderType uint8,
                       conditionalPrice uint256, conditionalPriceType uint8
SendQuote:             quantity uint256, price uint256, orderType uint8,
                       conditionalPrice uint256, conditionalPriceType uint8, leverage uint256
```

Request envelope is `{ "typedData": { types, primaryType, domain, message }, "signature": "0x<eip712-signature-from-wallet>" }`. Example trigger-market message (`:255-272`): `{ partyAAddress, salt: 1234567890123456789, symbolId: 2, positionType: 0, affiliate: "0x8a98f69139534Ef85775b473082CE4Af1373cd63", quoteId: null, takeProfit: null, stopLoss: null, sendQuote: { quantity: "1", price: "3600", orderType: 1, conditionalPrice: "3650", conditionalPriceType: "market", leverage: "5" } }`. The doc instructs callers to **always** fetch `GET /api/v5/signing-spec` per environment rather than hardcoding domain/types (`:15`).

_(Related enum from `Enigma_Hedger.md:100-115`: `TriggerMarketPositionType { LONG = 0, SHORT = 1 }`; `TriggerMarketOrderState = 'pending' | 'new' | 'triggered' | 'triggered_pending' | 'canceled' | 'killed'`.)_

#### 4.4 `Docs/design-docs/*` (no pools content)

- `instant-layer-v2.md` (412 lines) — VIBE-799, author Citoyen, **Status: Implemented**. v1 = solver holds delegated subaccount access and builds the tx from a JSON body; v2 = user signs every action locally with the session key, solver only relays. Applies to **VibeCaps (Enigma)** and **Majors (RASA)**; **ORBS stays on v1**. Falls back to v1 when no session key (Privy/AA). Non-goals: ORBS flow, Privy/AA on v2, contract changes ("InstantLayer v2 contract already deployed"), and the **direct "Add Margin" contract call in GroupedPositions stays a wallet transaction**.
- `session-key.md` (242 lines) — VIBE-464, author Rowan Brooks, **Status: Implemented**. Locally stored key vs wallet popup (~300–500 ms); key encrypted with a key derived from the wallet address; loaded at app startup; **one key per wallet, shared across sub-accounts, auto-expires after 7 days**; settings has a timing-comparison test button. Non-goals: trade-flow/1-click changes, hedger integration, Privy/AA, new deps (viem + Web Crypto only). This is the one design doc with a matching test file (`src/services/session-key/session-key-service.test.ts`).

---

#### Key file paths (absolute)

- `/symmio/Vibe-ui/Docs/Pool_Detail_Page.md`
- `/symmio/Vibe-ui/Docs/Pools_Discover_Table_Data_Sources.md`
- `/symmio/Vibe-ui/Docs/Pools_and_Permissionless_Listing.md`
- `/symmio/Vibe-ui/Docs/VibeCaps.md`, `.../VibeCaps_Token_List.md`
- `/symmio/Vibe-ui/Docs/analytics-subgraph-usages.md`
- `/symmio/Vibe-ui/Docs/technichal-docs-back-end/{instant-layer-v2-solver.md,v5-conditional-orders-api-example.md}`
- `/symmio/Vibe-ui/Docs/design-docs/{instant-layer-v2.md,session-key.md}`
- `/symmio/Vibe-ui/test/unit/components/App/Pools/components/PoolDetail/pool-stats.test.ts` — the only pools test
- `/symmio/Vibe-ui/src/components/App/Pools/components/PoolDetail/pool-stats.ts:35` — the regressed line
- `/symmio/Vibe-ui/src/utils/numbers.ts:55` — `fromWeiBN(amount, decimals = 18, defaultOutput?)`
- `/symmio/Vibe-ui/src/components/App/Pools/services/index.tsx` — real listing endpoint surface
- `/symmio/Vibe-ui/src/constants/misc.ts:23` — `APP_POOLS_BACKEND_URL`
- `/symmio/Vibe-ui/src/constants/routes.ts:20-25` — pools route map
- `/symmio/Vibe-ui/{vitest.config.mts,playwright.config.ts,.github/workflows/unit-test.yml,.github/workflows/e2e.yml}`

---

# Part II — Resolved open questions

These six questions were raised by a completeness critic that read all ten subsystem maps, then answered by dedicated agents that went back to the source.

## 1. What is a pool on-chain? (main_pool, TVL, LP accounting)

#### VERDICT

**`main_pool` is not a vault. It is the token's main third-party AMM/DEX liquidity-pool address — the pool the Enigma inventory service prices and swaps against. There is no SYMMIO LP-token, vault, or pool contract anywhere. LP accounting is 100% custodial bookkeeping split across two off-chain services: the Listing service (per-user LP shares, in its own Postgres, keyed by `wallet_id`/`market_id` UUIDs) and the Inventory service (the actual token+USDC balance sheet per market). The money sits in solver-operated custodial wallets plus the Enigma solver's single aggregate PartyB balance on the lowcap diamond — never segregated per pool, never attributable on-chain to an LP.**

I proved `main_pool` is a DEX pair address by hitting the live API and cross-checking DexScreener (below). An SDK **cannot** read pool state trustlessly; there is nothing on-chain to read.

---

#### 1. `main_pool` — what it actually is

##### 1a. The three declaration sites (all unconsumed) — confirmed

```
$ grep -rn "main_pool" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" --include="*.md" .
src/components/App/Pools/services/types.ts:57:  main_pool: string | null      # IMarket
src/components/App/Pools/services/types.ts:178:  main_pool: string             # AddMarketResponse
src/components/App/Pools/services/types.ts:324:  main_pool: string | null      # MarketDetailResponse
src/components/App/Pools/utils/marketSearchItemToStubIMarket.ts:37:    main_pool: null,
```

Four hits. Three are type declarations, one writes `null`. **Zero reads.** Confirmed across the entire git history:

```
$ git grep -n "main_pool" $(git rev-list --all) -- src | sed 's/^[0-9a-f]*://' | cut -d: -f1 | sort | uniq -c
     56 src/components/App/Pools/components/PoolCard/index.tsx      (deleted)
    360 src/components/App/Pools/components/PoolDetail/index.tsx    (only `main_pool: ''` literals)
   6174 src/components/App/Pools/services/types.ts
    150 src/components/App/Pools/utils/marketSearchItemToStubIMarket.ts
```

##### 1b. The smoking gun: the deleted `PoolCard` labelled it

The only code that ever _rendered_ `main_pool` is the deleted `PoolCard` (last seen at commit `1824005347fe73f9503b1b7e11b20962d5a2a0bf`, `src/components/App/Pools/components/PoolCard/index.tsx:70-71`):

```tsx
<p className={`${title} `}>Main liq Pool</p>
<p>{data.main_pool ? truncateString?.(data.main_pool) : '-'}</p>
```

**"Main liq Pool"** = main liquidity pool. Rendered as a truncated address string, nothing more.

##### 1c. Live-API proof — it is a DexScreener pair address

The live listing OpenAPI is at **`https://listing85.enigma.bz/openapi.json`** (title `"Vibe PermissionLess Listing"`, version `0.1.0`). `Docs/Third_Party_Services.md:74` points at `https://listing.vibe.trading/docs`, which returns **HTTP 521 (Cloudflare origin down) — that host is dead**. `https://listing85.enigma.bz/v2/docs` is 404; the docs live at `/docs`, `/redoc`, `/openapi.json` (no `/v2` prefix), while the _routes_ are all `/v2/...`.

`GET /v2/market` is **public / unauthenticated**. Two real responses:

| market                                                           | `main_pool` returned                           | DexScreener top pair for that token                                                                                                   |
| ---------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `HYDX` (Base, `0x00000e7efa313F4E11Bfff432471eD9423AC6B30`)      | `0x51f0B932855986B0E621c9D4DB6Eee1f4644D3D2`   | `base / hydrex / 0x51f0B932855986B0E621c9D4DB6Eee1f4644D3D2` labels `["CLAMM"]`, HYDX/USDC, **liq $752,154** — highest-liquidity pair |
| `WSOLP` (Solana, `GvUCjmWSXA5hrTh9smmNA1AU55YCtP9mDLQcrKA1pump`) | `H5gzcMCCXDZeXzNedDGfEPJnpYAYuYhH6t4Cyxt5PdFz` | `solana / pumpswap / H5gzcMCCXDZeXzNedDGfEPJnpYAYuYhH6t4Cyxt5PdFz`, WSOLP/SOL, **liq $94,302** — highest-liquidity pair               |

Exact string match against `pairs[].pairAddress` from `https://api.dexscreener.com/latest/dex/tokens/{token}`, in both cases the deepest pool. `main_pool` is a **base58 Solana address** for Solana markets — it cannot be an EVM vault. `Quokka` (Base) returns `main_pool: null` and is still `market_status: "listed"` with live TVL, so it is not even required.

##### 1d. It is a _lister-supplied input_, not a system-derived identity

`AddMarketDepositRequestSchemaV2` (request body of `POST /v2/market/add-market`) carries an optional input field:

```json
"pool_address": { "anyOf": [{"type":"string"},{"type":"null"}], "title": "Pool Address" }
```

which is echoed back on the response as `main_pool`. Note the schema hygiene: every genuine blockchain address field in that spec (`token_contract_address`, `user_address`, `wallet_public_key`, `market_address`, `withdraw_address`, `account_address`) carries `description: "EVM or Solana blockchain address"` + examples. **`main_pool` / `pool_address` carry neither** — the backend does not model it as a protocol address. It is metadata the lister hands over so the solver knows where to route swaps.

The frontend's `AddMarketPayload` (`src/components/App/Pools/services/types.ts:155-162`) **does not even include `pool_address`** — Vibe-ui never sends it. Any `main_pool` value in production came from a non-Vibe client or backend inference.

---

#### 2. Where the money actually sits

Three layers, none of them an LP vault.

##### Layer 1 — Deposit: a custodial EOA, funded by a manual transfer

`POST /v2/market/deposit-address` (summary: _"If user have wallet return it, else create new one"_) returns `wallet_public_key`. The FE routes it straight to a QR code:

- `src/components/App/Pools/services/hooks/useAddUserDeposit.ts:37` — `publicAddress: data.wallet_public_key`
- `src/components/App/Pools/components/ListingDepositModal/index.tsx:23-58` — renders `publicAddress` as a `QrCodeWithLogo`
- `.../ListingDepositModal/index.tsx:82` — _"Only deposit {{tokenName}} to this address."_
- `.../ListingDepositModal/index.tsx:111-123` — the "Confirm Deposit" button calls **`refetchPoolsData?.()` and closes the modal**. That is the entire deposit "transaction": _"Click after sending your tokens. We will verify your deposit and begin the 24h review process."_

There is no `approve`, no `transfer`, no `deposit()`. The user is instructed to manually send tokens to a backend-generated address. This is a centralized-exchange deposit flow.

##### Layer 2 — Custody/inventory: the Enigma Inventory Service ledger

`GET /v2/market` documents its own provenance (listing OpenAPI, operation `Get public market and pool stats`):

> _"Returns market metadata plus aggregate TVL, APY, pool amounts, lifetime reward, and inventory positions for the token on the given deposit chain. **Listed markets use live Inventory balances.** Delisted markets return **cached** remaining token and USDC balances with TVL fixed at zero."_

And `GET /v2/pools`:

> _"Return market_cap (from **inventory TVL**) and APR for each address."_ (`PoolInfoSchema.market_cap` description: _"TVL from inventory (market cap)"_)

The Inventory Service OpenAPI (`https://inventory85.enigma.bz/openapi.json`, title `"Inventory Service"`) defines TVL at `GET /api/v1/markets/tvl`:

> ```
> total_usdc  = available_usdc + locked_usdc_for_short + locked_usdc_for_net_margin + reserved_usdc
> total_token = available_token + locked_token_for_long + reserved_token
> tvl         = total_token * price + total_usdc   (null when price unavailable)
> ```

**Byte-identical pass-through, verified live:**

| field                                      | listing `GET /v2/market`  | inventory `GET /api/v1/markets/tvl` |
| ------------------------------------------ | ------------------------- | ----------------------------------- |
| HYDX `total_token_in_pool` / `total_token` | `19655025948687182317857` | `19655025948687182317857`           |
| HYDX `total_usdc_in_pool` / `total_usdc`   | `912873425247244240`      | `912873425247244240`                |
| HYDX `tvl`                                 | `530088982178321792955`   | `530088982178321792955`             |
| WSOLP `total_token_in_pool`                | `47642666940000000000000` | `47642666940000000000000`           |

`total_usdc_in_pool` / `total_token_in_pool` / `tvl` **are** the Inventory Service's ledger rows. Those are bucket names (`available_`, `locked_`, `reserved_`) in a database, not on-chain slots. The service moves real money — `TransferJournalResponse` has `source_address` / `source_type` / `source_chain_id` → `destination_address` / `destination_type` / `destination_chain_id`, `reason` ∈ `{SETTLEMENT, PLATFORM_FEE}`, `state` ∈ `{PENDING, SUCCESS, FAILED, TIMED_OUT}`, `tx_hash`; `SwapJournalResponse` has `swapper` ∈ `{order_handler, stabilizer, buyback_handler, maintenance_fee}`, `tx_hash` — but every one of those endpoints is gated behind `X-API-Key` (`{"error_message":"Not Authorized","error_code":9,"error_detail":"Missing X-API-Key."}`). Only `GET /api/v1/markets/tvl`, `/tvl-aggregate`, `/available`, `/funding-rate` are public. **An SDK cannot audit the balance sheet, only read the number the operator publishes.**

##### Layer 3 — On-chain: one solver PartyB account, commingled across all pools

The only on-chain footprint of the whole pool system:

- Lowcap diamond `LOWCAP_DIAMOND_ADDRESS[HYPEREVM] = '0x57331038c21982116EE9b0906E4a5c5cB52dcE2e'` (`src/constants/addresses.ts:51-57`)
- Enigma solver `partyBAddress = '0x76bc5889c0cfcC20960b0D81F541595d81a95122'` (`src/constants/hedgers.ts:91-93`)
- A `symbolId` (`MarketDetailResponse.symbol_id`, `types.ts:318`)

That is it. In perps-core v0.8.5 a symbol is:

```solidity
// contracts/core/storages/SymbolStorage.sol:8-18
struct Symbol {
    uint256 symbolId; string name; bool isValid;
    uint256 minAcceptableQuoteValue; uint256 minAcceptablePortionLF;
    uint256 tradingFee; uint256 maxLeverage;
    uint256 fundingRateEpochDuration; uint256 fundingRateWindowTime;
}
```

No vault, no share token, no depositor mapping. PartyB collateral is keyed `partyBAllocatedBalances[partyB][partyA]` (per counterparty, `docs/v0.8.5/clearing-house.md:19-21`), or `[partyB][address(0)]` in cross mode — **never per symbol**. So the fraction of pool USDC actually posted as margin (`locked_usdc_for_net_margin`) is one undifferentiated solver balance shared by all 271 lowcap markets.

---

#### 3. Proof that no LP/vault contract exists — the greps

```
$ cd /symmio/Vibe-ui
$ grep -rniE "vault|erc4626|lp_?token|lpToken|shares\(|totalAssets|totalSupply" --include="*.ts" --include="*.tsx" src
# → only: ERC20/ERC721/Collateral/REFERRAL ABIs' generic totalSupply,
#   a Vault *icon* (src/components/Icons/v2/Vault.tsx), symmio.sol's
#   insuranceVault / reserveVault entries, and a "My_Trading_Vault" placeholder string.
#   Nothing pool-related.

$ grep -rn "wagmi|useWriteContract|writeContract|useReadContract|readContract|viem|abi" \
        --include="*.ts" --include="*.tsx" src/components/App/Pools
src/components/App/Pools/components/PoolDetail/PoolStatsCard.tsx:13:import { Address } from 'viem'
```

**One hit in the entire 106-file Pools slice, and it is a TypeScript type import.** No contract read, no contract write, no ABI, no signer — except SIWE login (`services/hooks/useListingLogin.ts:12,31` → `useSignMessageV2`), which signs a login message, not a transaction.

```
$ cd /symmio/perps-core   # branch version_0.8.5
$ grep -rhoE "^(abstract )?(contract|interface|library) [A-Za-z0-9_]+" contracts --include="*.sol" \
    | sort -u | grep -iE "lp|vault|pool|share|liquid"
contract PartyALiquidationFacet
contract PartyBLiquidationFacet
contract ConfigurableMockVirtualProvider / MaliciousMockVirtualProvider / VirtualProvider
interface IPartyALiquidationEvents / IPartyALiquidationFacet / IPartyBLiquidationEvents / IPartyBLiquidationFacet / IVirtualProvider
library DeferredLiquidationFacetImpl / LibLiquidation / LibMuonLiquidation / PartyALiquidationFacetImpl / PartyBLiquidationFacetImpl / SharedEvents
```

**No LP, vault, pool, or share contract exists in perps-core.** The only `*Vault*` identifiers are:

- `reserveVault` — `mapping(address => uint256)` in `contracts/core/storages/AccountStorage.sol:194`, a **PartyB emergency reserve** (`contracts/core/facets/PartyBAccount/PartyBAccountFacetImpl.sol:75-93`, `depositToReserveVault` / `withdrawFromReserveVault`), used as an insolvency fallback in force-close (`contracts/core/libraries/LibForceActions.sol:158-163`). Unrelated to LPs.
- `liquidationInsuranceVault` — an address param set by `setLiquidationInsuranceVaultParams` (`contracts/core/facets/Control/ControlFacet.sol:457-467`), receives excess liquidation profit. Unrelated to LPs.

---

#### 4. The LP accounting model (fully custodial)

**User-side ledger** — `GET /v2/profit/{token_contract_address}` (JWT-gated), FE `UserProfitResponse` (`services/types.ts:354-361`). Live schema `LPTokenProfitSchema` has one extra field the FE type omits: **`claimed_reward`**.

| field                                                    | meaning                                        | FE consumer                                                      |
| -------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------- |
| `user_lp_amount` (1e18)                                  | the LP "share balance" — a DB integer          | `PoolWithdrawModal/index.tsx:48`, `BalanceCard.tsx:20`           |
| `pending_withdraw_lp_amount` (1e18)                      | locked subset, _already included_ in the above | `PoolWithdrawModal/index.tsx:49`, `BalanceCard.tsx:21`           |
| `user_balance_in_tokens` / `user_balance_in_usdc` (1e18) | LP's pro-rata claim on the inventory buckets   | `BalanceCard.tsx:18-19`, `WithdrawalDetailModal/index.tsx:45-46` |
| `claimable_reward`                                       | claimable USDC                                 | `claim-rewards-modal/index.tsx:84`                               |
| `claimed_reward`                                         | **exists in API, missing from FE type**        | —                                                                |

The FE computes withdrawal splits by _ratio arithmetic on these DB numbers_ (`PoolWithdrawModal/index.tsx:50-61`) — `availableRatio = (totalLp - pendingLp) / totalLp`, then `user_balance_in_tokens × availableRatio`. That is pure trust in the backend's share math.

**Withdraw** — `POST /v2/market/withdraw`, JWT-only, response schema is literally `{}` (untyped):

```ts
// src/components/App/Pools/components/PoolWithdrawModal/index.tsx:99-115
const withdrawLpAmount = availableLp.times(percentage).div(100).toFixed(0);
mutate({ amount: withdrawLpAmount, market_address: market.token_contract_address, withdraw_address: recipientAddress });
```

`withdraw_address` is **user-typed free text** for Solana markets (`PoolWithdrawModal/index.tsx:70-86` validates format only). No signature over the amount, no on-chain proof, no burn of anything. A valid JWT is the sole authorization.

**Claim** — `POST /v2/claim` (`services/index.tsx:259-261`), rate-limited _"5 requests per 24 hours per user per market"_. Payload (`claim-rewards-modal/index.tsx:83-88`) targets a **SYMMIO subaccount**: `account_address: selectedAccount.accountAddress`. `ClaimProfitResponseSchema` returns `status`, `amount`, `claim_request_id` (uuid) and **`transaction_hash`** — the backend broadcasts the USDC transfer itself. `types.ts:396` comments _"success means USDC was moved to the subaccount; claim is synchronous."_ This is the single moment LP money enters the SYMMIO on-chain system, and it is a custodial payout, not a user transaction.

**Identity keys are DB UUIDs, not addresses.** `GetClaimResponseSchema` fields: `claim_request_id: uuid`, **`wallet_id: uuid`**, **`market_id: uuid`**. `DELETE /v2/market/withdraw/{withdraw_id}` takes `format: uuid`. The system of record is a relational database.

**Revenue split** (from unconsumed schemas): `ClientConfigResponse.protocol_reward_share_percent = 30`, then `RevenueDistributionMetrics { enigma_share, buyback_amount, last_update }`, then `buyback_ratio` (10 on every live market) → LP `reward_*`. Entirely backend-computed.

**Deposit/withdraw records do carry chain proof — the FE just drops it.** API `MarketTransaction` has `transaction_id` and **`transaction_hash`**; FE `ITransactionHistory` (`services/types.ts:379-386`) declares only `wallet_address, usdc_amount, token_amount, type, status, time`. `src/components/App/Pools/utils/explorerUtils.ts` only builds token-contract links and `intent.symmscan.com/position-details/{tenant}/{quoteId}` links — **no transaction-hash explorer link exists anywhere in the pool UI**. Same omission in `src/services/pools/types.ts:25-38` (`UserTransaction` lacks `transaction_hash`, which `UserTransactionItem` returns).

---

#### 5. Live listing-service surface (35 routes) vs. what Vibe-ui consumes

Base URL `APP_POOLS_BACKEND_URL` (`src/constants/misc.ts:23-27`):

```ts
IS_BACKEND_STAGING_ENV
  ? "https://listing-staging.enigma.bz/v2/"
  : IS_TEST_ENVIRONMENT
    ? "https://listing85.enigma.bz/v2/"
    : "https://listing85.enigma.bz/v2/"; // ← test and prod identical
```

**Consumed** (all in `src/components/App/Pools/services/index.tsx` + `src/services/pools/services.ts`): `market/search`, `market/search-user`, `auth/sign-in-message`, `auth/login`, `market/add-market`, `market/deposit-address`, `market/retry-listing`, `market/retry-listing-info`, `market/token-meta-data`, `market/token-support`, `market/transaction-history/{start}/{size}`, `market/withdraw` (POST), `market/weekly-listing-limit`, `market/refund`, `market/user-transactions/{start}/{size}`, `market`, `profit/{addr}`, `claim`.

**Never called by any code in this repo** (verified by per-path grep):

| route                                                                     | what the SDK is missing                                                                                                                                                                                       |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /v2/configs`                                                         | `recommended_initial_deposit_usdc`, `minimum_initial_deposit_usdc`, `listing_fee_usdc`, `supported_deposit_chains[]`, `rate_limits`, `protocol_reward_share_percent` — **all hardcoded or absent in the FE**  |
| `GET /v2/pools`                                                           | batch `market_cap` + APR by address                                                                                                                                                                           |
| `GET /v2/market/metrics`                                                  | `MarketMetrics { balance_changes, profit, revenue_distribution }`                                                                                                                                             |
| `GET /v2/market/user-metrics`                                             | `UserMarketMetrics { earned_profit, total_claimed, pending_withdraw_lp_amount, total_deposit, total_withdraw, balance }`                                                                                      |
| `GET /v2/market/user-shares/{token_contract_address}`                     | `UserShareResponse`                                                                                                                                                                                           |
| `GET /v2/market/chart/rewards`, `GET /v2/profit/chart/rewards`            | **the reward/TVL history the UI ships as a "Coming Soon" `ChartPlaceholder`** (`Docs/Pool_Detail_Page.md:151` "Chart: Start as Coming Soon (no TVL/rewards history endpoints yet)" — the endpoints now exist) |
| `GET /v2/market/total-reward`, `GET /v2/profit/total-reward`              | `TotalRewardSchema`                                                                                                                                                                                           |
| `GET /v2/market/maintenance-fees`                                         | `MaintenanceFeeRecord { token_amount, usdc_amount, timestamp, tx_hash }` — the only place a pool surfaces a real tx hash                                                                                      |
| `GET /v2/market/listing-status`                                           | `MarketListingStatusResponse { current_step, steps[], market_status, error_code, error_detail, retry_count, retry_limit }` — a real listing state machine the UI reimplements from `market_status` alone      |
| `GET/POST /v2/market/config`                                              | per-user market config opinion                                                                                                                                                                                |
| `DELETE /v2/market/withdraw/{withdraw_id}`                                | **cancel a pending withdrawal — the UI has no cancel path at all**                                                                                                                                            |
| `GET /v2/claim/{claim_request_id}`, `GET /v2/claim/search/{start}/{size}` | claim history/restore                                                                                                                                                                                         |
| `POST /v2/auth/nonce`, `GET /v2/auth/me`                                  | SIWE nonce + session check                                                                                                                                                                                    |

Inventory service (`src/components/App/Pools/services/index.tsx:49-56`, base `https://inventory85.enigma.bz/api`, staging `https://inventory-staging.enigma.bz/api`) — the FE calls exactly **one** of its 28 routes: `GET /v1/markets/tvl-aggregate` (`services/index.tsx:203-205`; `useAggregatedTvl.ts` — key `['GetAggregatedTvl']`, staleTime 120 s, refetchInterval 120 s; rendered `GeneralInfo.tsx:39-45` as "Vibecaps TVL", live value `596440816347119643722774` ≈ $596 k). Public and un-keyed alongside it: `GET /api/v1/markets/tvl?addresses=…` (per-market, the exact source of `total_*_in_pool`), `/tvl-aggregate`, `/markets/available`, `/markets/{symbol}/available`, `/markets/funding-rate`, `/markets/{symbol}/tvl-history` — **`tvl-history` is the pool TVL chart the UI stubs out.**

---

#### 6. Flags — dead code, stale types, hardcoded values

1. **`marketSearchItemToStubIMarket.ts:13`** — `// TODO: I think we can remove this function!` Its `main_pool: null` (line 37) is the only write of the field in the codebase.
2. **`MIN_POOL_DEPOSIT_AMOUNT = 5`** (`src/components/App/Pools/constants.ts:4`, rendered by `MinDepositWarning.tsx:19` as _"Minimum deposit amount is $5"_) contradicts live `GET /v2/configs`: `minimum_initial_deposit_usdc = "1500000000000000000.00"` (**$1.5**), `recommended_initial_deposit_usdc = "2000000000000000000"` ($2), `listing_fee_usdc = "1000000000000000000"` ($1). The UI shows a wrong minimum from a constant while the authoritative endpoint goes uncalled.
3. **`WITHDRAWAL_COOLDOWN_DAYS = 14`** (`constants.ts:3`) — no backend field anywhere in the listing OpenAPI corresponds to it. Pure frontend fiction.
4. **`MarketDetailResponse.tvl: string`** (`services/types.ts:329`) is a type lie — the API declares `tvl` nullable and live `Quokka` (`0x289a086583a605c4Af00De3Bf859b70AfC68F991`, Base) returns **`tvl: null`** while still `market_status: "listed"`. `SummaryCards/index.tsx:29` does `fromWei(market.tvl)`; `fromWei` (`src/utils/numbers.ts:46-47`) coerces null → `'0'`, so a listed pool with an unavailable token price silently renders **"$0.00" TVL** instead of "unavailable".
5. **`MarketDetailResponse` is missing 13 live fields**: `maintenance_fees`, `reward_1h`, `reward_6h`, `solver_revenue_1h`, `solver_revenue_6h`, `price_driven_apy_{1h,6h,24h,30d,lifetime}`, `tvl_driven_apy_{1h,6h,24h,30d,lifetime}`, `apy_1h`, `apy_6h`. Note `apy_*` is often `"0"` while `tvl_driven_apy_*`/`price_driven_apy_*` carry the real (signed) numbers — `PoolStatsCard.tsx:26` renders `apy_lifetime` as "Total APY", which is `"0"` on live markets that have non-zero `tvl_driven_apy_lifetime`.
6. **`MarketSearchItem` (`services/types.ts:67-92`) declares `price_usd`, which live `GET /v2/market/search` never returns**, and omits the fields it does return: `market_cap`, `apr_1h`, `apr_6h`, `apr_24h`, `apr_30d`, `apr`, `tvl_driven_apy_*`, `price_driven_apy_*`.
7. **`UserProfitResponse` omits `claimed_reward`**; **`ITransactionHistory` omits `transaction_id` + `transaction_hash`**; **`UserTransaction` omits `transaction_hash`**.
8. **`Docs/Third_Party_Services.md:74`** points the listing service at `https://listing.vibe.trading/docs` — **dead (HTTP 521)**. Correct: `https://listing85.enigma.bz/docs` (+ `/openapi.json`, `/redoc`). `Docs/Pools_Discover_Table_Data_Sources.md:37` has the right host.
9. **`Docs/Pool_Detail_Page.md:35,84-87,141`** describes `usePoolDetail` + `GetMarketDeposits({query, size:1})` + `GetUserDeposit` — none of those exist any more (replaced by `useMarketDetail.ts` → `GET /v2/market`, commit `abd43ede4` "split pool detail into public market and auth-gated user endpoints"). `Docs/Pool_Detail_Page.md:21` still calls TVL / 30D APY / Claimable Rewards "placeholders"; they are live now.
10. **`src/constants/misc.ts:25-27`** — the `IS_TEST_ENVIRONMENT` and production branches of `APP_POOLS_BACKEND_URL` are the **same string**; the ternary is dead.
11. **`useAddUserDeposit.ts:46`** — `console.log('e', e)` left in the error handler; the hook's `status` param (line 18) is accepted and never used.
12. **`useAddUserDeposit.ts:9`** — file is `useAddUserDeposit.ts` but exports `useAddDeposit`.

---

#### 7. Implications for the SDK

- **There is no trustless read path.** `tvl` / `total_usdc_in_pool` / `total_token_in_pool` / `user_lp_amount` have no on-chain counterpart. An SDK must call `GET /v2/market` and `GET /v2/profit/{addr}`, or go one hop upstream to `GET https://inventory85.enigma.bz/api/v1/markets/tvl?addresses=…` (public, unauthenticated, byte-identical output) — which is a _different_ operator's API, not a chain.
- **`main_pool` is still worth exposing**, just not as pool identity: it is a stable handle for price/liquidity/chart data (DexScreener `pairAddress`, an AMM pool readable on Solana or Base). Type it `mainLiquidityPoolAddress?: string` and document that it is a **third-party AMM pair on the token's own chain, possibly base58 (Solana), frequently null**. Do not name it "pool address" — it will be read as the SYMMIO pool.
- **A pool's on-chain identity is `(LOWCAP_DIAMOND_ADDRESS[chain], symbol_id)`** and nothing else. `symbol_id` is null for `waiting_for_deposit` / `under_review` / `rejected` markets — pools exist before they have any on-chain existence at all.
- **Custody risk must be a first-class doc statement.** Deposits go to a backend-generated EOA by manual transfer; withdrawals are JWT-authorized REST calls with a free-text destination address; claims are backend-broadcast transfers. Every LP balance is a database row.
- Model the three-way trust boundary explicitly: **Listing service** (LP shares, per-user) → **Inventory service** (market balance sheet, per-symbol) → **SYMMIO lowcap diamond** (solver PartyB margin, commingled across all markets).

---

## 2. Whose quotes does Open Quotes show — pool side or trader side?

#### ANSWER

**Same book, same side, no inversion.** The "Positions" tab is exactly the per-side aggregation of the rows the "Open Quotes" tab lists. Both are **trader-side (partyA)**: every quote's `partyA` is a trader Virtual Account and `partyB` is always the single Enigma solver. The pool/LP vault is never a party on any of these quotes, so neither tab is "the pool's own positions" — both read as _"traders hold X long against this pool"_, and the pool's own exposure is the mirror image, which **no column on the page states**.

Verified numerically against live mainnet data across 15 symbols: `long_position_amount` == Σ(`quantity` − `closedAmount`) over subgraph quotes with `positionType == 0`, to the wei. Not swapped, not double-counted.

---

#### 1. The query has no party filter — confirmed

`src/apollo/queries.ts:372-427`, the `where` clause is a single line:

```graphql
src/apollo/queries.ts:387
      where: { symbolId: $symbolId, source: $source, quoteStatus_in: $quoteStatuses }
```

No `partyA`, `partyA_in`, `partyB`, `subAccount`, or `subAccount_in`. The selection set _does_ request `partyA` (`queries.ts:394`) and `partyB` (`queries.ts:395`) — see §7 for what happens to them.

`src/components/App/Pools/services/hooks/usePoolQuotes.ts:26`:

```ts
const source = LOWCAP_DIAMOND_ADDRESS[FALLBACK_CHAIN_ID]?.toLowerCase();
```

- `FALLBACK_CHAIN_ID = CHAIN_IDS[0]` (`src/constants/chains.ts:52`), `CHAIN_IDS = [SupportedChainId.HYPEREVM]` (`chains.ts:50`), `HYPEREVM = 999` (`chains.ts:40`).
- `LOWCAP_DIAMOND_ADDRESS[999]` = `0x57331038c21982116EE9b0906E4a5c5cB52dcE2e` (prod) / `0x99641E06d38F327166b3a48f86Ca2cbB3B4fB7EB` (test) — `src/constants/addresses.ts:51-57`.

`source` is the **diamond deployment address**, not a party. Corroborated by the only other caller of a `source`-filtered query: `src/services/quotes/hooks/useQuoteOpenPriceUpdates.ts:14` → `source: diamondContract.address || ''`.

Query mechanics: `queryKey: ['poolQuotes', symbolId, quoteStatuses, first, skip, orderBy, orderDirection]`, `fetchPolicy: 'no-cache'`, `staleTime: 30_000`, `refetchInterval: 60_000`, `enabled: Boolean(symbolId && source)`, default `first = 101` (`usePoolQuotes.ts:21,30-53`). Statuses come from `OPEN_STATUS_NUMBERS = OPEN_QUOTE_STATUS.map(...)` = `[4,5,6]` (OPENED, CLOSE_PENDING, CANCEL_CLOSE_PENDING) — `PoolDetailTabs.tsx:17`, `src/types/quote.ts:17`. Endpoint: `ClientType.ANALYTICS` → `https://api.goldsky.com/api/public/project_cm1hfr4527p0f01u85mz499u8/subgraphs/hyperevm_mainnet_analytics/latest/gn` (`src/apollo/client/apolloClients.ts:14-15`).

---

#### 2. Live proof: one partyB, 95 distinct partyAs

Ran the exact `POOL_QUOTES_BY_SYMBOL_AND_SOURCE` predicate against the live analytics subgraph (`where: {source: "0x5733…ce2e", quoteStatus_in:[4,5,6]}`, paged to exhaustion):

```
total open quotes on lowcap diamond: 251
partyB distribution: {'0x76bc5889c0cfcc20960b0d81f541595d81a95122': 251}   <-- 100% one address
distinct partyA count: 95
symbolId=1 (SYMM) alone: 74 distinct partyA, top holder 22 quotes
```

`0x76bc5889c0cfcC20960b0D81F541595d81a95122` is literally `HEDGER_DATA_MAP[HedgerType.ENIGMA].partyBAddress` in `src/constants/hedgers.ts:91-93`. So **every** row on the Open Quotes tab is `some trader VA → Enigma solver`. 196 of the SYMM long rows belong to 74 different people; the tab renders them as 196 anonymous "Long" rows.

The listing service's `main_pool` field is a **DEX pair address** (Uniswap/Meteora), not a SYMMIO party — checked all 15 markets, zero of them appear in the partyA set (e.g. SYMM `main_pool = 0x3eB2a8015dE1419a5089dAb37b0056F0fc24f821`, CARDS `main_pool = HnhpJPJgBG2KwniMTNW8cVBHvk1hFog3RC3kjnyc23tD`).

---

#### 3. The two tabs are the same book, same side — exact match

`PoolPositionsTable.tsx:34-60` builds 2 rows from `market.long_position_amount` / `short_position_amount` (REST `GET /market`, §6). `PoolOpenQuotesTable.tsx:76-78` renders per-quote `positionType` and `quantity − closedAmount`.

Aggregating the subgraph set by `positionType` and comparing to the live REST payload for the same symbol:

| symbolId | ticker    | subgraph Σ(qty−closed) pt=0 | REST `long_position_amount`     | subgraph Σ pt=1      | REST `short_position_amount` |
| -------- | --------- | --------------------------- | ------------------------------- | -------------------- | ---------------------------- |
| 1        | SYMM      | 7748327.735135 (n=196)      | **7748327.735135**              | 857523.370182 (n=26) | **857523.370182**            |
| 8        | VVV       | 7.120680 (n=2)              | **7.120680**                    | 6.090970 (n=1)       | **6.090970**                 |
| 118      | CARDS     | 6285.624830 (n=1)           | **6285.624830**                 | 0                    | **0**                        |
| 137      | ADS       | 0                           | **0**                           | 537.695100 (n=2)     | **537.695100**               |
| 30       | TRUMP     | 66.923400 (n=3)             | **66.923400**                   | 0                    | **0**                        |
| 168      | SUEDE     | 581669.302998 (n=5)         | **581669.302998**               | 0                    | **0**                        |
| 189      | ANSEM     | 329.372603 (n=4)            | **329.372603**                  | 0                    | **0**                        |
| 68       | GNS       | 0                           | **0**                           | 32.212746 (n=1)      | **32.212746**                |
| 138      | PSG       | 0                           | **0**                           | 10.239019 (n=2)      | **10.239019**                |
| 188      | SPAIN     | 0                           | **0**                           | 24.408622 (n=2)      | **24.408622**                |
| 146      | DEAD      | 8787.238537 (n=1)           | **8787.238537**                 | 0                    | **0**                        |
| 166      | RIVERBOAT | 1800.099900 (n=1)           | **1800.099900**                 | 0                    | **0**                        |
| 4        | $WIF      | 2.007231 (n=1)              | **2.007231**                    | 0                    | **0**                        |
| 109      | SPACEX    | 0                           | **0**                           | 0.000205 (n=1)       | **0.000205**                 |
| 22       | ASTER     | 476.312404 (n=2)            | **476.312403** (1 wei rounding) | 0                    | **0**                        |

Note the asymmetric cases (ADS, GNS, PSG, SPAIN, SPACEX: long=0, short>0): if the REST were the _pool's_ side it would be the exact opposite bucket. It isn't. **Not inverted.**

`positionType` index → side: `getPositionTypeByIndex` (`src/utils/quote.ts:273-275`) maps by enum key order over `enum PositionType { LONG, SHORT }` (`src/types/trade.ts:29-32`), so **0 = LONG, 1 = SHORT**.

---

#### 4. On-chain corroboration

`getPartyBAggregatedPositionBySymbol(partyB, symbolId)` (ABI at `src/constants/abi/symmio.ts:631-679`, returns `longPosition`/`shortPosition` as `{uint8 positionType, uint256 aggregatedOpenAmount, uint256 avgOpenPrice}`), called on the lowcap diamond `0x5733…ce2e` with `partyB = 0x76bc…5122` via HyperEVM RPC:

```
sid=1   LONG{type:0 amt:7748327.735135     avgPx:0.011290640363902291} SHORT{type:1 amt:857523.370182 avgPx:0.0091922253015868}
sid=8   LONG{type:0 amt:7.12068            avgPx:16.630716348570587}   SHORT{type:1 amt:6.09097       avgPx:16.558680901728298}
sid=118 LONG{type:0 amt:6285.62483         avgPx:0.21036827684810047}  SHORT{type:1 amt:0             avgPx:0}
sid=137 LONG{type:0 amt:0                  avgPx:0}                    SHORT{type:1 amt:537.6951      avgPx:0.377913256399096}
sid=166 LONG{type:0 amt:1800.0999          avgPx:0.001001174772785089} SHORT{type:1 amt:0             avgPx:0}
```

Two conclusions:

1. The contract's **PartyB-scoped** aggregate is keyed by the **quote's** `positionType` (i.e. partyA's direction) and is **not flipped** for partyB. `longPosition` for the solver holds the trader-long quotes. Anyone porting this must not assume "partyB view ⇒ inverted".
2. On-chain `aggregatedOpenAmount` == subgraph Σ == REST `*_position_amount`. All three agree on **size and side**.

---

#### 5. The uPnL sign convention is the TRADER's — and it's painted green on the pool's page

REST `*_upnl` obeys `long_upnl = (mark − entry) × amount` and `short_upnl = (entry − mark) × amount`. Proven two ways:

**(a) both rows imply the same mark.** SYMM: from the long row `0.0078185175 + 17831.5498/7748327.735 = 0.0101199`; from the short row `0.0095809872 + 462.0953/857523.370 = 0.0101199`. VVV: `16.745635` vs `16.745638`.

**(b) the implied mark matches the live price service** (`https://lowcap-price.enigma.bz/api/v1/metadata`, `PRICE_SERVICE_METADATA_ENDPOINT` at `src/services/price-service/constants.ts:22`):

| symbol           | implied mark from REST row | live `price_usd` |
| ---------------- | -------------------------- | ---------------- |
| ASTER (long)     | 0.6976797                  | 0.6976           |
| TRUMP (long)     | 2.6807                     | 2.68             |
| RIVERBOAT (long) | 0.00011221                 | 0.0001122        |
| SPAIN (short)    | 0.1981669                  | 0.1981           |
| SYMM (both)      | 0.0101199                  | 0.01015          |
| GNS (short)      | 0.5508499                  | 0.5515           |
| SPACEX (short)   | 501.26                     | 501.81           |

So the "UPNL" column is **the traders' unrealized PnL**, and `PoolPositionsTable.tsx:126-129` colors it:

```tsx
className={cn(`primary-body-1-semibold text-main-light-blue`, {
  'text-main-pink': Number(item.upnl) < 0,
})}
```

Positive → blue/"good". On a page whose entire purpose is the LP pool, a positive number there is the LPs' **loss**. Same trap in the Trade History tab, `PoolTradeHistoryTable.tsx:132-133`:

```tsx
const pnl = isLong ? (closePrice - openPrice) * qty : (openPrice - closePrice) * qty;
const pnlColor = pnl >= 0 ? "text-main-light-blue" : "text-main-pink";
```

Trader-side realized PnL, green when the trader won.

---

#### 6. Where the two tabs genuinely DISAGREE: price and value (a second, separate defect)

Sizes reconcile perfectly; **prices do not**. `long_position_avg_open_price` from REST is _not_ the on-chain/subgraph `avgOpenPrice`:

| symbolId      | side  | on-chain `avgOpenPrice` | REST `*_avg_open_price` | Δ in USD over the book     |
| ------------- | ----- | ----------------------- | ----------------------- | -------------------------- |
| 1 SYMM        | long  | 0.011290640363902291    | 0.007818517485517458    | **26,903.15**              |
| 1 SYMM        | short | 0.0091922253015868      | 0.009580987216399005    | −333.37                    |
| 166 RIVERBOAT | long  | 0.001001174772785089    | 0.000123048323319296    | 1.58 (88% of a $1.80 book) |
| 146 DEAD      | long  | 0.000471045253306389    | 0.000355714844879245    | 1.01                       |
| 168 SUEDE     | long  | 0.000270595272064123    | 0.000232726238694511    | 22.03                      |
| 30 TRUMP      | long  | 2.9041949942743965      | 2.6653658963835296      | 15.98                      |
| 137 ADS       | short | 0.377913256399096       | 0.3968192230677667      | −10.17                     |
| 22 ASTER      | long  | 0.6528583726075909      | 0.6763292397819946      | −11.18                     |
| 189 ANSEM     | long  | 0.22795497352319544     | 0.2305604299133207      | −0.86                      |
| 118 CARDS     | long  | 0.21036827684810047     | 0.20963760634171386     | 4.59                       |

Direction is overwhelmingly (but not universally — ASTER and ANSEM invert) _in favor of the reported position_: all 7 shorts get a higher entry, 8 of 10 longs get a lower entry. It looks like an accrued-funding / cost-basis adjustment applied by the listing backend, but I could not confirm it: `getPartyBAggregatedFunding(partyB, symbolId, positionType)` returns `0` for every symbol, and `getPartyBAggregateFundingDebt` **reverts with `Diamond: Function does not exist`** on the deployed lowcap diamond. **Unexplained — flag it.**

Consequences on screen for one live symbol (SYMM, symbolId 1):

- **Positions tab** "Entry Price" = `0.0078185` (`PoolPositionsTable.tsx:43` ← `market.long_position_avg_open_price`); "Position Value" = `60,580.44` = amount × that entry (`PoolPositionsTable.tsx:42`, entry-notional).
- **Open Quotes tab** "Open Price" = raw `item.openedPrice`, weighted `0.011291` (`PoolOpenQuotesTable.tsx:79` `const price = toBN(item.openedPrice).toNumber()`); "Position Size (Value)" = `qty × liveMarkPrice` ≈ `78,646` (`PoolOpenQuotesTable.tsx:80-82`, **mark**-notional, falls back to open price only when mark is 0).

Same book, two entry prices ~44% apart and two "value" definitions. Aggregating the Open Quotes rows will never reproduce the Positions row.

Both tabs pull mark from `usePrice({ id: market.symbol_id, preferredHedgerType: HedgerType.ENIGMA })` (`PoolOpenQuotesTable.tsx:32`, `PoolPositionsTable.tsx:31`) — but the Positions row's mark is _implicit_ inside a backend-computed `upnl`, so the two tabs' marks can also be from different instants.

---

#### 7. Fields fetched and thrown away

`toQuoteFromGraph` (`src/apollo/service.ts:140-179`) already normalizes the counterparty:

```ts
src/apollo/service.ts:160-162
    partyA: entity.partyA ? getAddress(entity.partyA) : '',
    partyB: entity.partyB ? getAddress(entity.partyB) : '',
    subAccount: entity.subAccount?.address ? getAddress(entity.subAccount.address) : undefined,
```

(`subAccount` is always `undefined` here — `POOL_QUOTES_BY_SYMBOL_AND_SOURCE` does not select `subAccount { address }`, unlike `POOL_QUOTE_EVENTS_BY_SYMBOL_AND_SOURCE` at `queries.ts:459-461`.)

`grep -rn "partyA\|partyB\|subAccount" src/components/App/Pools/` returns **zero hits**. Nothing under the Pools slice ever renders a counterparty. The Open Quotes columns are exactly `type / timestamp / quantity / entryPrice / markPrice` (`PoolOpenQuotesTable.tsx:38-51`), so there is no signal that 196 rows are 74 different people rather than one pool book.

---

#### 8. Git history confirms the intent was "same side, aggregated"

Before commit `83039ca28` ("feat: add postions data", arielinn, 2026-03-15), `PoolPositionsTable` built its two rows **from these very subgraph quotes**:

```ts
// removed by 83039ca28
// TODO: It should read from "solver new endpoint"
const { quotes, isLoading } = { quotes: [], isLoading: false } as { quotes: SubGraphData[]; isLoading: boolean };
const longs = quotes.filter((q) => q.positionType === 1);
const shorts = quotes.filter((q) => q.positionType === 2);
```

That commit replaced the aggregation with `tokenProfit.long_position_amount` / `short_position_amount` (later renamed to `MarketDetailResponse`). So the REST fields were adopted as a **drop-in replacement for bucketing these quotes by `positionType`** — which the live data confirms they are. (Note the old filter used `1`/`2` while the enum is 0-indexed — dead by the time it was replaced, since `quotes` was hardcoded `[]`.)

`Docs/Pool_Detail_Page.md:25-28` states the same design: Positions = "Aggregated long/short positions (quoteStatus=4)", Trade History = "**pool-wide, not user-specific**".

---

#### 9. Other flags found while tracing

- **`source` filter is a no-op today.** `quotes(where: {source_not: "0x5733…ce2e"})` on the HyperEVM analytics subgraph returns `[]` — that subgraph indexes only the lowcap diamond. The effective filter is `symbolId` + `quoteStatus_in`.
- **Hard 101-row ceiling.** `first = 101` (`usePoolQuotes.ts:21`), pagination is client-side over that array (`PoolOpenQuotesTable.tsx:56-59`), and `formatCount` prints `+100` for anything >100 (`PoolDetailTabs.tsx:33-36`). SYMM has 222 open quotes; the tab shows at most 101 and a badge reading `+100`.
- **"Open Time" is not the open time.** `PoolOpenQuotesTable.tsx:99` renders `item.statusModifyTimestamp`, which `toQuoteFromGraph` sets from `entity.timestamp` (last status modification, `service.ts:165`). `createTimestamp` (from `timestampSendQuote`, `service.ts:166`) is fetched but unused.
- **Stale non-zero prices on empty sides.** REST returns a non-zero `*_avg_open_price` for sides with zero amount (e.g. sid=118 `short_position_avg_open_price = 0.18514`, sid=137 `long_position_avg_open_price = 0.41408`, sid=4 `short = 0.13708`). Only masked because the UI gates on `size > 0` (`PoolPositionsTable.tsx:38,49`). Any consumer that doesn't gate will render a phantom row.
- **Dead code:** `src/components/App/Pools/components/PoolDetail/tables/PoolOpenOrdersTable.tsx` is never imported (`grep -rn "PoolOpenOrdersTable" src` → only its own definition). The "Limit Orders" tab renders a hardcoded "Coming Soon" block with `count: 0` (`PoolDetailTabs.tsx:106, 129-138`). Its only dependency `useOpenOrders` (`services/hooks/useOpenOrders.ts:5`) is therefore also dead.
- **Commented-out columns:** `PoolOpenQuotesTable.tsx:45-48,137-140` (UPNL/Liq.Price/Margin/Funding) and `PoolPositionsTable.tsx:70-72,144-146` (Liq.Price/Margin/Funding) are shipped as a `ComingSoonColumnsPanel` overlay instead.
- **Trade History has the same no-party-filter shape.** `usePoolHistoryQuotes.ts:27` uses the same `source`, and `queries.ts:444` filters `where: { type_in: $typeIn, quote_: { symbolId: $symbolId, source: $source } }` — also every trader.

---

#### Recommendation for the SDK port

Anything modeling this must carry an explicit perspective flag. The natural core shape is `{ symbolId, side: 'LONG' | 'SHORT', perspective: 'PARTY_A' }` where `PARTY_A` = trader; the pool/LP view is `-1 ×` size, `-1 ×` uPnL, and `LONG ↔ SHORT` swapped. Do **not** infer the flip from "we asked for partyB's aggregate" — §4 proves the contract's own partyB view is still keyed by partyA's `positionType`. And do not treat `*_position_avg_open_price` / `*_position_value` as reconcilable with per-quote `openedPrice`; they are a different, currently unexplained basis (§6).

---

## 3. Deposit chain vs trading chain: how deposits become pool liquidity

I have everything needed. Writing the answer.

### GAP-FILL 3 — `DepositChain` vs HyperEVM: how deposits become pool liquidity

#### Short answer

**There is no bridge leg, and `deposit_chain` is not a collateral-routing hint. The premise of the question contains a false equivalence: the "deposit" in the Pools slice is not a USDC collateral deposit at all — it is a deposit of _the lowcap token itself_, sent to a backend-custodied address on the token's own home chain.**

`deposit_chain` is **the chain the listed token's contract lives on** (its spot-DEX chain), used as (a) half of the market's composite primary key, (b) the chain for token-metadata/price lookups, (c) the address-format for refunds/withdrawals, and (d) a block-explorer link key. It never touches the trading chain, and it is never bridged.

The `DepositChain → CCTPDomain` map in `explorerUtils.ts` is **not** evidence of a CCTP path — it exists solely because `SCANNER_URLS` happens to be keyed by CCTP domain numbers. I have the commit that introduced it, and it says so.

The crossing from "pool value" to "HyperEVM subaccount" happens **entirely inside the Enigma listing backend** — surfaced to the frontend as `POST /claim`, a plain authenticated REST call with no transaction, no signature, and no bridge.

`Docs/Pool_Detail_Page.md:150` is **stale** (it was accurate on 2026-02-07 and was invalidated on 2026-03-17); `Docs/Third_Party_Services.md:20` is **correct**. `LOWCAP_DIAMOND_ADDRESS[BASE]` serves **no** live pools and is unreachable at runtime.

---

#### 1. The two unrelated things both called "deposit"

|           | **Pool listing deposit** (the `DepositChain` one)        | **Trader collateral deposit**                                                    |
| --------- | -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Asset     | The lowcap token (`SHIB`, a Solana memecoin, …)          | USDC                                                                             |
| Chain     | `deposit_chain` — Solana / Base / BSC / Sonic / Arbitrum | HyperEVM 999 only                                                                |
| Mechanism | Send to a custodial address from a QR code               | ERC-20 `approve` + on-chain deposit                                              |
| Code      | `src/components/App/Pools/**`                            | `src/components/ReviewModal/DepositModal/**`, `src/components/DepositAAModal/**` |
| Uses CCTP | No                                                       | Yes (legacy; now superseded)                                                     |

The two never meet. `apps`-level proof that the pools deposit is the **token**, not collateral:

- `src/components/App/Pools/components/CreatePool/components/Review.tsx:85` — `{t('Only deposit {{tokenTicker}} to this address.', { tokenTicker: addMarketResponse?.token_ticker })}`
- `src/components/App/Pools/components/ListingDepositModal/index.tsx:82` — `{t('Only deposit {{tokenName}} to this address.', { tokenName })}`

Neither says USDC. `MinDepositWarning` (`src/components/App/Pools/components/MinDepositWarning.tsx:19`) states the floor in **USD value** — `MIN_POOL_DEPOSIT_AMOUNT = 5` (`src/components/App/Pools/constants.ts:4`) — not in USDC units.

---

#### 2. `deposit_chain` == the token's home chain

`src/components/App/Pools/types.ts:73-79`:

```ts
export enum DepositChain {
  Solana = 0,
  Base = 8453,
  BSC = 56,
  ARBITRUM_ONE = 42161,
  SONIC = 146,
}
```

Note `Solana = 0` — a sentinel, not a chain id. This is a **token-venue enum**, not an EVM chain-id set.

Five independent uses, all consistent with "the token's home chain", none with "where collateral is custodied for trading":

**(a) Token support + metadata lookup are keyed by it.** `src/components/App/Pools/services/index.tsx:195-197` and `:189-193`:

```ts
return api.get<string>(`/market/token-support?contract_address=${contract_address}&chain=${chain}`);
return api.get<GetTokenMetaDataResponse>(`/market/token-meta-data?contract_address=${contract_address}&chain=${chain}`);
```

Driven from the create-pool form at `src/components/App/Pools/components/CreatePool/components/TokenBasics.tsx:41-44` (`useTokenValidate({ tokenAddress: debouncedToken, chain: DepositChain })`). You cannot ask "does this token exist / what are its decimals" on a chain the token doesn't live on.

**(b) It is half the market's composite primary key.** `GetMarketDetail` (`services/index.tsx:220-230`) → `GET /market?token_contract_address=…&deposit_chain=…`. Same for `RetryMarketPayload`, `RetryListingInfoPayload`, `AddDepositPayload`, `AddMarketPayload`, `ClaimProfitRequest` (`services/types.ts:119, 128, 161, 188, 391`). The same contract address on two chains is two different markets.

**(c) It selects the DexScreener spot-price venue.** `src/components/App/Pools/components/PoolDetail/PoolStatsCard.tsx:35-44`:

```ts
chainName: DEPOSIT_CHAIN_OPTIONS.find((chain) => chain.value === market.deposit_chain)?.label ?? '',
```

lower-cased into a DexScreener chain slug at `src/services/dexscreener/hooks/useDexscreenerTokenDetails.ts:19`. That is definitionally the chain whose AMM pool prices the token.

**(d) It dictates the _address format_ for payouts.** `src/components/App/Pools/components/PoolWithdrawModal/index.tsx:69-86`:

```ts
const isSolanaMarket = market?.deposit_chain === DepositChain.Solana
…
if (isSolanaMarket) {
  return isSolanaAddress(recipientAddress) ? null : t('Enter a valid Solana address.')
}
try { getAddress(recipientAddress); return null } catch { return t('Enter a valid EVM address.') }
```

A Solana-market LP must supply a **Solana** payout address. If liquidity had been bridged to HyperEVM, a Solana address would be meaningless.

**(e) Refunds go back on the same chain.** `src/components/ReviewModal/RefundYourDepositModal/RefundYourDepositModal.tsx:79`:

```
{t('Enter a refund address on the same chain as your deposit')}
```

---

#### 3. The actual deposit mechanism: a custodial address behind a QR code

`AddDeposit` — `src/components/App/Pools/services/index.tsx:170-177`:

```ts
export async function AddDeposit({ payload }: { payload: AddDepositPayload }) {
  const { token_contract_address, deposit_chain } = payload;
  return api.post<AddDepositResponse>(`/market/deposit-address`, {
    token_contract_address,
    deposit_chain,
  });
}
```

|                |                                                                                                                                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Method / URL   | `POST {APP_POOLS_BACKEND_URL}market/deposit-address`                                                                                                                                                 |
| Base URL const | `APP_POOLS_BACKEND_URL`, `src/constants/misc.ts:23-27` → staging `https://listing-staging.enigma.bz/v2/`, else `https://listing85.enigma.bz/v2/` (test and prod branches are **identical** — see §8) |
| Auth           | `Authorization: Bearer <listingAccessTokens[account]>`, injected by the axios request interceptor `services/index.tsx:62-77`; 401 clears the token (`:79-93`)                                        |
| Request        | `AddDepositPayload { token_contract_address: string; deposit_chain: number }` (`services/types.ts:186-189`)                                                                                          |
| Response       | `AddDepositResponse { token_contract_address, user_address, deposit_chain, wallet_public_key, token_decimal, market_status }` (`services/types.ts:191-198`)                                          |
| React-Query    | `useMutation` only, no key (`services/hooks/useAddUserDeposit.ts:24-31`)                                                                                                                             |

`wallet_public_key` is the payload. On success (`useAddUserDeposit.ts:32-44`) it is pushed into the application store and rendered as a **QR code plus copyable address** by `ListingDepositModal/index.tsx:28-58, 84-105`, with the chain logo embedded in the QR (`:48`). The user then leaves the app, sends tokens from their own wallet/exchange, comes back and presses "Confirm Deposit" (`:110-120`), whose entire behavior is `refetchPoolsData?.(); toggleDepositModal()`. Caption at `:122`:

> `Click after sending your tokens. We will verify your deposit and begin the 24h review process.`

The pool-creation path is the same shape: `AddMarketResponse.wallet_public_key` (`services/types.ts:177`) → QR in `Review.tsx:30-60`.

**This is a centralized-exchange-style custodial deposit.** There is no on-chain interaction the frontend can observe, which is why nothing downstream carries a tx hash (§5).

---

#### 4. Where "liquidity" lives, and what the pool actually holds

`MarketDetailResponse` (`services/types.ts:313-351`) carries **both** sides:

```ts
total_usdc_in_pool: string;
total_token_in_pool: string;
```

composed into a two-sided balance bar at `src/components/App/Pools/components/PoolDetail/pool-stats.ts:35-45` (`tokenValue = tokenBalance × dexscreenerPrice`, `totalPoolValue = tokenValue + usdcBalance`).

The LP's position is an off-chain **LP-token ledger balance**, not an on-chain balance — `UserProfitResponse` (`services/types.ts:354-361`):

```ts
user_balance_in_tokens: string; // 1e18
user_balance_in_usdc: string; // 1e18
claimable_reward: string;
user_deposited_token_amount: string;
user_lp_amount: string; // 1e18
pending_withdraw_lp_amount: string; // 1e18, already included in user_lp_amount but locked
```

Withdrawal is denominated in **LP wei** (`WithdrawRequest.amount`, `services/types.ts:364-369`) and computed client-side at `PoolWithdrawModal/index.tsx:101`.

The tradable side lives on HyperEVM and is reached **only** through `symbol_id`:

- `usePoolQuotes.ts:26,31` — `source = LOWCAP_DIAMOND_ADDRESS[FALLBACK_CHAIN_ID]`, `getApolloClient(FALLBACK_CHAIN_ID, ClientType.ANALYTICS)` → `hyperevm_mainnet_analytics` (`src/apollo/client/apolloClients.ts:14-15`). Query `POOL_QUOTES_BY_SYMBOL_AND_SOURCE`, vars `{ symbolId, source, quoteStatuses, first, skip, orderBy, orderDirection }`, `fetchPolicy: 'no-cache'`, `staleTime: 30_000`, `refetchInterval: 60_000`, `enabled: Boolean(symbolId && source)`.
- `usePoolHistoryQuotes.ts:27,32` — identical, query `POOL_QUOTE_EVENTS_BY_SYMBOL_AND_SOURCE`.
- Notional cap / OI: `PoolStatsCard.tsx:28-32` → `useNotionalCap({ hedgerType: HedgerType.ENIGMA, marketId: market.symbol_id, isLowcap: true })`; Enigma is pinned `chainId: SupportedChainId.HYPEREVM` at `src/constants/hedgers.ts:84`.
- Hand-off to trading: `PoolsTable/components/TradeButton.tsx:79` → `routes.vibecaps.symbolId(symbolId.toString())`. **`deposit_chain` is dropped entirely.**
- Gate: `canTradeMarket` (`utils/canTradeMarket.ts:3-5`) = `status === Listed && symbolId != null`.

So the join between the deposit chain and HyperEVM is **`symbol_id`, assigned by the backend during the 24h review**. That is the whole bridge: an integer.

---

#### 5. The claim path — the only pool → HyperEVM crossing, and it is off-chain

`services/index.tsx:259-261`: `POST /claim` with `ClaimProfitRequest` (`services/types.ts:389-394`):

```ts
{
  (token_contract_address, deposit_chain, account_address, amount);
}
```

`account_address` is a **HyperEVM SYMMIO subaccount**, chosen from `useUserAccounts()` (`claim-rewards-modal/index.tsx:32, 87`), which reads `getUserSubAccounts` off the AccountLayer on the connected chain (`src/services/blockchain/hooks/useUserAccounts.ts:22-23`) and types rows by comparing `symmioCore` against `LOWCAP_DIAMOND_ADDRESS[chainId]` (`:35-41`).

The response type carries the explicit comment (`services/types.ts:396`):

```ts
/** POST /v2/claim — success means USDC was moved to the subaccount; claim is synchronous. */
export interface ClaimProfitResponse {
  status: string;
  amount: string;
  claim_request_id: string;
}
```

**"USDC was moved to the subaccount" is performed by the backend.** The frontend does `mutateAsync` and invalidates `['userProfit', contractAddress]` (`claim-rewards-modal/index.tsx:91-93`). No transaction, no wallet prompt, no receipt wait. `useClaimProfit` is 10 lines (`services/hooks/useClaimProfit.ts`).

Symmetrically, `POST /market/withdraw` (`services/index.tsx:251-253`) takes **no chain parameter at all** and returns nothing but a toast (`services/hooks/usePoolWithdraw.ts:24-38`), with a 14-day cooldown (`constants.ts:3`, rendered `PoolWithdrawModal/index.tsx:321-326`).

And the deposit/withdraw ledger has **no tx hash and no chain id** — `ITransactionHistory` (`services/types.ts:379-386`):

```ts
{
  (wallet_address, usdc_amount, token_amount, type, status, time);
}
```

rendered by `PoolDetail/tables/TransactionRow.tsx:14-48` — action, amount, date, status. If any of this were on-chain, there would be a hash to link.

---

#### 6. Negative proof: no bridge exists in the pools slice

Greps I ran, verbatim results:

```
$ grep -rniE "bridge|burn|attestation|iris-api|messenger|transmitter" \
    src/components/App/Pools/ src/services/pools/
(no output)

$ grep -rniE "usewritecontract|writecontract|sendtransaction|useaccount\(|usechainid" \
    src/components/App/Pools/ src/services/pools/
(no output)

$ grep -rl "wagmi" src/components/App/Pools src/services/pools
(no output)

$ grep -rl "abi" src/components/App/Pools src/services/pools
(no output)

$ grep -rni "cctp" src/components/App/Pools/
src/components/App/Pools/utils/explorerUtils.ts:3,8,9,10,11   ← only file
```

The Pools slice performs **exactly one** signature operation in its entire surface, and it is SIWE login, not a transaction — `src/components/App/Pools/services/hooks/useListingLogin.ts:12,31` (`useSignMessageV2` → `signMessageCallback(message)`), feeding `POST /auth/login` (`services/index.tsx:162-164`) against the SIWE challenge from `GET /auth/sign-in-message?address=&domain=&uri=` (`:156-160`).

The only `viem` import in the whole slice is a bare `Address` type (`PoolDetail/PoolStatsCard.tsx:13`).

---

#### 7. The `DepositChain → CCTPDomain` map is a block-explorer artifact — proven by its own commit

`src/components/App/Pools/utils/explorerUtils.ts:6-13`:

```ts
// Map a pool deposit chain to the corresponding SCANNER_URLS key.
const DEPOSIT_CHAIN_TO_SCANNER_KEY: Record<number, number> = {
  [DepositChain.Solana]: CCTPDomain.Solana,
  [DepositChain.Base]: CCTPDomain.Base,
  [DepositChain.ARBITRUM_ONE]: CCTPDomain.Arbitrum,
  [DepositChain.SONIC]: CCTPDomain.Sonic,
  [DepositChain.BSC]: SupportedChainId.BSC,
};
export const getTokenExplorerUrl = (chain, address) => {
  const base = SCANNER_URLS[DEPOSIT_CHAIN_TO_SCANNER_KEY[chain]];
  if (!base) return null;
  return `${base}/token/${address}`;
};
```

The reason is mundane: **`SCANNER_URLS` is itself keyed by CCTP domain numbers**, `src/constants/addresses.ts:144-155`:

```ts
export const SCANNER_URLS: { [chainId: number]: string } = {
  [CCTPDomain.Ethereum]: 'https://etherscan.io',
  [CCTPDomain.Arbitrum]: 'https://arbiscan.io',
  …
  [SupportedChainId.BSC]: 'https://bscscan.com',   // BSC is not a CCTP domain, so it falls back to a chain id
}
```

The `DepositChain.BSC` entry breaking the pattern is the tell — a genuine CCTP routing table could not contain BSC at all.

Git confirms intent. `git log --all -S 'CCTPDomain' -- src/components/App/Pools/` returns exactly two commits, and the introducing one is:

```
9ad794df5  2026-04-07  fix(pools): reuse SCANNER_URLS and build share url from routes helper
```

whose diff adds `import { SCANNER_URLS } from '@/constants/addresses'`, `import { CCTPDomain } from '@/types/cctps'`, the comment `// Map a pool deposit chain to the corresponding SCANNER_URLS key.`, and the lookup. Its stated purpose is literally "reuse SCANNER_URLS".

The sole consumer is a token link in the page header — `PoolDetail/PoolDetailHeader.tsx:35`:

```ts
const explorerUrl = getTokenExplorerUrl(market.deposit_chain, market.token_contract_address);
```

The file's _other_ export carries a comment explicitly disclaiming the deposit chain — `explorerUtils.ts:22-23`:

```
// Symmio intent explorer. Keyed by the chain a quote was settled on — i.e. the
// chain whose subgraph the quote was fetched from, not the pool's deposit chain.
```

`getSymmioPositionUrl(chain, quoteId)` → `https://intent.symmscan.com/position-details/{tenant}/{quoteId}`, tenant from `SYMMIO_EXPLORER_TENANT_BY_CHAIN` (`:26-32`). Its only call site passes `chainId` from `usePoolHistoryQuotes`, i.e. `FALLBACK_CHAIN_ID = 999 → 'HYPEREVM'` (`PoolTradeHistoryTable.tsx:134`; `usePoolHistoryQuotes.ts:76`).

**A CCTP path is not even implied — the same file explicitly separates the two chain concepts.**

---

#### 8. CCTP structurally _cannot_ serve this, even in principle

`src/types/cctps.ts:8-18`:

```ts
export enum CCTPDomain {
  Ethereum = 0,
  Avalanche = 1,
  Optimism = 2,
  Arbitrum = 3,
  Solana = 5,
  Base = 6,
  Polygon = 7,
  Unichain = 10,
  Sonic = 13,
}
```

- **No HyperEVM domain.** CCTP has no destination on the trading chain. Confirmed against `defaultConfigs.networks` (`src/constants/cctp.ts:60-135`) — nine entries, none HyperEVM.
- **No BSC domain**, yet `DepositChain.BSC` is a first-class pool option (`Pools/constants.ts:9`). The `DepositChain` set is _not_ a subset of the CCTP set.
- CCTP moves **USDC only**. Pool deposits are arbitrary lowcap tokens (`Review.tsx:85`).

The live CCTP entrypoint is `useTransferUSDC` (`src/hooks/cctp/UseCCTP.ts`), used by `DepositActionButton.tsx`, `ClaimMintUsdcButton.tsx`, `WithdrawCctpButton.tsx`, `ProcessInstantWithdraw.tsx`, `CCTPTransactionChecker.tsx` — **none** in the pools tree. Its destination is hard-coded `destinationDomain: CCTPDomain.Base` (`src/components/DepositAAModal/components/DepositActionButton.tsx:176`; fee quote `:142` and `WalletDepositComponent.tsx:76-79`) — i.e. the whole CCTP subsystem still targets **Base**, and is now overridden in the UI by `HyperEvmDepositNotice` (`src/components/HyperEvmDepositNotice/HyperEvmDepositNotice.tsx:39`):

> `Deposit USDC on <network>{{chainName}}</network>. Other networks aren't supported yet.`

with `chainName = getChainInfo(FALLBACK_CHAIN_ID)` = HyperEVM (`:6`). The live trader deposit is same-chain: approve `LOWCAP_DIAMOND_ADDRESS[chainId ?? FALLBACK_CHAIN_ID]` then `useTransferCollateral(…, TransferTab.DEPOSIT, …)` (`src/components/ReviewModal/DepositModal/components/ActionButton.tsx:67-92`).

---

#### 9. Docs: `Pool_Detail_Page.md` is stale; `Third_Party_Services.md` is correct

**Correct:** `Docs/Third_Party_Services.md:20` — "Enigma is the hedger for **VibeCaps** (low-cap) markets on HyperEVM." Matches `src/constants/hedgers.ts:84` (`chainId: SupportedChainId.HYPEREVM`).

**Stale:** `Docs/Pool_Detail_Page.md:123` and `:150`:

> `IMarket.symmio_symbol_id (symbolId) + LOWCAP_DIAMOND_ADDRESS[BASE] (source)`
> `3. **Subgraph source**: Use `LOWCAP_DIAMOND_ADDRESS[BASE]`as`source` param since VibeCaps pools use the lowcap diamond`

It was accurate when written. `git show d35bc9d7c:src/components/App/Pools/services/hooks/usePoolQuotes.ts`:

```
25:  const source = LOWCAP_DIAMOND_ADDRESS[SupportedChainId.BASE]?.toLowerCase()
30:      const client = getApolloClient(SupportedChainId.BASE, ClientType.ANALYTICS)
```

Timeline:

| Date       | Commit      | Event                                                                                                                                                       |
| ---------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-02-07 | `d35bc9d7c` | `feat: add pool detail page` — code **and** doc both say BASE                                                                                               |
| 2026-03-17 | `22eeed305` | `feat: integrate HyperEVM support and refactor chain handling` — code switches to `FALLBACK_CHAIN_ID`; `CHAIN_IDS = [SupportedChainId.HYPEREVM]` introduced |
| 2026-05-13 | `c7fe12b18` | last edit to `Pool_Detail_Page.md` — the `[BASE]` lines were never touched                                                                                  |

`git log -S 'LOWCAP_DIAMOND_ADDRESS[BASE]' -- Docs/Pool_Detail_Page.md` returns nothing since creation. **The doc is stale by design-drift, not the code.** Current code: `usePoolQuotes.ts:26,31` and `usePoolHistoryQuotes.ts:27,32` both use `FALLBACK_CHAIN_ID`.

`Docs/Subaccount_Login_Info.md:538` (`LOWCAP_DIAMOND_ADDRESS[BASE] = '0x...'`) and `Docs/design-docs/instant-layer-v2.md:375` (`0x0f4352e4a88b5Dc0531a98B538F04893Fb22489C`, the Base address) are stale the same way.

`Docs/Pool_Detail_Page.md:134-137` is also stale: it describes deposits via `GetUserDeposit({ contract_address })`, a function that no longer exists — the current calls are `GetTransactionHistory` and `GetUserProfit` (`services/index.tsx:232-249`).

---

#### 10. Does `LOWCAP_DIAMOND_ADDRESS[BASE]` still serve live pools? **No.**

`src/constants/addresses.ts:51-57`:

```ts
export const LOWCAP_DIAMOND_ADDRESS: AddressMap = {
  [SupportedChainId.BASE]: "0x0f4352e4a88b5Dc0531a98B538F04893Fb22489C",
  [SupportedChainId.POLYGON]: "0x5da06138507162db04979EEA7F55d30400cA13Fe",
  [SupportedChainId.HYPEREVM]: IS_TEST_ENVIRONMENT
    ? "0x99641E06d38F327166b3a48f86Ca2cbB3B4fB7EB"
    : "0x57331038c21982116EE9b0906E4a5c5cB52dcE2e",
};
```

Four independent reasons the BASE and POLYGON entries are dead:

1. **Every pools consumer hard-pins `FALLBACK_CHAIN_ID`** (= `CHAIN_IDS[0]` = `HYPEREVM`, `src/constants/chains.ts:50-52`): `usePoolQuotes.ts:26`, `usePoolHistoryQuotes.ts:27`. They do not read the wallet chain at all.
2. **The subgraph is HyperEVM-only.** `getApolloClient` (`apolloClients.ts:31-41`) returns `undefined` for any `chainId !== FALLBACK_CHAIN_ID` and logs `"${chainId} is not a supported subgraph network"`. All three URLs are `…hyperevm_mainnet_*` / `vibe-back-hyperevm-mainnet` (`:12-18`).
3. **The app force-switches the wallet off any other chain.** `src/stores/application/updaters/applicationUpdater.ts:10-14`:
   ```ts
   if (!CHAIN_IDS.includes(chainId as any)) {
     switchChain(FALLBACK_CHAIN_ID);
   }
   ```
   and `useSupportedChainId()` (`src/lib/hooks/useSupportedChainId.ts:17`) returns false otherwise, gating every contract read. Since `useContract` resolves the address map by `useWalletStore.use.chainId()` (`src/lib/hooks/useContract.ts:12-22`), `LOWCAP_DIAMOND_ADDRESS[8453]` can only be selected in a state the updater immediately destroys.
4. **The network switcher is hidden.** `CHAIN_IDS.length > 1` is false → `NavBar.tsx:56` renders no `<Web3Network />`; `Web3Network/index.tsx:18` `isMultiChain = false`.

The BASE/POLYGON entries are historical residue. Note `COLLATERAL_SYMBOL`/`COLLATERAL_DECIMALS`/`DIAMOND_ADDRESS`/`INSTANT_LAYER_ADDRESS`/`SIGNATURE_STORE_ADDRESS`/`BACKED_WITHDRAW_BRIDGE_ADDRESS` (`addresses.ts:19-100`) have the same shape — several have **no HyperEVM entry at all**, so those subsystems are dead on the current chain.

---

#### 11. End-to-end flow, as the code actually implements it

```
CREATE / DEPOSIT  (off-chain, custodial, on the TOKEN's chain)
  form { TokenContractAddress, DepositChain, BuybackProfit, MaxLeverage }   Pools/types.ts:1-6
    GET  /market/token-support?contract_address=&chain=                     services/index.tsx:195
    GET  /market/token-meta-data?contract_address=&chain=                   services/index.tsx:189
    GET  https://api.dexscreener.com/latest/dex/tokens/{addr}               services/index.tsx:199
  POST /market/add-market  { …, deposit_chain }        → wallet_public_key  services/index.tsx:166
  (or, for an existing market)
  POST /market/deposit-address { token_contract_address, deposit_chain }
                                                       → wallet_public_key  services/index.tsx:170
    ↓ QR + copyable address; user sends the TOKEN from their own wallet
    ↓ market_status: waiting_for_deposit → under_review (24h) → listed | rejected
    ↓ backend assigns symbol_id                                    ← THE ONLY LINK

TRADE  (on-chain, HyperEVM 999, keyed ONLY by symbol_id)
  LOWCAP_DIAMOND_ADDRESS[999] as `source`  +  symbolId
    → hyperevm_mainnet_analytics subgraph                        usePoolQuotes.ts:26-52
    → Enigma solver (chainId 999) notional cap / market info     hedgers.ts:84
    → /vibecaps/{symbolId}                                       TradeButton.tsx:79

REALIZE VALUE  (two disjoint exits — this is the crux)
  A) LP withdraw  → POST /market/withdraw { amount(LP wei), market_address, withdraw_address }
       payout back on the DEPOSIT chain, address format validated per chain
       14-day cooldown                    services/index.tsx:251 · PoolWithdrawModal:69-115
  B) Claim rewards → POST /claim { token_contract_address, deposit_chain,
                                   account_address, amount }
       "USDC was moved to the subaccount" — backend-side credit on HYPEREVM
                                           services/index.tsx:259 · types.ts:396
```

Exit (B) is the only place a deposit-chain identity and a HyperEVM identity appear in the same payload — and the crossing is executed by the Enigma listing backend, invisible to the frontend.

---

#### 12. Flagged: dead code, stale config, hacks, bugs

**Dead / unreachable**

- `src/hooks/cctp/flow/useCctpFlow.ts` + its nine `useStep*` hooks (`useStepApproveUsdc`, `useStepBurnUsdc`, `useStepWaitForBurn`, `useStepWaitForAttestation`, `useStepMintUsdc`, `useStepWaitForMint`, `useStepTransferToAccount`, `useStepComplete`, `useStepReclaimAccount`) — **zero callers**. `grep -rn "useCctpFlow" src` matches only the definition. The live path is `useTransferUSDC` in `src/hooks/cctp/UseCCTP.ts`.
- `LOWCAP_DIAMOND_ADDRESS[BASE]` / `[POLYGON]`, `DIAMOND_ADDRESS` (BASE+POLYGON only — **no HyperEVM entry**, `addresses.ts:47-50`), `INSTANT_LAYER_ADDRESS` (BASE only), `SIGNATURE_STORE_ADDRESS` (BASE+POLYGON only), `BACKED_WITHDRAW_BRIDGE_ADDRESS` (BASE+POLYGON only) — unreachable under `CHAIN_IDS = [HYPEREVM]`.
- `IMarket.additional_chains` and `IMarket.main_pool` (`services/types.ts:56-57, 176, 178, 323-324`) — declared in three response types, **never read**. `grep -rn "additional_chains|main_pool" src` hits only the type declarations and the stub factory that hard-codes them `null`.
- `ITransactionHistory` has no `tx_hash`/`chain_id` field, so `TransactionRow.tsx` can never link out.

**Stale**

- `Docs/Pool_Detail_Page.md:123,150` (`LOWCAP_DIAMOND_ADDRESS[BASE]`), `:135` (`GetUserDeposit`, function no longer exists); `Docs/Subaccount_Login_Info.md:538`; `Docs/design-docs/instant-layer-v2.md:375`.
- `DepositActionButton.tsx:176` — `destinationDomain: CCTPDomain.Base` hard-coded while the app trades on HyperEVM; `WalletDepositComponent.tsx:76-79` quotes fees to `CCTPDomain.Base`. Superseded in UI by `HyperEvmDepositNotice`, but the code path is still live.
- `src/constants/misc.ts:25-27` — `IS_TEST_ENVIRONMENT` and the production fallback both resolve to `https://listing85.enigma.bz/v2/`. The ternary is a no-op; the listing test env points at production.
- `src/lib/hooks/useContract.ts:13-14` — comment says _"In simulator mode, always use Base chain for address resolution"_ but the code uses `FALLBACK_CHAIN_ID` (= HyperEVM). Same stale comment at `src/lib/hooks/useSupportedChainId.ts:13` ("simulator mocks Base").

**Bugs / hazards**

- **DexScreener slug mismatch for Arbitrum pools.** `DEPOSIT_CHAIN_OPTIONS` labels Arbitrum `'Arbitrum one'` (`Pools/constants.ts:11`); `useDexscreenerTokenDetails.ts:19` lower-cases it to `"arbitrum one"` and `buildTokenKey` (`src/services/dexscreener/service.ts:72-74`) does an exact string match against the metadata service's `chain_id`. `"arbitrum one" !== "arbitrum"` → `selectTokensFromSnapshot` returns `[]` → `tokenPrice` is `undefined` → `getPoolStatsCardValues` falls back to `DEFAULT_BALANCE_PERCENT = 50` (`pool-stats.ts:28,41-44`), silently showing a fake 50/50 pool split for every Arbitrum-chain pool. `'Solana' / 'Base' / 'BSC' / 'Sonic'` all lower-case to valid slugs; only Arbitrum breaks.
- `useAddUserDeposit.ts:45-47` — `console.log('e', e)` left in the error handler; the error message is a hard-coded generic that discards the backend's `error_message` (unlike `usePoolWithdraw.ts:45` and `claim-rewards-modal/utils.ts:60-66`, which do surface it).
- `CreatePool/index.tsx:109` — `console.log('Final data:', data)` on submit.
- `CreatePool/index.tsx:100` and `TokenBasics.tsx:84` — `//@ts-ignore` suppressions on the `DepositChain` form field.
- `utils/marketSearchItemToStubIMarket.ts:18` — `// TODO: I think we can remove this function!`
- `constants/addresses.ts:24` — `// TODO: Add Pimlico support for HyperEVM when available`, yet `PIMLICO_PROJECT_IDS[HYPEREVM]` is already populated (`:26`).
- `constants/hedgers.ts:167` — `// TODO: It is better to use a more dynamic way to get the hedger info by account type`
- `useAddDeposit` takes a `status: MarketStatus` prop (`useAddUserDeposit.ts:18`) that is destructured nowhere and never used; `TokenBasics.tsx:75` computes a value for it.
- Cosmetic "coming soon" stubs: `Pools/components/ui/ComingSoonBadge.tsx`, `ComingSoonColumnsPanel.tsx`, `PoolsInfo/ChartPlaceholder.tsx`.

---

#### 13. What the SDK should take from this

1. **Do not model `deposit_chain` as a chain to transact on.** It is a `(token_contract_address, deposit_chain)` composite market key plus a metadata/explorer/payout-format discriminator. Modelling it as an EVM chain id is what makes it look disjoint from the trading chain — `Solana = 0` is the giveaway that it is a venue enum.
2. **The listing/pool backend (`listing85.enigma.bz/v2/`) is a custodial service**, not a protocol surface. Deposit, withdraw, refund and claim are all authenticated REST with SIWE bearer tokens and zero chain interaction. Any SDK wrapper must not present them as transactions.
3. **`symbol_id` is the sole join** between a pool and its on-chain market. `deposit_chain` must be dropped at that boundary — `TradeButton.tsx:79` is the reference behavior.
4. If the SDK exposes pool stats, the DexScreener chain-slug mapping needs a real normalization table (`DepositChain → dexscreener slug`), not `label.toLowerCase()` — see the Arbitrum bug above.

---

## 4. Lifecycle drivers and symbol_id provenance

### GAP-FILL 4 — Pool lifecycle drivers & `symbol_id` provenance (Vibe-ui)

#### TL;DR (the answer up front)

**Nothing in the client drives the lifecycle.** `market_status` is a pure server-owned string that the client only _reads_ and _filters on_. The only two client actions that can cause a transition are `POST /market/add-market` (creates the row at `waiting_for_deposit`) and `POST market/retry-listing` (asks the server to re-attempt a `rejected` row). Everything else — deposit detection, `under_review` entry, `listed`, `rejected`, `delisted` — happens off-client with **zero** observability: no deposit watcher, no status endpoint, no WS, no ETA, no timestamp. The client re-reads `market_status` only on the ambient 90 s list poll / 60 s detail poll.

**`symbol_id` has zero producers in the codebase.** It is minted by the Enigma solver's symbol registry (`GET {solver}/contract-symbols` → `ContractSymbol.symbol_id`), surfaced to the client _only_ through listing-service responses, and treated as an opaque integer. Its assignment moment relative to `listed` is not observable anywhere in this repo — but the code is written defensively as if `listed` and `symbol_id != null` can diverge in **both** directions.

Also: this repo used to have deposit-status polling and it was deliberately deleted (commits below). The dead types are the fossils.

---

#### 1. The status vocabulary and who owns it

##### The enum

`src/components/App/Pools/types.ts:56-62`

```ts
export enum MarketStatus {
  WaitingForDeposit = "waiting_for_deposit",
  UnderReview = "under_review",
  Rejected = "rejected",
  Listed = "listed",
  Delisted = "delisted",
}
```

##### The dead enum

`src/components/App/Pools/types.ts:64-71`

```ts
export enum DepositStatus {
  Waiting = "waiting",
  Deposited = "deposited",
  Rejected = "rejected",
  Refound = "refound",
  Success = "success",
  Withdraw = "withdraw",
}
```

Proof it is dead — the only import is a **type position**, never a value:

- `src/components/App/Pools/components/Filters/FilterByStatus.tsx:5` imports it, and uses it at `:25` solely in the signature `onSelect = (status: MarketStatus | DepositStatus | 'all')`. The rendered option list `MARKET_FILTER_STATUS` (`FilterByStatus.tsx:7-13`) contains only `MarketStatus` members.
- `grep -rn "DepositStatus\." src/ --include='*.ts' --include='*.tsx'` → **no matches**.

Note `DepositStatus` has 6 members; `IDepositHistory` (`services/types.ts:144-152`) has 7 keys (`waiting, deposited, rejected, refound, success, transferred, withdraw`) — `transferred` has no enum member. Note also the persistent backend typo `refound` (not `refund`), while the _transaction_ APIs spell it `refund` (`services/types.ts:371`, `src/services/pools/types.ts:8`). Two different status vocabularies for the same money.

##### `market_status` is read-only, everywhere

Every consumer (full list from `grep -rn "MarketStatus\.\|market_status" src/`):

| Site                                                                                                                                                                                                                                                            | What it does with the status                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `constants.ts:19-40` `poolStatusMapper`                                                                                                                                                                                                                         | `Record<MarketStatus, {color, title}>` — the _only_ place a status becomes UI. `listed→'Live' #089981`, `rejected→'Rejected' danger-400`, `under_review→'Under Review' neutrals-gray-100`, `waiting_for_deposit→'Waiting' sunglow-400`, `delisted→'Delisted' main-gray` |
| `utils/canTradeMarket.ts:3-4`                                                                                                                                                                                                                                   | `status === Listed && symbolId != null`                                                                                                                                                                                                                                 |
| `utils/canDepositToMarket.ts:7-11`                                                                                                                                                                                                                              | `false` for `delisted`; for `rejected` only if `allowRejected`; **`true` for everything else** (incl. `under_review`)                                                                                                                                                   |
| `useDiscoverMarketSearch.ts:67`, `useYourPoolsMarketDeposits.ts:51`                                                                                                                                                                                             | sends it back as the `market_status=` **query filter** only                                                                                                                                                                                                             |
| `useUserProfit.ts:102`                                                                                                                                                                                                                                          | `enabled: … && marketStatus === MarketStatus.Listed`                                                                                                                                                                                                                    |
| `RetryListingButton.tsx:48`                                                                                                                                                                                                                                     | `isRejected = item.market_status == MarketStatus.Rejected`                                                                                                                                                                                                              |
| `TokenBasics.tsx:66-69`                                                                                                                                                                                                                                         | `isCreatedMarket` / `isLiveMarket` / `isPendingMarket` gating in the create wizard                                                                                                                                                                                      |
| `DiscoverPoolTableItem.tsx:36,182-184`, `YourPoolTableItem.tsx:199-201,206`, `DiscoverPoolMobileCard.tsx:40,102`, `YourPoolMobileCard.tsx:114,150`, `PoolDetailHeader.tsx:133,190-197`, `PoolWithdrawModal/index.tsx:148`, `WithdrawalDetailModal/index.tsx:40` | render the pill                                                                                                                                                                                                                                                         |

**No write path anywhere sets `market_status`.** The client never sends it in a request body — only as a GET filter.

---

#### 2. The two (and only two) client-triggered transitions

##### (a) `null → waiting_for_deposit` — create the market

`src/components/App/Pools/services/index.tsx:166-168`

```ts
export async function AddMarket({ payload }: { payload: AddMarketPayload }) {
  return api.post<AddMarketResponse>(`/market/add-market`, payload);
}
```

- Base URL: `APP_POOLS_BACKEND_URL` (`services/index.tsx:42`) = `src/constants/misc.ts:23-27` → prod & test `https://listing85.enigma.bz/v2/`, staging `https://listing-staging.enigma.bz/v2/`. Bearer token injected by the request interceptor from `useUserStore.listingAccessTokens[account]` (`services/index.tsx:62-77`); a 401 clears the token (`:83-90`).
- Payload `AddMarketPayload` (`services/types.ts:155-162`): `{token_contract_address, is_tax, user_whitelist_tax, buy_back_ratio, max_leverage, deposit_chain}`. Built at `CreatePool/index.tsx:110-117` with `is_tax:false, user_whitelist_tax:false` hardcoded.
- **Caller**: `CreatePool/index.tsx:80-106`. `onSuccess` invalidates `['getMarketSearch']`, `['getUserMarketSearch']`, `['discoverPoolsCount']` (`:83-85`) and advances the wizard to step 3.
- **No status is read from the response.** `setAddMarketResponse` (`:86-91`) keeps exactly four fields: `token_ticker`, `deposit_amount`, `wallet_public_key`, `deposit_chain`. `market_status` and `deposit_status` are discarded on the floor.
- Gated by `useWeeklyListingLimit` (`GET /market/weekly-listing-limit` → `{limit, remaining, reset_at}`, `useWeeklyListingLimit.ts:98-124`; adaptive `refetchInterval` 60 s when `remaining <= 5`, else 300 s). `isLimitReached` disables the "New Pool" button (`DiscoverPoolsContent.tsx:162`, `YourPoolsContent.tsx:335`).

##### (b) `rejected → (retry)` — the only re-entry

`services/index.tsx:179-181`

```ts
export async function RetryMarketListing(payload: RetryMarketPayload) {
  return api.post<RetryMarketResponse>(`market/retry-listing`, payload);
}
```

- `RetryMarketPayload = {token_contract_address, deposit_chain}` (`types.ts:117-120`); response `RetryMarketResponse = {market_status: string}` (`types.ts:122-124`) — **also never read**: `useRetryMarketListing.ts:168-183` ignores `data` entirely and just invalidates `['getUserMarketSearch']`, `['getMarketSearch']`, `['retryListingInfo']` plus a success toast.
- Sibling read `GET market/retry-listing-info?…` → `{retry_limit, remaining_retries, remaining_cooldown_seconds}` (`services/index.tsx:183-187`, `types.ts:131-135`), hook `useRetryListingInfo.ts:205-216`, key `['retryListingInfo', token_contract_address, deposit_chain]`, `staleTime: 30_000`, **no `refetchInterval`**, `enabled: isRejected`.
- UI `RetryListingButton.tsx:45-147`. Cooldown/limit come from the info query with fallback to the row's own `remaining_retry_limit` / `remaining_cooldown_seconds` (`UserMarketSearchItem`, `types.ts:112-114`) at `:58-63`. Cooldown is rendered as a static string via `formatCooldown` (`:21-34`) — **not a live countdown**; it only refreshes when the 90 s list poll or the 30 s-stale info query refetches.

That is the whole client-side write surface for the lifecycle. Plus one adjacent money path: `POST market/refund` (`src/services/pools/services.ts:7-36`) for a rejected pool's deposit, which does not change `market_status`.

---

#### 3. "Confirm Deposit" is a lie — and it used to be real

##### Current

`src/components/App/Pools/components/ListingDepositModal/index.tsx:109-124`

```tsx
<Button
  onClick={() => {
    refetchPoolsData?.()
    toggleDepositModal()
  }}
  className="w-full" size="md" variant="primary"
>
  {t('Confirm Deposit')}
</Button>
<span className="…">
  {t('Click after sending your tokens. We will verify your deposit and begin the 24h review process.')}
</span>
```

`refetchPoolsData` is threaded from `useAddDeposit`'s modal options (`useAddUserDeposit.ts:32-44`) and resolves to `discoverQuery.refetch` / `yourPoolsQuery.refetch` (`DiscoverPoolsContent.tsx:179,190`, `YourPoolsContent.tsx:353,364`) or `useMarketDetail(...).refetch` (`PoolDetail/index.tsx:37`). So the button = "re-run the same market-search GET you'd have re-run 90 s later anyway, then close."

The modal's other job is the deposit address: `AddDeposit` → `POST /market/deposit-address` `{token_contract_address, deposit_chain}` → `AddDepositResponse` (`services/index.tsx:170-177`, `types.ts:191-198`). The only field consumed is `wallet_public_key` (`useAddUserDeposit.ts:37`), rendered as a QR (`qrcode-with-logos`, `ListingDepositModal/index.tsx:28-58`) and a copy target. `AddDepositResponse.market_status` is not read. Confirmed by `grep -rn "wallet_public_key" src/` — 8 hits, all QR/copy/state-carrying, none a balance or tx lookup.

##### It was real, and was deliberately removed

`git log -S "DepositStatus" -- src` / `-S "deposit_status" -- src` surface three demolition commits:

**`945011569` "refactor: handle check deposit status" (2026-03-09)** deleted the deposit poll. It removed:

```ts
export async function GetDepositStatus({ ...rest }: { wallet_public_key: string; deposit_chain: number }) {
  return api.post<GetDepositStatusResponse>(`/market/deposit-status`, rest);
}
```

and its response type

```ts
export interface GetDepositStatusResponse {
  deposit_amount: string;
  expected_amount: string;
  market_status: string;
  deposit_status: string;
}
```

The same commit turned the Review step's `Check Deposit` button into today's `Done` (`CreatePool/index.tsx`), and turned the modal's `mutate({deposit_chain, wallet_public_key})` into today's `refetchPoolsData?.(); toggleDepositModal()`. The deleted handler was the real UX:

- `deposit_status === 'waiting'` → ERROR toast _"Awaiting Deposit / No deposit detected yet. Please send your deposit to continue."_
- `deposit_status === 'deposited' | 'success'` → SUCCESS toast _"Deposit Submitted / Your deposit has been received and is now being processed."_ then `refetchPoolsData()` + close.

The same commit deleted `src/components/App/Pools/components/DepositsTable/index.tsx` (187 lines), which held the **only complete `DepositStatus` → label mapping ever written**, and is the clearest surviving statement of the intended state machine:

```ts
[DepositStatus.Success]:   { color: '#089981',                        title: 'Approved' },
[DepositStatus.Rejected]:  { color: 'var(--color-additional-danger-400)', title: 'Rejected' },
[DepositStatus.Deposited]: { color: 'var(--color-neutrals-gray-100)', title: 'Pool Under Review' },
[DepositStatus.Refound]:   { color: 'var(--color-neutrals-gray-100)', title: 'Refound' },
[DepositStatus.Waiting]:   { color: '#FDCB35',                        title: 'Waitng for deposit' },   // sic
```

→ **`deposit_status: deposited` IS `market_status: under_review`**, and `deposit_status: success` IS `listed`/approved. The two enums are the same machine seen from the money side and the market side. That is why the `DepositStatus` colors match `poolStatusMapper`'s colors exactly (`#089981` for approved/live, `neutrals-gray-100` for under review).

**`a1795cdc5` "refactor: remove amount from listing" (2026-03-09, 90 min earlier)** removed the fixed-amount model: deleted `DepositAmountModal.tsx` (user typed the exact deposit amount), removed `deposit_amount` from `AddMarketPayload` and `AddDepositPayload`, and removed `deposit_amount`/`field_amount`/`deposit_status` from **`AddDepositResponse`** — but left all three on **`AddMarketResponse`**, which is exactly the orphaned trio at `types.ts:174-175,182` today. It also deleted a commented-out modal subtitle: `"Send your deposit to the address below to start 24h verification."` The exact-amount rule became the flat `MIN_POOL_DEPOSIT_AMOUNT = 5` (`constants.ts:4`) rendered by `MinDepositWarning.tsx:143` — which is why `Docs/Pools_and_Permissionless_Listing.md:38`'s "must emphasize sending the **exact amount**" is now stale.

**`0ac5d115d` "feat: remove deprecated endpoints" (2026-06-15)** removed the last `deposit_status` _query_ surface: `GetUserDeposit({deposit_status, …})` → `GET /market/user-deposits/{start}/{size}`, plus `IDeposit` (which carried `deposit_amount`, `field_amount`, `deposit_status`, `wallet_public_key`, `refund_address`, `market_status`, `deposit_time`), `GetPublicMarketDeposits` → `/market/public-market-deposits/summary/{start}/{size}`, and `GetMarketDeposits` → `/market/market-deposits/summary/{start}/{size}`. Replaced by `market/search` + `market/search-user` + `market/user-transactions`.

##### `field_amount` was never rendered — ever

`git log --all -S "field_amount"` → 5 commits, all type-file churn. `git grep -n "field_amount"` across all reachable revisions, excluding `types.ts` → **zero hits**. It has existed only as a type property since `ce4e2e048 feat: implement listing services`. (Almost certainly a backend typo for "filled/failed amount"; the SDK should not carry it.)

##### `deposit_amount` is _half_-dead

Contrary to a strict reading: `CreatePool/index.tsx:88` **does** read it — `deposit_amount: data?.data.deposit_amount` into `addMarketResponse` state, passed to `<Review addMarketResponse={…}/>` (`:73`). But `Review.tsx` (150 lines, read in full) renders only `token_ticker`, `wallet_public_key`, `deposit_chain` — **never `deposit_amount`**. So it is read into React state and dropped. `deposit_status` and `market_status` on `AddMarketResponse` are not even destructured.

---

#### 4. What the user actually sees during the advertised "24h review"

Three mutually contradictory narratives ship simultaneously:

1. `ListingDepositModal/index.tsx:122` — _"We will verify your deposit and begin the **24h review** process."_
2. `CreatePool/components/Review.tsx:71-74` — _"Your market is **automatically listed** and will go live after a **quick system check**."_
3. `CreatePool/components/TokenBasics.tsx:207,212,222` — for a `waiting_for_deposit` market: badge **"Pending Activation"**, headline _"Market exists but trading hasn't started."_, body _"A small deposit of **$5 or more will activate the market for everyone**. Once active, you earn fees as an LP."_

`grep -rn "24h review\|review process\|system check\|activate the market" src/` returns exactly those three strings. "24h" appears in no other listing context (the only other `24 hour` string is the unrelated withdraw cooldown, `src/components/Withdraw/components/CooldownWarning.tsx:46`).

Then, for the whole review window, the observable state is:

| Surface                                      | `under_review` behavior                                                                                                                                                      | Cite                                                                                                           |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Status pill                                  | grey dot + literal `"Under Review"`, no timer, no start timestamp                                                                                                            | `constants.ts:28-31`; `PoolDetailHeader.tsx:190-197`; `YourPoolTableItem.tsx:197-202`                          |
| Trade button                                 | `disabled` (`canTrade` false)                                                                                                                                                | `canTradeMarket.ts:3-4`; `TradeButton.tsx:17,22`; `YourPoolTableItem.tsx:215`; `DiscoverPoolTableItem.tsx:189` |
| Deposit button                               | **enabled** — `canDepositToMarket` returns `true` for `under_review` (fall-through at `canDepositToMarket.ts:11`). Users can keep funding a pool that may end up `rejected`. | `YourPoolTableItem.tsx:43,60-64,216-224`                                                                       |
| Retry button                                 | hidden (only `rejected`)                                                                                                                                                     | `YourPoolTableItem.tsx:206-212`                                                                                |
| Your Balance / Claimable Rewards cards       | `useUserProfit` `enabled` requires `=== Listed` → query never fires, cards render empty/`-` for an authenticated owner                                                       | `useUserProfit.ts:102`; `SummaryCards/index.tsx:40-50`                                                         |
| OI / Available Liq stats                     | rendered as `null` when `symbol_id` is null                                                                                                                                  | `PoolStatsCard.tsx:72-100`                                                                                     |
| Positions / Open Quotes / Trade History tabs | `enabled: Boolean(symbolId && source)` → disabled, permanent empty state                                                                                                     | `usePoolQuotes.ts:50`; `usePoolHistoryQuotes.ts:69`                                                            |
| Limit Orders tab                             | hardcoded **"Coming Soon" / "Limit orders will be available in the next update."** regardless of status                                                                      | `PoolDetailTabs.tsx:129-138`                                                                                   |
| "Age" column                                 | `formatListingAge(listing_time)` → `'-'` while `listing_time` is null                                                                                                        | `formatListingAge.ts:1-13`; `YourPoolTableItem.tsx:194`                                                        |
| Refresh cadence                              | 90 s (`getMarketSearch`/`getUserMarketSearch`) or 60 s (`marketDetail`)                                                                                                      | `useDiscoverMarketSearch.ts:56-57`; `useYourPoolsMarketDeposits.ts:28-29`; `useMarketDetail.ts:35-36`          |

Also: `under_review` and `waiting_for_deposit` rows are **not filtered out of public Discover** — `statusFilter` is `undefined` unless `?status=` is in the URL (`useDiscoverMarketSearch.ts:44`), so half-listed markets sit in the public table with a disabled Trade button.

There is **no** countdown, no `review_started_at`, no ETA field on any response type, and no notification. The user's only recourse is to leave the tab open (90 s poll) or reload.

---

#### 5. Proof of no deposit detection / no status polling / no WS

```
$ grep -rn "setInterval|WebSocket|EventSource" src/components/App/Pools src/services/pools
src/components/App/Pools/components/WeeklyLimitTooltip.tsx:30:    const id = setInterval(() => {     # weekly-limit reset countdown only

$ grep -rn "useBalance|getBalance|txHash|transactionHash|useWaitForTransaction" src/components/App/Pools src/services/pools
src/components/App/Pools/components/claim-rewards-modal/ClaimRewardsAccountItem.tsx:5,24  # subaccount USDC, unrelated to listing deposits
```

No chain read of `wallet_public_key`, no tx-hash input, no receipt wait. Note the deposit chain set includes **Solana (`DepositChain.Solana = 0`)** (`types.ts:73-79`, `constants.ts:6-12`), so a generic EVM balance watcher wouldn't have covered it anyway.

Every listing query and its cadence (`grep -rn "refetchInterval\|staleTime" src/components/App/Pools`):

| Hook                                     | Key                                                                                           | staleTime                          | refetchInterval                                  | enabled                  |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------ | ------------------------ | -------------------- |
| `useDiscoverMarketSearch`                | `['getMarketSearch', query, size, start, searchTerm, statusFilter, sortBy, orderBy, filters]` | `0`                                | `90_000`                                         | always                   |
| `useYourPoolsMarketDeposits`             | `['getUserMarketSearch', accessToken, account, query, …]`                                     | `0`                                | `90_000`                                         | `accessToken && account` |
| `useMarketDetail`                        | `['marketDetail', contractAddress, depositChain]`                                             | `30_000`                           | `60_000`                                         | `contractAddress`        |
| `useDiscoverPoolsCount`                  | `['discoverPoolsCount']`                                                                      | `Infinity`                         | — (`refetchOnMount/Reconnect/WindowFocus:false`) | always                   |
| `useRetryListingInfo`                    | `['retryListingInfo', addr, chain]`                                                           | `30_000`                           | —                                                | `isRejected`             |
| `useUserProfit`                          | `['userProfit', contractAddress]`                                                             | `600_000`                          | `600_000`                                        | `Listed` only            |
| `useTransactionHistory`                  | `['GetTransactionHistory', …]`                                                                | `30_000`                           | —                                                | `marketAddress`          |
| `usePoolQuotes` / `usePoolHistoryQuotes` | `['poolQuotes'                                                                                | 'poolHistoryQuotes', symbolId, …]` | `30_000`                                         | `60_000`                 | `symbolId && source` |
| `useOpenOrders`                          | `['openOrders', payload]`                                                                     | `30_000`                           | `60_000`                                         | `payload.symbol_id`      |
| `useWeeklyListingLimit`                  | `['weeklyListingLimit']`                                                                      | `30_000`                           | 60 s / 300 s adaptive                            | `accessToken`            |

##### The one deposit-status signal that survives

`GET market/user-transactions/{start}/{size}` (`src/services/pools/services.ts:38-64`) returns `UserTransaction.transaction_status: 'pending'|'rejected'|'refund'|'success'` (`src/services/pools/types.ts:8,25-38`). It is **only** used in `RefundYourDepositModal.tsx:35-41` with `transaction_status:'rejected', transaction_type:'deposit'` to sum a refundable amount. It is never used to detect "my listing deposit landed", and `useUserTransactions.ts:6-16` has no `refetchInterval`. Per-pool `GET /market/transaction-history/{start}/{size}` (`services/index.tsx:236-249`) returns the same status vocabulary (`TransactionStatus`, `types.ts:371`) and drives only the Deposits/Withdrawals table.

---

#### 6. `symbol_id` — provenance, zero producers, and the divergence hazard

##### Zero producers in Pools

```
$ grep -rn "symbol_id|symmio_symbol_id|symbolId" src/components/App/Pools --include='*.ts' --include='*.tsx'
```

→ 20 consumer sites + 6 type declarations. Every value originates from a response object (`item.symbol_id`, `market.symbol_id`, `row.symbol_id`). Not one assignment computes it.

Repo-wide, every `symbol_id:` assignment is **outbound to the hedger**, sourced from `market?.id` — i.e. from `contract-symbols`, not minted here:
`src/hooks/trade/useEstimatedClosePriceForItems.ts:51`, `src/hooks/groupedQuotes/useGroupedEstimatedUpnl.ts:52`, `src/components/App/UserPanel/SettlementReceipt.tsx:70`, `src/components/EstimatedUpnl/EstimatedUpnl.tsx:53`.

##### The actual mint: the solver's `contract-symbols` registry

`Market.id` **is** `ContractSymbol.symbol_id`, one line:
`src/stores/hedger/hedgerUtils.ts:6-7`

```ts
export const transformMarketData = (market: ContractSymbol): Market => ({
  id: market.symbol_id,
```

- Type: `ContractSymbol.symbol_id: number` (`src/stores/hedger/hedgerTypes.ts:105`), response `ContractSymbolsResponse {count, symbols}` (`:118-121`).
- Fetch: `useFetchAllMarkets` (`src/stores/hedger/hedgerUpdater.ts:599-611`) — `queryKey: ['contract-symbols', hedgerType]`, `joinUrl(HEDGER_DATA_MAP[type].domain, routes.contractSymbols)`, `refetchInterval: 300_000`, `select: normalizeMarketsData`.
- Route constant `contractSymbols: 'contract-symbols'` for both hedgers (`src/constants/hedgers.ts:73` Rasa, `:126` Enigma). Enigma domain (`:87-91`): prod `https://solver.enigma.bz/api`, staging/test `https://solver-staging.enigma.bz/api`.
- `normalizeMarketsData` (`hedgerUtils.ts:29-70`) builds `byId[market.id]` from **all** symbols and `byName` from a lowest-non-zero-fee dedupe. `byId` is therefore the authoritative symbol_id → market map.

##### The registry is a dense sequential counter — empirical proof

`tools/contract-symbol-enigma.json` (a captured lowcap `contract-symbols` response, `count: 17`) has `symbol_id` 1…17 with **no gaps**, one per listed lowcap, each carrying a `token_address`:

```
1  SYMM::80..5f_SFLOW      0x800822d361335b4d5F352Dac293cA4128b5B605f
2  1INCH::c5..BE_SFLOW     0xc5fecC3a29Fb57B5024eEc8a2239d4621e111CBE
3  VIRTUAL::0b..1b_SFLOW   0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b
…
15 SURGE::3z..Pg_SFLOW     3z2tRjNuQjoq6UDcw4zyEPD1Eb5KXMPYb4GWFzVT1DPg   (Solana)
16 X33::33..33_SFLOW       0x3333111A391cC08fa51353E9195526A70b333333
17 JUP::JU..CN_SFLOW       JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN    (Solana)
```

Contrast `tools/contract-symbols-perps.json` (Rasa majors): 2206 symbols, ids 1…2793 — sparse, i.e. a long-lived registry with retired ids. So: **`symbol_id` is the solver's monotonic registration index, allocated per (token_address, deployment), and it is stable/never reused within a deployment.** The lowcap symbol _name_ is derived from the token address (`{FULLNAME}::{first2}..{last2}_SFLOW`) — the exact derivation is reproduced offline in `tools/TokenImages/_transformVibecaps.py:23-27`:

```python
clean_addr = token_address[2:] if token_address.lower().startswith("0x") else token_address
first2, last2 = clean_addr[:2], clean_addr[-2:]
file_name = f"{full_name}::{first2}..{last2}_SFLOW"
```

and that same script writes `"symbol_id": str(symbol_id)` into token-vendor metadata — again copying, never minting.

`Docs/VibeCaps_Token_List.md:13,52,111,119,190` documents the three-way join: `contract-symbols` (ids) × `lowcap-price…/api/v1/metadata` (joined **by `name`**) × `token-vendor/tokens/` (joined **by `symbol_id`**). Implemented at `src/services/token/transformers.ts:7-31` (`combineTokenData`: iterate `markets.byId`, filter `isValid`, match `metadata.find(m => m.name === market.name)`, emit `symbolId: market.id`).

##### How `symbol_id` reaches the Pools UI

Only via listing-service responses, on three different shapes with **two different field names**:

| Type                                                                          | Field                                                                    | Cite                                                                                                                   |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `IMarket` (legacy)                                                            | `symmio_symbol_id?: number \| null` **and** `symbol_id?: number \| null` | `services/types.ts:53-55` with the comment _"Authenticated endpoint uses `symmio_symbol_id`, public uses `symbol_id`"_ |
| `MarketSearchItem` (`GET market/search`)                                      | `symbol_id: number \| null`                                              | `services/types.ts:69`                                                                                                 |
| `UserMarketSearchItem extends MarketSearchItem` (`GET market/search-user`)    | inherits `symbol_id`                                                     | `services/types.ts:102`                                                                                                |
| `MarketDetailResponse` (`GET /market?token_contract_address=&deposit_chain=`) | `symbol_id: number \| null`                                              | `services/types.ts:318`                                                                                                |

**`symmio_symbol_id` is now fully dead**: `grep -rn "symmio_symbol_id" src/` returns only the declaration at `types.ts:53-54`. The `search`/`search-user` migration (commit `0ac5d115d`) normalized everything onto `symbol_id`, but `Docs/Pool_Detail_Page.md:111,123,148,153` still documents `symmio_symbol_id` — **stale doc**. (Same doc's `GET /market/market-deposits/summary` and `GetUserDeposit` references are also dead endpoints; `Docs/Pools_Discover_Table_Data_Sources.md:19-30` cites the deleted `/market/public-market-deposits/summary/{start}/{size}` for every column — stale.)

##### It is passed verbatim, everywhere, as an opaque int

| Consumer               | Call                                                                                                                                                                           | Cite                                                                                                                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hedger market lookup   | `useMarket({ id: market.symbol_id ?? undefined })` → `markets.byId[id]`                                                                                                        | `PoolPositionsTable.tsx:30`, `PoolOpenQuotesTable.tsx:31`, `PoolTradeHistoryTable.tsx:88`, `PoolOpenOrdersTable.tsx:21`; impl `src/stores/hedger/hedgerHooks.ts:74-81`                                                                                                   |
| Price feed             | `usePrice({ id: market.symbol_id ?? undefined, preferredHedgerType: HedgerType.ENIGMA })` → `state.prices[hedgerType].data.byId[id]`                                           | `PoolPositionsTable.tsx:31`, `PoolOpenQuotesTable.tsx:32`; impl `hedgerHooks.ts:88-107`                                                                                                                                                                                  |
| Solver notional cap    | `useNotionalCap({hedgerType: ENIGMA, marketId: market.symbol_id, isLowcap: true})` → `GET {solver}/notional_cap/{marketId}`                                                    | `PoolStatsCard.tsx:28-32`; route template `src/constants/hedgers.ts:127` `notionalCap: (marketId) => \`notional_cap/${marketId}\``; hook `src/services/markets/hooks/useNotionalCap.ts:35-52`, key `['getNotionalCap', hedgerType, marketId]`, `refetchInterval: 60_000` |
| COH / TP-SL service    | `SearchConditionalOrders({… symbol_id})` → `POST /api/v4/search/` on `TPSL_SERVICES[ENIGMA].domain`                                                                            | `PoolOpenOrdersTable.tsx:30`; `useOpenOrders.ts:74`; `services/index.tsx:263-265`; payload type `types.ts:411-417`                                                                                                                                                       |
| Analytics subgraph     | `variables.symbolId: String(symbolId)` + `source: LOWCAP_DIAMOND_ADDRESS[FALLBACK_CHAIN_ID].toLowerCase()`, query `POOL_QUOTES_BY_SYMBOL_AND_SOURCE`, `fetchPolicy:'no-cache'` | `usePoolQuotes.ts:26,37,50`; `usePoolHistoryQuotes.ts:49,69`                                                                                                                                                                                                             |
| Trading route          | `/vibecaps/{symbolId}`                                                                                                                                                         | `TradeButton.tsx:30`; `src/constants/routes.ts:3` `vibecaps: { symbolId: (symbolId) => \`/vibecaps/${symbolId}\` }`                                                                                                                                                      |
| Boosted-rewards config | `boosted.find(b => b.symbol_id === String(market.id))`                                                                                                                         | `src/utils/market.ts:4-7`; `BoostedToken.symbol_id: string` (`src/services/markets/types.ts:19-28`) — note **string** here vs number everywhere else                                                                                                                     |

##### The divergence hazard the code already admits

`utils/canTradeMarket.ts:3-4`:

```ts
export function canTradeMarket({ status, symbolId }: { status?: string | null; symbolId?: number | null }) {
  return status === MarketStatus.Listed && symbolId != null;
}
```

Two independent conditions. If the listing service assigned `symbol_id` at the same instant it set `listed`, the `symbolId != null` clause would be redundant. It isn't, and `PoolStatsCard.tsx:72-100` independently gates OI/liquidity on `market.symbol_id` **without** consulting `market_status`. Reading both together, the client is written to survive:

- **`listed` with `symbol_id === null`** — status flipped before/independently of registry ingest. Confirmed as an expected case by `Docs/Pool_Detail_Page.md:148` (_"`symmio_symbol_id` … can be null for unlisted pools"_) and `:153` (_"Unlisted pools (`symmio_symbol_id === null`): Position/quote tabs show empty state"_).
- **`symbol_id != null` while not `listed`** — a market that was live and is now `delisted` keeps its id; `canTradeMarket` correctly kills trading, while the subgraph history tabs (gated only on `symbolId`) keep working. That's the right behavior and is clearly deliberate.

##### The unhandled race: `listed` + `symbol_id` the solver hasn't published yet

`contract-symbols` refetches at `refetchInterval: 300_000` (`hedgerUpdater.ts:610`) — **five minutes**, and there is no invalidation of `['contract-symbols', hedgerType]` from any listing action. So a freshly-`listed` market can carry a valid `symbol_id` that is absent from `markets.byId` for up to 5 minutes. In that window:

- `canTradeMarket` returns **true**, the Trade button is **enabled**, and the user is routed to `/vibecaps/{symbolId}`.
- `src/components/App/Lowcap/CheckSymbol.tsx:39-52` then finds no match and **silently redirects to a different market**:

```tsx
const matchMarket = Object.values<Market>(markets).find((m) => m.id.toString() === symbolId?.toLowerCase());
if (matchMarket) {
  useTradeStore.setState({ marketId: matchMarket.id });
} else {
  // If no match, redirect to first market available
  router.push(routes.vibecaps.symbolId(marketIds[0]));
}
```

`marketIds[0]` is `Object.keys(markets)[0]` (`:17`) — arbitrary insertion/numeric key order. The user clicks "Trade" on their brand-new pool and lands on someone else's market with no explanation. (Separately, `src/pages/vibecaps/[symbol].tsx:55-64` also hard-redirects to `symbolId('1')` for `EXCLUDED_TOKENS`.) **This is the single most user-visible defect in the whole slice, and it is a direct consequence of `symbol_id` being an opaque cross-service identity with no readiness signal.**

---

#### 7. The listing-service surface, complete (base `https://listing85.enigma.bz/v2/`)

All via the shared axios instance at `services/index.tsx:41-44` (timeout 20 000 ms), Bearer-authed by interceptor.

| Method | Path                                                                                         | Request                                              | Response type                                                                                                      | Hook / key                                                  |
| ------ | -------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| GET    | `auth/sign-in-message?address=&domain=&uri=`                                                 | —                                                    | `GetSignInMessageResponse {message, params}`                                                                       | `useListingLogin`                                           |
| POST   | `auth/login`                                                                                 | `LoginPayload {message, signature}`                  | `LoginResponse {accessToken, tokenType}`                                                                           | `useListingLogin`                                           |
| GET    | `market/search?limit=&offset=&query=&sort_by=&chain_ids=&market_status=&order_by=&<filters>` | —                                                    | `MarketSearchResponse {total, limit, offset, items}`                                                               | `useDiscoverMarketSearch`, 90 s                             |
| GET    | `market/search-user?…`                                                                       | —                                                    | `UserMarketSearchResponse`                                                                                         | `useYourPoolsMarketDeposits`, 90 s                          |
| GET    | `market?token_contract_address=&deposit_chain=`                                              | —                                                    | `MarketDetailResponse` (40 fields, `types.ts:313-351`)                                                             | `useMarketDetail`, 60 s                                     |
| POST   | `market/add-market`                                                                          | `AddMarketPayload`                                   | `AddMarketResponse` (`market_status`+`deposit_status` unread)                                                      | `CreatePool` mutation                                       |
| POST   | `market/deposit-address`                                                                     | `{token_contract_address, deposit_chain}`            | `AddDepositResponse` (only `wallet_public_key` read)                                                               | `useAddDeposit`                                             |
| POST   | `market/retry-listing`                                                                       | `RetryMarketPayload`                                 | `RetryMarketResponse {market_status}` (unread)                                                                     | `useRetryMarketListing`                                     |
| GET    | `market/retry-listing-info?…`                                                                | —                                                    | `RetryListingInfoResponse`                                                                                         | `useRetryListingInfo`                                       |
| GET    | `market/token-meta-data?contract_address=&chain=`                                            | —                                                    | `GetTokenMetaDataResponse`                                                                                         | `useTokenMetaData`, staleTime 5 min                         |
| GET    | `market/token-support?contract_address=&chain=`                                              | —                                                    | `string`; error `TokenSupportError {error_code…}`, `SUPPORT_TOKEN_ERROR.UNSUPPORTED_TOKEN = 26` (`types.ts:53-55`) | `useTokenValidate` → gates step 1                           |
| GET    | `market/weekly-listing-limit`                                                                | —                                                    | `WeeklyListingLimitResponse`                                                                                       | `useWeeklyListingLimit`                                     |
| GET    | `market/transaction-history/{start}/{size}?market_address=&wallet_address=`                  | —                                                    | `TransactionHistoryResponse`                                                                                       | `useTransactionHistory`                                     |
| GET    | `market/user-transactions/{start}/{size}?…`                                                  | —                                                    | `SearchUserTransactionsResponse`                                                                                   | `useUserTransactions` (refund modal only)                   |
| POST   | `market/withdraw`                                                                            | `WithdrawRequest`                                    | —                                                                                                                  | `usePoolWithdraw`                                           |
| POST   | `market/refund`                                                                              | `{market_address, deposit_chain, recipient_address}` | —                                                                                                                  | `useRefundRejectedPool` (manual `axios`, own Bearer header) |
| GET    | `profit/{token_contract_address}`                                                            | —                                                    | `UserProfitResponse`                                                                                               | `useUserProfit` (`Listed` only)                             |
| POST   | `claim`                                                                                      | `ClaimProfitRequest`                                 | `ClaimProfitResponse`                                                                                              | `useClaimProfit`                                            |

Non-listing bases in the same file: DexScreener `https://api.dexscreener.com/latest` (`:45-48`), inventory `https://inventory85.enigma.bz/api` / `https://inventory-staging.enigma.bz/api` (`:49-56`, `GET /v1/markets/tvl-aggregate`), COH `TPSL_SERVICES[HedgerType.ENIGMA].domain` (`:57-60`), Enigma solver `revenue/{marketId}` via `HEDGER_DATA_MAP[ENIGMA].domain` (`:207-218`).

**There is no OpenAPI/Swagger spec for the listing service in this repo.** Proof: `grep -rln "waiting_for_deposit|under_review|symbol_id" --include='*.md' --include='*.json' --include='*.yaml' --include='*.yml'` → only `tools/contract-symbol*.json` (data dumps) + `Docs/*.md` prose. `ls Docs/technichal-docs-back-end/` → only `instant-layer-v2-solver.md`, `v5-conditional-orders-api-example.md`. The status state machine is documented **nowhere** except the six-line prose at `Docs/Pools_and_Permissionless_Listing.md:20-27`:

> 1. User selects token and clicks "New Pool" / 2. UI shows deposit address + required data / 3. User deposits required token(s) / 4. User confirms deposit / 5. **Market appears as pending/in-review until admin acceptance** / 6. **After approval, solver ingests data and market becomes tradable**

Step 5 ("admin acceptance") and step 6 ("solver ingests data") are the only in-repo statements of who drives `under_review → listed` and when `symbol_id` appears — and neither is verifiable from code. Steps 5/6 being _sequential_ is consistent with `canTradeMarket` needing both conditions: approval sets `listed`, a **later** solver ingest mints `symbol_id`.

---

#### 8. Answers to the four sub-questions

**Who assigns `symbol_id`?** The Enigma solver's symbol registry, exposed at `GET {solver.enigma.bz/api}/contract-symbols` as `ContractSymbol.symbol_id` (`hedgerTypes.ts:105`), consumed as `Market.id` (`hedgerUtils.ts:7`). The listing service mirrors it onto its own market rows (`MarketSearchItem.symbol_id`, `MarketDetailResponse.symbol_id`). The client has **zero** producers; `grep -rn "symbol_id" src/components/App/Pools` gives 20 read sites and 0 writes.

**When relative to `listed`?** Not determinable from this repo. The evidence says it is **not simultaneous**: `canTradeMarket` requires both `status === Listed` **and** `symbolId != null` (`canTradeMarket.ts:4`); `Docs/Pool_Detail_Page.md:148,153` treats `symbol_id === null` as a normal state; and `Docs/Pools_and_Permissionless_Listing.md:26-27` orders admin approval _before_ solver ingest. The strongest inference: **admin acceptance sets `listed`; a subsequent solver ingest allocates `symbol_id`**, and the client is defensively written for the gap. Confirm with the listing-service team before encoding it in the SDK.

**Can it change?** No evidence of reassignment, and structural evidence against it: lowcap ids are dense 1…17, majors are sparse 1…2793 (retired-but-not-reused), and `symbol_id` is the join key for `token-vendor` metadata, the `/vibecaps/{symbolId}` URL, the subgraph `symbolId`, and `BoostedToken.symbol_id`. It behaves as an immutable primary key. A `delisted` market plausibly keeps its id (nothing clears it, and the history tabs gate only on `symbolId`). **Unverified** — this is an open question for the vendor, and the SDK should not model it as mutable without an answer.

**What does the user see during the "24h review"?** A grey `"Under Review"` pill, a disabled Trade button, an **enabled Deposit button**, empty Positions/Quotes/History tabs, blank Balance/Rewards cards, `'-'` for Age, no countdown, no ETA, and no notification — refreshed only by the ambient 90 s/60 s polls. Meanwhile three different screens tell them it takes 24 h (`ListingDepositModal:122`), that it is automatic after a "quick system check" (`Review.tsx:72`), or that a $5 deposit "will activate the market for everyone" (`TokenBasics.tsx:222`).

---

#### 9. Dead code / hazards for the SDK port

1. **`DepositStatus` enum** (`Pools/types.ts:64-71`) — never used as a value. Delete or resurrect with the real machine (`deposited` ≡ `under_review`, `success` ≡ approved, per the deleted `DepositsTable`).
2. **`AddMarketResponse.deposit_status` / `field_amount`** (`services/types.ts:175,182`) — never read; `field_amount` never rendered in **any** revision.
3. **`AddMarketResponse.deposit_amount`** — read into state (`CreatePool/index.tsx:88`) but never rendered by `Review.tsx`. Half-dead.
4. **`AddDepositResponse.market_status`**, **`RetryMarketResponse.market_status`** — returned, never read. The retry response is the _only_ endpoint that would tell you the post-transition status synchronously.
5. **`IMarket.symmio_symbol_id`** (`types.ts:54`) — zero readers. `IMarket` itself survives only to type `usePoolsStore.selectedPoolForRefund` and is manufactured by a stub with `token_decimal: 18` and `buy_back_ratio: 0` hardcoded (`marketSearchItemToStubIMarket.ts:30,33`), which carries the self-aware `// TODO: I think we can remove this function!` at `:13`.
6. **`depositUtils.ts`** — `getEffectiveDeposit` and `calcUserShare` both exported with **zero** consumers (grep returns only the definitions). Fully dead.
7. **`IDepositHistory`** (`types.ts:144-152`) — only reachable through the dead stub; `EMPTY_DEPOSIT_HISTORY` is the only value ever constructed.
8. **`CreatePool/index.tsx:100-101`** — `//@ts-ignore` on `error.response?.data?.error_message`; the listing error shape (`TokenSupportError`, `types.ts:212-216`) exists but isn't applied here. Also a stray `console.log('Final data:', data)` at `:109`, and `console.log('e', e)` at `useAddUserDeposit.ts:46`.
9. **`PoolDetailTabs.tsx:129-138`** — hardcoded "Coming Soon" Limit Orders tab, with `count: 0` (`:106`) even though `useOpenOrders` exists and works.
10. **Stale docs**: `Docs/Pools_Discover_Table_Data_Sources.md:19-30` (dead endpoints for every column), `Docs/Pool_Detail_Page.md:111,123,148,153` (`symmio_symbol_id`, `GET market/market-deposits/summary`, `GetUserDeposit`), `Docs/Pools_and_Permissionless_Listing.md:38` ("exact amount" — superseded by `MIN_POOL_DEPOSIT_AMOUNT = 5`), `:33` (`src/services/markets/*` / `src/services/token/*` are not where market services live for pools).
11. **Vocabulary bug**: backend spells it `refound` in `IDepositHistory`/`DepositStatus` but `refund` in `TransactionStatus`/`UserTransactionStatus`. Normalize in the SDK, don't propagate.

#### 10. Recommended SDK shape (from these findings)

- Model the lifecycle as **server-owned, read-only**: `MarketStatus` is data, and the SDK exposes exactly two writes (`addMarket`, `retryListing`) plus the read-side `getMarketSearch`/`getMarketDetail`.
- **Never derive tradability from status alone.** Port `canTradeMarket`'s two-condition form, and go further: require `symbol_id` to be _resolvable in the hedger market map_, not merely non-null, before enabling a trade route. That closes the `CheckSymbol.tsx:48-50` silent-redirect defect.
- Invalidate `['contract-symbols', hedgerType]` whenever a market transitions to `listed`, instead of waiting out the 300 s interval.
- If the listing service still serves `POST /market/deposit-status` (`{wallet_public_key, deposit_chain}` → `{deposit_amount, expected_amount, market_status, deposit_status}`, removed client-side in `945011569`), the SDK should re-expose it — it is the only real deposit-detection signal that ever existed, and its absence is why "Confirm Deposit" is a no-op and why the review window is a black box. **Open question for the vendor: is that endpoint still live?**
- Surface `remaining_cooldown_seconds` / `reset_at` as live countdowns, not one-shot formatted strings.
- Treat `symbol_id` as an opaque immutable `number` (never `String()`-cast except at the subgraph/`BoostedToken` boundary where the upstream shape demands it) and **document that it is null until solver ingest**.

**Key files:** `/symmio/Vibe-ui/src/components/App/Pools/services/types.ts`, `/symmio/Vibe-ui/src/components/App/Pools/types.ts`, `/symmio/Vibe-ui/src/components/App/Pools/services/index.tsx`, `/symmio/Vibe-ui/src/components/App/Pools/constants.ts`, `/symmio/Vibe-ui/src/components/App/Pools/utils/canTradeMarket.ts`, `/symmio/Vibe-ui/src/components/App/Pools/components/ListingDepositModal/index.tsx`, `/symmio/Vibe-ui/src/components/App/Pools/components/CreatePool/index.tsx`, `/symmio/Vibe-ui/src/stores/hedger/hedgerUtils.ts`, `/symmio/Vibe-ui/src/stores/hedger/hedgerUpdater.ts`, `/symmio/Vibe-ui/src/components/App/Lowcap/CheckSymbol.tsx`, `/symmio/Vibe-ui/tools/contract-symbol-enigma.json`, `/symmio/Vibe-ui/Docs/Pools_and_Permissionless_Listing.md`.

---

## 5. Custodial deposit address semantics and failure modes

#### VERDICT

**The "per (user, token, chain)" claim is unverifiable from this codebase — it is an inference from the request body, not an observed contract.** There is no OpenAPI spec, no test, no mock, and no fixture for `market/deposit-address` anywhere in the repo. The client never reads the one field that would let it verify attribution (`user_address`). And the refund path is confirmed unreachable for any non-`rejected` pool.

Proof of absence:

```
grep -rn "deposit-address|market/refund|deposit_address" . --include=*.{ts,tsx,json,md}  (excl node_modules/.next)
  → src/services/pools/services.ts:15
  → src/components/App/Pools/services/index.tsx:173
find . \( -iname "*openapi*" -o -iname "*swagger*" \)      → 0 results
grep -rln "AddDeposit|deposit-address|refundRejectedPool|RefundYourDeposit" --include=*.test.* --include=*.spec.*  → 0 results
grep -rn "memo|destination_tag|deposit_tag" src/components/App/Pools  → 0 results
```

---

#### 1. The mint — two independent endpoints produce `wallet_public_key`

**A. `AddDeposit`** — `/symmio/Vibe-ui/src/components/App/Pools/services/index.tsx:170-177`

```ts
export async function AddDeposit({ payload }: { payload: AddDepositPayload }) {
  const { token_contract_address, deposit_chain } = payload;
  return api.post<AddDepositResponse>(`/market/deposit-address`, {
    token_contract_address,
    deposit_chain,
  });
}
```

The body carries **no user identifier**. Identity is entirely the `Authorization: Bearer` header injected by the request interceptor at `services/index.tsx:60-74`:

```ts
const account = useWalletStore.getState().account;
const accessToken = account ? listingAccessTokens?.[account] : undefined;
config.headers.Authorization = `Bearer ${accessToken}`;
```

So the real tuple is **(bearer-token subject, `token_contract_address`, `deposit_chain`)** — not (user, token, chain). The distinction matters: `listingAccessTokens` is keyed by EOA (`src/stores/user/user.ts:84-85`), and the whole user store is persisted unpartialized to `localStorage` key `store-user-0.0.5` (`src/stores/user/user.ts:9` + trailing `true` arg; `src/utils/store.ts:29-45` — `persistKeys` omitted ⇒ **entire state persisted**, bearer tokens included).

Base URL — `src/constants/misc.ts:23-27`:

```ts
export const APP_POOLS_BACKEND_URL = IS_BACKEND_STAGING_ENV
  ? "https://listing-staging.enigma.bz/v2/"
  : IS_TEST_ENVIRONMENT
    ? "https://listing85.enigma.bz/v2/"
    : "https://listing85.enigma.bz/v2/"; // ← dead ternary: both branches identical
```

Env vars: `NEXT_PUBLIC_BACKEND_ENVIRONMENT === 'staging'`, `NEXT_PUBLIC_IS_TEST_ENVIRONMENT === 'true'` (`src/constants/environment.ts:1-2`).

**B. `AddMarket`** — the _same address type_ is also minted at pool-creation time. `AddMarketResponse.wallet_public_key` at `services/types.ts:177`, consumed in `CreatePool/index.tsx:89` and rendered as a QR in `CreatePool/components/Review.tsx:32,88,92`. So a pool creator receives an address from `POST /market/add-market`, and later `POST /market/deposit-address` returns one again for the same (token, chain). **Nothing in the client compares the two.** If the backend is not idempotent, the creator's Review-screen address and their later Deposit-modal address can differ silently, and both QRs stay valid-looking.

#### 2. Stability across calls — the client actively cannot detect drift

`useAddDeposit` is a **`useMutation`, not a `useQuery`** — `src/components/App/Pools/services/hooks/useAddUserDeposit.ts:24-31`. Consequences:

- **No `queryKey`, no cache, no dedupe.** Every click of "Deposit" fires a fresh `POST /market/deposit-address`.
- The result is written straight into transient modal state and never persisted — `useAddUserDeposit.ts:32-43`:

```ts
onSuccess: ({ data }) => {
  useApplicationStore.setState({
    modalOptions: {
      [ApplicationModal.LISTING]: {
        tokenName,
        publicAddress: data.wallet_public_key,
        chain: deposit_chain,
        refetchPoolsData,
      },
    },
    openModal: ApplicationModal.LISTING,
  });
};
```

- Shape of that slot: `src/stores/application/applicationHooks.ts:17-22` (`publicAddress?: string`).

There is no prior value to diff against, so a backend that rotates addresses would be **invisible to the UI and to the user**. Idempotency is assumed, never asserted.

**Five call sites**, all unconditional on success:
`CreatePool/components/TokenBasics.tsx:71` · `PoolsList/YourPoolMobileCard.tsx:48` · `PoolsTable/DiscoverPoolTableItem.tsx:48` · `PoolsTable/YourPoolTableItem.tsx:52` · `PoolDetail/index.tsx:32`

#### 3. The two response fields that would answer the question are never read

`services/types.ts:191-198`:

```ts
export interface AddDepositResponse {
  token_contract_address: string;
  user_address: string; // ← never read
  deposit_chain: number;
  wallet_public_key: string;
  token_decimal: number; // ← never read
  market_status: string; // ← never read
}
```

```
grep -rn "user_address" src --include=*.ts --include=*.tsx
  → services/types.ts:166  (AddMarketResponse decl)
  → services/types.ts:193  (AddDepositResponse decl)
```

**Two hits, both type declarations. Zero reads.** The server echoes back which user it attributed the address to, and the client discards it. A stale/wrong bearer token (persisted in localStorage, cleared only on a 401 — `services/index.tsx:82-91`) would produce an address attributed to a different account, and the UI would render it as yours with no discrepancy possible. Same for `market_status`: the server says whether the market can even accept a deposit, and the client ignores it.

#### 4. The guards that actually exist — copy strings, and nothing else

`ListingDepositModal/index.tsx` in full is: chain label (`:72`), token name (`:75`), QR (`:79`), the warning (`:82`), copy-to-clipboard (`:84-105`), `<MinDepositWarning />` (`:108`), and a button.

```ts
// :82
{
  t("Only deposit {{tokenName}} to this address.", { tokenName });
}
```

```ts
// MinDepositWarning.tsx:19
{
  t("Minimum deposit amount is ${{amount}}.", { amount: MIN_POOL_DEPOSIT_AMOUNT });
}
```

`MIN_POOL_DEPOSIT_AMOUNT = 5` — `src/components/App/Pools/constants.ts:4`. Its **only** consumers repo-wide are the import and the interpolation above:

```
grep -rn "MIN_POOL_DEPOSIT_AMOUNT" src
  → constants.ts:4               (definition)
  → MinDepositWarning.tsx:4      (import)
  → MinDepositWarning.tsx:19     (string interpolation)
```

**The `5` never participates in a comparison anywhere in the codebase.** It is a rendered numeral. Confirmed: `MinDepositWarning.tsx` is 23 lines total, pure presentation.

The "Confirm Deposit" button is a no-op toward the backend — `ListingDepositModal/index.tsx:110-120`:

```ts
onClick={() => { refetchPoolsData?.(); toggleDepositModal() }}
```

It refetches the pools list (`YourPoolsContent.tsx:153` → `useYourPoolsMarketDeposits`, `refetchInterval: 90_000`, `staleTime: 0` — `useYourPoolsMarketDeposits.ts:28-29`) and closes. No tx hash, no amount, no attestation. The subtitle at `:122` — _"Click after sending your tokens. We will verify your deposit and begin the 24h review process."_ — is the only place "verify" appears, and it describes backend behavior the client cannot observe.

**There is no amount input, no memo/tag field, no token-contract confirmation, and no "I understand" checkbox in either deposit surface** (`ListingDepositModal/index.tsx`, `CreatePool/components/Review.tsx`, both read in full).

#### 5. Failure modes

| Scenario                                        | Client-side detection                                              | Client-side recourse |
| ----------------------------------------------- | ------------------------------------------------------------------ | -------------------- |
| Wrong token to the address                      | none — `:82` copy only                                             | none                 |
| Wrong chain (correct token)                     | none — `:72` copy + chain logo baked into the QR center (`:47-51`) | none                 |
| Below $5                                        | none — `MIN_POOL_DEPOSIT_AMOUNT` never compared                    | none                 |
| Address rotated between calls                   | none — mutation, no cache, no diff                                 | none                 |
| Address attributed to another user              | none — `user_address` discarded                                    | none                 |
| Deposit to a healthy (`listed`) pool by mistake | none                                                               | **none** (§6)        |

Aggravating: the QR encodes the bare address with no chain/amount/token qualifier — `ListingDepositModal/index.tsx:29-52`, `content: publicAddress`. The only chain signal is a logo image composited into the QR center (`logo.src`, `:48`), which is decorative and not scanned. On EVM chains all five `DEPOSIT_CHAIN_OPTIONS` (`constants.ts:6-12`: Solana, Base, BSC, Sonic, Arbitrum One) share the same 20-byte address format, so a Base-vs-BSC-vs-Arbitrum mis-send is **indistinguishable to the user, the QR, and the app**.

**Latent chain-coercion bug** — `DepositChain.Solana = 0` (`src/components/App/Pools/types.ts:73-79`), so `0` is a _real chain_, not a sentinel. At `PoolDetail/index.tsx:34`:

```ts
deposit_chain: market?.deposit_chain ?? 0,
```

If `market` hasn't loaded or lacks `deposit_chain`, the app requests a **Solana** deposit address. The identical pattern recurs on the refund path — `RefundYourDepositModal.tsx:47`: `depositChain: selectedPoolForRefund?.chain_id || 0` (note `||`, so a legitimate `0` and a missing value are also conflated).

**Dead safety hook**: `useAddDeposit` declares a required `status: MarketStatus` param (`useAddUserDeposit.ts:18`) that is **never destructured** (`:9-13` takes only `token_contract_address`, `deposit_chain`, `tokenName`, `refetchPoolsData`) and never referenced. All five call sites are forced to pass it; it does nothing. The obvious guard — refuse to mint a deposit address for a `delisted`/`rejected` market — is wired up and then dropped. Note `canDepositToMarket` (`utils/canDepositToMarket.ts:7-11`) **returns `true` for unknown or `undefined` status** (fall-through at `:10`), and `DiscoverPoolTableItem.tsx:39` / `DiscoverPoolMobileCard.tsx:42` pass `{ allowRejected: true }` — so Discover rows deliberately allow depositing into **rejected** markets, which are exactly the markets whose only exit is the refund modal that Discover rows cannot open.

#### 6. Refund — reachable only from a `rejected` row, confirmed

**Endpoint** — `src/services/pools/services.ts:7-36`:

```ts
const result = await axios.post(
  `${APP_POOLS_BACKEND_URL}market/refund`,
  { market_address: marketAddress, deposit_chain: depositChain, recipient_address: recipientAddress },
  { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } },
);
```

Note it uses **raw `axios`**, not the configured `api` instance — so it bypasses the request interceptor (hand-rolls the header instead), bypasses the 401 token-clearing response interceptor (`services/index.tsx:82-91`), has **no timeout** (the `api` instance sets `timeout: 20000` at `services/index.tsx:40-43`; no `axios.defaults` exist repo-wide), and the response is **untyped** (`axios.post` with no generic ⇒ `any`).

**Reachability — exhaustive.** `selectedPoolForRefund` (`src/stores/pools/pools.ts:5`) has exactly two writers, and both render behind the same status check:

- `PoolsTable/YourPoolTableItem.tsx:70-74` → button at `:209`, inside `{item.market_status == MarketStatus.Rejected ? (…)` at **`:206`**
- `PoolsList/YourPoolMobileCard.tsx:76-79` → button at `:154`, inside `{pool.market_status == MarketStatus.Rejected ? (…)` at **`:150`**

The modal mounts at `src/components/Layout/index.tsx:202` (`{selectedPoolForRefund && <RefundYourDepositModal />}`). A repo-wide `grep -rn "Refund|refund" src` returns only these two writers, the store, the modal, `StatusBadge.tsx:13-16`, and a `TransactionStatus` union (`services/types.ts:371`). **Confirmed: a mis-sent deposit on a `waiting_for_deposit`, `under_review`, `listed`, or `delisted` pool has no UI recourse whatsoever.** Discover rows — which can deposit into rejected markets — never render a refund button either.

Stale documentation: `utils/marketSearchItemToStubIMarket.ts:14` claims _"refund modal open from discover row"_. That path does not exist. `:13` also carries `// TODO: I think we can remove this function!`.

**No address validation** — `RefundYourDepositModal.tsx:129-142`:

```tsx
<p className="…">{t('Refund Address')}</p>
<ThemedInput.Primary
  placeholder={t('e.g. 0x...')}
  value={refundAddress}
  onChange={(e) => setRefundAddress(e.currentTarget.value)}
/>
…
<Button onClick={handleRefundRejectedPool}
  disabled={!refundAddress || isRefundingRejectedPool || isLoadingUserTransactions || depositAmount === 0}>
```

The only check is **non-empty**. No `isAddress`, no checksum, no length check, no `.trim()`, no chain-format check. The placeholder is hardcoded `e.g. 0x...` **even when the pool is on Solana** (`DepositChain.Solana = 0`), actively misleading the user into pasting an EVM address as a Solana refund destination.

The button-label helper confirms no validity state exists — `:63-68`:

```ts
const buttonText = evaluate({
  Refunding: isRefundingRejectedPool,
  "Enter Refund Address": !refundAddress,
  "Loading...": isLoadingUserTransactions,
  Refund: true,
})!;
```

**Eligibility gate is narrower than it looks** — `:35-41` + `:58-61`:

```ts
const { data: userTransactions, … } = useUserTransactions({
  accessToken, token_address: selectedPoolForRefund?.contract_address ?? '',
  chain_id: selectedPoolForRefund?.chain_id,
  transaction_status: 'rejected',
  transaction_type: 'deposit',
})
const depositAmount = transactionRows.reduce((t, tx) => t + Number(fromWei(tx.amount)), 0)
```

Only deposits the backend has already classified **`rejected`** count. A mis-sent transfer the backend recorded as `success`/`pending`, or never indexed at all, yields `depositAmount === 0` → button permanently disabled. So even on a rejected pool, the refund exit is gated on backend classification the user cannot influence or see. (`UserTransactionStatus = 'pending' | 'rejected' | 'refund' | 'success'`, `src/services/pools/types.ts:8`.)

**Decimals bug in the displayed amount** — `fromWei(amount, decimals = 18)` (`src/utils/numbers.ts:46-53`) is called with **one argument** at `:60`, ignoring `UserTransaction.token_decimal` which is present on the very row being summed (`src/services/pools/types.ts:36`). For a 6-decimal token the "Deposit Amount" shown at `:116` is understated by 10¹². Compounding it, the `IMarket` stub fed to this modal hardcodes decimals — `marketSearchItemToStubIMarket.ts:30`: `token_decimal: 18`.

**Unguarded error handler** — `src/services/pools/hooks/useRefundRejectedPool.ts:13-19`:

```ts
onError: (error: any) => {
  addPopup({ content: { toastType: ToastType.ERROR, props: { errorTitle: error.response.data.error_message } } });
};
```

`error.response` is `undefined` on a network failure or timeout ⇒ `TypeError`, thrown inside the react-query error callback. Since the refund POST has no timeout, a hung request never resolves; a dropped connection crashes the handler instead of showing a toast. The user is left with no feedback on the one call that moves their funds.

On success (`:21-30`) it invalidates `['getUserTransactions']` and `['getUserMarketSearch']` and toasts _"Refund request has been sent successfully."_ — note **request sent**, not executed. There is no status polling for the refund itself; `UserTransactionStatus` includes `'refund'` and `UserTransaction.refund_address` exists (`src/services/pools/types.ts:8,37`), but the modal never reads either.

#### 7. The damning contrast — the sibling modal does it correctly

`PoolWithdrawModal/index.tsx:69-88`, same feature folder, same free-text-address problem, **fully solved**:

```ts
const isSolanaMarket = market?.deposit_chain === DepositChain.Solana;
const recipientAddress = isSolanaMarket || !useConnectedWalletAddress ? withdrawAddress.trim() : connectedWalletAddress;
const addressError = useMemo(() => {
  if (!market) return null;
  if (!recipientAddress) return t("Withdraw address is required.");
  if (isSolanaMarket) {
    return isSolanaAddress(recipientAddress) ? null : t("Enter a valid Solana address.");
  }
  try {
    getAddress(recipientAddress);
    return null;
  } catch {
    return t("Enter a valid EVM address.");
  }
}, [isSolanaMarket, market, recipientAddress, t]);

const isDisabled = percentage === 0 || isPending || !hasBalance || Boolean(addressError);
```

Plus a chain-correct placeholder (`:417`: `isSolanaMarket ? t('Enter Solana withdraw address') : t('Enter EVM withdraw address')`), a connected-wallet default for EVM markets (`:90-97`), and `.trim()`. The refund modal has **none** of this.

The validator exists and is used elsewhere too — `src/utils/validate.ts:4-14`, applied in the trading withdraw flow at `src/components/Withdraw/components/SenderReceiver/SenderReceiver.tsx:22,32` with an explicit `'error'` sentinel. The refund path is the **outlier**, not a codebase-wide gap.

(Separately, `isSolanaAddress` is weak — `validate.ts:26-28`: `/[1-9A-HJ-NP-Za-km-z]{32,44}/` is **unanchored**, so it matches any string _containing_ 32+ base58 chars. Because base58 excludes `0`, a zero-free 40-hex EVM address still matches, and `isAddress` then returns it via the Solana branch un-checksummed at `validate.ts:6-8` before `getAddress` is ever reached.)

#### 8. Not the same as the account-deposit surface

`DepositAAModal/components/AddressDepositComponent.tsx:74-91` shows a superficially similar QR + _"Only deposit `<link>`USDC`</link>` to this address on"_ + hardcoded Base chip. But that address is `account` — the user's **own** smart account, on-chain verifiable and user-controlled. The pools `wallet_public_key` is an opaque backend-custodied address. The two surfaces look alike to a user and carry entirely different trust assumptions; nothing in the UI distinguishes them.

#### 9. Defect list (ranked by financial exposure)

1. `RefundYourDepositModal.tsx:131-142` — free-text `recipient_address`, zero validation, sent to an irreversible transfer endpoint. Wrong-chain/typo'd address = permanent loss. Fix exists 200 lines away in `PoolWithdrawModal/index.tsx:72-86`.
2. `YourPoolTableItem.tsx:206` / `YourPoolMobileCard.tsx:150` — refund gated on `market_status == Rejected`; no recourse for any mis-send on a healthy pool.
3. `constants.ts:4` — `MIN_POOL_DEPOSIT_AMOUNT` never compared; the $5 floor is decorative.
4. `services/types.ts:193` — `user_address` returned and discarded; deposit-address attribution is never verified client-side.
5. `useRefundRejectedPool.ts:17` — `error.response.data.error_message` throws on network error, on the fund-moving call, which also has no timeout (`services.ts:14`).
6. `PoolDetail/index.tsx:34` + `RefundYourDepositModal.tsx:47` — chain fallback to `0`, which is `DepositChain.Solana`, not a sentinel.
7. `useAddUserDeposit.ts:18` — required `status` param accepted from 5 call sites and never used; no market-status guard on address minting.
8. `RefundYourDepositModal.tsx:60` — `fromWei` ignores `token_decimal`; amount misreported for non-18-decimal tokens.
9. `RefundYourDepositModal.tsx:133` — `e.g. 0x...` placeholder shown for Solana pools.
10. `marketSearchItemToStubIMarket.ts:13-14,30` — `TODO` + JSDoc describing a nonexistent discover-row refund path + hardcoded `token_decimal: 18`.
11. `misc.ts:25-27` — dead ternary, `IS_TEST_ENVIRONMENT` and prod resolve to the same host.
12. `useAddUserDeposit.ts:46` — `console.log('e', e)` left in the error path.
13. Zero test coverage on both the deposit-address and refund flows.

---

## 6. Realtime on a pool page: what ticks, and is it correct?

I have the complete trace. Here is the exhaustive answer.

---

### GAP‑FILL 6 — Realtime on a pool page: what ticks, and is it correct?

#### TL;DR

**Exactly one thing on a pool page is realtime: the `Mark Price` column in two tables**, fed by the Enigma lowcap price WebSocket. Everything else is react‑query polling (30s–10min) or a "Coming Soon" stub.

**Yes, `/pools` does load the market registry** — but not because of anything on the pools page. `HedgerUpdater` is mounted app‑wide in `StoresUpdater` (`src/pages/_app.tsx:146`), so `['contract-symbols', ENIGMA]` is fetched on every route. The registry is _not_ route‑gated; the **socket** is, and the **`activeHedgerType`** is (and `/pools` sets neither).

**For a freshly‑listed pool the failure is silent and, in one case, permanent** — and the visible symptom is not `-` but a plausible‑looking **`$0.00`**, because `formatPrice` defaults `decimalPoints` to `2` when the registry lookup misses.

---

#### 1. What actually ticks — full inventory for `/pools/[contractAddress]`

| Source                            | Hook                                                                                                   | Key / URL                                                                                                                                                | Cadence                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **Enigma lowcap price WS**        | `usePrice({id, preferredHedgerType: ENIGMA})`                                                          | `wss://lowcap-price.enigma.bz/ws` (`src/constants/hedgers.ts:106-112`)                                                                                   | push (**the only realtime thing**) |
| Listing service pool detail       | `useMarketDetail` (`useMarketDetail.ts:10-37`)                                                         | `GET /market?token_contract_address=…&deposit_chain=…` → `['marketDetail', contractAddress, depositChain]`, `staleTime 30_000`, `refetchInterval 60_000` | 60s                                |
| Analytics subgraph — open quotes  | `usePoolQuotes` (`usePoolQuotes.ts:28-53`)                                                             | `POOL_QUOTES_BY_SYMBOL_AND_SOURCE`, `['poolQuotes', symbolId, …]`, `fetchPolicy:'no-cache'`, `enabled: Boolean(symbolId && source)`                      | 60s                                |
| Analytics subgraph — history      | `usePoolHistoryQuotes` (`usePoolHistoryQuotes.ts:29-72`)                                               | `POOL_QUOTE_EVENTS_BY_SYMBOL_AND_SOURCE`, `['poolHistoryQuotes', …]`                                                                                     | 60s                                |
| Enigma solver notional cap        | `useNotionalCap({hedgerType: ENIGMA, marketId: symbol_id, isLowcap:true})` (`PoolStatsCard.tsx:28-32`) | `GET {enigma}/notional_cap/{marketId}` → `['getNotionalCap', hedgerType, marketId]`                                                                      | 60s                                |
| Enigma solver market info         | `useMarketInfo()` (`useMarketInfo.ts:11-16`)                                                           | `GET https://solver.enigma.bz/api/get_market_info` → `['getMarketInfo']`                                                                                 | 120s                               |
| Enigma **price‑service metadata** | `useDexscreenerTokenDetails` (`useDexscreenerTokenDetails.ts:35-41`)                                   | `GET https://lowcap-price.enigma.bz/api/v1/metadata` → `['tokenDetails', tokenRequests]`                                                                 | 45s                                |
| Listing service txn history       | `useTransactionHistory` (`useTransactionHistory.ts:25-38`)                                             | `GET /market/transaction-history/{start}/{size}`                                                                                                         | **never refetches** (see §6)       |
| User profit                       | `useUserProfit` (`useUserProfit.ts:10-19`)                                                             | `GET /profit/{addr}`                                                                                                                                     | 600s                               |

Nothing pool‑related is pushed over the notifications WS — `useNotificationsWebSocket` (`src/stores/notifications/notificationsUpdater.ts:39-46`) refuses to connect at all unless `activeAccountAddress` exists (a trading subaccount, which a pure LP need not have), and its subscribe frame is per‑address position state, not listing state.

**Proof of zero WS in the pools slice:**

```
grep -rniE "websocket|useWebSocket|wss://|EventSource|SSE" src/components/App/Pools/ src/services/pools/
```

returns only incidental substring hits (`isSelected`, `hasSeenListingTerms`, `addre**ssE**rror`). `src/services/pools/` contains only `services.ts` + two react‑query hooks.

---

#### 2. Where the WS actually comes from, and the double gate

`/pools` opens **both** sockets nominally:

```ts
// src/stores/hedger/hedgerUpdater.ts:196-209
const shouldOpenBinanceSocket = useMemo(() => {
  if (pathname?.startsWith(routes.account.index)) return true
  if (pathname?.startsWith(routes.majors.index)) return true
  if (pathname?.startsWith(routes.vibecaps.index)) return false
  return true                                         // ← /pools lands here
}, [pathname])

const shouldOpenLowcapSocket = useMemo(() => {
  ...
  if (pathname?.startsWith(routes.pools.index)) return true   // :207
  return false
}, [pathname])
```

But that boolean is only the **second** gate. The first is `useGetHedgerTypes()`:

```ts
// src/stores/hedger/hedgerHooks.ts:197-211
export function useGetHedgerTypes() {
  const chainId = useWalletStore.use.chainId() ?? FALLBACK_CHAIN_ID;
  return useMemo(
    () =>
      Object.keys(HEDGER_DATA_MAP).filter((hedgerType) => {
        const { chainId: hedgerChainId } = HEDGER_DATA_MAP[hedgerType];
        if (hedgerChainId !== chainId) return false;
        return true;
      }) as HedgerType[],
    [chainId],
  );
}
```

- `HEDGER_DATA_MAP[RASA].chainId = SupportedChainId.BASE` (8453) — `hedgers.ts:33`
- `HEDGER_DATA_MAP[ENIGMA].chainId = SupportedChainId.HYPEREVM` (999) — `hedgers.ts:84`
- `CHAIN_IDS = [SupportedChainId.HYPEREVM]; FALLBACK_CHAIN_ID = CHAIN_IDS[0]` — `chains.ts:50-52`
- `chainId` is the wagmi connected chain, verbatim: `useWalletStore.setState({ chainId: chainId ?? FALLBACK_CHAIN_ID, … })` — `walletUpdater.tsx:41`

**Consequences:**

1. On the shipped HyperEVM deployment, `hedgerTypes === [ENIGMA]`. The Binance group never exists, so `webSocketConnections.find(conn => conn.endpoint === WEBSOCKET_ENDPOINTS.BINANCE)?.endpoint ?? null` (`hedgerUpdater.ts:224`) is `null`. `shouldOpenBinanceSocket === true` on `/pools` is a **no‑op**; the whole Binance branch (and `/majors`) is dead on this chain config.
2. **If the user's wallet is on any chain other than 999, `hedgerTypes` is `[]` or `[RASA]`, the LOWCAP group vanishes, and the lowcap socket URL resolves to `null` (`hedgerUpdater.ts:242`) — the socket never opens on `/pools` at all.** This is not hypothetical for pools: pools are cross‑chain by construction (`MarketDetailResponse.deposit_chain`, `DEPOSIT_CHAIN_OPTIONS` covers Solana/Base/BSC/Sonic/Arbitrum — `Pools/constants.ts:6-12`), and `useAddDeposit`/CCTP flows push users to switch chains. Switch to Base to fund a pool, come back to the pool page → Mark Price is frozen forever with no indication.
3. When it freezes, nothing tells the user. `webSocketStatus` is written to the store (`hedgerUpdater.ts:292`) but the only banner that reads it is gated on `/majors`:
   ```ts
   // src/components/LocationAndConnectivityChecker/index.tsx:23,63
   const isOnTradePage = router.pathname.startsWith(routes.majors.index)
   if (isOnTradePage && webSocketStatus === ReadyState.CLOSED) { …banner… }
   ```
   Not `/pools`, not even `/vibecaps`.
4. Prices never decay. `updatePrices` (`src/stores/hedger/hedger.ts:67-120`) only _merges_ — it never deletes or timestamps individual entries for consumers. `state.prices[hedgerType].lastUpdated` is set (`hedger.ts:116`) but **no pool component reads it**. A dead socket renders indistinguishably from a live one.

---

#### 3. The subscribe asymmetry — confirmed

Binance gets a frame; the lowcap socket gets **nothing**:

```ts
// hedgerUpdater.ts:296-308  — Binance ONLY
if (shouldOpenBinanceSocket && binanceConnection.readyState === ReadyState.OPEN && …) {
  const json = {
    method: windowVisible ? 'SUBSCRIBE' : 'UNSUBSCRIBE',
    params: ['!markPrice@arr@1s', '!ticker@arr'],
    id: 1,
  }
  binanceConnection.sendJsonMessage(json)
}
```

`grep -n "lowcapConnection" hedgerUpdater.ts` → lines 240, 265, 286, 460, 533, 537. **`sendJsonMessage` never appears for the lowcap connection.** It is a pure firehose: the server pushes an untyped array of every lowcap market and the client filters client‑side.

Side effect of the asymmetry: Binance is told to UNSUBSCRIBE when the tab is hidden, but the lowcap socket keeps receiving the full firehose in a background tab and merely drops it in the handler:

```ts
// hedgerUpdater.ts:461
if (!shouldOpenLowcapSocket || !windowVisible || !lastMessage) return;
```

---

#### 4. The name→id resolution path, and where it breaks

```ts
// hedgerUpdater.ts:467-517  (lowcap onMessage)
lowcapHedgers.forEach((hedgerType) => {
  const hedgerMarkets = allMarkets[hedgerType]?.data
  if (!hedgerMarkets) return                                     // :469  ← registry missing → whole tick dropped

  const currentPrices = useHedgerStore.getState().prices[hedgerType]?.data
  const byNameValues = currentPrices?.byName ? { ...currentPrices.byName } : {}
  const byIdValues   = currentPrices?.byId   ? { ...currentPrices.byId }   : {}

  for (const item of lastMessage || []) {
    const itemMarket = hedgerMarkets.byName[item.name]
    if (!itemMarket) continue                                    // :479  ← THE silent drop

    const marketData = {
      fundingRate: '0.00004335',                                 // :482  HARD-CODED
      nextFundingTime: 1741824000000,                            // :483  HARD-CODED (2025-03-13, in the past)
      markPrice: item.markPrice,                                 // :484  the only real field
      indexPrice: '0.19743943',                                  // :485  HARD-CODED
      market: itemMarket,
    }
    byNameValues[itemMarket.name] = marketData

    if (!lowcapNameToIdsCache.current[hedgerType]) {              // :492
      lowcapNameToIdsCache.current[hedgerType] = new Map<string, number[]>()
    }
    const nameToIdsCache = lowcapNameToIdsCache.current[hedgerType]

    let marketIds = nameToIdsCache.get(item.name)                // :498
    if (!marketIds) {
      marketIds = Object.values(hedgerMarkets.byId)
        .filter((market) => market.name === item.name)
        .map((market) => market.id)
      nameToIdsCache.set(item.name, marketIds)                   // :504
    }
    marketIds.forEach((marketId) => { … byIdValues[marketById.id] = {…marketData, market: marketById} })
  }
  updatePrices({ hedgerType, isLoading: false, data: { byName: byNameValues, byId: byIdValues }, error: null })
})
```

The registry the lookup runs against is built by `normalizeMarketsData` (`src/stores/hedger/hedgerUtils.ts:29-71`): `byId[market.id]` from **all** symbols, `byName[market.name]` from a **lowest‑trading‑fee dedupe** (`hedgerUtils.ts:32-57`). `market.name` is `ContractSymbol.name`, which for lowcaps is an opaque composite key — per `Docs/VibeCaps_Token_List.md:63`, `"NSFA::Eo..mp_SFLOW"` (ticker + truncated pair address + DEX suffix), **not** the ticker.

So the chain the pool page depends on is:

```
MarketDetailResponse.symbol_id  →  markets[ENIGMA].byId[symbol_id]  →  .name
                                          ↕ must equal
                                    WS item.name  →  prices[ENIGMA].byId[symbol_id]
```

`MarketDetailResponse` (`Pools/services/types.ts:313-351`) carries **`symbol_id: number | null`** and **no market name at all** — only `token_ticker` / `token_name` / `token_contract_address`. The pool page therefore has no way to detect, log, or work around a name mismatch; it just gets `undefined` back from `usePrice`.

---

#### 5. What happens to a freshly‑listed pool — four distinct failure modes

##### 5a. `symbol_id === null` (pool created, not yet listed on SYMMIO)

`useMarket({ id: market.symbol_id ?? undefined })` and `usePrice({ id: …, preferredHedgerType: ENIGMA })` both hit the `id ? … : undefined` branch (`hedgerHooks.ts:80`, `hedgerHooks.ts:105`) and return `undefined`.

Mark Price → `'-'` (`PoolPositionsTable.tsx:136-141`, `PoolOpenQuotesTable.tsx:129-134`). Correct.

But `useNotionalCap` **silently falls through to a different market**:

```ts
// src/services/markets/hooks/useNotionalCap.ts:23-27
const activeMarket = useActiveMarket();
const effectiveMarketId = marketId || activeMarket?.id; // ← null || activeMarket.id
```

`useActiveMarket()` = `useMarket({ id: useTradeStore.use.marketId() })` (`tradeHooks.ts:8-11`), and `marketId` is set by `/vibecaps/[symbol]` (`CheckSymbol.tsx:46`, `pages/vibecaps/[symbol].tsx:63`). The trade store is **not** persisted (`trade.ts:5-22`, no `isPersist` arg — cf. `user.ts` which passes `true`), so a hard reload on `/pools` is safe, but an SPA navigation `/vibecaps/42 → /pools/0xabc…` makes the unlisted pool render **market 42's OI and Available Liq** as its own. `PoolStatsCard` does guard the _display_ with `market.symbol_id ? … : null` (`PoolStatsCard.tsx:72-99`), so this one is masked — but the wrong request is still fired every 60s under key `['getNotionalCap', ENIGMA, 42]`.

##### 5b. `symbol_id` set, but registry snapshot is older than the listing — **up to forever**

`useFetchAllMarkets` is the only fetcher:

```ts
// hedgerUpdater.ts:600-613
queryKey: ['contract-symbols', hedgerType],
queryFn: () => fetchHedgerData(joinUrl(HEDGER_DATA_MAP[hedgerType].domain, …routes.contractSymbols)),
refetchInterval: 300_000,
select: normalizeMarketsData,
```

No `staleTime`, no invalidation — `grep -rn "contract-symbols" src/` returns exactly three hits: two route strings in `hedgers.ts` and this queryKey. **None of the pool mutations invalidate it.** `CreatePool/index.tsx:83-85` invalidates `['getMarketSearch']`, `['getUserMarketSearch']`, `['discoverPoolsCount']` — never the registry.

And the global query defaults kill every other refresh path:

```ts
// src/components/Layout/Providers/ReactQueryProvider.tsx:9-13
refetchOnMount: false,
refetchOnWindowFocus: false,
refetchIntervalInBackground: false,
```

So: the registry refreshes **only** on a 5‑minute timer that **does not run while the tab is hidden**, and there is **no refetch on focus**. A tab left open on `/pools` overnight in the background can hold a registry snapshot hours old, and returning to it triggers nothing.

During that window, on the pool detail page:

- `hedgerMarkets.byName[item.name]` misses → `continue` (`hedgerUpdater.ts:479`) → `prices[ENIGMA].byId[symbol_id]` is never written → **Mark Price `-`**.
- `useMarket({id})` → `undefined` → `symbolMarket?.pricePrecision` / `?.quantityPrecision` are `undefined` → `formatPrice` defaults:

  ```ts
  // src/utils/numbers.ts:117
  let { decimalPoints = 2 } = options;
  ```

  with `roundingMode = 'down'` (`numbers.ts:113`) and **`autoIncreaseDecimalPoints` not passed by any pool table**. A lowcap trading at `$0.00001736` (the doc's own example, `VibeCaps_Token_List.md:71`) renders as **`0.00`**, not `-`:
  - Entry Price — `PoolPositionsTable.tsx:120`
  - Size — `PoolPositionsTable.tsx:102`, `PoolOpenQuotesTable.tsx:105`, `PoolTradeHistoryTable.tsx:171`
  - Open Price — `PoolOpenQuotesTable.tsx:122`
  - Close Price — `PoolTradeHistoryTable.tsx:165`

  That is the worst class of bug in this slice: a missing registry entry produces a **confident wrong number**, not a blank.

- `PoolOpenQuotesTable.tsx:80-82` computes `positionValue` from `markPrice.gt(0) ? markPrice : openedPrice` — so with no mark price it silently reverts position value to the _opening_ price. No indication.

##### 5c. Registry refresh arrives, but the name was already cached — **permanently stuck**

`lowcapNameToIdsCache` is a `useRef` (`hedgerUpdater.ts:193`) inside `usePriceWebSocket`, which runs in `PriceWebsocketUpdaterComponent` mounted at the app root (`StoresUpdater.tsx:60-63, 132`). `grep -n "NameToIdsCache|\.clear\(\)" hedgerUpdater.ts` shows the cache is **read and written but never invalidated**, and it is **not keyed on `allMarkets`**.

The lowcap effect _does_ depend on `allMarkets` (`hedgerUpdater.ts:536-543`), so on a registry refresh it replays `lastJsonMessage`. That saves the case of a _brand‑new name_ (cache miss → rebuild from fresh `byId`).

It does **not** save the case where the name was already cached and a new `symbol_id` appears under it — a re‑list, or a second fee tier for the same token. `nameToIdsCache.get(item.name)` returns the stale `[oldId]` array, the `if (!marketIds)` rebuild is skipped (`:499`), and `prices[ENIGMA].byId[newSymbolId]` is **never populated for the lifetime of the page**. The only fix is a full reload. Note `normalizeMarketsData` explicitly anticipates multiple ids per name (`hedgerUtils.ts:32-57` dedupes `byName` by lowest fee) — so this is a live, designed‑for scenario that the cache breaks.

##### 5d. `chainName` label mismatch kills the _other_ price source

`PoolStatsCard.tsx:35-45` is the only place on a pool page that resolves a price by **token address** rather than symbol id — the path that would work for an unlisted pool:

```ts
chainName: DEPOSIT_CHAIN_OPTIONS.find((chain) => chain.value === market.deposit_chain)?.label ?? "";
```

`useDexscreenerTokenDetails` lowercases it (`useDexscreenerTokenDetails.ts:19`) and matches against `PriceServiceMetadata.chain_id` via `buildTokenKey` (`dexscreener/service.ts:72-75`). Labels are `'Solana' | 'Base' | 'BSC' | 'Sonic' | 'Arbitrum one'` (`Pools/constants.ts:6-12`). Four lowercase to valid Dexscreener chain slugs; **`'Arbitrum one'` → `'arbitrum one'` matches nothing** — Dexscreener's slug is `arbitrum`. Every Arbitrum pool silently gets `tokenPrice === undefined`.

The consequence is not a blank either — `getPoolStatsCardValues` fabricates a balance split:

```ts
// PoolDetail/pool-stats.ts:28,41-44
const DEFAULT_BALANCE_PERCENT = 50;
const tokenPercent =
  hasTokenPrice && totalPoolValue.gt(0)
    ? tokenValue.div(totalPoolValue).times(100).toNumber()
    : DEFAULT_BALANCE_PERCENT;
```

→ the Pool Balance bar renders a confident **50/50** split (`PoolStatsCard.tsx:159-162`) that is pure invention.

Related, in `YourPoolsList.tsx:60`: `meta.baseToken.address === item.contract_address` — a raw case‑sensitive compare. `mapMetadataEntry` preserves the price‑service casing (`dexscreener/service.ts:104`) while only the _request_ side is lowercased; any checksummed‑vs‑lowercase divergence drops the price to `'-'` (`YourPoolMobileCard.tsx:109`).

---

#### 6. The hedger‑identity bug: `useMarket` and `usePrice` disagree

All four pool tables call `useMarket` **without** `preferredHedgerType`, while the two price calls pass `ENIGMA` explicitly:

| File:line                      | Call                                                          |
| ------------------------------ | ------------------------------------------------------------- |
| `PoolPositionsTable.tsx:30`    | `useMarket({ id: market.symbol_id ?? undefined })`            |
| `PoolPositionsTable.tsx:31`    | `usePrice({ id: …, preferredHedgerType: HedgerType.ENIGMA })` |
| `PoolOpenQuotesTable.tsx:31`   | `useMarket({ id: market.symbol_id ?? undefined })`            |
| `PoolOpenQuotesTable.tsx:32`   | `usePrice({ id: …, preferredHedgerType: HedgerType.ENIGMA })` |
| `PoolTradeHistoryTable.tsx:88` | `useMarket({ id: market.symbol_id ?? undefined })`            |
| `PoolOpenOrdersTable.tsx:21`   | `useMarket({ id: market.symbol_id ?? undefined })`            |

`useMarket` resolves through `useActiveHedgerMarkets(preferredHedgerType)` → `markets[preferredHedgerType ?? activeHedgerType]` (`hedgerHooks.ts:36-41, 74-81`). So the **precision** lookup follows `activeHedgerType`, while the **price** lookup is pinned to `ENIGMA`. They can disagree, because nothing on `/pools` pins `activeHedgerType`:

- `activeHedgerType` is **persisted to localStorage** (`user.ts:9` name `'user'` + `isPersist=true` at `user.ts:...`, key `store-user-0.0.5` per `utils/store.ts:40`). Default `HedgerType.ENIGMA` (`user.ts:17`).
- `/vibecaps/[symbol]` forces it: `CheckSymbol.tsx:28-37` → `setActiveHedger(lowcapHedgerType)`.
- `/majors/[symbolId]` forces it the other way: `TradePageUpdater.tsx:12-20` → `setActiveHedger(lastMajorsHedger ?? DEFAULT_HEDGER_TYPE)` where `DEFAULT_HEDGER_TYPE = HedgerType.RASA` (`hedgers.ts:138`).
- `CheckChainHedgerChecker` **explicitly excludes `/pools`**:
  ```ts
  // src/checker/CheckChainHedgerChecker.ts:20-24
  if (!pathname?.startsWith(routes.majors.index) && !pathname?.startsWith(routes.vibecaps.index)) {
    return;
  }
  ```

So: **visit `/majors` once, then `/pools` — now and after every future reload, `activeHedgerType === RASA`.** All four pool tables resolve `symbol_id` against `markets[RASA]`. On HyperEVM that map doesn't exist at all (RASA filtered out by `useGetHedgerTypes`), `useActiveHedgerMarkets` returns the `{ byId: {}, byName: {}, count: 0 }` fallback (`hedgerHooks.ts:40`), and **every price/size on every pool table silently drops to 2‑decimal formatting** — the `$0.00` failure from §5b, permanently, for a fully‑listed healthy pool. On a Base‑connected wallet it is worse: `markets[RASA].byId[symbol_id]` may **hit a completely unrelated major market**, and the tables render that market's `pricePrecision`/`quantityPrecision`.

##### Why the `/vibecaps` gate cannot simply be copied

`pages/vibecaps/[symbol].tsx:35, 99-101`:

```ts
const isCurrentHedgerValid = useIsCurrentHedgerValid()
...
if (!isCurrentHedgerValid) {
  return <CheckSymbol />          // mounts, forces ENIGMA, re-renders
}
```

(`/majors/[symbolId].tsx:160-161` does the identical thing with `<TradePageUpdater />`.)

`useIsCurrentHedgerValid` is route‑coupled through `useCurrentTradingType`, which **has no `/pools` branch and falls off the end returning `undefined`**:

```ts
// src/stores/application/applicationHooks.ts:246-255
export function useCurrentTradingType() {
  const path = usePathname();
  if (path?.startsWith(routes.vibecaps.index)) return TradingType.Shitcoins;
  if (path?.startsWith(routes.majors.index)) return TradingType.Majors;
} // ← implicit undefined on /pools
```

`useIsLowcap()` = `undefined === TradingType.Shitcoins` = `false` (`hedgerHooks.ts:242-246`), so `useIsCurrentHedgerValid()` = `currentHedger.isLowcap === false` (`hedgerHooks.ts:251-256`) → **`false` for the default ENIGMA hedger on `/pools`**. Dropping the vibecaps gate onto `/pools` as‑is would render the checker forever. The fix has to be either passing `preferredHedgerType: HedgerType.ENIGMA` to every `useMarket` in the pools slice, or adding a `routes.pools` → `TradingType.Shitcoins` branch to `useCurrentTradingType`.

---

#### 7. Fabricated and dead things in this path

- **Hard‑coded price fields.** `hedgerUpdater.ts:482-485` stamps `fundingRate: '0.00004335'`, `nextFundingTime: 1741824000000` (a fixed timestamp in the past), `indexPrice: '0.19743943'` onto **every** lowcap market. Only `markPrice` is real. Any consumer of `usePrice(...).indexPrice` or `.fundingRate` for a lowcap is reading a constant. The pool tables happen to read only `markPrice` (`PoolPositionsTable.tsx:32`, `PoolOpenQuotesTable.tsx:33`), so they dodge it — but the store is poisoned for anyone else.
- **No type for the lowcap frame.** `lowcapConnection.lastJsonMessage as any` (`hedgerUpdater.ts:460`), iterated as `for (const item of lastMessage || [])`. `hedgerTypes.ts` defines `PriceResponse`/`LastPriceResponse` for Binance only (`:34-45`); there is no lowcap equivalent. `Docs/Enigma_Hedger.md:592-598` documents the endpoint with **no payload spec**.
- **Dead ternary.** `hedgers.ts:110-112`: `IS_TEST_ENVIRONMENT ? 'wss://lowcap-price.enigma.bz/ws' : 'wss://lowcap-price.enigma.bz/ws'` — both branches identical. Same pattern in `APP_POOLS_BACKEND_URL` (`misc.ts:23-27`) and `getPriceServiceBaseUrl` (`price-service/constants.ts:15-18`).
- **Dead component + hook.** `PoolOpenOrdersTable.tsx` and `useOpenOrders.ts` are fully implemented (`GET /conditional-orders/search`, `enabled: Boolean(payload.symbol_id)`, 60s) but **never rendered** — `PoolDetailTabs.tsx:129-138` returns a hardcoded "Coming Soon / Limit orders will be available in the next update." block. `grep -rn "PoolOpenOrdersTable" src/` → only its own definition.
- **`PoolChartCard.tsx` is a stub.** 91 lines of fully‑wired `ThemedSwitch` state (`ChartTab`, `PerformanceTab`, a "Yearly" dropdown button with no handler at `:75-78`) rendering a `ChartPlaceholder` + "Coming Soon" (`:82-88`). None of the state does anything.
- **`ComingSoonColumnsPanel`** bolts fake `Liq. Price / Margin / Funding` columns (`PoolPositionsTable.tsx:77,152`) and `UPNL (ROE%) / Liq. Price / Margin / Funding` (`PoolOpenQuotesTable.tsx:53,147`) beside the real tables; the real `<td>`s for them are commented out in place (`PoolPositionsTable.tsx:144-146`, `PoolOpenQuotesTable.tsx:137-140`).
- **`useTransactionHistory` never self‑refreshes.** `useTransactionHistory.ts:25-38` has `staleTime: 30_000` but **no `refetchInterval`**, and the global defaults disable refetch‑on‑mount and refetch‑on‑focus. The Deposits & Withdrawals tab and its tab badge count (`PoolDetailTabs.tsx:68-70, 110`) are frozen at first fetch until `usePoolWithdraw` invalidates `['GetTransactionHistory']` (`usePoolWithdraw.ts:17`) — i.e. only _your own_ withdrawal updates it.
- **Stale docs.** `Docs/Pools_Discover_Table_Data_Sources.md:24` claims Discover's Price column comes from `GET {PRICE_SERVICE}/api/v1/metadata`; the current desktop table (`DiscoverPoolTableItem.tsx`) has no price column at all and reads `item.tvl / market_cap / vol24h / liquidity / open_interest` straight off the 90s‑polled `market/search` response (`useDiscoverMarketSearch.ts:55-75`). Only the mobile `YourPoolsList` still uses the metadata path. `Docs/Enigma_Hedger.md:55, 200` also still names `symmio-api.Enigma.trading/bsapi` and channel `Base_Enigma_Production`, while the code says `solver.enigma.bz/api` and `Hyper-EVM_Solver-Low-Cap_Production` (`hedgers.ts:90, 104`).

---

#### 8. The join that already exists and is not used

`combineTokenData` (`src/services/token/transformers.ts:7-31`) is precisely the `symbol_id ↔ token contract address` bridge a pool page needs:

```ts
const meta = metadata.find((m) => m.name === market.name)
if (!meta?.base_token?.address) return acc
acc.push({ symbolId: market.id, symbolName: market.name, tokenAddress: meta.base_token.address, … })
```

Exposed as `useHedgerTokens()` (`services/token/hooks/useHedgerTokens.ts`), used by ten Lowcap components — and by **zero** pool components. It would let a pool page (a) confirm registry membership by address rather than by a nullable `symbol_id`, and (b) recover the composite market `name`.

Two obstacles worth recording:

1. `useHedgerTokens` keys off `useHedgerInfo()?.familyType` (`:10, 13-15`), and `getTokensInfoByHedger` **throws** for anything but `HedgerFamilyType.ENIGMA` (`services/token/service.ts:8-10`) — so on `/pools` with a persisted RASA `activeHedgerType` it would blow up. Same root cause as §6.
2. `mapMetadataEntry` (`dexscreener/service.ts:77-134`) **drops `name`** when converting `PriceServiceMetadata` → `DexscreenerTokenResponse`. `PoolStatsCard` is already fetching the full metadata snapshot every 45s (`fetchMetadataSnapshot`, `service.ts:165-171`) — the market name it needs is in that response and is thrown away by the mapper. Also unparsed by `BackendMetadataSchema` (`service.ts:18-70`): `decimal`, `updated_at`, `source`.

---

#### 9. Answers, stated plainly

**Q: What makes anything on a pool page tick in realtime?**
Only the `Mark Price` cell in `PoolPositionsTable` and `PoolOpenQuotesTable`, via `usePrice({ id: market.symbol_id, preferredHedgerType: ENIGMA })` reading `useHedgerStore.prices[ENIGMA].byId`, which is written exclusively by the lowcap `onMessage` handler at `hedgerUpdater.ts:458-543`. `PoolTradeHistoryTable` has no live price (it uses `useMarket` only, `:88`). Everything else is polled.

**Q: Is it correct?**
No, on six counts: (1) the socket is silently dead whenever the wallet is off chain 999, with no banner on `/pools`; (2) `updatePrices` never expires entries and no pool component reads `lastUpdated`, so frozen prices are indistinguishable from live; (3) `useMarket` and `usePrice` resolve against _different_ hedgers because `/pools` sets no `activeHedgerType`; (4) a registry miss degrades to `decimalPoints: 2` and renders `0.00` instead of `-`; (5) `lowcapNameToIdsCache` is never invalidated, permanently stranding a new id under an existing name; (6) `fundingRate`/`indexPrice`/`nextFundingTime` in the store are hard‑coded constants for all lowcaps.

**Q: What happens for a freshly‑listed pool not yet in the market registry?**
`hedgerMarkets.byName[item.name]` misses → `continue` at `hedgerUpdater.ts:479` → the tick is dropped for that market entirely. Mark Price shows `-`; every _other_ numeric column silently switches to 2‑decimal rounding‑down and shows `0.00`. This persists for up to 5 minutes with the tab foregrounded (`refetchInterval: 300_000`), **indefinitely** if the tab is backgrounded (`refetchIntervalInBackground: false`, `refetchOnWindowFocus: false`), and **permanently** if the market's `name` was already in `lowcapNameToIdsCache` under a different id. No pool mutation invalidates `['contract-symbols', ENIGMA]`.

**Q: Does `/pools` even load that registry?**
Yes — but incidentally, not deliberately. `StoresUpdater` is mounted unconditionally in `_app.tsx:146`, so `HedgerUpdater` (`hedgerUpdater.ts:27-35`) → `useFetchMarkets` → `useFetchAllMarkets` (`:600-627`) runs on every route. The registry is gated only by `useGetHedgerTypes()`'s chainId filter, **not** by trading type or path — which is exactly why `/pools` gets the registry for free while getting neither the `activeHedgerType` pin nor the `useIsCurrentHedgerValid` gate that `/vibecaps` uses.

---

# Part III — Cross-cutting synthesis (partial)

reviate:true}).price : null`|`openInterest > 0` blue (`:54`) |
| 4 | `Available Liq`|`market.symbol_id ? <span class="text-main-light-blue">{formatPrice(availableLiquidityLong,…)}</span> / <span class="text-main-pink">{formatPrice(availableLiquidityShort,…)}</span> : null`| long blue, short pink (hardcoded) |
| 5 |`Vol 24H`|`vol24h ? formatPrice(vol24h, {addDollarSign:true, decimalPoints:2, abbreviate:true}).price : '-'`| blue when present |
| 6 |`Buyback Ratio`|`formatPercentage(market.buyback_ratio, { decimalPoints: 2 }).percentage`— **raw`number`, no ×100 and no `fromWei`** | none |
| 7 | `Active LPs`|`String(market.active_lps)`| none |
| 8 |`Age`|`market.age ? formatListingAge(market.age) : '-'` | none |

Render loop `:127-136`: `stat.value !== null` → `<p class={cn('primary-caption-2-semibold', stat.valueColor || 'text-white')}>`; else a grey `-`. Grid `grid-cols-2 sm:grid-cols-4`; card `w-1/2` desktop / `w-full` mobile (`:123`).

#### 11.4 Pool Balance bar — `PoolStatsCard.tsx:139-163`

```
token side:  formatPrice(tokenBalance, { decimalPoints: 2, addDollarSign: false, abbreviate: true }).price
             + ' ' + market.token_ticker
usdc side:   formatPrice(usdcBalance,  { decimalPoints: 2, abbreviate: true }).price
             + ' ' + COLLATERAL_SYMBOL[FALLBACK_CHAIN_ID]
bar:         <div class="bg-main-blue" style={{ width: `${tokenPercent}%` }} />
             <div class="bg-main-pink" style={{ width: `${100 - tokenPercent}%` }} />
```

`COLLATERAL_SYMBOL[FALLBACK_CHAIN_ID]` = `COLLATERAL_SYMBOL[SupportedChainId.HYPEREVM]` = `'USDC'` (`src/constants/addresses.ts:19-23`). The usdc `formatPrice` call **omits `addDollarSign`**, whose default is `true` (`src/utils/numbers.ts:110`) → renders `$1.2K USDC`.

#### 11.5 TVL and 30D APY — `SummaryCards/index.tsx:21-38`

```ts
// TVL card (public, never gated)
formatPrice(fromWei(market.tvl), { addDollarSign: true, decimalPoints: DEFAULT_PRECISION /* 2 */ }).price;
// no `abbreviate` → full thousands-separated dollars

// 30D APY card (public)
const apy30d = Number(fromWei(market.apy_30d)); // :21
const apy30dColor = apy30d > 0 ? "text-main-light-blue" : apy30d < 0 ? "text-main-pink" : "text-white"; // :22
formatPercentage(apy30d, { decimalPoints: 0 }).percentage; // :36 — integer %, floored
```

Contrast with `PoolStatsCard`'s `Total APY`, which uses `apy_lifetime` at 2 dp and leaves the zero case uncoloured.

#### 11.6 Aggregated TVL tile — `PoolsInfo/GeneralInfo.tsx:39-52`

```ts
// "Vibecaps TVL"  — NOTE: manual /1e18, not fromWei
formatPrice(toBN(tvlData.tvl).div(1e18), { addDollarSign: true, decimalPoints: 1, abbreviate: true });
// "Available OI"
formatPrice(total_open_interest, { addDollarSign: true, decimalPoints: 1, abbreviate: true });
// both fall back to '-' when absent
```

Other tiles: `Total OI` = `formatPrice(total_used, {$,1,abbrev})`; `24h Volume` = `formatPrice(marketInfo?.total_value_24h, {$,1,abbrev})`; `24h Revenue` = `formatPrice(revenueData.day.total_revenue, {$,1,abbrev, roundingMode:'up'})`; `Lifetime Volume` = `formatPrice(marketInfo?.total_lifetime_value, …)`; `Lifetime Revenue` = `formatPrice(revenueData.lifetime.total_revenue, {…, roundingMode:'up'})`; `Active Pools` = `poolsCount`; `Top Chain` = **no value** → `<ComingSoonBadge/>`.

#### 11.7 User balance and pending withdrawal

`SummaryCards/BalanceCard.tsx:18-29`:

```ts
const usdcBalance = userProfit?.user_balance_in_usdc ?? "0";
const tokenBalance = userProfit?.user_balance_in_tokens ?? "0";
const userLpAmount = toBN(userProfit?.user_lp_amount ?? "0");
const pendingWithdrawalLpAmount = toBN(userProfit?.pending_withdraw_lp_amount ?? "0");
const pendingWithdrawalRate = userLpAmount.gt(0) ? pendingWithdrawalLpAmount.div(userLpAmount) : toBN(0);
const pendingWithdrawalUsdc = toBN(usdcBalance).times(pendingWithdrawalRate).toFixed(0); // stays in wei
const pendingWithdrawalToken = toBN(tokenBalance).times(pendingWithdrawalRate).toFixed(0); // stays in wei
const hasPendingWithdrawal = pendingWithdrawalLpAmount.gt(0);
const pendingWithdrawalRateLabel = formatPercentage(pendingWithdrawalRate.times(100), {
  decimalPoints: 2,
  removeTrailingZeros: true,
}).percentage;
```

Face value (`:111-131`): `formatPrice(fromWei(usdcBalance), {addDollarSign:true, decimalPoints:2, abbreviate:true})` | `formatPrice(fromWei(tokenBalance), {addDollarSign:false, decimalPoints:2, abbreviate:true})` + ticker — e.g. `$1.2K | 340.00 PEPE`.

#### 11.8 Max withdraw — `PoolWithdrawModal/index.tsx:48-67, 101`

```ts
const totalLp = toBN(userProfit?.user_lp_amount ?? "0"); // :48
const pendingLp = toBN(userProfit?.pending_withdraw_lp_amount ?? "0"); // :49
const availableLp = totalLp.minus(pendingLp); // :50
const availableRatio = totalLp.isZero() ? BN_ZERO : availableLp.div(totalLp); // :51
const pendingRatio = totalLp.isZero() ? BN_ZERO : pendingLp.div(totalLp); // :52

const totalTokenBalanceWei = userProfit?.user_balance_in_tokens ?? "0"; // :54
const totalUsdcBalanceWei = userProfit?.user_balance_in_usdc ?? "0"; // :55
const pendingTokenBalanceWei = toBN(totalTokenBalanceWei).times(pendingRatio).toFixed(0); // :56
const pendingUsdcBalanceWei = toBN(totalUsdcBalanceWei).times(pendingRatio).toFixed(0); // :57
const tokenBalanceWei = toBN(totalTokenBalanceWei).times(availableRatio).toFixed(0); // :58
const usdcBalanceWei = toBN(totalUsdcBalanceWei).times(availableRatio).toFixed(0); // :59
const tokenBalance = Number(fromWei(tokenBalanceWei)); // :60
const usdcBalance = Number(fromWei(usdcBalanceWei)); // :61
const hasBalance = availableLp.gt(0); // :62

const estimatedToken = (tokenBalance * percentage) / 100; // :66
const estimatedUsdc = (usdcBalance * percentage) / 100; // :67

// the value actually submitted:
const withdrawLpAmount = availableLp.times(percentage).div(100).toFixed(0); // :101
```

i.e. **`amount = (user_lp_amount − pending_withdraw_lp_amount) × percentage / 100`, in 1e18 LP units, as a stringified integer.**

`.toFixed(0)` uses BigNumber's default `ROUND_HALF_UP`, not floor — it can theoretically emit 1 wei more than available. At `percentage === 100` the value is exactly `availableLp`, so "max" is exact. Note the displayed estimate uses JS floats while the submitted amount uses BigNumber LP math; the two can disagree in the last digits, which the "amounts may vary" disclaimer covers.

`isDisabled = percentage === 0 || isPending || !hasBalance || Boolean(addressError)` (`:88`).

#### 11.9 Recipient address validation — `PoolWithdrawModal/index.tsx:69-86`

```ts
const isSolanaMarket = market?.deposit_chain === DepositChain.Solana; // :69  (Solana === 0)
const recipientAddress = isSolanaMarket || !useConnectedWalletAddress ? withdrawAddress.trim() : connectedWalletAddress; // :70-71

const addressError = useMemo(() => {
  if (!market) return null;
  if (!recipientAddress) return t("Withdraw address is required.");
  if (isSolanaMarket) return isSolanaAddress(recipientAddress) ? null : t("Enter a valid Solana address.");
  try {
    getAddress(recipientAddress);
    return null;
  } catch {
    // @ethersproject/address checksum
    return t("Enter a valid EVM address.");
  }
}, [isSolanaMarket, market, recipientAddress, t]); // :72-86
```

`isSolanaAddress` (`src/utils/validate.ts:26-28`) is `/[1-9A-HJ-NP-Za-km-z]{32,44}/.test(address)` — **unanchored, no length cap enforcement, no base58 checksum**. Any string _containing_ ≥32 base58 characters passes.

#### 11.10 Claimable rewards

**No client-side computation.** `ClaimableRewardsCard.tsx:22`:

```ts
const claimableReward = userProfit?.claimable_reward ?? "0";
```

rendered `:28-37` as `formatPrice(claimableReward, { addDollarSign: false, decimalPoints: DEFAULT_PRECISION, abbreviate: true }).price` + the literal `USDC`. **No `fromWei`** — and that is correct, because the claim modal re-scales with `toWei(claimableReward)` on the way out (`claim-rewards-modal/index.tsx:84`). Modal header (`:45-47`):

```ts
const claimableRewardsAmount = userProfit?.claimable_reward
  ? formatPrice(userProfit.claimable_reward, { addDollarSign: false, abbreviate: true }).price
  : "—";
```

#### 11.11 Withdrawal cooldown

```ts
// src/components/App/Pools/constants.ts:3
export const WITHDRAWAL_COOLDOWN_DAYS = 14;

// src/components/App/Pools/utils.ts:3-4
export const getDaysLeft = (createTime: number) =>
  Math.max(0, Math.ceil((createTime + WITHDRAWAL_COOLDOWN_DAYS * 86400 - Date.now() / 1000) / 86400));
```

`createTime` is `ITransactionHistory.time` (unix seconds). **No backend field corresponds to this constant** anywhere in the listing OpenAPI — it is a pure client assertion.

#### 11.12 Listing age

```ts
// src/components/App/Pools/utils/formatListingAge.ts:1-13
if (!listingTime) return "-";
const diffMs = Date.now() - listingTime * 1000;
const days = Math.floor(diffMs / 86_400_000);
const hours = Math.floor((diffMs / 3_600_000) % 24);
return `${days}d${hours > 0 ? ` ${hours}h` : ""}`;
```

Every call site passes a **unix timestamp** `listing_time` (`DiscoverPoolTableItem.tsx:177`, `YourPoolTableItem.tsx:194`, `DiscoverPoolMobileCard.tsx:281`, `YourPoolMobileCard.tsx:293`) **except** `PoolStatsCard.tsx:118`, which passes `market.age`. `MarketDetailResponse` carries **both** `listing_time` (`:328`) and `age` (`:342`). If `age` is a duration, the `Age` stat renders nonsense (`age = 86_400` → ≈`20500d`).

#### 11.13 Weekly listing limit

```ts
// useWeeklyListingLimit.ts:6-8, 20-35
const NEAR_LIMIT_REMAINING = 5;
const NEAR_LIMIT_REFETCH = 60_000;
const DEFAULT_REFETCH = 300_000;

refetchInterval: (query) => {
  const data = query.state.data;
  if (!data) return DEFAULT_REFETCH;
  return data.remaining <= NEAR_LIMIT_REMAINING ? NEAR_LIMIT_REFETCH : DEFAULT_REFETCH;
};

return {
  isLimitReached: data ? data.remaining <= 0 : false, // ← FAILS OPEN while loading or on error
  limit: data?.limit ?? 0,
  remaining: data?.remaining,
  resetAt: data?.reset_at ?? null, // unix SECONDS
  isLoading,
  isError,
};
```

Countdown (`WeeklyLimitTooltip.tsx:10-34`): `getRemainingTime(resetAt * 1000)` (`src/utils/time.ts:21-38`, dayjs-UTC) → `{d}d {h}h` / `{h}h {m}m` / `{m}m`, `null` once `diff <= 0`; ticks every `60_000` ms and self-clears on expiry.

It blocks exactly one thing — the "New Pool" button (`DiscoverPoolsContent.tsx:159-170`, `YourPoolsContent.tsx:128-143`) and the wizard's step-1 Continue (`TokenBasics.tsx:139-148`). It does not block retry, deposit, refund, claim, withdraw, or trade.

#### 11.14 Filter parsing — `FilterPoolModal/helpers.ts`

```ts
// :90-105 parseNumberShorthand
//   strips `$ , % whitespace`, matches /^(-?(?:\d+\.?\d*|\.\d+))([kmb])?$/,
//   multipliers 1e3 / 1e6 / 1e9, formatted by toPlainDecimal (:84-88)
// :107-123 parseTimeShorthand
//   bare digits pass through as a timestamp; `Nd`/`Nm`/`Ny` become
//   now - N*86400 | N*2592000 | N*31536000
// :125-129 parseFilterValue → dispatches on unit
// :131-158 sanitizeFilterInput(input, unit)
//   keeps digits + a single `.` + one trailing suffix from ['k','m','b'] (usd/percent)
//   or ['d','m','y'] (time). It DROPS `-`, so the `-?` branch of parseNumberShorthand
//   is unreachable through the UI.
// :160-178 formatCompactNumber → "$1.5M", "10%", "2d"
// :180-191 formatTime → ceil to d/m/y (LOSSY round-trip, see §12)
// :193-195 getActiveFieldCount → counts FIELDS, not bounds
```

Request-side scaling (`useDiscoverMarketSearch.ts:45-53`): every key present in the URL as a string is forwarded with `key.startsWith('listing_time') ? value : toWei(value)` — so all money **and percent** bounds are scaled by 1e18.

#### 11.15 Trade-history fee and PnL — `PoolTradeHistoryTable.tsx:117-134`

```ts
const leverage = getQuoteLeverage(item);
const qty = toBN(item.closedAmount).toNumber();
const closePrice = toBN(item.avgClosedPrice || "0").toNumber();
const openPrice = toBN(item.openedPrice).toNumber();
const tradeValue = qty * closePrice;
const initialNotionalValue = getOpenFeeNotionalValue(item);
const closeNotionalValue = getCloseFeeNotionalValue(item, item.closedAmount || "0");
const fee = calculatePlatformFee(
  initialNotionalValue,
  item.tradingFee || "0",
  item.closeFee || "0",
  closeNotionalValue,
);
const isLong = item.positionType === PositionType.LONG;
const pnl = isLong ? (closePrice - openPrice) * qty : (openPrice - closePrice) * qty;
const pnlColor = pnl >= 0 ? "text-main-light-blue" : "text-main-pink"; // zero is coloured as profit
const explorerUrl = getSymmioPositionUrl(chainId, item.id);
```

Fee math (`src/utils/fees.ts:11-35`): `openNotional = marketPrice * quantity`; `closeNotional = avgClosedPrice * closedAmount`; `fee = openNotional*tradingFee + closeNotional*closeFee`.

`getQuoteLeverage` (`src/utils/quote.ts:59-72`) = `quantity * requestedOpenPrice / (initialCVA + initialPartyAMM + initialLF)`, `.toFixed(0, ROUND_HALF_UP)` → integer string rendered `{leverage}x`.

#### 11.16 Open-quotes derivations — `PoolOpenQuotesTable.tsx:76-82`

```ts
const leverage = getQuoteLeverage(item);
const isLong = item.positionType === PositionType.LONG;
const qty = toBN(item.quantity).minus(toBN(item.closedAmount)).toNumber(); // REMAINING size
const price = toBN(item.openedPrice).toNumber();
const markPrice = toBN(liveMarkPrice ?? 0);
const positionValuePrice = markPrice.gt(0) ? markPrice.toNumber() : price;
const positionValue = qty * positionValuePrice;
```

#### 11.17 Positions-table derivations — `PoolPositionsTable.tsx:37-57`

Rows pushed only when `Number(market.long_position_amount) > 0` / `Number(market.short_position_amount) > 0`:

```ts
size = fromWei(longSize); // longSize = Number(market.long_position_amount)
positionValue = fromWei(market.long_position_value);
entryPrice = fromWei(market.long_position_avg_open_price);
upnl = fromWei(market.long_position_upnl);
```

Note the precision hazard at `:37,41`: `const longSize = Number(market.long_position_amount)` then `fromWei(longSize)` — the wei string is coerced through a JS `number` (unsafe above 2⁵³) before division, while the sibling fields pass the raw string.

#### 11.18 Trade-history synthetic total count — `PoolDetailTabs.tsx:85-98`

```ts
const historyPageData = useMemo(() => historyQuotes.slice(0, HISTORY_PAGE_SIZE), [historyQuotes]);
// Each request fetches FETCH_SIZE rows starting at skip; reporting skip + response.length
// as totalCount naturally exposes additional pages as the user advances, so the page
// count grows with selection instead of being frozen.
const computedHistoryTotalCount = (historyPage - 1) * HISTORY_PAGE_SIZE + historyQuotes.length;

if (!isHistoryQuotesLoading) {
  lastHistoryTotalCountRef.current = Math.max(lastHistoryTotalCountRef.current, computedHistoryTotalCount);
}
// Keep page controls stable during refetches — otherwise totalCount briefly collapses
// and the table shows the empty state while the next batch is in flight.
const historyTotalCount = isHistoryQuotesLoading
  ? Math.max(computedHistoryTotalCount, lastHistoryTotalCountRef.current)
  : computedHistoryTotalCount;
```

`HISTORY_PAGE_SIZE = 10`, `HISTORY_FETCH_SIZE = 110` (`:18-19`). Each page over-fetches 110 rows at `skip = (page-1)*10` and discards 100. Page 1 reports 110 → `lastPage = 11`, and the horizon walks forward as the user pages. `formatCount` (`:33-36`) renders `'+100'` for `count > 100`.

#### 11.19 Deposits/withdrawals amount sign — `tables/AmountCell.tsx:39-45`

```ts
const isWithdrawal = type === "withdraw";
const isPending = status === "pending";
const isPendingWithdrawal = isPending && isWithdrawal;
const sign = isPendingWithdrawal ? "~" : isWithdrawal ? "-" : ""; // deposits get NO '+'
```

Colour: `isPendingWithdrawal → text-strong`, else `isWithdrawal → text-main-pink`, else `text-main-light-blue`. Two optional segments joined by `<span className="text-main-gray"> | </span>`: USDC only when `isWithdrawal && usdcAmount > 0` (at `DEFAULT_PRECISION = 2`), token when `tokenAmount > 0` (at `DEFAULT_AMOUNT_PRECISION = 4`).

#### 11.20 Token-image resolution — `src/hooks/markets/useTokenImageByContract.ts:34-60`

Index built from `useTokenVendors()` (`:11-26`): `byTokenAddress` (lowercased `vendor.tokenAddress`) and `byMajorLiquidityPool` (lowercased `vendor.token_metadata.major_liquidity_pool`, skipping `'0x0'`). Resolution order:

1. `byMajorLiquidityPool.get(contractAddress.toLowerCase())`
2. `byTokenAddress.get(\`${tokenTicker}::${addr.slice(2,4)}..${addr.slice(-2)}\_sflow\`.toLowerCase())`
3. `byTokenAddress.get(\`${tokenTicker}usdt\`.toLowerCase())`
4. `DEFAULT_TOKEN_IMAGE = '/static/images/default-token.svg'` (`src/constants/misc.ts:203`)

#### 11.21 Explorer URLs — `utils/explorerUtils.ts`

```ts
// :7-13  — the map exists ONLY because SCANNER_URLS is keyed by CCTP domain numbers
const DEPOSIT_CHAIN_TO_SCANNER_KEY: Record<number, number> = {
  [DepositChain.Solana]:       CCTPDomain.Solana,       // 0     -> 5
  [DepositChain.Base]:         CCTPDomain.Base,         // 8453  -> 6
  [DepositChain.ARBITRUM_ONE]: CCTPDomain.Arbitrum,     // 42161 -> 3
  [DepositChain.SONIC]:        CCTPDomain.Sonic,        // 146   -> 13
  [DepositChain.BSC]:          SupportedChainId.BSC,    // 56    -> 56  ← not a CCTP domain
}
// :15-20
getTokenExplorerUrl(chain, address) =>
  chain == null || !address ? null
    : SCANNER_URLS[DEPOSIT_CHAIN_TO_SCANNER_KEY[chain]] ? `${base}/token/${address}` : null

// :24-39
getSymmioPositionUrl(chain, quoteId) => `https://intent.symmscan.com/position-details/${TENANT}/${quoteId}`
// tenant map: ARBITRUM→'ARBITRUM', BASE→'BASE', BSC→'BNB', HYPEREVM→'HYPEREVM', SONIC→'SONIC'
```

Bases (`src/constants/addresses.ts:144-155`): solscan.io, basescan.org, arbiscan.io, sonicscan.org, bscscan.com. The file's own comment at `:22-23` explicitly disclaims the deposit chain for `getSymmioPositionUrl`: _"Keyed by the chain a quote was settled on — i.e. the chain whose subgraph the quote was fetched from, not the pool's deposit chain."_

#### 11.22 `truncateToSignificant` — dead

`utils/truncateToSignificant.ts:34-49`:

```ts
export function truncateToSignificant(num: number, digitCount: number) {
  const sci = num.toExponential();
  const [significand, exponent] = sci.split("e");
  const sign = num < 0 ? -1 : 1;
  let digits = Math.abs(Number(significand)).toString().replace(".", "");
  digits = digits.slice(0, digitCount);
  const newSignificand = digits[0] + (digits.length > 1 ? "." + digits.slice(1) : "");
  return sign * Number(newSignificand) * Math.pow(10, Number(exponent));
}
```

32 lines of JSDoc, examples `(0.0456789, 2) → 0.045`, `(-0.000007891, 2) → -0.0000078`. **Zero importers.**

---

### 12. Gaps, stubs and gotchas

#### 12.1 "Coming soon" and stubs

| Surface                        | Location                                                                                | Detail                                                                                                                                                                                                                                                                                                          |
| ------------------------------ | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| **Pool chart**                 | `PoolChartCard.tsx:20-88`                                                               | Permanent `Coming Soon` + `ChartPlaceholder`. Takes no props, issues zero fetches. `chartTab` / `performanceTab` state (`:23-24`) is **never read in the render**. The `Yearly` timeframe button (`:75-78`) has no `onClick`.                                                                                   |
| **Limit Orders tab**           | `PoolDetailTabs.tsx:129-138`                                                            | Inline `<Table 64×64/>` + `Coming Soon` + _"Limit orders will be available in the next update."_ Badge hardcoded `0` (`:106`).                                                                                                                                                                                  |
| **Top Chain tile**             | `GeneralInfo.tsx:167`                                                                   | Only `ComingSoonBadge` consumer in the app.                                                                                                                                                                                                                                                                     |
| **GeneralInfo analytics card** | `GeneralInfo.tsx:175-185`                                                               | `ChartPlaceholder` + _"Advanced revenue analytics and historical charts will be available in the next update."_                                                                                                                                                                                                 |
| **`yourInfoItems`**            | `GeneralInfo.tsx:122-133`                                                               | 10 tiles, 8+ without a `value` → all `ComingSoonBadge`. **Unreachable** — the only call site hardcodes `activeTab={'discover'}`, so `isYours` is always false.                                                                                                                                                  |
| **Unimplemented columns**      | `PoolPositionsTable.tsx:70-72,144-146,152`; `PoolOpenQuotesTable.tsx:45-48,137-140,147` | `ComingSoonColumnsPanel` fakes `Liq. Price / Margin / Funding` (positions) and `UPNL (ROE%) / Liq. Price / Margin / Funding` (open quotes). The real `<td>`s are commented out in place; the `ComingSoonBadge` imports are commented out too. The panel is `hidden … md:flex`, so it never renders below 768px. |
| **TP \| SL column**            | `PoolOpenOrdersTable.tsx:99`                                                            | Hardcoded `-                                                                                                                                                                                                                                                                                                    | -` (in dead code). |

#### 12.2 Dead code

| Item                                                                                                          | Location                                                                            | Evidence                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PoolOpenOrdersTable`                                                                                         | `PoolDetail/tables/PoolOpenOrdersTable.tsx`                                         | Repo-wide grep finds the symbol only in its own file. Import dropped in commit `fd076e6fb`.                                                            |
| `useOpenOrders` + `SearchConditionalOrders` + `SearchConditionalOrdersPayload/Response` + `IConditionalOrder` | `services/hooks/useOpenOrders.ts`, `services/index.tsx:263-265`, `types.ts:411-440` | Dead by transitivity from the above. The `conditionalOrders` axios instance (`services/index.tsx:57-60,111-117`) exists only to serve it.              |
| `NumberInput`                                                                                                 | `components/FormInputs/NumberInput.tsx`                                             | Zero importers.                                                                                                                                        |
| `depositUtils.ts` — `getEffectiveDeposit`, `calcUserShare`                                                    | `utils/depositUtils.ts:4-14`                                                        | Zero importers repo-wide.                                                                                                                              |
| `truncateToSignificant`                                                                                       | `utils/truncateToSignificant.ts`                                                    | Zero importers.                                                                                                                                        |
| `DepositStatus` enum                                                                                          | `types.ts:64-71`                                                                    | Only ever a type in `FilterByStatus.tsx:25`.                                                                                                           |
| `IDepositHistory` / `deposit_history` / `user_deposit_history`                                                | `types.ts:144-152`, `IMarket:60-61`                                                 | Only reachable through the stub converter; `EMPTY_DEPOSIT_HISTORY` is the only value ever constructed.                                                 |
| `IMarket.symmio_symbol_id`                                                                                    | `types.ts:54`                                                                       | Zero readers since the `search`/`search-user` migration (commit `0ac5d115d`).                                                                          |
| `IMarket.main_pool` / `additional_chains` / `cex_list`                                                        | `types.ts:56-57` + the two response types                                           | Zero readers; only written as `null` by the stub.                                                                                                      |
| `AddMarketResponse.field_amount`                                                                              | `types.ts:175`                                                                      | `git log --all -S "field_amount"` → 5 commits, all type-file churn; **never rendered in any revision**.                                                |
| `AddMarketResponse.deposit_status`, `AddDepositResponse.market_status`, `RetryMarketResponse.market_status`   | `types.ts:182,197,123`                                                              | Returned, never read.                                                                                                                                  |
| `useToggleListingSignatureRequestModal`                                                                       | `applicationHooks.ts:268-270`                                                       | Exported, never imported.                                                                                                                              |
| `IS_POOLS_ENABLED`                                                                                            | `src/constants/environment.ts:5`                                                    | `NEXT_PUBLIC_POOLS_ENABLE` — **never referenced anywhere in `src/`**. `.env:13` sets it `true`. Absent from `.env.example`.                            |
| `NEXT_PUBLIC_POOLS_CLAIM_MOCK` / `_ERROR`                                                                     | `.env:22-23` (commented)                                                            | Zero code references.                                                                                                                                  |
| `ActiveTabKeys` members `'pools'`, `'your_deposits'`                                                          | `types.ts:8`                                                                        | `tabs` ships only `discover` / `your_pools`.                                                                                                           |
| `status: MarketStatus` param                                                                                  | `useAddUserDeposit.ts:18`                                                           | Required by all five call sites, destructured nowhere.                                                                                                 |
| `accessToken?` prop                                                                                           | `useTokenMetaData.ts:6`                                                             | Declared, never used.                                                                                                                                  |
| `isPendingMarket`                                                                                             | `TokenBasics.tsx:69,157,160`                                                        | Computed, threaded into `ExistingPoolNotice`, never read in its body.                                                                                  |
| `isDataLoading` / `metaError` / `isMetaSuccess`                                                               | `useTokenValidate.ts:81-83`                                                         | Returned; the sole consumer destructures only 5 of 8 fields.                                                                                           |
| `token_decimal` in `GetPoolStatsCardValuesParams`                                                             | `pool-stats.ts:14`                                                                  | Required by the type, ignored by the body.                                                                                                             |
| `useMarketDetail().isError` / `useUserProfit().isError`                                                       | —                                                                                   | Returned, never consumed. `grep -rn "isError" src/components/App/Pools/components/PoolDetail/` → **zero hits**.                                        |
| `WithdrawRequest.description`                                                                                 | `types.ts:367`                                                                      | Declared, never sent.                                                                                                                                  |
| `LoginMessage.expirationTime`                                                                                 | `types.ts:36`                                                                       | Declared, never populated client-side.                                                                                                                 |
| `LoginResponse.tokenType`                                                                                     | `types.ts:40`                                                                       | Discarded; `Bearer` hardcoded in the interceptor.                                                                                                      |
| `StatusBadge` defensive branch                                                                                | `tables/StatusBadge.tsx:27`                                                         | `if (!info) return null` — unreachable given the exhaustive `Record`.                                                                                  |
| `[<PaperPlaneTopRight/>, false]`                                                                              | `DiscoverPoolTableItem.tsx:68`                                                      | Hard-coded-`false` branch in `evaluateJSX`.                                                                                                            |
| `DIAMOND_ADDRESS[HYPEREVM]`, `LOWCAP_DIAMOND_ADDRESS[BASE]/[POLYGON]`                                         | `addresses.ts:47-57`                                                                | Unreachable under `CHAIN_IDS = [HYPEREVM]`; the app force-switches off any other chain (`applicationUpdater.ts:10-14`) and hides the network switcher. |
| `src/hooks/cctp/flow/useCctpFlow.ts` + 9 `useStep*` hooks                                                     | —                                                                                   | Zero callers repo-wide.                                                                                                                                |

#### 12.3 Known bugs, ranked by financial exposure

1. **`RefundYourDepositModal.tsx:131-142` — free-text `recipient_address`, zero validation** sent to an irreversible transfer endpoint. Wrong-chain or typo'd address = permanent loss. The correct implementation exists ~200 lines away in `PoolWithdrawModal/index.tsx:72-86`. The placeholder is hardcoded `e.g. 0x...` **even for Solana pools**.
2. **`YourPoolTableItem.tsx:206` / `YourPoolMobileCard.tsx:150` — refund gated on `market_status == Rejected`.** A mis-sent deposit on a healthy pool has **no UI recourse whatsoever**. Discover rows can deposit into rejected markets (`allowRejected: true`) but never render a refund button.
3. **`constants.ts:4` — `MIN_POOL_DEPOSIT_AMOUNT` never participates in a comparison.** Its only consumers are the import and the string interpolation in `MinDepositWarning.tsx:19`. The $5 floor is decorative. The live `GET /v2/configs` (never called) says `minimum_initial_deposit_usdc = 1.5`, `recommended = 2`, `listing_fee_usdc = 1`.
4. **`services/types.ts:193` — `user_address` returned and discarded.** Deposit-address attribution is never verified client-side; a stale bearer token could render another account's address as yours with no discrepancy possible.
5. **`useRefundRejectedPool.ts:13-19` — `error.response.data.error_message` unguarded**, on the fund-moving call, which also has **no timeout** (`src/services/pools/services.ts:14` uses raw axios; the `api` instance's `timeout: 20000` does not apply).
6. **`PoolDetail/index.tsx:34` and `RefundYourDepositModal.tsx:47` — chain fallback to `0`**, which is `DepositChain.Solana`, not a sentinel. The refund site uses `||`, conflating a legitimate `0` with a missing value.
7. **`useAddUserDeposit.ts:18`** — the market-status guard is wired up (five call sites compute and pass it) and then dropped. Combined with `canDepositToMarket`'s default-allow fall-through (`utils/canDepositToMarket.ts:10`), a new backend status string silently gets an enabled Deposit button and an uncoloured raw-string Status cell.
8. **`RefundYourDepositModal.tsx:59-61` — refund amount summed with a hardcoded 18-decimal `fromWei`**, ignoring each row's `token_decimal` (which is present on `UserTransaction`). Understated by 10¹² for a 6-decimal token. Compounded by `marketSearchItemToStubIMarket.ts:30`'s hardcoded `token_decimal: 18`.
9. **`pool-stats.ts:35` — `fromWeiBN(market.total_token_in_pool)` with no decimals argument.** A regression from commit `ebc1d08c7` that leaves the unit test RED (see §12.4) and misreports the token side of the Pool Balance bar for every non-18-decimal token.
10. **`PoolStatsCard.tsx:39` — `chainName: 'Arbitrum one'`** lowercases to `'arbitrum one'` and matches no price-service chain slug (`dexscreener/service.ts:72-75`). Every Arbitrum pool gets `tokenPrice === undefined` → `getPoolStatsCardValues` falls back to `DEFAULT_BALANCE_PERCENT = 50`, rendering a **confident, invented 50/50 pool split**.
11. **`YourPoolsList.tsx:60` — case-sensitive `meta.baseToken.address === item.contract_address`** against a lowercased request address. A checksummed `contract_address` silently fails to match and the mobile price shows `'-'`.
12. **`CheckSymbol.tsx:39-52` — silent redirect on a registry miss.** `canTradeMarket` only requires `symbol_id != null`, not that the id is _resolvable_ in `markets.byId`. Since `['contract-symbols']` refetches only every 300 s and never on focus or mount, a freshly-listed market can be tradable-looking for minutes while `/vibecaps/{symbolId}` bounces the user to `marketIds[0]` — an arbitrary other market.
13. **Registry miss degrades to `$0.00`, not `-`.** When `useMarket({id})` returns `undefined`, `symbolMarket?.pricePrecision` / `?.quantityPrecision` are `undefined` and `formatPrice` defaults `decimalPoints = 2` with `roundingMode: 'down'` (`src/utils/numbers.ts:113,117`). A lowcap at `$0.00001736` renders as **`0.00`** in Entry Price, Size, Open Price, and Close Price.
14. **`ClaimRewardsAccountItem.tsx:25` — `useUpnl` called without `subAccountType`.** Loses the Vibecaps skip and resolves the diamond from the _globally active_ account's type, so every lowcap row fires a pointless RPC and shows `$0.00` uPNL.
15. **`ClaimableRewardsCard.tsx:43` — `disabled={claimableReward === '0'}`** is a strict string compare. `'0.0'`, `'0.00'`, `'0e0'`, or a numeric `0` all leave the button enabled; the modal's own `canRequest` then disables submission — inconsistent gating between card and modal.
16. **`PoolTradeHistoryTable.tsx:137` — duplicate React keys.** `key={item.id}` (= `Number(entity.quoteId)`) while the feed is `quoteEvents`; multiple partial closes of one quote produce multiple rows with the same id. `usePoolHistoryQuotes:65` already sets `quote.historyEventId = event.id`, documented at `src/types/quote.ts:114-115` as "unique per close event", and it is unused.
17. **`DiscoverPoolsTable.tsx:146` — no React `key`** on the row factory (the mobile list does set one).
18. **`PoolDetailTabs.tsx:91-93` — ref mutated during render.** Not concurrent-safe.
19. **`Table/index.tsx:478` falsy-`0` hazard.** `data.slice(totalCount ? 0 : (page-1)*perPage, page*perPage)` — the presence of `totalCount` is the implicit "server-paginated" switch, so a server-paginated table reporting `totalCount === 0` silently reverts to client-side slicing.
20. **`PoolWithdrawModal/index.tsx:101` uses `.toFixed(0)` with `ROUND_HALF_UP`** (BigNumber default; `numbers.ts:5` only sets `EXPONENTIAL_AT`), so a partial withdraw can theoretically request 1 wei more than available.
21. **`PoolWithdrawModal/index.tsx:433-445` — the "address required" error is rendered only inside the manual-input branch.** In connected-wallet mode with an empty address, the user sees a disabled button and no reason.
22. **Pre-`router.isReady` "Pool details not found" flash** (`PoolDetail/index.tsx:59-77`). On a hard load `router.query.contractAddress` is `undefined`, so the query is `enabled: false`; in react-query v5 a disabled query reports `isLoading === false`, so the not-found screen renders for one tick. `router.isReady` is consulted only inside the effect (`:54`), never in the render guard.
23. **The `deposit_chain` self-heal effect depends on the whole `router` object** (`PoolDetail/index.tsx:53-57`) and causes a second `marketDetail` fetch on every cold entry without the query param.
24. **`useNotionalCap`'s `marketId || activeMarket?.id` fallback** (`useNotionalCap.ts:27`) fires a request for the globally active trading market when `symbol_id` is null. Masked in the UI (the card renders `null`), but the wrong request runs every 60 s.
25. **`ListingAuthGuard.tsx:24-38` — the bail-out ref is over-broad.** `authModalWasOpenRef` is set by **any** `openModal !== null`, not only auth modals, so an unrelated modal opening and closing on a gated route triggers the redirect. Also `shallow: true` is inert on the cross-page `/pools/create-pool → /pools` redirect.
26. **`useSignMessageV2` silently returns the literal string `'response'`** when no provider branch matches (`src/callbacks/useSignMessage.ts:77`) — that would be POSTed as a signature.
27. **`ListingSignatureRequestModal.tsx:86-88` — every failure reads as "Signature was rejected."**, including HTTP 5xx, 4xx, timeouts, and a missing callback.
28. **`SignInMessage` query string is hand-concatenated and not URL-encoded** (`services/index.tsx:159`); `uri` contains `https://` so raw `:` and `//` land in the query.
29. **`constructQueryParams` does not URL-encode** (`src/utils/queryParams.ts:9`) — a search term containing `&` or `#` breaks the request.
30. **`FilterPoolModal/index.tsx:178-179` — for `unit === 'time'` the inputs are swapped**: `firstInputKey = maxKey` labelled "From", so the _From_ box writes `listing_time__le`.
31. **The `listing_time` filter round-trip is lossy.** `getInitialFilters` (`helpers.ts:55-65`) converts a stored timestamp into a _relative_ label via `formatTime` (`:180-191`, ceil to d/m/y), and re-submitting reparses it as a fresh offset from `Date.now()`. Reopening and applying without touching anything moves the boundary.
32. **Two active-filter counters disagree.** `DiscoverPoolsContent.tsx:58` counts individual _bounds_ over `FILTER_FIELD_KEYS`; the modal's own badge uses `getActiveFieldCount` (`helpers.ts:193-195`), which counts _fields_. They differ whenever both bounds of one field are set.
33. **`MARKET_SEARCH_FILTER_KEYS` (20) is a superset of `FILTER_FIELD_KEYS` (14).** `user_revenue__ge/__le`, `apr_24h__ge/__le`, `apr_30d__ge/__le` are forwarded to the **public** `market/search` if present in the URL, have no UI, and are not counted by any badge.
34. **`getQueryWithoutFilters` deletes all 20 keys** while the modal edits 14 — resetting wipes URL-only filters the modal never showed.
35. **`sanitizeFilterInput` strips `-`** (`helpers.ts:131-158`), making the `-?` branch of `parseNumberShorthand` (`:95`) unreachable through the UI.
36. **`DiscoverPoolMobileCard.tsx:268-271`** applies the APY colour class from `aprValue` even when `isAprVisible` is false and the printed value is `'-'`.
37. **`PoolStatsCard.tsx:155` omits `addDollarSign: false`** for the pool's USDC side → renders `$1.2K USDC`.
38. **`PoolWithdrawModal/index.tsx:320-326` renders "14 Day"** (singular); `WithdrawalDetailModal/index.tsx:112` uses "Days".
39. **`WithdrawalDetailModal`'s `daysLeft` is frozen at click time** (`AmountCell.tsx:47-58`) and does not tick.
40. **`WithdrawalDetailModal/index.tsx:45-46` shows `useUserProfit` _totals_, not pending-adjusted** balances, under a "Your Balance" heading in a pending-withdrawal context.
41. **`AuthGatedPlaceholder.tsx:20` shows "Sign to view your balance"** under the **Claimable Rewards** heading too.
42. **`useUserProfit`'s query key omits `isAuthenticated` and `marketStatus`** even though `enabled` depends on both (`useUserProfit.ts:11,16`) — the cache entry is shared across auth transitions.
43. **`useWeeklyListingLimit`'s key omits the account** (`:16`) — a wallet switch serves the previous account's cached limit. It also **fails open** (`isLimitReached === false`) while loading or erroring.
44. **`useYourPoolsMarketDeposits` and `useUserTransactions` embed the raw bearer token in the react-query key** (`:33`, `:7`).
45. **Both market-search hooks put the whole `router.query` object in the key**, so any unrelated param change (including `tab`) forces a network round-trip.
46. **`useTokenMetaData` and `useTokenValidate` share the key `['tokenMetaData', tokenAddress, chain]` with conflicting `enabled`/`retry` options** — RQ merges by first-registered observer, so the retry policy is non-deterministic.
47. **`useTokenValidate`'s DexScreener key omits `chain`** (`:50`) — the same address on two chains shares one cache entry.
48. **`useTokenValidate.ts:67-69` names its results `totalMarketCap` / `totalLiquidity`** while they hold a **single** pair's values (the highest-`liquidity.usd` pair), not a sum.
49. **`PoolOpenQuotesTable` sort does not reset the page** — `currentPage` is untouched when `onSortChange` fires.
50. **Split pagination in open quotes**: server-side `orderBy` + client-side slicing over a `first: 101` cap. Quote #102+ is unreachable and uncounted. SYMM had 222 open quotes at measurement time; the tab shows at most 101 behind a `+100` badge.
51. **`useTransactionHistory` has no `refetchInterval`** — the Deposits/Withdrawals tab and its badge only refresh on remount, on `usePoolWithdraw`'s invalidation, or never (global `refetchOnMount: false` and `refetchOnWindowFocus: false`).
52. **`GetRevenue` is always called with the default `DEFAULT_MARKET_ID = 1`** — the "24h Revenue" and "Lifetime Revenue" tiles are **not** pool-scoped.
53. **The lowcap price socket sends no subscribe frame** and is a pure firehose resolved through an uninvalidated `lowcapNameToIdsCache` `useRef` (`hedgerUpdater.ts:492-504`). A new `symbol_id` appearing under an already-cached market _name_ is **permanently** stranded for the page's lifetime.
54. **Hard-coded price fields.** `hedgerUpdater.ts:482-485` stamps `fundingRate: '0.00004335'`, `nextFundingTime: 1741824000000` (a fixed past timestamp), and `indexPrice: '0.19743943'` onto **every** lowcap market. Only `markPrice` is real. The pool tables happen to read only `markPrice`.
55. **`useMarket` and `usePrice` resolve against different hedgers on `/pools`.** All four pool tables call `useMarket({id})` **without** `preferredHedgerType` while the price calls pin `ENIGMA`. `activeHedgerType` is persisted to localStorage and is set by `/vibecaps` and `/majors` but **never by `/pools`** (`CheckChainHedgerChecker.ts:20-24` explicitly excludes it). Visit `/majors` once, then `/pools`, and every pool table resolves precision against `markets[RASA]` — empty on HyperEVM.
56. **No error state anywhere in the detail tables.** All four data hooks return `isError` and `refetch`; neither is wired to any UI. A failed subgraph or REST call renders as an indistinguishable "empty" sleeping-Chepe.
57. **No WS-disconnect banner on `/pools`.** `LocationAndConnectivityChecker/index.tsx:23,63` gates its banner on `router.pathname.startsWith(routes.majors.index)`.
58. **`ListingDepositModal/index.tsx:28-58` runs the QR effect unconditionally**, so with `publicAddress === ''` it renders a QR of the empty string.
59. **`Review.tsx:56-59` — QR promise chain with no `.catch` and no unmount guard**; `:32,88,92` cast `wallet_public_key` `as string` while it can be `undefined` (reachable via the stepper gating hole below).
60. **The Stepper bypasses every gate.** All three steps are always clickable (`Stepper/index.tsx`), and `onStepChange` only runs `methods.trigger(fields)`. Clicking step 2 from step 1 bypasses `isSupported` and `isLimitReached` (button-only gates); clicking step 3 from step 2 **skips the create request entirely**, rendering `Review` with `addMarketResponse === undefined` → `"Only deposit undefined to this address."`
61. **`CreatePool/index.tsx:80` destructures only `mutate`** — no `isPending` guard on the Create Pool button, so double-submit is possible.
62. **`SliderInput` has three inconsistent defaults**: form default `'20'` (`index.tsx:44`), slider falsy-fallback `[5]`, read-out nullish-fallback `5`. Its tick labels `2/5/10/15/20` are hardcoded, evenly spaced, and misaligned against a 1→20 track.
63. **`PresetInput`'s `max: 100` is not enforced at the input level** — you can type `999`; only the RHF rule flags it, and only on touch/submit.
64. **`SearchableSelectBase` never syncs `value`** (`FormInputs/SearchableSelect.tsx:65`), so an RHF `reset`/`setValue` on `DepositChain` would not move the visible selection.
65. **Console logs in production paths**: `CreatePool/index.tsx:109` (`'Final data:'`), `useAddUserDeposit.ts:46` (`'e'`), `apolloClients.ts:36`.
66. **Three `//@ts-ignore`s**: `CreatePool/index.tsx:100` (error body), `TokenBasics.tsx:84` (`errors.DepositChain`), `PresetInput.tsx:62` (`setValue`).
67. **`Stepper`'s prop is misspelled `orintation`** (`Stepper/index.tsx:9,14`), and `CreatePool/index.tsx:150` passes the typo.
68. **A new `ApolloClient` is constructed on every `queryFn` invocation** (`apolloClients.ts:27-29`) combined with `fetchPolicy: 'no-cache'` — the Apollo cache is inert and the allocation is wasted.
69. **`usePoolHistoryQuotes`'s key omits `typeIn`** (`:30`) — constant today, brittle.
70. **`getNotionalCap` uses a non-null assertion** `effectiveMarketId!` (`useNotionalCap.ts:37`) protected only by `enabled`.
71. **Duplicated Filters button** — verbatim copies for desktop (`DiscoverPoolsContent.tsx:105-119`, `max-md:hidden`) and mobile (`:129-143`, `hidden max-md:flex`).
72. **Both list and table trees are always mounted** (CSS-only branch), doubling per-row `useAddDeposit`, `useListingAuth`, and `useTokenImageByContract`.
73. **Two parallel error-body types for the same API**: `TokenSupportError` (`services/types.ts:212-216`, used by withdraw and retry) and `ListingApiErrorBody` (`claim-rewards-modal/utils.ts:3-7`, used by claim).
74. **Two byte-identical status unions**: `TransactionStatus`/`TransactionType` (`services/types.ts:371-372`) and `UserTransactionStatus`/`UserTransactionType` (`src/services/pools/types.ts:8-9`).
75. **`src/services/pools/services.ts` bypasses the shared `api` instance** — hand-rolled `Authorization`, no 401 auto-clear, no timeout, untyped responses.
76. **Backend vocabulary split**: `refound` in `IDepositHistory`/`DepositStatus` vs `refund` in `TransactionStatus`/`UserTransactionStatus`.
77. **`RetryListingButton` is the only Pools row component importing `lucide-react`** (`LoaderCircle, Clock3, AlertCircle, RotateCcw`, `:5`) while using the in-house `Retry` icon for the button face; the rest of Pools uses `@/components/Icons/v2/*`.
78. **Retry cooldown is a one-shot formatted string**, not a live countdown — it only refreshes on the 90 s list poll or the 30 s-stale info query.
79. **One `retryListingInfo` query per rejected row** — no batching.
80. **`ListingSignatureRequestModal.tsx:65-67`** — a hardcoded static "Logged In" pill, not derived from any state. The whole modal is un-i18n'd (raw English strings) unlike the rest of the Pools tree.

#### 12.4 The one pools test, and it is RED

`test/unit/components/App/Pools/components/PoolDetail/pool-stats.test.ts` — 3 vitest cases against `getPoolStatsCardValues`, no mocks, no renderer, no network.

| #   | Title                                                              | Inputs                                                                                                                                                                                                 | Assertions                                                                                                                 | Status    |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1   | `uses token decimals when normalizing the token balance` (`:6-25`) | `total_token_in_pool: toWei('250', 6)`, `total_usdc_in_pool: toWei('1000')`, `token_decimal: 6`, `tokenPrice: '4'`, `notionalCap {used: 321.45, available_to_long: 123.45, available_to_short: 67.89}` | `openInterest === 321.45`; `tokenBalance.toString() === '250'`; `usdcBalance.toString() === '1000'`; `tokenPercent === 50` | **FAILS** |
| 2   | `clamps exhausted liquidity sides to zero` (`:27-44`)              | `available_to_long: -12`, `available_to_short: 45`                                                                                                                                                     | `→ 0`, `→ 45`                                                                                                              | passes    |
| 3   | `keeps a neutral split when token price is unavailable` (`:46-62`) | `tokenPrice: null`                                                                                                                                                                                     | `tokenPercent === 50`                                                                                                      | passes    |

Case 1 cannot hold against the current implementation. `pool-stats.ts:35` calls `fromWeiBN(market.total_token_in_pool)` with the default `decimals = 18`, so `250000000 / 1e18 = 2.5e-10` → `.toString()` yields `'0.00000000025'` (with `EXPONENTIAL_AT: 30`), not `'250'`; and `tokenPercent ≈ 1e-10`, not `50`.

Git proves the regression direction:

- `886bace6d` _"fix(pools): cover pool stats edge cases"_ (2026-04-15) **added** the test **and** changed the line to `fromWeiBN(market.total_token_in_pool, market.token_decimal)`.
- `ebc1d08c7` _"fix: calculate token balance in right way"_ (2026-06-16) — a **1-line commit** — reverted it, without touching the test.

`.github/workflows/unit-test.yml:41-42` runs `yarn test:unit` on every PR and on push to `main`. Either this test has been failing in CI since 2026-06-16, or CI has been red/ignored. **This is a live correctness question about pool token balances for non-18-decimal tokens** — 6-decimal USDC-style tokens are exactly case 1.

#### 12.5 Untested flows — everything except those three assertions

There is **no MSW/nock/fetch-mock anywhere in the repo**, and the unit project has **no `setupFiles`** (`vitest.config.mts:16-23`) — so no `@testing-library/jest-dom` matchers and no global mocks for any unit test. There are **zero Pools stories**, so the storybook-vitest browser project asserts nothing about pools. E2E (`test/e2e/`) has 3 executing tests, all VibeCaps; `grep -rin "pool" test/` hits only inside `pool-stats.test.ts`.

Uncovered, in rough risk order:

- **Deposit-address issuance and the deposit UX** (`AddDeposit` → `ListingDepositModal`) — the step where a user can lose funds. Zero coverage of any kind.
- **Refund** (`refundRejectedPool`, `RefundYourDepositModal`) — zero coverage.
- **Withdraw** (`PoolWithdrawModal`, `usePoolWithdraw`, `PostWithdraw`, `WithdrawalDetailModal`).
- **Claim** (`claim-rewards-modal/**`, `useClaimProfit`, `ClaimProfit`, `useUserProfit`).
- **Create-pool wizard** end to end, plus token validation and the weekly limit.
- **Listing auth** (`ListingAuthGuard`, `useListingAuth`, `useListingLogin`, SIWE round-trip, `AuthGatedPlaceholder`).
- **Retry** (`RetryListingButton`, `useRetryMarketListing`, `useRetryListingInfo`).
- All 20 exported service functions — no URL-construction, query-param-encoding, or response-typing coverage.
- All 22 hooks — no query-key, `staleTime`, or `enabled`-gating assertion exists for any pools query.
- `toQuoteFromGraph()` normalization — the docs' most emphatic correctness rule — has no test anywhere in the repo.
- Trivially testable and untested pure helpers: `canDepositToMarket`, `canTradeMarket`, `formatListingAge`, `explorerUtils`, `listingSearchMetrics`, `marketSearchItemToStubIMarket`, `FilterPoolModal/helpers.ts`, `claim-rewards-modal/utils.ts`, `getDaysLeft`, `routes.pools.poolDetail`. `canDepositToMarket` / `canTradeMarket` are gating predicates — the highest-risk untested logic after `pool-stats`.

Testability blockers for anyone adding coverage: (a) `NEXT_PUBLIC_POOLS_ENABLE` is absent from `.env.example`, so a CI-built app may render no pools UI; (b) the unit project needs `setupFiles` wiring before any component test; (c) e2e only runs post-deploy against a live Vercel URL, so any pools e2e would hit **production listing/solver backends with a real wallet**.

#### 12.6 Slice disagreements — recorded, not resolved

1. **`SearchConditionalOrders` resolved URL.** The _service-layer_ and _pool-detail-tables_ slices both compute `https://conditional-orders-handler-lowcap85.rasa.capital/api/v5/api/v4/search/` (baseURL path + relative path, axios `combineURLs`). The _state-chain-nav_ slice computes `https://conditional-orders-handler-lowcap85.rasa.capital/api/v4/search/`, reasoning that the leading `/` in `'/api/v4/search/'` resets the path. **Both agree the URL is wrong**; they disagree on how. Since the endpoint is dead code it never fires. An SDK port should use the canonical form `` `${baseUrl}search/` `` (`src/services/triggerMarketOrders/service.ts:219`).

2. **Discover table data source.** `Docs/Pools_Discover_Table_Data_Sources.md:19-30` sources Price/Mkt.Cap from the price service and Vol/Liquidity/OI from the Enigma solver, keyed off `GET /market/public-market-deposits/summary/{start}/{size}`. `Docs/Pool_Detail_Page.md:91,95-96,106` and the _entry-tabs-discover_ slice both say every metric comes from listing `GET market/search` fields on `MarketSearchItem`. **The code agrees with the latter** — `public-market-deposits` does not exist in `services/index.tsx` — but the price/market-cap column mapping needs re-derivation, since `market/search` may or may not carry `price_usd` (the type declares it; the live endpoint does not return it).

3. **`AddMarketResponse.deposit_amount`.** The _auth-listing_ slice calls it "captured and dropped (dead data)". Gap-fill 4 established it is **read into React state** at `CreatePool/index.tsx:88` and passed to `<Review>`, but never rendered by `Review.tsx`. Half-dead: reachable, never displayed. `field_amount` is fully dead in every revision.

4. **`useDexscreenerTokenDetails` transport.** The _your-pools_ slice describes it as a DexScreener fetch; the _pool-detail-shell_ and _service-layer_ slices establish that **despite the name it does not call dexscreener.com** — `getDexscreenerTokenDetails` fetches `GET {PRICE_SERVICE_API_BASE_URL}/metadata` and filters client-side (`src/services/dexscreener/service.ts:165-195`). The separate `GetTokenDexScreenerData` in `services/index.tsx:199-201` _does_ hit `api.dexscreener.com`, and is used only by the create-pool wizard. Two different services behind similar names.

5. **`GetTransactionHistory` default page size.** `services/index.tsx:236-249` defaults `size = 150`; `useTransactionHistory.ts:19-46` defaults `size = 10`. Divergent defaults for the same endpoint, flagged by the _service-layer_ slice.

6. **`HISTORY_FETCH_SIZE`.** The branch history (`5c6895fad`) introduced `50`; commit `701a6bfb1` raised it to `110`. Current code is `110` (`PoolDetailTabs.tsx:19`). Slices citing `50` describe the pre-`701a6bfb1` state.

7. **`useWeeklyListingLimit` constant naming.** One slice transcribes `NEAR_LIMIT_REMAINING`, another `NEARLIMIT_REMAINING`. Value is `5` either way.

8. **Enigma's chain.** `Docs/Third_Party_Services.md:20` says HyperEVM; `Docs/Enigma_Hedger.md:191-193` says `chainId: 8453 // BASE mainnet`; `Docs/Pool_Detail_Page.md:150` says `LOWCAP_DIAMOND_ADDRESS[BASE]`. **The code says HyperEVM 999** (`src/constants/hedgers.ts:84`, `src/constants/chains.ts:50`), and git shows the switch happened in commit `22eeed305` (2026-03-17) while the doc was last touched 2026-05-13 without updating those lines. `LOWCAP_DIAMOND_ADDRESS[BASE]` serves **no live pools**: every pools consumer hard-pins `FALLBACK_CHAIN_ID`, the subgraph is HyperEVM-only, and `applicationUpdater.ts:10-14` force-switches the wallet off any other chain.

9. **Positions vs Open Quotes.** No slice reconciled them; gap-fill 2 did, numerically. They are the **same book, same side, trader-side, not inverted** — see [§10.7](#107-verified-reconciliation-positions-vs-open-quotes). They genuinely diverge on entry price and notional definition.

10. **`main_pool`.** Multiple slices flagged it as an unread field that might be the pool's on-chain identity. Gap-fill 1 proved by live API + DexScreener cross-check that it is the **token's main third-party AMM pair address** (base58 for Solana markets, frequently `null`, supplied by the lister as an optional `pool_address` input the frontend never sends). The deleted `PoolCard` (`1824005347f`, `:70-71`) labelled it _"Main liq Pool"_.

#### 12.7 Documentation vs code

| Doc claim                                                                                                  | Reality                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Pool_Detail_Page.md:35,84-87,99` — `usePoolDetail.ts` + `GetMarketDeposits({query, size:1})`              | Neither exists. The hook is `useMarketDetail.ts` → `GET /market?token_contract_address=&deposit_chain=` (commit `abd43ede4`).                                                                                                   |
| `Pool_Detail_Page.md:141` — `GetUserDeposit({contract_address})`                                           | Removed by commit `0ac5d115d`. Replaced by `GetTransactionHistory` + `GetUserProfit`.                                                                                                                                           |
| `Pool_Detail_Page.md:44` — `poolDetail: (contractAddress: string) => …`                                    | Signature takes an optional `depositChain` and appends `?deposit_chain=`.                                                                                                                                                       |
| `Pool_Detail_Page.md:21` — TVL / 30D APY / Claimable Rewards are "placeholders"                            | All three render live data now.                                                                                                                                                                                                 |
| `Pool_Detail_Page.md:21` — `SummaryCards.tsx`                                                              | It is a **directory** with 4 files, including the undocumented `AuthGatedPlaceholder.tsx`.                                                                                                                                      |
| `Pool_Detail_Page.md:111,123,148,153` — `symmio_symbol_id`                                                 | Fully dead; everything normalized onto `symbol_id`.                                                                                                                                                                             |
| `Pool_Detail_Page.md:151` — "Chart: Coming Soon (no TVL/rewards history endpoints yet)"                    | `GET /v2/market/chart/rewards`, `GET /v2/profit/chart/rewards`, and inventory `GET /api/v1/markets/{symbol}/tvl-history` all exist and are never called.                                                                        |
| `Pools_Discover_Table_Data_Sources.md:19,29` — `GET /market/public-market-deposits/summary/{start}/{size}` | Does not exist in `services/index.tsx`.                                                                                                                                                                                         |
| `Pools_and_Permissionless_Listing.md:38` — deposit instructions must emphasize "the **exact amount**"      | Superseded by the flat `MIN_POOL_DEPOSIT_AMOUNT = 5` when commit `a1795cdc5` removed `DepositAmountModal.tsx` and the amount fields.                                                                                            |
| `Third_Party_Services.md:74` — listing docs at `https://listing.vibe.trading/docs`                         | **Dead (HTTP 521).** The live OpenAPI is `https://listing85.enigma.bz/openapi.json` (title _"Vibe PermissionLess Listing"_, v0.1.0), with `/docs` and `/redoc` — **no `/v2` prefix on the docs, but all routes are `/v2/...`**. |
| `Unit_Test.md:40-41` — `yarn test:all`                                                                     | Not a script in `package.json`.                                                                                                                                                                                                 |
| `Unit_Test.md:109` — `jest.setup.ts`                                                                       | Does not exist. The real setup file is `.storybook/vitest.setup.ts`, wired only into the storybook project.                                                                                                                     |
| `FRONTEND_ONBOARDING_PLAN.md:401-402` route table                                                          | Omits `/pools/[contractAddress]`.                                                                                                                                                                                               |
| `Data_Sources_and_Services.md:44` — "Queries: `src/apollo/queries/*`"                                      | It is a single file, `src/apollo/queries.ts`.                                                                                                                                                                                   |
| `Routes_and_Pages.md:38` — "/pools/create-pool (desktop-only; mobile redirects to VibeCaps)"               | **No mobile redirect exists.** The wizard is fully usable at any width; the only route-level redirects are the two auth ones.                                                                                                   |
| `marketSearchItemToStubIMarket.ts:14` JSDoc — "refund modal open from discover row"                        | That path does not exist.                                                                                                                                                                                                       |
| `src/lib/hooks/useContract.ts:13-14` comment — "In simulator mode, always use Base chain"                  | The code uses `FALLBACK_CHAIN_ID` (HyperEVM). Same stale comment at `useSupportedChainId.ts:13`.                                                                                                                                |
| `services/types.ts:312,353,363,388` JSDoc — `GET /v2/market`, `GET /v2/profit/...` etc.                    | The `/v2/` comes from `baseURL`; the axios paths are `/market`, `/profit/{addr}`, `/market/withdraw`, `/claim`.                                                                                                                 |

#### 12.8 Endpoints the backend serves and Vibe-ui never calls

Discovered against the live `https://listing85.enigma.bz/openapi.json` (35 routes total). Consumed: `market/search`, `market/search-user`, `auth/sign-in-message`, `auth/login`, `market/add-market`, `market/deposit-address`, `market/retry-listing`, `market/retry-listing-info`, `market/token-meta-data`, `market/token-support`, `market/transaction-history/{start}/{size}`, `market/withdraw`, `market/weekly-listing-limit`, `market/refund`, `market/user-transactions/{start}/{size}`, `market`, `profit/{addr}`, `claim`.

**Never called:**

| Route                                                                     | What the client is missing                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /v2/configs`                                                         | `recommended_initial_deposit_usdc`, `minimum_initial_deposit_usdc` (**$1.5**, not $5), `listing_fee_usdc`, `supported_deposit_chains[]`, `rate_limits`, `protocol_reward_share_percent` (30)                                                                  |
| `GET /v2/market/listing-status`                                           | `{current_step, steps[], market_status, error_code, error_detail, retry_count, retry_limit}` — **a real listing state machine the UI reimplements from `market_status` alone**                                                                                |
| `GET /v2/market/chart/rewards`, `GET /v2/profit/chart/rewards`            | The reward/TVL history the UI ships as a "Coming Soon" placeholder                                                                                                                                                                                            |
| `GET /v2/market/metrics`, `GET /v2/market/user-metrics`                   | `balance_changes`, `profit`, `revenue_distribution`; `earned_profit`, `total_claimed`, `total_deposit`, `total_withdraw`                                                                                                                                      |
| `GET /v2/market/user-shares/{token_contract_address}`                     | `UserShareResponse`                                                                                                                                                                                                                                           |
| `GET /v2/market/total-reward`, `GET /v2/profit/total-reward`              | `TotalRewardSchema`                                                                                                                                                                                                                                           |
| `GET /v2/market/maintenance-fees`                                         | `{token_amount, usdc_amount, timestamp, tx_hash}` — the only pool surface with a real tx hash                                                                                                                                                                 |
| `DELETE /v2/market/withdraw/{withdraw_id}`                                | **Cancel a pending withdrawal — the UI has no cancel path at all**                                                                                                                                                                                            |
| `GET /v2/claim/{claim_request_id}`, `GET /v2/claim/search/{start}/{size}` | Claim history / restore                                                                                                                                                                                                                                       |
| `GET /v2/pools`                                                           | Batch `market_cap` (from inventory TVL) + APR by address                                                                                                                                                                                                      |
| `GET /v2/auth/nonce`, `GET /v2/auth/me`                                   | SIWE nonce + session check — the latter would give the client an expiry signal it currently lacks                                                                                                                                                             |
| `GET/POST /v2/market/config`                                              | Per-user market config                                                                                                                                                                                                                                        |
| **removed client-side** `POST /market/deposit-status`                     | `{deposit_amount, expected_amount, market_status, deposit_status}` — the **only real deposit-detection signal that ever existed**, deleted in commit `945011569` along with the "Awaiting Deposit" / "Deposit Submitted" toasts and `DepositsTable/index.tsx` |

Inventory service (`https://inventory85.enigma.bz/openapi.json`, ~28 routes) — the client calls exactly one (`/v1/markets/tvl-aggregate`). Also public: `GET /api/v1/markets/tvl?addresses=…` (the byte-identical source of `total_*_in_pool` and `tvl`), `/markets/available`, `/markets/{symbol}/available`, `/markets/funding-rate`, and **`/markets/{symbol}/tvl-history`**. Everything that would let you audit the balance sheet — `TransferJournalResponse` (`source_address/type/chain_id → destination_*`, `reason ∈ {SETTLEMENT, PLATFORM_FEE}`, `state`, `tx_hash`), `SwapJournalResponse` (`swapper ∈ {order_handler, stabilizer, buyback_handler, maintenance_fee}`, `tx_hash`) — is gated behind `X-API-Key`.

Inventory TVL definition (from its own spec):

```
total_usdc  = available_usdc + locked_usdc_for_short + locked_usdc_for_net_margin + reserved_usdc
total_token = available_token + locked_token_for_long + reserved_token
tvl         = total_token * price + total_usdc          (null when price unavailable)
```

Those are **bucket names in a database**, not on-chain slots.

#### 12.9 Type-vs-live-API drift

| Type                               | Missing field the live API returns                                                                                       | Declared field the live API does not return                                                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UserProfitResponse`               | `claimed_reward`                                                                                                         | —                                                                                                                                                                                   |
| `ITransactionHistory`              | `transaction_id`, `transaction_hash`                                                                                     | —                                                                                                                                                                                   |
| `UserTransaction`                  | `transaction_hash`                                                                                                       | —                                                                                                                                                                                   |
| `ClaimProfitResponse`              | `transaction_hash`                                                                                                       | —                                                                                                                                                                                   |
| `MarketSearchItem`                 | `market_cap`, `apr_1h`, `apr_6h`, `apr_24h`, `apr_30d`, `apr`, `tvl_driven_apy_*`, `price_driven_apy_*`                  | `price_usd`                                                                                                                                                                         |
| `MarketDetailResponse`             | `maintenance_fees`, `reward_1h/6h`, `solver_revenue_1h/6h`, `price_driven_apy_*`, `tvl_driven_apy_*`, `apy_1h`, `apy_6h` | —                                                                                                                                                                                   |
| `MarketDetailResponse.tvl: string` | —                                                                                                                        | **`tvl` is nullable**; a live `listed` market returned `null` while `SummaryCards/index.tsx:29` does `fromWei(market.tvl)` → coerces to `'0'` → renders a confident **"$0.00" TVL** |
| `AddMarketPayload`                 | `pool_address` (optional input echoed back as `main_pool`)                                                               | —                                                                                                                                                                                   |

`apy_*` is often `"0"` on live markets whose `tvl_driven_apy_*` / `price_driven_apy_*` carry the real (signed) numbers — and `PoolStatsCard.tsx:26` renders `apy_lifetime` as "Total APY".

**Transaction hashes exist on the wire and the UI drops them.** There is no transaction-hash explorer link anywhere in the pool UI — `explorerUtils.ts` only builds token-contract links and `intent.symmscan.com` position links.

---

### 13. Open questions for the SDK port

#### 13.1 Must be answered by the listing-service vendor

1. **Is `POST /market/deposit-address` idempotent per (bearer subject, token, chain)?** The OpenAPI summary reads _"If user have wallet return it, else create new one"_, but the client uses a `useMutation` with no cache and no diff, so a rotating address would be invisible and un-detectable. An SDK should cache the address as a query and surface a change.
2. **Is `POST /market/deposit-status` still live?** It is the only deposit-detection signal that ever existed (removed client-side in `945011569`, request `{wallet_public_key, deposit_chain}`, response `{deposit_amount, expected_amount, market_status, deposit_status}`). Its absence is why "Confirm Deposit" is a no-op and the review window is a black box. Note the response's `expected_amount` implies an exact-amount contract the current UI does not communicate.
3. **When is `symbol_id` assigned relative to `market_status = 'listed'`?** `canTradeMarket` requires both conditions independently, and `Docs/Pools_and_Permissionless_Listing.md:26-27` orders admin approval _before_ solver ingest — suggesting a real gap. Confirm before encoding it.
4. **Can `symbol_id` ever change or be reused?** Structural evidence says no (lowcap ids are dense 1…17; majors are sparse 1…2793 with retired ids; it is the join key for token-vendor metadata, the `/vibecaps/{id}` URL, the subgraph `symbolId`, and `BoostedToken.symbol_id`). Nothing clears it on `delisted`. **Unverified.**
5. **What is the authoritative minimum deposit?** The client renders `$5`; `GET /v2/configs` says `minimum_initial_deposit_usdc = 1.5`, `recommended = 2`, plus a `listing_fee_usdc = 1` the UI never mentions.
6. **What is the authoritative withdrawal cooldown?** `WITHDRAWAL_COOLDOWN_DAYS = 14` is a client constant with no corresponding backend field.
7. **Why does `*_position_avg_open_price` differ from the on-chain/subgraph `avgOpenPrice`?** Up to 44% on live markets. `getPartyBAggregatedFunding` returns 0 and `getPartyBAggregateFundingDebt` reverts on the deployed diamond, so the adjustment is unexplained.
8. **Is `age` a timestamp or a duration?** `MarketDetailResponse` carries both `listing_time` and `age`; `PoolStatsCard.tsx:118` is the only call site that feeds `age` to `formatListingAge`, which expects a unix timestamp.
9. **Does `market/search` accept `user_revenue__*` / `apr_24h__*` / `apr_30d__*`?** They are forwarded to the _public_ endpoint if present in the URL but have no UI and no counterpart on `MarketSearchItem`.
10. **What are the real rate limits?** The live spec mentions "5 requests per 24 hours per user per market" for `POST /claim`; nothing else is documented and `GET /v2/configs.rate_limits` is never read.

#### 13.2 Design decisions the SDK must make

11. **Model the lifecycle as server-owned and read-only.** Expose exactly two writes that affect it (`addMarket`, `retryListing`) and treat `market_status` as an opaque enum with a default-deny (not default-allow) fall-through for unknown values — the opposite of `canDepositToMarket`.
12. **Never derive tradability from status alone.** Port `canTradeMarket`'s two-condition form and go further: require `symbol_id` to be **resolvable in the hedger market map**, not merely non-null, before enabling a trade route. That closes the silent-redirect defect. Also invalidate `['contract-symbols', hedgerType]` whenever a market transitions to `listed`, instead of waiting out the 300 s timer.
13. **Carry an explicit perspective flag on every position/quote type.** The natural core shape is `{ symbolId, side: 'LONG' | 'SHORT', perspective: 'PARTY_A' }`. The pool/LP view is `-1 ×` size, `-1 ×` uPnL, and `LONG ↔ SHORT` swapped. Do **not** infer the flip from "we asked for partyB's aggregate" — the contract's own partyB view is still keyed by partyA's `positionType`.
14. **Do not treat `*_position_avg_open_price` / `*_position_value` as reconcilable with per-quote `openedPrice`.** They are a different, unexplained basis, and the two surfaces use different notional definitions (entry-notional vs mark-notional).
15. **Model `deposit_chain` as a market-key discriminator, not a chain to transact on.** It is half of the composite primary key `(token_contract_address, deposit_chain)` plus a metadata/explorer/payout-format selector. `Solana = 0` is a real value — every guard must be `!= null`, never truthiness.
16. **Type `main_pool` as `mainLiquidityPoolAddress?: string`** and document it as a third-party AMM pair on the token's own chain, possibly base58, frequently null. Do not name it "pool address" — it will be read as the SYMMIO pool.
17. **State the custody model as a first-class doc property.** Deposits go to a backend-generated EOA by manual transfer; withdrawals are JWT-authorized REST calls with a free-text destination; claims are backend-broadcast transfers. Every LP balance is a database row. Model the three-way trust boundary explicitly: Listing service (LP shares, per-user) → Inventory service (market balance sheet, per-symbol) → SYMMIO lowcap diamond (solver PartyB margin, commingled across all markets).
18. **Validate every user-supplied payout address at the SDK boundary**, chain-aware (EVM checksum via `getAddress`; a _properly anchored_ base58 check for Solana — the current `isSolanaAddress` regex is unanchored and admits zero-free EVM addresses). Never ship a refund/withdraw call that accepts arbitrary text.
19. **Decide the unit contract explicitly per field.** `claimable_reward` is a **plain decimal string** while every sibling on the same response is 1e18. `user_share_percentage` is a plain number while `apr` is 1e18. `buyback_ratio` is a plain integer percent. `notionalCap.*` are plain USD floats. An SDK should normalize all of these at the boundary and document the wire form.
20. **Respect `token_decimal`.** Three separate sites hardcode 18 (`pool-stats.ts:35`, `RefundYourDepositModal.tsx:60`, `marketSearchItemToStubIMarket.ts:30`). Decide once whether the listing service's `total_token_in_pool` / `UserTransaction.amount` are token-decimals or always-18, and encode it.
21. **Expose cooldowns and limits as live values, not one-shot strings.** `remaining_cooldown_seconds` and `reset_at` should drive countdowns.
22. **Surface `isError` and `refetch`.** No pool table in Vibe-ui distinguishes "empty" from "failed"; an SDK that returns both should make the distinction cheap to render.
23. **Do not carry `field_amount`, `IDepositHistory`, `DepositStatus`, `symmio_symbol_id`, `additional_chains`, or `cex_list` into the SDK** without a vendor statement — all are unconsumed and at least two are believed to be backend typos or vestiges.
24. **Normalize the `refound`/`refund` vocabulary split** rather than propagating it.
25. **Decide whether the SDK owns the `contract-symbols` registry.** `Market.id === ContractSymbol.symbol_id` is the single load-bearing join, and Vibe-ui's 300 s no-invalidation, no-refetch-on-focus policy is the root cause of the freshly-listed-pool failure modes. An SDK that owns pool listing should probably own registry invalidation too.
26. **Chain-slug normalization for price lookups.** `DEPOSIT_CHAIN_OPTIONS[].label.toLowerCase()` is not a valid price-service/DexScreener chain slug (`'Arbitrum one'` → `'arbitrum one'` ≠ `'arbitrum'`). Ship an explicit `DepositChain → slug` table.
27. **Decide the pending-withdrawal exit story.** There is no finalize step, no cancel path (despite `DELETE /v2/market/withdraw/{withdraw_id}` existing), and no status polling — the SDK should at minimum expose the cancel endpoint and a withdrawal-status query.

---

_Compiled from ten slice maps and six gap-fill investigations against `/symmio/Vibe-ui` @ `staging`. Every claim above is traceable to a `file:LINE` citation, a live API response, a deployed-contract read, or a named git commit._
