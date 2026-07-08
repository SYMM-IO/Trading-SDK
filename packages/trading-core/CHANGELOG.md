# @symmio/trading-core

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
  - @symmio/utils@0.2.0

## 0.1.1

### Patch Changes

- 429539a: Rewrite package READMEs with verified usage examples and links to the documentation site and SDK console.
- Updated dependencies [429539a]
  - @symmio/utils@0.1.1

## 0.1.0

### Minor Changes

- d3b5bff: Initial public release of the SYMMIO SDK packages.

### Patch Changes

- Updated dependencies [d3b5bff]
  - @symmio/utils@0.1.0
