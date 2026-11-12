# @symmio/session-key

## 1.1.0

### Minor Changes

- 9532b0b: Keep captured viem accounts bound to the manager lifecycle and local expiry, checking all signing methods before and after asynchronous signing. Add SessionKeyExpiredError, restore-only load(owner), and absolute-expiry imports for transferred sessions.

  Validate stored key identity and timestamps before publication, including competing-writer reconciliation. Reject invalid import inputs before changing the existing signer or persisted record. Encryption, password locks, deployment scoping, and cross-context storage coordination remain application responsibilities.

- f92258e: **Safer session-key lifecycle.**
  - **`onLoadError: "rotate" | "throw"`** decides what `initialize` does when the storage adapter's `load` throws. The default, `"rotate"`, keeps today's behavior: the record is removed and a new, undelegated key is generated. `"throw"` leaves the stored record untouched, clears the in-memory key, and rejects with the new `SessionKeyLoadError`, so an app can retry or ask before replacing a key that may still be delegated.
  - **Lifecycle calls no longer interleave.** `initialize`, `importPrivateKey`, `rotate` and `destroy` run one after another on a manager, and concurrent `initialize(owner)` calls share one run. Starting a newer lifecycle request revokes the current in-memory signer synchronously; an older request that was still running rejects with `SessionKeyOperationSupersededError` instead of publishing stale key material.
  - **Competing writers are reconciled on a best-effort basis.** After saving, the manager checks the stored metadata and adopts a different key it observes. A write that lands after the final read can still supersede this manager, so consumers that need strict cross-tab coordination must provide it at their storage boundary.

## 1.0.0

### Major Changes

- ee1ad05: First stable release of the SYMMIO SDK.

  v1.0.0 marks the SDK as production-ready. The public API of every package is now covered by semantic versioning: a breaking change requires a major bump. All packages move to 1.0.0 together and are versioned in lockstep from here.

  ### Breaking changes
  - **`@symmio/trading-core`**: `createConfig`'s optional `chainOverrides` parameter is replaced by **`symmioConfig`, which is now required**. Every supported chain must supply a non-zero `addresses.affiliatesAddress` — your frontend's on-chain affiliate for that chain, attached to every quote so the protocol attributes the trade to you and routes your share of the trading fee. Affiliate addresses are per chain: a registration on one chain is not valid on another. `createConfig` throws `SymmError` with code `AFFILIATE_ADDRESS_REQUIRED` for any supported chain missing one, so a trade can never silently fall back to the SDK's built-in default affiliate and lose attribution. The new `SymmioChainConfigInput` type describes the shape — everything stays optional except `addresses.affiliatesAddress`.

    ```diff
     const config = createConfig({
    +  symmioConfig: {
    +    [SymmioSupportedChainId.HYPER_EVM]: {
    +      addresses: { affiliatesAddress: "0xYourHyperEvmAffiliate…" },
    +    },
    +  },
       getClient: () => publicClient,
       getWalletClient: async () => walletClient,
     });
    ```

  - **`@symmio/trading-react`**: `SymmioProvider`'s optional `chainOverrides` prop is replaced by the required `symmioConfig` prop, forwarded to `createConfig` — same rule, same error.

    ```diff
    -<SymmioProvider>
    +<SymmioProvider
    +  symmioConfig={{
    +    [SymmioSupportedChainId.HYPER_EVM]: {
    +      addresses: { affiliatesAddress: "0xYourHyperEvmAffiliate…" },
    +    },
    +  }}
    +>
       <App />
     </SymmioProvider>
    ```

    Nothing else about the shape changed: `subgraphs`, `solver`, `priceService`, `notifications`, and `muon` remain optional and are still deep-merged onto the built-in chain defaults. An existing `chainOverrides` object can be renamed to `symmioConfig` as-is once each chain carries an affiliate address.

  ### New features
  - **`@symmio/trading-core`**: new `getEstimatedPrice` read — asks the solver what an open or close would actually fill at, given the order quantity, side, and slippage-adjusted request price. It is a read-only simulation; nothing is submitted. Ships with `getEstimatedPriceQueryKey` / `getEstimatedPriceQueryOptions` and the `toEstimatedPrice` transformer. New `calculatePriceImpact` derives the signed price-impact percent of an estimate against a reference price such as the mark.
  - **`@symmio/trading-react`**: new `useEstimatedPrice` hook wrapping the above, with `quantity` and `price` debounced (configurable via `debounceMs`) so typing in a trade form fires one request instead of one per keystroke.
  - **`@symmio/trading-core`**: new `calculateAvailableInstantOpenMargin` — the maximum initial margin an instant open can spend, shaved for fees and, for SHORT only, a worst-case slippage fill.
  - **`@symmio/trading-react`**: new `useAvailableInstantOpenMargin` hook composing the balance and fee reads into that spendable margin, ready to wire to a trade form's `Max` chip and submit gate.
  - **`@symmio/trading-react`**: `useAccountBalanceOf` and `useAccountBalanceInfo` accept `live: true`, which subscribes to the account's settle notifications over the shared WebSocket and refetches when an open anchors or a close fills, so a balance reflects a just-settled trade without a manual refresh. Off by default.
  - **`@symmio/trading-react`**: `calculateQuotePnl`, `calculatePriceImpact`, and `calculateAvailableInstantOpenMargin` are now re-exported from the package root, so trade-form math no longer needs a direct `@symmio/trading-core` import.

  ### Fixes
  - **`@symmio/trading-react`**: `useDeposit` now invalidates the credited subaccount's balance queries on success, not only the connected wallet's collateral allowance and balance. A deposit is not a trade settle, so live balance reads did not otherwise refetch and the trade form's available margin / `Max` kept showing the pre-deposit figure.
  - **`@symmio/trading-react`**: `useInstantOpenWithTpSl` now seeds the confirming TP/SL slot with the target trigger price and price type rather than the state alone, so `useQuoteTpSl` renders the levels immediately on the freshly-opened position row instead of leaving them blank until the WebSocket report lands.

  ### Other
  - **All packages**: `repository`, `homepage`, and `bugs` metadata now point at the `SYMM-IO/Trading-SDK` repository.
  - **`@symmio/utils`**, **`@symmio/session-key`**, **`@symmio/eslint-config`**, **`@symmio/typescript-config`**: no functional changes in this release; versions are aligned to 1.0.0 with the rest of the SDK.

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
