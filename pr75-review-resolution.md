# PR 75 review resolution

Review source: [SDK PR #75 comment and attached Markdown](https://github.com/SYMM-IO/Trading-SDK/pull/75#issuecomment-6415804272).

Implementation starts from SDK commit `43e4455c07996b70ce39996abd79e2ea54a19d54` on `feature/VIBE-1902/sdk-pools`. The user approved the revised SDK design before implementation. This record covers the SDK review response; it does not claim the companion app branches are migrated to this revised API.

## Resolution matrix

| Finding                                         | Resolution                                                                                                                                                                                                             | Regression evidence                                                                                                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1: third-party enrichment                      | Removed the enrichment actions, selectors, exports, tests and reference page. Consumers supply prices.                                                                                                                 | Source/export search and packed-consumer verification.                                                                                                |
| P2: strict sign-in checks                       | Fresh server challenges are signed as issued. Only prefetched challenges are matched to wallet, deployment, origin, statement and expiry; mismatches fetch afresh.                                                     | `auth/authenticate-listing.test.ts`: mismatch, expired challenge, empty statement and trailing URI.                                                   |
| P14: optimistic ledger                          | Removed the React cache-patching ledger and core profit projector. Mutation hooks retain normal targeted refresh behavior.                                                                                             | Removed exports and existing mutation-hook regression suite.                                                                                          |
| P3: Solana case joins                           | Join backend aliases against the catalog, preserve outgoing canonical spelling, and keep distinct exact catalog identities separate. Ambiguity is an explicit gap.                                                     | `portfolio/review.test.ts`: mixed-case deposits/refunds and distinct catalog identities. Live backend casing still requires stage QA.                 |
| P4: inconsistent filters                        | Portfolio accepts deployment, authentication, ordering, reward window and caller prices. Search and deposit-chain filtering happen after full assembly.                                                                | Portfolio test verifies runtime filter extras are not forwarded to just one source.                                                                   |
| P5: event snapshots                             | Preserve absent quote values, overlay event amounts onto quantityToClose, and document fees as cumulative per quote.                                                                                                   | Trade-history fixture includes owner, IDs, timestamps and fees; null liquidation price and partial-close amount asserted.                             |
| P6/P7: incompatible inputs and float arithmetic | Four projections accept normalized SDK results. Token, LP and deposit/refund arithmetic uses bigint; USD and percent outputs remain unformatted numbers.                                                               | Type-level group tests, exact large wei, full refund, dust and split-conservation fixtures.                                                           |
| P8: legacy config                               | Correct both old initial-deposit fields and new nullable fields; preserve the separate universal floor; unknown rate limits become null.                                                                               | `listing-config/legacy-config.test.ts` and existing config tests. Live legacy endpoint still requires stage QA.                                       |
| P28: challenge prefetch                         | Optional `prefetchChallenge`, off by default. Wallet/deployment/origin/statement cache identity, one-time nonce consumption, expiry refresh and failure fallback. Replacement fetching does not delay login.           | React prefetch tests cover shared-hook nonce consumption, rejection, wallet/origin changes, explicit signer, failed prefetch and replacement latency. |
| P29: four grouped APIs                          | Added portfolio, position, statistics and open-position reads, query factories and composed React hooks. Removed obsolete scalar modules. React observes existing source queries rather than a second aggregate cache. | Normalized-input type tests, fixture parity, source-cache reuse and disabled/private wallet-switch tests; published-smoke fixture.                    |
| P10: incomplete/unbounded reads                 | Ten-page cap, repeated-page detection and source gaps. Unknown statuses remain null; incomplete history cannot override authoritative deposits. Missing source coverage makes whole-portfolio totals unknown.          | 1,500-row truncation, repeated pages, failed status lookup, expired auth and React pagination tests.                                                  |
| P11: fractional rates                           | One 18-decimal bigint field per rate. Plain and legacy fixed-point percentages normalize consistently; raw-string rate twins removed.                                                                                  | `markets/fractional-rates.test.ts` covers 12.75 and 0.5 across catalog, detail and profit; inventory APR fixture.                                     |
| P12: ROI                                        | Numerator and denominator use the same priced positions. Known collateral from an unpriced pool can still appear in the balance total.                                                                                 | Portfolio fixture returns 0% rather than 50%; unknown whole-portfolio deposited value stays null.                                                     |

The old calculation fixtures were migrated to the four groups before removing their implementations. Removed enrichment and optimistic-ledger tests belong to removed features. Deliberate differences are nullable unknown values, exact bigint splits, comparable ROI and refusing liquidation estimates for missing/incomplete account inputs. The table's price-change percentage remains unleveraged. Its existing leverage fallback and source precedence are preserved.

## Consumer migration required

Coordinate these changes on VIBE-1902 and the separately owned VIBE-1903 branch before either consumes the revised SDK release. Do not merge an app dependency bump alone.

| Existing consumer                                                           | Required change                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/symmio/poolReads.ts`, `hooks/usePoolList.ts`, `hooks/usePoolDetail.ts` | Restore app-owned DEX/Jupiter/pump.fun/GeckoTerminal enrichment and source selection. Pass chosen prices into grouped SDK reads/projections. Preserve the app's batching and refresh tiers.                                      |
| `lib/symmio/poolMutationCache.ts`                                           | Remove imports of beginPoolOptimisticUpdate/projectPoolProfitOperation. Own optimistic state in the app; operation-specific rollback must not overwrite newer server data. Continue targeted invalidation after accepted writes. |
| `lib/symmio/poolPortfolio.ts`                                               | Read `getPoolPortfolio(...).entries`, totals and gaps. Pass userAddress. Apply client filters/pagination after assembly.                                                                                                         |
| `lib/listing/depositHistory.ts` and deposit/withdraw/claim consumers        | Replace scalar imports with position/portfolio fields. Raw token and LP values are bigint at 18 decimals.                                                                                                                        |
| `components/pools/PoolDetail/usePoolStats.tsx`                              | Use getPoolStatistics through the existing app query wrapper, or calculatePoolStatistics over existing SDK snapshots. An existing catalog snapshot can preserve headline/source precedence without a second search.              |
| `components/pools/PoolDetail/tables/poolOpenQuoteMath.ts`                   | Replace the eight scalar exports with grouped open-position metrics. priceChangePercent is the unleveraged price move.                                                                                                           |
| Config consumers                                                            | Treat null rate limits as unknown. Legacy initial floors are now corrected in the existing fields; the universal floor remains separate.                                                                                         |
| Listing auth consumers                                                      | Opt into prefetchChallenge only where desired. Keep actual signer/origin/deployment consistent, and discard app-level auth completions after context changes.                                                                    |

Choose either existing app query wrappers around core actions/projections or composed SDK hooks for a screen. Mounting both duplicates orchestration. The composed hooks reuse primitive SDK cache keys; primitive private observers must pass the same userAddress to share those entries. Keep the host QueryClient stable across renders and clear private session state on logout. No companion Vibe UI source files or the separate VIBE-1903 checkout were changed by this review response. The SDK's own demo config card now displays unknown rate limits correctly.

## Compatibility and release

The removed APIs exist only on the unreleased PR. The nullable `ListingRateLimits` change affects an existing public type, so the changeset explicitly requests a **core major** release and a React minor release. Publishing remains a separate delivery action. Package smoke tests verify locally packed artifacts; they do not establish that a compatible registry release exists.

The pool liquidation estimate assumes that the account is isolated to that market. Mixed-side, incomplete or unavailable account inputs yield null. It is not a cross-market risk calculation. Supplemental profit totals retain the documented scaled-amount contract; no unverified plain-amount heuristic was added.

## Verification

### Comprehensive follow-up review

Reviewed the entire PR from merge base `5e3a7161883243214514f599914138d4f8869610`, including head `43e4455c07996b70ce39996abd79e2ea54a19d54` and the approved revision in this commit. Refreshed remote main was `0cca5d0be3bc3c82507fcfd9b1418d4abbfba457`; this review does not merge the newer main changes.

The follow-up found and fixed four additional edge cases:

- Core pagination discarded earlier successful pages when a later request failed. It now retains discovered holdings and reports a failed-source gap. HTTP 401/403 still reject, including on later pages.
- React pagination advanced by the requested page size, skipping rows when the backend returned a smaller page with more results available. It now advances by the actual returned count, matching core.
- Composed manual refreshes bypassed disabled/authentication gates and could request the pool-wide withdrawal queue for personal statistics. All four composed refresh functions respect their gates, and disabled paged sources stay idle.
- Cached sign-in challenges could bypass deployment validation when core callers omitted chainId. Validation now resolves the config's default deployment before deciding whether to reuse a challenge.

Regression coverage includes retained partial pages, capped backend pages, expired sessions on later pages, unauthenticated explicit refresh, personal-statistics refresh scope, and default-deployment challenge mismatch. Review also traced normalization, bigint balance/refund arithmetic, rate units, Solana aliases, event snapshots, existing mutation invalidation families, query-key credential exclusion, exports, removed-code references, documentation and the major-release requirement.

Verified locally on 2026-10-26 using Node 24.16.0 and pnpm 10.10.0. Local logs are ignored workspace artifacts, not committed fixtures.

| Check                                                                  | Result                                                                                                                                                                                       |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @symmio/trading-core test`                              | **3,531 passed**, 494 files.                                                                                                                                                                 |
| `pnpm --filter @symmio/trading-react test`                             | **922 passed**, 211 files.                                                                                                                                                                   |
| Core and React `check-types`                                           | Passed.                                                                                                                                                                                      |
| Core and React `lint`                                                  | Passed with zero warnings.                                                                                                                                                                   |
| Formatting of every changed/new TypeScript, TSX, Markdown and MDX file | Passed with the repository Prettier configuration and plugins.                                                                                                                               |
| `pnpm verify-packages`                                                 | Passed: package builds, packed-tarball publint/attw, fresh consumer install, strict NodeNext typecheck and runtime imports of all entry points.                                              |
| `pnpm --filter @symmio/docs build`                                     | Passed, including static pages and Pagefind indexing of 339 pages.                                                                                                                           |
| React Doctor 0.4.2                                                     | Full package scan included new untracked hooks; **zero diagnostics in changed React files**. 153 diagnostics elsewhere in the package remain outside this scope. Scoring/telemetry disabled. |
| `git diff --check`                                                     | Passed.                                                                                                                                                                                      |

The React suite emits local-proxy 503 and happy-dom teardown diagnostics in existing request tests, but all assertions pass. The docs build emits existing nested-worktree root-inference and Git timestamp warnings. Neither was treated as a clean run until its command completed successfully.

The SDK demo also passes `pnpm --filter @symmio/web check-types` and lint for its changed listing-config card. The final React Doctor scan finds no diagnostics across the PR's changed React files. Vibe UI's `bun run check:sdk -- --published` still reports its intentional local SDK link; this is not published-release verification and no app dependencies were changed here.

The final regressions include SSR without window, prefetch expiry, two simultaneous auth-hook instances, a slow replacement challenge, wallet/origin changes, source-cache reuse, pagination caps and repeated pages. Rerender fixtures explicitly keep one QueryClient, matching supported host usage. The removed calculation/enrichment/optimistic modules are also absent from rebuilt dist output.

Self-review: all findings in the matrix have code, removal or documented-contract resolutions. The four groups accept normalized SDK reads, retain consumer filtering/formatting ownership, and avoid a second React aggregate cache. Exact raw amounts, nullable unknowns, authentication scoping and bounded requests were checked. Publication, downstream migration and live service evidence remain separate checks below.

## Remaining stage and delivery checks

1. Confirm actual Solana deposit/refund casing and canonical outgoing addresses against staging.
2. Confirm legacy config response shape and initial-deposit/rate-limit rendering against staging.
3. Migrate the companion app consumers, then re-run their behavior matrix, UI/polling/request-count checks, builds and wallet scenarios against a reviewed, published release.
4. Check CI again after an authorized push. This local implementation does not claim to fix the separately observed pkg-pr-new preview publication failure.

No SDK release, deployment or Jira change was made. GitHub review comments have not been posted or marked resolved by this local implementation.

## P30 follow-up and main merge — 2026-10-27

Reference: [P30 review feedback](https://github.com/SYMM-IO/Trading-SDK/pull/75#issuecomment-6442496695).

Updated the PR from head `41d30c0868d8b46c72acfd989f032e1d3b5013e0`, preserving the merged pool-detail work from #77, with main `d0ecf9dc7516b723730665f92e5b3d4025c0af70`. The earlier uncommitted SDK compatibility checkout and companion app checkout were preserved separately.

The merge retains main's expanded subgraph fields and the pool-specific immutable history metrics. GraphQL output was regenerated from the combined query sources. `PoolTradeHistoryRow.closeFee` remains the derived event amount; the underlying rate stays on the aligned quote. The demo history table consumes the pool row type.

P30 is addressed in the existing portfolio and profit APIs:

- Known non-listed pools keep deposit/refund history and zero LP stake. Listed rows without deposits also contribute zero without profit/detail requests.
- Portfolio rows expose `hasDeposit`: positive observed history or catalog deposit, confirmed absence, or unknown when history is incomplete. Both core and React use this projection to select reads, without duplicating financial or address-matching logic.
- Only profit HTTP 404 with numeric backend code 22 becomes a zero LP position. Code 21, other 404s, 429, 5xx and transport failures remain errors.
- Combined profit/detail concurrency is capped at five per core call or mounted portfolio hook. Each failed per-row read retries once, excluding 401/403. React polling and manual refresh use the same queue and primitive cache keys. Canceled queued queries do not start stale requests.
- Tests cover funded/refunded mixtures, exact 404 versus 500 classification, unfunded request suppression, partial history, transient recovery, authentication failures, core and React concurrency, primitive cache sharing, manual refresh and queued cancellation.

Verification used Node 24.16.0 and pnpm 10.10.0 in the isolated update checkout:

| Check                                                                | Result                                                                                                            |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Full core unit suite                                                 | 3,697 passed across 515 files.                                                                                    |
| Full React unit suite                                                | 946 passed across 220 files.                                                                                      |
| Workspace lint and typechecks                                        | All 26 tasks passed, including required package builds and docs production build (352 routes, 346 pages indexed). |
| React Doctor 0.4.2, changed React files against the original PR head | Zero errors or warnings; scoring and telemetry disabled.                                                          |
| Changed-file Prettier and Git whitespace checks                      | Passed.                                                                                                           |

`pnpm verify-packages` also passed: all package tarballs passed publint/attw, and a fresh consumer passed strict NodeNext typechecking and runtime imports of all entrypoints.

The React suite emitted the existing mocked-network 503 and happy-dom teardown messages and exited successfully. The docs build emitted existing nested-worktree root and Git timestamp warnings. Live authenticated backend reproduction, publication and downstream published-release verification remain separate delivery steps.
