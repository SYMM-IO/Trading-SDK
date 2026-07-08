# @symmio/session-key

## 0.1.2

### Patch Changes

- 29cc357: Fix module resolution in the published packages.
  - **`@symmio/trading-react`**: the `./provider`, `./account-layer`, `./instant-layer`, `./wallet`, `./errors`, `./transactions`, `./markets`, `./fees`, and `./price-service` subpath exports pointed at `dist/<name>/index.js` files that were never emitted, so importing from any of them threw `ERR_MODULE_NOT_FOUND` at runtime. Each sub-barrel is now its own build entry, so the files exist.
  - **All packages**: generated `.d.ts` now use fully-specified relative import paths (`./x.js`, `./x/index.js`), so the types resolve under `moduleResolution: "node16"` / `"nodenext"`, not only `"bundler"`.

## 0.1.1

### Patch Changes

- 429539a: Rewrite package READMEs with verified usage examples and links to the documentation site and SDK console.

## 0.1.0

### Minor Changes

- d3b5bff: Initial public release of the SYMMIO SDK packages.
