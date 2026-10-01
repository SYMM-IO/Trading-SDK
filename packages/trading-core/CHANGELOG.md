# @symmio/trading-core

## 3.1.0

### Minor Changes

- eac9be1: Add accumulated-funding reads — the funding a position has accrued on-chain but not yet settled, and the per-pair funding state it accrues from.

  `core` gains:
  - `getQuotePendingFunding` (plus `getQuotePendingFundingQueryKey` / `getQuotePendingFundingQueryOptions`) and its `QuotePendingFunding` row — pending funding for a batch of quote ids, read from the diamond view `getQuoteFundingDebts`. Ids are de-duplicated, sorted and read in sequential batches of `batchSize` (default 25); each batch is its own `eth_call` against the RPC's latest block, so rows from different batches can come from adjacent blocks. The value is what the contract would settle if the quote were charged in that block, in 18-decimal collateral units, and moves in whole-epoch steps. The query key accepts a partial scope, so `predicateMatch(getQuotePendingFundingQueryKey, { configKey })` matches every pending-funding read of a chain.
  - `getFundingFeesOfPartyB` (plus `getFundingFeesOfPartyBQueryKey` / `getFundingFeesOfPartyBQueryOptions`) and the `FundingFee` struct — the raw accumulated-funding state a solver keeps for one symbol. Its `epochDuration`, `startEpoch` and `startEpochTimeStamp` tell whether the pair is not configured, configured but not started, or accruing.
  - `isActiveQuoteStatus` — whether a known on-chain status is an active position (`OPENED`, `CLOSE_PENDING`, `CANCEL_CLOSE_PENDING`, `LIQUIDATED_PENDING`); `isActivePosition` now delegates to it.

  `react` gains `useQuotesPendingFunding` (per-quote rows aligned 1:1 with the input plus the `pendingNetReceived` sum), `useQuotePendingFunding` (the single-quote form) and `useFundingFeesOfPartyB`. `useManagedQuotes` invalidates the pending-funding reads along with its other on-chain quote reads, and `useForceClose` invalidates them once the write succeeds (after its receipt, by default). Nothing polls by default; pass `query.refetchInterval`.

  **Sign convention** — `pendingNetReceived` is income-positive like every SDK funding amount: `> 0n` means the position will receive the funding, `< 0n` means it owes it. It is the negation of the contract's cost-positive `getQuoteFundingDebts`, so it sits next to the settled `netReceived` with no sign flip. The `FundingFee` rates are raw per-unit contract values and stay cost-positive (positive = that side pays).

  **Active positions only** — the view does not check quote status. A quote a solver locked but never opened (`LOCKED`, `CANCEL_PENDING`, or `CANCELED` / `EXPIRED` after a lock) reads as a meaningless amount that grows every epoch. The React hooks read only rows with a `quoteId` and a known active `quoteStatus`; core callers filter with `isActiveQuoteStatus` first.

  Pending funding is not in the subgraph, and settled (`getQuoteFunding`) plus pending funding is not a lifetime total, because the two are read from different sources at different heights. A Muon-signed uPnL already includes pending accumulated funding; the SDK's mark-price uPnL does not. Both views are identical on v0.8.5 and v0.8.6, so there is no version gate.

- 96d0c50: Add collateral ↔ 18-decimal Core unit conversion helpers, and correct the unit and "quote, not proof" labels on gasless fees, allowances and receipts.

  SYMMIO Core keeps balances, operational-fee allowances and fee quotes in 18 decimals. Token transfers, deposit and withdrawal amounts, and a GaslessLayer's deposit terms use the collateral token's decimals. Several labels called 18-decimal values "raw collateral units", and nothing in the SDK converted between the two scales.

  **`@symmio/trading-core`**
  - New `collateralToCore18(amount, collateralDecimals)` scales a collateral-token amount up to 18-decimal Core units. The conversion is exact.
  - New `core18ToCollateral(amount18, collateralDecimals, { rounding? })` scales an 18-decimal amount down to token base units. It rounds up by default, the rule for funding a fee (`(fee18 + scale - 1n) / scale` for a non-negative amount). `rounding: "down"` rounds toward negative infinity, for an amount that must not be overstated. The options bag is exported as `Core18ToCollateralOptions`.
  - Both throw `SymmError("validation", "COLLATERAL_DECIMALS_UNSUPPORTED")` unless the decimals are an integer from 0 to 18. `withdrawAuto` now derives its 18-decimal deallocate amount with `collateralToCore18`, so a chain configured with unsupported collateral decimals fails with that typed error instead of a `RangeError`.
  - Documentation corrections, with no behavior change:
    - `getOperationalFeeAllowance`'s `allowance` and `pendingAllowance`, and `approveOperationalFee`'s `amounts`, are 18-decimal Core units, not collateral units. An approval replaces the allowance rather than adding to it, every charge decrements it (`maxUint256` included), and it adds no balance. The charger is the GaslessLayer proxy. The examples approve a bounded `parseUnits("5", 18)` budget instead of `maxUint256`.
    - `getAccountBalanceOf`, `getAccountBalanceInfo` and `AccountBalanceInfo` return 18-decimal Core units, as the docs already said.
    - `GaslessSubmitReceipt.paidFee` and `remainingFeeAllowance` are the service's acceptance-time figures, as reported by the service. `paidFee` is not proof that a fee was collected. `remainingFeeAllowance` is not a post-execution balance or an authorization guarantee, and it can read `2^256 - 1` while the Core approval is bounded.
    - `GaslessDepositSubmitReceipt`'s `observedAmount`, `paidFee` and `creditedAmount` are acceptance-time estimates in token base units that leave out a wallet creation fee. The settlement sweeps the full balance present when it executes.

  **`@symmio/trading-react`**
  - Documentation only: the `useApproveOperationalFee` example approves a bounded 18-decimal budget instead of `maxUint256`, and `useOperationalFeeAllowance` and `useAccountBalanceOf` state that their values are 18-decimal Core units.

- 96d0c50: Pin the complete multi-wallet GaslessLayer and GaslessWallet ABIs, and rebuild the gasless fee quote on `previewFeeQuote`.

  The SDK's gasless ABI was a hand-trimmed fragment older than the current contracts. Its fee quote called `getAccountOperationalFee`, which the latest perps-core GaslessLayer no longer has. The gasless slice has not been released yet, so the breaking changes below ship as a minor bump. Each one is listed.

  **`@symmio/trading-core`**
  - **`gaslessLayerAbi` and `gaslessWalletAbi` are now the complete ABIs**, copied verbatim from perps-core commit `b63ee55e` with every constructor, error, event and function. The export names are unchanged, but the inferred types now cover the whole contract. For example, `GaslessWallet.execute` is `payable` and returns `bytes[]`. Both are also exported from the `symmio-contracts/abi` barrel. They require a GaslessLayer on the multi-wallet interface. The production proxy `0x8347953D80037b8d82827246f37EC7442AD188B4` has not been upgraded yet, so it is unsupported until the vendor upgrades it.
  - `GASLESS_WALLET_EXECUTE_SELECTOR` and `GASLESS_WALLET_EXECUTION_SENTINEL_SELECTOR` keep their names and values. They moved into the gasless slice's constants module, and the package root still exports them.
  - **Breaking: `getGaslessOperationalFeeQuote` is removed.** So are `getGaslessOperationalFeeQuoteQueryKey`, `getGaslessOperationalFeeQuoteQueryOptions` and their `GetGaslessOperationalFeeQuote*` types. Use the new **`getGaslessFeeQuote(config, { operations })`** instead (plus `getGaslessFeeQuoteQueryKey` / `getGaslessFeeQuoteQueryOptions`). Each entry of `operations` is `{ operation, walletId? }`, with one wallet id per operation and a default of `0n`. The action no longer takes `account`, because the contract bills each operation's own `signerAccount`. It encodes the exact `relayInstantBatch` call the relayer submits, with placeholder signatures so no prompt is needed, and reads `previewFeeQuote`.
  - The result is a `GaslessFeeQuote`: `collateralToken`, `collateralDecimals`, `blockNumber`, `timestamp`, `exact`, `payments` (one `GaslessFeePayment` per operation, with its `account`, `payer`, `GaslessFeeSource` and 18-decimal fee components), `totalFee18`, `totalDebit18`, `freeOpsApplied` and `nativeSponsored`. **Breaking:** `amountDue` and `wouldBlockOnQuota` are gone. `exact` is always `false` from a preview, because only the relayer's simulation is exact.
  - **Breaking: an exhausted daily free quota is now an error, not a flag.** The contract reverts with `DailyFreeOpsLimitExceeded`, and the SDK throws `GASLESS_FREE_QUOTA_EXHAUSTED`. Test for it with the new `isGaslessFreeQuotaExhaustedError`. Any other revert throws `GASLESS_FEE_QUOTE_REVERTED`. A GaslessLayer without the multi-wallet interface throws `GASLESS_LAYER_INTERFACE_UNSUPPORTED`. Its quote reverts with empty data, but so does an upgraded GaslessLayer's quote for a batch it cannot decode. On an empty-data revert the SDK therefore makes one more read that quotes empty calldata: revert data there throws `GASLESS_FEE_QUOTE_REVERTED`, another empty revert throws `GASLESS_LAYER_INTERFACE_UNSUPPORTED`, and a transport failure rethrows the original viem error unchanged. An empty batch throws `GASLESS_EMPTY_BATCH`, and a wallet id outside the `uint256` range (or a JavaScript `number`) throws `GASLESS_WALLET_ID_INVALID`, both before any RPC call.
  - **Breaking: the transparent dispatcher's fee pre-flight (`preflightFee`) uses the new quote**, still before any signature prompt. `GASLESS_FEE_UNAFFORDABLE` is removed. An exhausted free quota throws `GASLESS_FREE_QUOTA_EXHAUSTED`, or takes the wallet path under `fallback: "wallet"`. A reverted quote and an unsupported GaslessLayer throw with no fallback. A quote read that fails for transport reasons no longer blocks the write: signing proceeds, and the relayer's own simulation decides.

  **`@symmio/trading-react`**
  - **Breaking: `useGaslessFeeQuote` takes `{ operations: { operation, walletId? }[] }` and returns `GaslessFeeQuote`.** `UseGaslessFeeQuoteParameters` now derives from `GetGaslessFeeQuoteOptions`. An exhausted free quota surfaces as a query error with code `GASLESS_FREE_QUOTA_EXHAUSTED`.

- 7d07dc5: Relay several gasless actions as one request, and preview what they cost before any signature.

  The relay already accepted many signed operations in one atomic `relay-instant` request, but only `relayInstantOperations` could send one, and only for operations the caller built, nonced and signed by hand. Every SDK action relayed alone. The fee preview had the same gap: `getGaslessFeeQuote` needed fully built operations, including a random salt and deadline that changed its query key on every render.

  **`@symmio/trading-core`**
  - New `relayGaslessBatch` (plus `relayGaslessBatchMutationOptions`). It takes a list of calls and relays them as one atomic transaction. Relayable writes are named by function — `{ functionName: "allocate", args }`, no ABI needed — or given as raw `{ data }`, and GaslessWallet calls join the same batch as `{ walletCalls, walletId }`. Before any prompt it resolves each write's contract from its selector, checks a session key's delegations, sequences nonces on every stream the batch signs on (the account's InstantLayer stream and one stream per wallet id), and previews the fee. It then signs each operation (the protocol has no batch signature, so a wallet prompts once per call) and submits once.
  - New `getGaslessBatchFeeQuote` (plus `getGaslessBatchFeeQuoteQueryKey` / `getGaslessBatchFeeQuoteQueryOptions`). It returns the `previewFeeQuote` for the same calls, with no operation to build. The result depends only on the account and the calls. Its query key holds encoded calldata instead of ABIs, and it stays deterministic while arguments do not yet encode.
  - New `getGaslessBatchSelectors` — the delegation set a session key needs to relay a batch.
  - New `GASLESS_RELAYABLE_FUNCTIONS` — every relayable write's ABI item, keyed by function name.
  - New types `GaslessBatchCall`, `GaslessBatchContractCall`, `GaslessBatchRawCall` and `GaslessBatchWalletExecute`.
  - Internal: the per-stream nonce lock now queues a task on several streams in one step, so a batch holding the InstantLayer stream and a wallet stream cannot deadlock with another batch, and its pending signatures are recorded on every stream it signed on. The dispatcher's gateway-coherence probe, owner cache and delegation pre-flight moved to shared modules, with no behavior change.

  **`@symmio/trading-react`**
  - New `useRelayGaslessBatch`. It confirms like the other relay hooks. Because every call is a known relayable write, it refreshes exactly the domains the batch touched: withdrawal requests, quotes and positions, sub-account lists, collateral, delegations, and each wallet entry's reads.
  - New `useGaslessBatchFeeQuote`. It debounces a changing batch internally (`debounceMs`, default 500), keyed on the calls' content rather than identity, so a form that rebuilds its calls on every keystroke reads the GaslessLayer once per pause.
  - Re-exports `GASLESS_RELAYABLE_FUNCTIONS`.

- 96d0c50: An ambiguous gasless submit can no longer double-execute, and a lost response can be replayed byte for byte.

  A relay submit that failed with a timeout, a `502` or a status `0` used to look like a definitive outage: `isConfirmedGaslessUnavailableError` matched any `404`/`502`/`503`, and the transparent dispatcher took the wallet path on it under `fallback: "wallet"`. But the gateway returns `502` for an upstream failure _and_ for an instance mismatch, either of which can happen after the body reached the service — so a request the relayer had already accepted could be paid for a second time from the wallet. The retry story was thin in the same place: one blind resend, no `Retry-After`, and no way to recover the bytes once both attempts were gone.

  **`@symmio/trading-core`**
  - Every submit (`relayInstantOperations`, `gaslessWalletExecute`, `relayGrantDelegation`, both deposit settlements) now goes through one internal disposition:
    - a `429`, or a `503` carrying the gateway's `{ error }` envelope, is resent under the **same key** after `max(retryAfterMs, 1 s + jitter)`, at most twice and only while the wait fits inside `execution.submitTimeoutMs`. The gateway dropped the request, so nothing can have executed;
    - an ambiguous failure (status `0`, a timeout, a `5xx` without that envelope) is resent **once**, after a jittered 1–2 s backoff, then thrown as `GASLESS_SUBMIT_UNCONFIRMED`. Once an attempt was ambiguous, every later failure — a gateway `429`/`503` refusing the resend, or a service verdict on it — is thrown as `GASLESS_SUBMIT_UNCONFIRMED` too, with that failure as its `cause`: it speaks for the resend only, while the first attempt may be executing, so it must never read as a fallback-eligible rejection;
    - a `2xx` with no `request_id` is unconfirmed too;
    - a `2xx` from the wrong protocol instance throws `GASLESS_INSTANCE_MISMATCH` with the parsed body — its `request_id` — kept in `responseData`.
  - New `getGaslessUnconfirmedSubmit(err)` returns the replayable `GaslessUnconfirmedSubmit` (`{ chainId, service, path, body, idempotencyKey }`), and `resubmitGaslessRequest(config, submit)` (with `resubmitGaslessRequestMutationOptions`) POSTs those bytes unchanged. A deposit replay re-reads the wallet's deterministic address before the POST, exactly as the original settlement did.
  - New `isGaslessIdempotencyConflictError(err)` for the vendor's `409 IDEMPOTENCY_KEY_CONFLICT`.
  - New `classifyGaslessFailure(err)` reduces any gasless failure to one `GaslessFailureReason` — `"payer-balance"`, `"fee-allowance"`, `"free-quota"`, `"failed-operation"`, `"submit-unconfirmed"`, … — reading the decoded revert ahead of the vendor code and the vendor code ahead of the HTTP status. New `decodeGaslessOperationFailure(err, abi)` names the failing batch entry of an `OperationFailed` revert and decodes its inner revert.
  - `parseGaslessErrorDetail` now also surfaces `revertMessage`, `decodedRevert`, `rpcError` and `failedOperation`, read from both `detail` and `detail.details`.
  - Every gasless error predicate reads `status` and `responseData` structurally, so they work unchanged on the error a React hook throws.

  **Breaking changes** (the gasless slice is unreleased):
  - `isConfirmedGaslessUnavailableError` no longer matches `404`, `502`, `504`, status `0` or a bare `503`. It matches exactly a `429` or a `503` with the gateway envelope. A gateway `404` is a configuration error, not an outage; the rest are ambiguous and surface as `GASLESS_SUBMIT_UNCONFIRMED`, which the predicate always refuses.
  - `isConfirmedGaslessFeeLimitError` no longer requires HTTP `409`. It matches a fee code on **any** pre-acceptance `4xx`, a `400 SIMULATION_REVERTED` whose decoded revert is billing-specific (`OperationalFee: …`, `DailyFreeOpsLimitExceeded`, `FeeLimitExceeded`), or a `rejected` record with either. A `rejected` record with a non-billing cause no longer qualifies — a wallet retry would revert the same way.
  - `idempotencyKey` is gone from `gaslessWalletExecute`, `relayGrantDelegation` and `GaslessWriteOptions`. Those re-sign on every call, so one key could only ever describe one signature; it is minted per call and echoed on the receipt. It stays a parameter on `relayInstantOperations` and both settlements, whose payload the caller builds.
  - `GaslessContractRevert.arguments` widens to `readonly unknown[] | Record<string, unknown>`: the vendor sends keyed arguments on some deployments, and they used to be dropped. Narrow with `Array.isArray` before indexing.
  - `GaslessErrorDetail` gains four fields, so an object literal typed as one must supply them.
  - A submit's `202` with no `request_id` now throws `GASLESS_SUBMIT_UNCONFIRMED` rather than `GASLESS_ACCEPTANCE_INVALID`, because its bytes can be replayed. The old code remains as the parser's own invariant.

  **`@symmio/trading-react`**
  - New `useResubmitGaslessRequest` — confirms and invalidates like the other relay hooks, on the service and chain the recorded submit names.
  - `classifyGaslessFailure`, `decodeGaslessOperationFailure`, `getGaslessUnconfirmedSubmit` and `isGaslessIdempotencyConflictError` are re-exported beside `parseGaslessErrorDetail`.
  - The transparent dispatcher never falls back to the wallet on an unconfirmed submit, an idempotency conflict or a `2xx` from the wrong instance, and it records an unconfirmed submit on the nonce stream so the next write on it waits instead of re-signing the same nonce.

- 96d0c50: Select a GaslessWallet by id in every wallet-scoped read, and read the wallet creation fee.

  On the multi-wallet GaslessLayer a gasless wallet is identified by `(owner, walletId)`. The SDK's reads hard-coded wallet `0`, and nothing read the one-time fee the GaslessLayer charges when it deploys a wallet. The gasless slice has not been released yet, so the breaking changes below ship as a minor bump. Each one is listed.

  **`@symmio/trading-core`**
  - `getGaslessWalletAddress`, `getGaslessWalletNonce` and `getGaslessDepositPolicy` take an optional `walletId: bigint`, defaulting to `0n`, the original wallet. A wallet id outside `0n` through `2^256 - 1`, or a JavaScript `number`, throws `GASLESS_WALLET_ID_INVALID` before any RPC call. `getGaslessWalletNonce` reads `walletOperationNonces(owner, walletId, signerAccount)`: wallet `0` keeps its original counter, and each positive id counts separately. The `GASLESS_WALLET_UNAVAILABLE` message now names the wallet id.
  - New `getGaslessWalletCreationFee(config, { owner, walletId? })`, plus `getGaslessWalletCreationFeeQueryKey` / `getGaslessWalletCreationFeeQueryOptions` and their `GetGaslessWalletCreationFee*` types. It reads `getWalletCreationFee(owner, walletId)` and returns the fee in collateral token units. The value is the configured fee while the wallet has no code, for every wallet id including `0`, and `0n` once the wallet is deployed. A deposit settlement deducts it from the swept balance; a relayed wallet operation charges it to the payer's SYMMIO balance.
  - `GetGaslessDepositPolicyReturnType` gains `walletId`, `walletCreationFee` and `collateralDecimals` (the collateral token's ERC-20 `decimals()`). The policy therefore makes two more reads: the creation fee, and `decimals()` on the collateral token.
  - **Breaking: `settlementMinimum` includes the creation fee.** It is now `max(minimumDeposit, depositFee + walletCreationFee + 1n)`, because the GaslessLayer rejects a settlement unless the swept balance exceeds the deposit fee plus the creation fee. With no creation fee the value is unchanged.
  - **Breaking: the query keys of the wallet address, wallet nonce and deposit policy reads now always carry `walletId`.** The key factories key an omitted id as `0n`, so `{ owner }` and `{ owner, walletId: 0n }` share one cache entry. A key assembled by hand, without the factory, must now include `walletId` to match a stored one.
  - The query factories forward every parameter to their action instead of a hand-listed subset, so `walletId` reaches the read.

  **`@symmio/trading-react`**
  - New `useGaslessWalletCreationFee` and `useGaslessWalletNonce`, exported from the package root and `@symmio/trading-react/gasless`. `useGaslessWalletAddress` and `useGaslessDepositPolicy` accept `walletId` through the core options.
  - **`useGaslessWalletExecute` invalidates the right nonce.** It used to invalidate the wallet-operation nonce keyed by the owner, so an operation signed for a sub-account left that account's nonce query stale. It now matches the signer account (`signerAccount`, or the owner when omitted).
  - `useGaslessWalletExecute`, `useSettleGaslessDepositNewAccount` and `useSettleGaslessDepositExistingAccount` also invalidate the owner's deposit policies and wallet creation fees, because the first operation or settlement on a wallet deploys it and zeroes its creation fee. The invalidation covers every wallet id of the owner until the write itself names one (see the multi-wallet writes changeset), after which it narrows to that id.
  - **Behavior change: `predicateMatch` compares only the fields its partial sets.** A default a key factory fills in for an omitted field is no longer compared, so `predicateMatch(getGaslessDepositPolicyQueryKey, { owner })` matches every wallet id of the owner instead of only wallet `0`. Key factories without such defaults match exactly as before.

- 96d0c50: Select a GaslessWallet by id in every gasless write, keep an acceptance even when the service reports it oddly, and serialize relays per nonce stream.

  The reads learned about `(owner, walletId)` in the previous change; the writes still hard-coded wallet `0`, relied on the service's legacy zero-filling default for `walletIds`, and sent the deprecated `wallet` alias on deposit settlements. Acceptance parsing threw on a missing amount or an unfamiliar status, which discards the `request_id` of a workflow that is already executing. And the nonce lock was released at the `202`, so the next relay on the same stream could sign a nonce the previous one had not landed yet. The gasless slice has not been released yet, so the breaking changes below ship as a minor bump. Each one is listed.

  **`@symmio/trading-core`**
  - **`relayInstantOperations` always sends `walletIds`**, one decimal id per operation, from each entry's new `walletId?: bigint` on `GaslessSignedOperationInput` (default `0n`). The service would zero-fill an omitted array for legacy clients, but relying on that makes a dropped id indistinguishable from a deliberate wallet `0`. New guards, all before the POST: `GASLESS_EMPTY_BATCH` for an empty batch, `GASLESS_TEMPLATE_WALLET_ID_UNSUPPORTED` when a `templateId` batch names a non-zero id (the contract's `relayInstantTemplate` takes no wallet ids), `GASLESS_TEMPLATE_ID_INVALID` for a `templateId` that is not a non-negative safe integer (an unguarded `NaN` serialized to JSON `null`, which the service read as "no template" and relayed as a plain batch), and `GASLESS_WALLET_ID_INVALID` for an id outside the `uint256` range.
  - **`gaslessWalletExecute` takes `walletId?: bigint`** (default `0n`), threading it through the address read, the nonce read and the relayed `walletIds` so the signed `target` and the relayed id can never disagree. An explicit `owner` that does not own `signerAccount` now throws **`GASLESS_WALLET_OWNER_MISMATCH` before the signature prompt** instead of signing an operation that could only revert.
  - **Breaking: both settle actions rename `wallet` to `owner` and take `walletId?: bigint`.** `settleGaslessDepositNewAccount({ owner, walletId?, affiliate, accountData, … })` and `settleGaslessDepositExistingAccount({ owner, walletId?, subAccount, … })` send `{ idempotencyKey, owner, walletId }` — the legacy `wallet` alias is no longer sent. Each reads `getGaslessWalletAddress(owner, walletId)` **before** the submit and verifies the acceptance's `wallet_id` and `deposit_address` against it, throwing **`GASLESS_DEPOSIT_WALLET_MISMATCH`** with the parsed receipt (request id included) in `responseData` on a mismatch. The vendor requires that check: a sweep takes a wallet's whole balance, so settling the wrong id moves funds the user never meant to move.
  - **Breaking: `GaslessSubmitReceipt` and `GaslessDepositSubmitReceipt` gained fields and their amounts became nullable.** Both now carry `idempotencyKey` (minted here when the caller passed none) and `protocolInstance`; the operations receipt adds `owner` and `walletIds`, and the deposit receipt adds `owner` and `walletId`. `paidFee`, `remainingFeeAllowance`, `observedAmount` and `creditedAmount` are now `bigint | null`. Persist the whole receipt: a bare request id is not enough context to reconcile a workflow after a reload.
  - **Acceptance parsing is deliberately tolerant.** Only `request_id` is required — a body without one throws `GASLESS_ACCEPTANCE_INVALID`, because nothing is left to track. An unfamiliar acceptance status reads as `queued` and an absent or malformed amount as `null`, rather than throwing away the id of a workflow that may already be executing. Stored records are still parsed strictly (`GASLESS_STATUS_UNKNOWN`), where a loud failure costs nothing.
  - **Breaking: `GaslessRequest` is now a per-service union** — `GaslessOperationRequest | GaslessDepositRequest`, both extending the new `GaslessRequestBase`. Narrow on the new `service` discriminant. The base adds `owner` (from `user_address` / `wallet_address`, which means the owner and not a GaslessWallet address), `walletIds`, `createdAt` and `updatedAt`. `operationType` moved onto the operations variant, which also gains `accountId` and `feeAmountRaw`; the deposits variant carries `depositAddress`, `walletId`, `accountName`, `amountRaw`, `feeRaw` and `creditedRaw`. Historical rows that stored no wallet ids normalize to one `0n` per stored operation, since an omitted id means wallet `0`.
  - **Breaking: the `accepted` lifecycle event is now a `GaslessAcceptedRequest`.** It gains `owner` and `walletIds`, `operationType` is `string | null`, and `protocolInstance` is `string | null` (it was `""` for a base that names none). `GaslessRelayEvent`'s `accepted` variant is `{ type: "accepted" } & GaslessAcceptedRequest`.
  - **The transparent dispatcher tracks a request under the billing sub-account's owner.** `userAddress` was the signing key, which for a session key owns nothing; it is now the cached `ownerOf(signerAccount)`, falling back to the signer when the owner cannot be read. The dispatcher also releases the nonce lock at the `202` and waits for the broadcast outside it, so one slow relay no longer stalls every later write on that account.
  - **New: relays are serialized per nonce stream, with a lazy pending-signature guard.** Streams are keyed `(chainId, signerAccount)` for InstantLayer operations, `(chainId, signerAccount)` for wallet `0` (whose nonces the contract counts per signer account across every owner) and `(chainId, walletId, owner, signerAccount)` for a positive id. After a `202` the SDK records the nonce it signed; the next caller on that stream waits for that request to reach any terminal status, or for the on-chain nonce to pass it, bounded by the signature's deadline and at most two minutes, and throws the new **`GASLESS_NONCE_STREAM_BUSY`** if neither happens — which is what an unconfirmed submit looks like. A failed terminal frees the nonce immediately. A submit that throws is recorded the same way whenever the nonce may still be spent — an ambiguous transport failure, or a `202` with no `request_id`, where the batch was certainly accepted and only its handle was lost — while any other rejection frees it at once. The bookkeeping is per `Config`, so coordinating other tabs or devices remains the app's job.
  - The error body attached to a terminal relay failure (`responseData`) now also carries `idempotency_key`, `tx_hash`, `wallet_ids`, `created_at`, `updated_at` and the service's own identity fields.

  **`@symmio/trading-react`**
  - **Breaking: `useSettleGaslessDepositNewAccount` and `useSettleGaslessDepositExistingAccount` take `owner` instead of `wallet`**, plus the optional `walletId`, because their variables are the core actions' parameters.
  - Both settle hooks invalidate the wallet-scoped reads for the id the acceptance reported, and `useGaslessWalletExecute` for the id its variables named, instead of every id of the owner.

- c1714ef: Relayed gasless writes now confirm before they resolve.

  An explicit relay used to resolve on the `202` acceptance — milliseconds after submit, seconds before the transaction landed. The mutation therefore resolved before its own effect existed, and following it to a terminal status was the consumer's job, hand-built and easy to omit. Omitting it produced a UI that sat on `queued` forever while the operation had in fact succeeded.

  **`@symmio/trading-core`**
  - New `confirmGaslessRequest(config, { requestId, until })` — the opinionated layer above `waitForGaslessRequest`. Resolves only on `succeeded`; `reverted` / `failed` / `rejected` throw as `GASLESS_RELAY_REVERTED` / `GASLESS_RELAY_FAILED` / `GASLESS_RELAY_REJECTED` with the record on `responseData`. With `until: "receipt"` it also waits for the receipt on your own client, so the state is readable by the reads you are about to invalidate. A receipt-wait timeout resolves without a receipt rather than throwing — the relay already reported the transaction mined.
  - `getGaslessRequestQueryOptions` **now polls by default**: a jittered 1–2 s while `queued`, 3–5 s after `submitted`, stopping at a terminal status; it retries up to three post-`202` `404`s (the accept-vs-record race) as well as transient transport failures, and treats a terminal record as permanently fresh. Previously the cadence was documented but not implemented, so a caller who passed no `refetchInterval` fetched once and froze. Every default yields to an explicit `query.*` override.
  - `GASLESS_QUEUED_POLL_MS` / `GASLESS_SUBMITTED_POLL_MS` moved to the slice root beside the status enum (same public names), joined by `gaslessPollDelay` and `GASLESS_RECEIPT_TIMEOUT_MS`.
  - `waitForGaslessRequest` is unchanged, deliberately: it still resolves for every terminal, including failures. The "succeeded or throw" opinion lives one layer up.
  - The transparent write path still returns a `txHash` from broadcast, so ordinary write hooks keep their shape — but the hash is now registered, and the React write tail follows the request rather than that first hash. See the status-resilience changeset.

  **`@symmio/trading-react`**
  - `useRelayInstantOperations`, `useGaslessWalletExecute`, `useSettleGaslessDepositNewAccount` and `useSettleGaslessDepositExistingAccount` now accept `GaslessRelayParameters` (`confirmation`, `receiptConfirmations`, `timeoutMs`, `receiptTimeoutMs`, `abortOnUnmount`, `onProgress`) and **confirm by default** (`confirmation: "receipt"`). Pass `confirmation: "none"` for the previous fire-and-forget behaviour.
  - They resolve with `{ accepted, confirmed }` rather than the bare acceptance receipt, and expose `relay` — `{ phase, requestId, idempotencyKey, status, txHash, degraded, issue }` — so a UI can show progress during a wait that may last as long as the relayer takes. They also take `onAccepted`, which fires at the `202` so a consumer can persist the request id before anything can go wrong.
  - On `succeeded` each hook invalidates the reads its action changed. All of them invalidate account balances and the fee allowance (the transport charges collateral). `useGaslessWalletExecute` also invalidates the signer account's wallet-operation nonce and the wallet's collateral balance. The deposit settlements also invalidate the swept address and, for a new account, the owner's sub-account lists. The wallet execute and both settlements invalidate the owner's deposit policies and wallet creation fees too, since a first use deploys the wallet. `useRelayInstantOperations` invalidates only transport-level reads — `operationType` is free-form, so the SDK cannot know which domain reads a batch touched.
  - The wait aborts on unmount by default; the invalidation still runs whenever a `succeeded` terminal was observed, so navigating away mid-wait does not leave the cache stale.
  - This also removes the `useSettleGaslessDepositNewAccount` caveat that a `succeeded` settlement is not instantly readable: the receipt is awaited on the same client the invalidated reads use.

- c1714ef: Relay six more writes through the gasless service, and stop the session-key selector set from growing with them.

  Gasless coverage was partial for a reason that no longer holds. Under perps-core 0.8.5 a relayed AccountLayer call
  arrived with the InstantLayer as `msg.sender`, so any write that derived identity from its caller — creating an account,
  renaming one, depositing — would have attributed the result to the relayer. In 0.8.6 the InstantLayer scopes the call to
  the account owner before dispatching it, so the AccountLayer's signer resolves to the user's own wallet and those writes
  became relayable. The vendor's own frontend already relays two of them against the same deployment.

  **`@symmio/trading-core`**
  - `forceClosePosition` and `forceCloseAuto` now accept `gasless`. The write already routed through the AccountLayer
    `_call` proxy, so only the selector registration and the parameter were missing — under a chain running in
    `execution.mode: "gasless"` it had been silently falling back to the wallet path.
  - `createSubAccounts`, `deleteSubAccount`, `editAccountName`, `depositForAccount` and `depositAndAllocateForAccount` now
    accept `gasless` and dispatch through the transparent seam.
  - `createSubAccounts` requires `gasless.account` when relayed: every operation is signed under an account the
    InstantLayer resolves on chain, and the subaccounts being created do not exist yet. Without it the call throws
    `GASLESS_ACCOUNT_UNRESOLVED`. A wallet with no subaccount at all still bootstraps through
    `settleGaslessDepositNewAccount`.
  - The deposit seams resolve their billing account from `account`, which may be a subaccount or a virtual account; a
    virtual account bills its parent. Relaying removes the gas but not the ERC20 approval — the collateral is still pulled
    from the owner's wallet.
  - `GASLESS_SESSION_KEY_SELECTORS` is now enumerated explicitly instead of being derived as "every relayable selector
    except `grantDelegation`". It was documented as resistant to silent widening but was not: each of the six new writes
    would have joined it automatically. All six stay owner-signed — they relay without gas, but creating, deleting and
    renaming accounts, moving the owner's collateral, and force-closing are not things a bounded session key does
    unattended. The membership is now asserted by test.

- 96d0c50: Make gasless status observation survive transient failures, and resolve relayed writes on the transaction that actually mined.

  Once the service returns a `202` the workflow is running whether or not the client can see it. The status loop used to throw on the first `429`, `503` or dropped connection, so a throttled poll surfaced as a failed relay — which invites the one action the lifecycle contract forbids, re-submitting an intent that is already executing. Separately, a transparently relayed write returned the relayer's **first** broadcast hash and the React write tail waited on it; when the relayer replaced that transaction (a gas bump, a stuck nonce), the wait never resolved.

  **`@symmio/trading-core`** (gasless, unreleased — breaking changes called out)
  - `waitForGaslessRequest` and `confirmGaslessRequest` absorb transient read failures (no response, `408`, `429`, `500`, `502`, `503`, `504`) instead of throwing: each one is reported through the new `onTransportIssue?: (error: SymmError) => void`, then retried after `max(Retry-After, jittered 1 s → 30 s backoff)`, capped by the remaining budget. They still throw for a definitive answer (`401`, `403`, `422`, a service error code), a fourth consecutive post-accept `404`, an abort, or an exhausted budget — and `GASLESS_BROADCAST_TIMEOUT` / `GASLESS_TERMINAL_TIMEOUT` now carry the last transient failure as `cause`, so "the relayer is slow" is distinguishable from "we went blind".
  - `getGaslessRequest` and `getGaslessRequestTransactions` accept `signal?: AbortSignal`, and their query factories forward TanStack's own signal and retry transient statuses with a `Retry-After`-aware delay.
  - The record factory's jittered `refetchInterval` is seeded from the query's own fetch timestamps rather than drawn per call: TanStack recomputes the callback on every render and restarts the countdown whenever the value changed, so a per-call random delay would leave any component that re-renders faster than the band frozen at `queued`. The value is stable between renders and fresh after every poll.
  - `getGaslessRequestTransactionsQueryOptions` takes an optional `status` — the record's last known status — which drives the attempts list's cadence and stops it once the record is terminal. Without it the query does not poll, because the attempts list has no terminal of its own to stop on. `status` never enters the query key.
  - **Breaking:** `gaslessPollDelay(status, random?)` returns a jittered delay inside the service's recommended band (1–2 s `queued`, 3–5 s `submitted`) rather than the fixed `GASLESS_QUEUED_POLL_MS` / `GASLESS_SUBMITTED_POLL_MS`. Those constants keep their values and still drive `waitForGaslessRequest`'s defaults.
  - **Breaking (cache key):** `getGaslessRequestTransactionsQueryOptions` defaults `service` to `"operations"` when it builds the query key, exactly as the request factory already did. Without the default, options built without `service` addressed a second cache entry for the attempts the action fetched under the default.
  - Status reads are paced internally at about 4 requests/second (burst 4) per `(Config, origin + protocol instance)`. The anonymous gateway allows 10 requests/second per IP and instance, and status polling is the one gasless call that runs unattended and in parallel, so the pacing keeps a submit, a fee quote or a deposit-policy read from being the call that earns the `429`.
  - New `isNewerGaslessRequest(prev, next)` — the stale-response guard for anything that writes a polled record somewhere shared. Lifecycle rank first (`queued` < `submitted` < terminal, terminal sticky, because a terminal record is immutable), then `updatedAt`.
  - **Breaking:** `GaslessRequestTransaction.status` is the new `GaslessTransactionAttemptStatus` enum (`SUBMITTED` / `CONFIRMED` / `REVERTED` / `FAILED`) instead of `string`; an undocumented value throws `GASLESS_ATTEMPT_STATUS_UNKNOWN` rather than normalizing. The shape also gains `requestId` (the service's `entity_id`), `workflow`, `receipt` (the relayer's raw JSON, untyped on purpose), `createdAt` and `updatedAt`.
  - New `getGaslessWriteRequest(config, { hash })` → `GaslessWriteRequest | null`. The transparent dispatcher registers each relayed write by its broadcast hash, so a caller can resolve an ordinary-looking write hash back to `{ requestId, service, chainId, protocolInstance, broadcastHash }` and follow the request instead of a hash that may never mine. `null` for a wallet-submitted write.

  **`@symmio/trading-react`**
  - **Breaking (behaviour):** a relayed write now resolves on the request's **terminal** transaction hash. `resolveWriteResult` detects a relayed hash, follows it with `confirmGaslessRequest({ until: "receipt" })`, and returns `WriteResult.gasless = { requestId, broadcastHash }` alongside the mined `hash` and `receipt`. A relay that ends `reverted` / `failed` / `rejected` rejects with the relayer's verdict (`GASLESS_RELAY_REVERTED` and friends) instead of `TransactionRevertedError` for a hash whose receipt may not exist.
  - New `useGaslessRequestTransactions` — the attempts companion to `useGaslessRequest`. Pass the record's `status` and it follows the same cadence and stops with it; without it, it fetches once.
  - `GaslessRelayParameters` gains `onAccepted?: (accepted: GaslessAcceptedRequest) => void`, invoked right after the `202` and **before** the `confirmation: "none"` early return, so the request id can be persisted before anything can go wrong. Observer failures are swallowed — a broken observer must not fail a request the service has already accepted.
  - **Breaking:** `GaslessRelayProgress` gains a required `degraded: boolean` (with `issue` for the last transient failure), an `idempotencyKey`, and a new `"unconfirmed"` phase for a wait that ran out of budget. `unconfirmed` means the outcome is unknown, not failed: the mutation still rejects, but the UI must show the request id and keep watching rather than offering a re-submit.
  - Every relay hook now publishes the `submitting` phase for the window between the click and the `202` — signing and the POST — which no phase covered before, and reports a failure in that window as `error` with no `requestId`. That is the one error phase where re-running the intent through the wallet is safe, because nothing was accepted.
  - Relay confirmation seeds the shared request cache through `isNewerGaslessRequest`, so a slow `queued` response can no longer repaint a finished workflow as pending.

- 96d0c50: Gasless status now streams over the gateway's WebSocket, with HTTP polling as the fallback.

  Relayer status was poll-only: every workflow re-read the same record on a timer, and a UI learned about a terminal status up to a poll interval late. The gateway serves a status WebSocket per protocol instance — optional, and disabled until operators enable it — so the SDK now prefers it and keeps polling underneath, exactly where the stream is not delivering.

  **`@symmio/trading-core`**
  - New `watchGaslessRequest(config, { requestId, service?, onUpdate, onStatusChange?, onError? })` → `Unwatch`. It **opens a socket and nothing else**: the subscribe snapshot and every later change arrive through `onUpdate`, each carrying complete state, and `onStatusChange` tells you when to poll instead. A `watch*` that silently became an HTTP poller would break its own contract, so the fallback stays the caller's (or `waitForGaslessRequest`'s) job.
  - New `supportsGaslessStatusStream(config, { chainId?, service? })`, the non-throwing check for a deployment that can stream at all.
  - New `gasless.statusStream` config block: `{ enabled: boolean; origin?: string }`. `enabled` is the per-deployment opt-in the gateway's own rollout requires, and `origin` names the gateway when your HTTP goes through a proxy — a proxy that forwards HTTP cannot be assumed to forward a WebSocket upgrade. Setting `origin` alongside a gateway `url` throws `GASLESS_STREAM_ORIGIN_CONFLICT`, so exactly one place names the gateway.
  - `waitForGaslessRequest` and `confirmGaslessRequest` take `transport?: "auto" | "poll"` (default `"auto"`). On `"auto"` they subscribe where the deployment allows it and poll only while the stream is not live; the resolution semantics, timeouts and transient-failure handling are unchanged, and the records are identical either way.
  - New types `GaslessRequestStreamUpdate`, `GaslessStreamStatus`, `GaslessStreamStatusDetail`, `GaslessStatusTransport`, `UnwatchGaslessRequest`.
  - New stream error codes surfaced through `onError`: `GASLESS_STREAM_NOT_FOUND`, `GASLESS_STREAM_INSTANCE_MISMATCH`, `GASLESS_STREAM_DISABLED`, `GASLESS_STREAM_COMMAND_INVALID`, `GASLESS_STREAM_PROTOCOL_ERROR`; plus the config-time `GASLESS_STREAM_NOT_CONFIGURED`, `GASLESS_STREAM_ORIGIN_REQUIRED` and `GASLESS_STREAM_ORIGIN_CONFLICT`.

  The protocol details the gateway documents are handled inside the shared hub, one socket per `(config, service, instance)`: the `ready` handshake is awaited before any command, every frame is verified against the configured protocol instance (a mismatch disables the stream rather than trusting another deployment's data), commands are paced and single-flight because they share your request quota, the gateway's bare `{"error":"Rate limit exceeded"}` requeues a command instead of tearing down the socket, close codes decide between backoff, bounded retries and a permanent stand-down, a `NOT_FOUND` right after a `202` resubscribes for the accept race, a terminal status unsubscribes itself, and a lost heartbeat forces a reconnect.

  **`@symmio/trading-react`**
  - `useGaslessRequest` subscribes where the deployment allows it, writes deliveries into the same cache entries the reads use, and **stops polling while the stream is live** — the pattern `usePrices` uses for the price feed. It returns the query result plus `stream: { status, detail, live }`, so a UI can show "Live" versus "Polling", and takes `transport?: "auto" | "poll"`.
  - A stream that is unavailable, disabled or misconfigured is never an error: the hook simply keeps polling, which is also the entire behavior on a deployment without a status stream.

- 96d0c50: Add `Retry-After` delays to HTTP errors, and give the gasless slice a connection layer built for the gateway's anonymous access, with errors that never carry its credentials.

  The GasLessQ gateway now serves anonymous clients by default, so a browser app whose Origin the deployment allows can call it directly with no key. Servers and backend-for-frontend proxies can still send a partner key.

  **`@symmio/trading-core`** (all HTTP actions, additive)
  - New `SymmApiError.retryAfterMs: number | null`: the `Retry-After` delay in milliseconds, parsed from delay-seconds or an HTTP-date. `SymmApiError.fromAxios` and subgraph queries fill it, and the constructor takes an optional `retryAfterMs` (default `null`). It is `null` when the response carried no usable header, which is the usual case for a cross-origin browser unless the server exposes the header. Nothing else about `fromAxios` changes: `cause` is still the axios error.

  **`@symmio/trading-core`** (gasless, unreleased — breaking changes called out)
  - **Anonymous access is the default.** Without `apiKey` the SDK sends no `Authorization` header at all; a blank key is treated as absent. `apiKey` stays optional, sent as `Authorization: Bearer <key>`, for servers and backend-for-frontend proxies that hold a partner key, and for deployments that turn anonymous access off. The JSDoc no longer says browser apps must use a proxy.
  - **Gasless HTTP errors never carry the credentials or the request body.** A gasless HTTP failure is still a `SymmApiError`, but its `cause` is a sanitized `Error` with only the axios `name`, `message` and `code`, plus `status`, `method` and `url`, instead of the axios error, whose request config holds the `Authorization` header and the signed body. The error's `url`, message and cause drop any userinfo, query string and fragment. `responseData` stays the raw response body, which a `422` can fill with echoed request fields.
  - One URL parser now classifies `gasless.url` as a gateway origin, an instance root, an instance-pinned service base or a proxy root.
    - **Breaking:** the instance-less `/v1/operations` and `/v1/deposits` compatibility bases throw `GASLESS_URL_LEGACY_ROUTE`. The gateway is retiring them, and they pin no instance to verify responses against.
    - **Breaking:** an instance root or service base whose path pins a different instance than `protocolInstance` throws `GASLESS_PROTOCOL_INSTANCE_CONFLICT`. The path used to win silently.
    - **Breaking:** a `url` with a query string, a fragment or a scheme other than `https` / `http` throws `GASLESS_URL_INVALID`. The SDK appends service paths to the URL, so such a URL could never route correctly. A `url` carrying credentials (`user:password@`) throws it too: pass a partner key as `apiKey`, which never reaches an error.
    - A proxy root with a `protocolInstance` now checks the `X-GasLessQ-Protocol-Instance` header of a successful response whenever the proxy forwards it, and fails with `GASLESS_INSTANCE_MISMATCH` on a mismatch. A proxy that does not forward the header still passes.
  - New `execution.submitTimeoutMs` (default `30_000`) bounds every relay and deposit-settlement POST. A timed-out submit fails like a network error, with `status: 0`. Status reads are not bounded by it.
  - New `statusStream?: SymmioGaslessStatusStreamConfig` (`{ enabled, origin? }`) on `SymmioGaslessConfig` declares whether a deployment serves the status WebSocket; `createConfig` deep-merges it, and an `origin` with no `enabled` to inherit throws `GASLESS_OVERRIDE_INCOMPLETE`. It is informational for now: status reads still poll over HTTP.
  - `parseGaslessErrorDetail` also reads the gateway's own `{ "error": "…" }` envelope into the new `gatewayError` field, and a FastAPI `422` `detail` array into the new `validationErrors` field (`GaslessValidationIssue[]`, each with `loc`, `msg` and `type`, without the echoed `input` or `ctx`). Both are `null` for other errors, and a body carrying only one of them no longer parses to `null`.

  **`@symmio/trading-react`**
  - New `SymmioRequestError.retryAfterMs: number | null`. `normalizeSymmError` forwards it from `SymmApiError`; every other kind carries `null`.

- 57add4c: Read the inventory lock on listing markets — `isLocked` on every catalogue row, `isLocked` + `lockReasons` on the detail — and regenerate the listing wire types.

  The listing backend now reports whether the inventory service has locked a market's pool. A lock pauses **deposits only**: trading, withdrawals and claims stay available, and the lock is orthogonal to `marketStatus` — a `LISTED` market can be locked, and the lock lifts without the lifecycle status moving. The SDK read nothing of this, so a UI could not gate its deposit flow.

  **`@symmio/trading-core`**
  - New `MarketLockReason` enum: `LIQUIDITY_EXPOSURE`, `LOW_TVL`, `PRICE_UNAVAILABLE`, `SHORT_CIRCUIT`, `MANUAL`, `UNKNOWN`. A reason this release does not recognize is folded to `UNKNOWN` by the mapper rather than thrown, so a newer backend cannot break the read. `UNKNOWN` is still a lock.
  - `ListingMarket` (and therefore `UserListingMarket`) gains `isLocked: boolean`. The row carries only the flag; the reasons are on the detail.
  - `ListingMarketDetail` gains `isLocked: boolean` and `lockReasons: MarketLockReason[]`. `isLocked` is `false` and `lockReasons` empty when the backend reports no lock state, as it does for a delisted pool. `marketStatus` is untouched.
  - `toListingMarket`, `toUserListingMarket` and `toListingMarketDetail` map the new fields. An object literal typed as `ListingMarket`, `UserListingMarket` or `ListingMarketDetail` must now supply `isLocked` (and `lockReasons` on the detail).
  - Listing wire types regenerated from the current spec. Two of its changes reach the mapped surface:
    - **Breaking: `PoolTransactionPage.marketAddress` widens to `string | null`.** The backend's transaction history is no longer scoped to one market on the wire and echoes `null` when it was not. A consumer assigning it to a `string` must handle the `null`.
    - `toListingConfig` reads the renamed wire fields `recommended_deposit_usdc` / `minimum_deposit_usdc`; `ListingConfig`'s own field names are unchanged.

- c1714ef: One `grantDelegation`, with the transport chosen by config.

  Granting a delegation was the only write with two hooks — `useGrantDelegation` for the wallet path and `useRelayGrantDelegation` for the gasless one — while every other relayable write is a single hook whose transport comes from `gasless.execution.mode`. That split was an artifact: `GASLESS_RELAYABLE_SELECTORS` was derived from the dispatcher's allow-list _and_ documented as the set to grant a session key, so registering `grantDelegation` as relayable would also have handed session keys the power to re-delegate. It was left out instead, and a parallel relay action was written around it.
  - **`grantDelegation` is now a relayable write.** It takes the `gasless` write parameter like `allocate` or `addMargin`, and returns the relayer's broadcast hash where a wallet hash would be — so `GrantDelegationReturnType` is still `Hash`, and receipt waits and cache invalidation are unchanged. Onboarding a session key from a wallet with no native balance now works through the ordinary action.
  - **A `isPartyB: true` grant cannot be relayed** — the signed-operation encoder has no PartyB form. It degrades to the wallet path, or throws `GASLESS_PARTYB_UNSUPPORTED` when `gasless: true` was demanded explicitly.
  - **New `GASLESS_SESSION_KEY_SELECTORS`** — the set to grant a session key: every relayable selector except `grantDelegation`. **`GASLESS_RELAYABLE_SELECTORS` now includes `grantDelegation`** and is no longer a delegation set; granting it would let a key mint itself further delegations over any selector and any expiry. Anywhere you passed it as `selectors`, switch to the new constant. A test pins the exclusion.
  - **`useRelayGrantDelegation` is removed** — use `useGrantDelegation`, which relays under gasless mode. The core `relayGrantDelegation` action stays as the low-level escape hatch, exactly as `relayInstantOperations` sits beside the transparent path.
  - **`useGrantDelegation`'s invalidation is fixed and widened**: it was invalidating delegation reads across _every_ chain config (no `configKey` scope), and it now also invalidates the InstantLayer nonce, the operational-fee allowance and account balances — a deliberate superset, since the hook cannot see which transport ran and a stale allowance silently blocks the next relay.

- c1714ef: Restore the per-call `gasless` opt-in in React, and finish the relayable-write surface it depends on.

  Twenty write hooks built the core action's parameters by hand-listing fields off the mutation
  `variables` instead of forwarding them, so `gasless` and `from` never reached the action. The failure
  was silent and invisible to the compiler: the variables generic is the core parameters type, so
  `mutate({ …, gasless: true })` type-checked and was then discarded. Only the config-level
  `execution.mode: "gasless"` actually worked — which is why the docs' own React example never did.

  **`@symmio/trading-react`**
  - Write hooks now forward their mutation variables verbatim (`{ ...variables, chainId }`), so `gasless`
    and `from` reach the core action. Affects `useAllocate`, `useDeallocate`,
    `useDeallocateAndInitiateWithdraw`, `useAddMargin`, `useRemoveMargin`, `useInitiateWithdraw`,
    `useRequestCancelWithdraw`, `useFinalizeWithdrawRequest`, `useRequestToCancelQuote`,
    `useRequestToCancelCloseRequest`, `useForceCancelQuote`, `useForceCancelCloseRequest`, and the eight
    writes that were dropping only `from`.
  - **Two behavior flips follow from that, both previously unreachable from React.** An explicit
    `gasless: true` on a chain carrying no gasless block now throws `GASLESS_NOT_CONFIGURED` instead of
    quietly paying gas; and `gasless: false` now genuinely forces the wallet path on a chain running in
    `execution.mode: "gasless"`. Config-driven mode still degrades silently, unchanged.
  - `useWithdraw` now passes its own `config` to the `useSubAccount` read it uses to resolve isolation,
    instead of falling back to the provider's config.

  **`@symmio/trading-core`**
  - `finalizeWithdrawRequest` accepts `gasless` and dispatches through the relay seam. Its selector was
    already registered as relayable and documented as such, but the action had no seam — so a gasless
    withdraw dead-ended at the final step on a wallet holding no native token. The operation is signed by
    the request's own `user` sub-account (override with `gasless.account`); it is the only relayable write
    that targets the diamond directly rather than through `_call`, because it is permissionless.
  - `GaslessWriteOptions` and `GaslessWriteParameter` are now exported. The config-side types were public
    while the per-call types were not, so consumers could not name the bag the docs told them to pass.
  - `FromParameter`'s documentation now states all three of its roles — simulation `msg.sender`,
    wallet-client hint on a write, and EIP-712 signer on a relay. It previously claimed to default to the
    connected wallet in React, which is true only of the `useSimulate*` hooks.

### Patch Changes

- 96d0c50: Fix WebSocket streams that reconnected after being disposed from inside their own callbacks.

  Every stream runs on an internal reconnecting socket. When a connection dropped, the socket decided to retry before it notified anyone, and it never checked again. A dispose that ran synchronously inside that notification was ignored. For example, an `onStatusChange` handler that unwatches on `"reconnecting"` still got a retry: a new connection opened after the watcher was gone, and nothing could close it. The same happened for a dispose on the `"connecting"` notification that starts a retry.

  The socket now re-checks after every callback, so a dispose from inside one cancels the pending retry or dial. A dispose on `"open"` also skips the stream's open handling, such as the kline watcher's `onReset`. Every stream gets the fix: `watchNotifications`, `watchTpSlNotifications`, `watchPrices`, `watchEnigmaPrices`, `watchBinancePrices`, `watchBinanceKlines`, `watchBinanceDepth`, and the candle and orderbook sources built on the last two. Nothing changes for a stream disposed outside its callbacks.

  A disposed stream also stops delivering frames while its connection is still closing. The `ws` package keeps handing over frames it has already read until the server acknowledges the close, so under `ws` a `watchBinanceKlines` subscription could call `onCandle` after its unwatch.

  The WebSocket concepts page now matches the code:
  - Only the notification, TP/SL and price streams share pooled connections; the Binance kline and depth watchers open one connection per call.
  - The pool closes a connection as soon as its last subscriber disposes; there is no grace period.
  - Retries back off from 500 ms to a 10 s cap.
  - No single status marks an outage. A failing stream switches between `"reconnecting"` and `"connecting"` instead of settling in `"closed"`, so watch for a stream that does not get back to `"open"`.
  - `WebSocketLike` is driven through its `on*` handler properties, not `addEventListener`.

  The `SocketStatus` type docs also say that `"connecting"` covers every retry dial, not only the first connect.

## 3.0.0

### Major Changes

- 4d2d62d: Replace the built-in Arbitrum staging deployment with its production contracts, Enigma solver, notifications, TP/SL identity, and mainnet subgraphs. Remove HyperEVM from the supported trading-chain registry while retaining it as a Pools listing-deposit chain, and make Arbitrum the default trading chain.
- 4f88f2a: Regenerate the Enigma solver client from the Arbitrum solver's OpenAPI spec — the enigma generation matching perps-core v0.8.6 (`orval.config.ts` now points at `https://solver.enigma.bz/api/swagger/doc.json`).

  Breaking — `getSolverRevenue` / `useSolverRevenue` are now **per-market**:
  - The new solver generation removed the protocol-wide `GET /revenue` aggregate (and the unused `/revenue/batch` and `/revenue/per-symbol`); only `/revenue/{symbolId}` and `/revenue/records` remain.
  - `GetSolverRevenueParameters.symbolId` is therefore **required**, and the parameters object is no longer optional on `getSolverRevenue`, `getSolverRevenueQueryOptions` and `useSolverRevenue`. For a multi-market figure, call once per market and label the sum with the markets it covers; `getRevenueRecords` remains the honest cross-market source.

  Additive — solver-fee caps on the market catalog:
  - `EnigmaMarket` and `SolverSymbol` gain `minOpenSolverFeeCap` / `minCloseSolverFeeCap` (decimal strings, defaulted to `"0"` when the solver omits them) — the minimum solver-fee caps a quote must allow under the perps-core v0.8.6 solver-fee mechanism, from the new `min_open_solver_fee_cap` / `min_close_solver_fee_cap` fields on `/contract-symbols` and `/symbols`.

- c810229: Per-chain contracts generation: chains declare `contractsVersion` and the instant-open signing path follows it.

  `SymmioChainConfig` gains a required **`contractsVersion: SymmioContractsVersion`** (`"0.8.5" | "0.8.6"`; overridable via `symmioConfig`). Built-ins: Base is `"0.8.5"`, while Arbitrum is `"0.8.6"`. The SDK branches on it at exactly the seams where the generations diverge:
  - **Quote-send signing (Enigma flow).** On a v0.8.6 chain the session key signs the new `sendQuote(...)` carrying `SolverFeeCaps { openRateCap, closeRateCap }` (18-decimal ratios of quote notional); on a v0.8.5 chain it keeps signing the legacy `sendQuoteWithAffiliateAndData(...)` — the capped selector does not exist on a v0.8.5 diamond. `prepareInstantOpenParams` resolves the caps from the market's `minOpenSolverFeeCap` / `minCloseSolverFeeCap` on v0.8.6 chains (pre-fillable via its `market` parameter) and emits `InstantOpenParameters.solverFeeCaps`. The Rasa flow is unchanged.
  - **Session-key delegation set.** New `getInstantTradeRequiredSelectors(config, { chainId })` (React: `useInstantTradeRequiredSelectors()`) resolves the per-chain set. `INSTANT_TRADE_REQUIRED_SELECTORS` now holds the v0.8.6 set (`SEND_QUOTE_SELECTOR` as the open leg) and the new `LEGACY_INSTANT_TRADE_REQUIRED_SELECTORS` holds the v0.8.5 set; multi-chain flows must resolve instead of hardcoding either.
  - **Withdraw-request decodes.** `getWithdrawRequests` / `getPendingWithdrawRequests` decode with a pinned v0.8.5 fragment on v0.8.5 chains (their on-chain struct predates `advancedAmount`) — without this, those reads fail to decode on Base. `WithdrawRequest.advancedAmount` is now **optional**: `undefined` on v0.8.5 chains, the on-chain value on v0.8.6 chains.

  New exports: `SymmioContractsVersion`, `encodeSendQuote` / `EncodeSendQuoteParameters`, `SolverFeeCaps`, `SEND_QUOTE_SELECTOR`, `LEGACY_INSTANT_TRADE_REQUIRED_SELECTORS`, `getInstantTradeRequiredSelectors`, `useInstantTradeRequiredSelectors`. The legacy encoder and selector stay exported.

  **Breaking.** `INSTANT_TRADE_REQUIRED_SELECTORS` changed value (its open leg is now `SEND_QUOTE_SELECTOR`) — on v0.8.5 chains use `LEGACY_INSTANT_TRADE_REQUIRED_SELECTORS` or, better, the resolver. On v0.8.6 chains, session keys delegated under the legacy set must be re-granted before they can open.

- 5606854: Upgrade the supported contracts version from perps-core v0.8.5 to **v0.8.6**.

  Per the one-contracts-version-per-release doctrine (`ARCHITECTURE.md` §2), the ABI fragments under `src/symmio-contracts/abi/` were swapped in place and now live under `v0.8.6/` — `symmioAbi`, `accountLayerAbi` and `instantLayerAbi` are the complete/fragment ABIs from the `version_0.8.6` tag of `SYMM-IO/perps-core`.

  Breaking, for consumers using the raw ABI exports directly:
  - `symmioAbi` no longer contains `forceCancelWithdraw` / `WITHDRAW_FORCE_CANCEL_ROLE`, the pre-affiliate `sendQuote` overload, or `owner` (replaced by `getOwner`); it gains the 0.8.6 surface (withdraw advance, restatement, operational/solver fees, snapshot liquidation, funding views, …).
  - `accountLayerAbi` drops the express-rate and virtual-provider admin functions and gains the 0.8.6 additions (scoped signers, sub-account ownership transfer, `createSubAccountsFor`, …).

  SDK-surface change: `WithdrawRequest` gains the required field `advancedAmount: bigint` — the collateral already advanced to the provider before cooldown expiry (express credit-line flow), mirroring the 0.8.6 `WithdrawStorage.WithdrawRequest` struct. The withdraw read views (`getWithdrawRequests`, `getPendingWithdrawRequests`) and the hooks built on them now return it.

  No typed action changed shape or behavior otherwise: every function the SDK wraps is signature-identical in 0.8.6 (the `QuoteStatus` and `WithdrawStatus` enums and `LibAccount.partyAAvailableBalanceForLiquidation` were verified unchanged against the `version_0.8.6` sources).

### Minor Changes

- 605a3b0: Rework instant-open sizing and funding around the solver's estimated fill price.

  `calculateTradeParams` now sizes collateral-input quantity from the raw mark price instead of the slippage-adjusted requested-open price. Slippage changes the execution bound without silently resizing the position while preserving the existing input and output structures.

  For lowcap instant opens, `prepareInstantOpenParams` now:
  - accepts an optional pre-fetched `estimatedOpenPrice` and can derive slippage automatically when the caller omits it;
  - validates the estimated fill against the effective slippage tolerance;
  - includes solver open/close fees and expected mark-to-fill settlement loss in the margin transfer; and
  - applies 1% funding headroom to the SHORT margin basis to cover lock growth when the final fill is above the estimate.

  Add `getInstantOpenFees`, its query helpers, and `useInstantOpenFees` for a normalized platform-fee, solver-fee, settlement-loss, and total-funding preview. Also export the supporting fee and calculation helpers and types.

- 265eac6: Remove the rasa-only `addSolverWhitelist` action and `useAddSolverWhitelist` hook. The `/add-sub-address-in-whitelist` endpoint has no backing logic on the rasa solver, so the SDK no longer wraps it. Drop any calls to `addSolverWhitelist`, `addSolverWhitelistMutationOptions`, or `useAddSolverWhitelist` — there is no replacement.
- 800e272: Provision the worst-case solver close fee, and price a close by how long the position was held.

  The solver charges more to close a freshly opened position than an aged one: the close-fee rate starts at `hedger_fee_close_early_rate`, holds flat until `hedger_fee_close_early_threshold` seconds, then decays linearly to the standard `hedger_fee_close` by `hedger_fee_close_standard_threshold`. With the staging numbers a close pays `0.0024` up to 30s, `0.0006` from 180s on, and interpolates between. The SDK priced the close fee as the flat `hedger_fee_close` everywhere — so an open under-provisioned its own close, and an immediate close came up short in the VA.

  **`@symmio/trading-core`**
  - The close-fee decay is exposed as **flat fields** mirroring the wire — `hedgerFeeCloseEarlyRate`, `hedgerFeeCloseEarlyThreshold`, `hedgerFeeCloseStandardThreshold` — alongside the existing `hedgerFeeClose` (the floor). They are carried on **`EnigmaMarket`** (from `getMarkets` / `/contract-symbols`) and on `SolverSymbol` (from `getSymbols` / `/symbols`); both wire endpoints return them. Enigma-only — a Rasa market has neither the wire fields nor the SDK fields. No nested object: the fields stay greppable and the shape stays flat.
  - New `SolverCloseFeeRates` (the four flat fields as a param type) with `getSolverCloseFeeRate(fees, holdingSeconds)` and `calculateSolverCloseFee(fees, { notional, holdingSeconds })` — the rate/amount the solver charges to close a position held `holdingSeconds` (`now − createTimestamp`). Piecewise: peak until the early threshold, linear decay between the thresholds, floor after. An `EnigmaMarket` or a `SolverSymbol` satisfies `SolverCloseFeeRates`, so pass either straight in. A negative holding time clamps to the peak; a market with no decay collapses to the flat rate. `toThresholdSeconds` coerces a wire threshold to whole seconds.
  - `calculateSolverFees` accepts the optional flat early-rate fields. When the early rate is given, the close leg provisions the **worst case** — `hedgerFeeCloseEarlyRate × notional`, the fee a just-opened position would pay — instead of the flat `hedgerFeeClose × notional`. `resolveMarket` resolves the fields under `includeHedgerFees`, so the open-fee preview (`getInstantOpenFees`) and the open wizard (`prepareInstantOpenParams`) provision accordingly from the market they already read — `addMargin` funds an immediate close. `EnigmaInstantOpenFees.closeSolverFee` is now that worst-case figure.

  **`@symmio/trading-react`**
  - `useInstantOpenFees` reads the early-close rates from the same `useMarkets` data it already fetches (no second request), so the previewed `closeSolverFee` matches what the open provisions. `InstantOpenMarketData` accepts the pre-fetched flat rate fields.

## 2.0.0

### Major Changes

- 1b9cc0a: Add grouped partial close — close an exact quantity across a merged position, and fix the group's notional and leverage figures.

  A `QuoteGroup` is several on-chain quotes, so closing "2.8 of the position" means splitting that amount across children without leaving a remainder the contract will reject. `core` gains a `close-planning` slice:
  - `planGroupClose` / `PlanGroupCloseResult` — a pure, deterministic greedy plan over the children (largest open size first, `key` as tie-break) that sums to the target **exactly** or fails without closing anything. Each candidate is either closed in full or partially down to its dust cap, with the excess spilled to the next child. Failures are typed: `exceeds-open`, `nothing-to-close`, and `dust-locked` (every remaining child sits at its cap) — the last carries `closeableQuantity`, the largest amount that would have worked, so a UI can offer it instead of a bare error.
  - `minRemainingQuantityOf` — the smallest remainder a quote may keep after a partial close, `ceil(openQuantity × minAcceptableQuoteValue / (cva + lf + partyAmm))`. This mirrors perps-core v0.8.5 `LibQuoteClose.closeQuote` ("Remaining quote value is low") and rounds **up**, because a remainder one wei short reverts on-chain. A quote with no partyA-locked value on record is reported as full-close-only.
  - `toGroupCloseCandidates` — the `UnifiedQuote[]` → `GroupCloseCandidate[]` adapter.

  `react` gains `useCloseQuoteGroup`: it plans the allocation, submits **every** child close in one bulk request (`instantCloseBulkAuto`), then tracks settlement per child off the account's live notifications — a step flips to `closed` on its close-**fill** frame, advancing `closedQuantity` / `progressPercent`, and the run reaches `success` only once every child confirms. The returned `close()` promise resolves at **submit** time, not settlement; read `status` / `steps` for the rest.

  **Breaking — `QuoteGroupMetrics.notional` is renamed to `initialNotional` and changes meaning.** It was `Σ(openQuantity × openPrice)`, which shrank as a position was partially closed; it is now `Σ(quantity × (initialOpenedPrice ?? requestedOpenPrice))` — the frozen at-open notional, unaffected by partial closes. Rename the field at the call site; if you were rendering "current position value", multiply `weightedOpenPrice` by `openQuantity` yourself rather than reusing this field.

  Two figures were also wrong and now change value:
  - **Group leverage** was `notional / (cva + lf + partyAmm)` off the current locked values — it drifted as a position was partially closed and it omitted `partyBmm`. It is now `Σ(quantity × (requestedOpenPrice ?? openedPrice)) / Σ(cva + lf + partyAmm + partyBmm)`, each child folding its frozen `initialLockedValues` when known. This is blended **opening** leverage and it holds steady across partial closes.
  - **`calculateQuoteLeverage`** returned `"0"` for a quote whose `requestedOpenPrice` is `0` (a market order, where only the settled price exists). It accepts an optional `openedPrice` used as the reference price in exactly that case. Existing callers are unaffected.

- 04c4973: Add multi-chain support and a second solver **kind** — the config, identity, and per-kind normalization that let one SDK serve Enigma (lowcap) and Rasa (majors) side by side, and add Base as a second chain.

  **Config & identity.** A chain now registers a map of solvers keyed by `SolverId`, where the id **is** the solver's kind — `SolverId = SymmioSolverKind = "enigma" | "rasa"` — because a chain registers at most one solver per kind. `getDefaultSolver` resolves a chain's default; actions take an optional `solverId` and fall back to it (mirroring the `chainId` fallback). The chain config gains `SymmioListingConfig` and `SymmioInventoryConfig` (the lowcap Pools backends), and its notifications config splits per kind into `SymmioEnigmaNotificationsConfig` / `SymmioRasaNotificationsConfig` (a discriminated `SymmioNotificationsConfig`). `createConfig` / `mergeChainConfig` validate every configured solver against the supported kinds and reject an unknown one. Base ships as a second chain (`SymmioSupportedChainId.BASE`) hosting a Rasa solver.

  **Per-kind response normalization.** Different solver kinds serve the same logical endpoint with different response shapes, so the reads that diverge now return a **discriminated union on `kind`** rather than a raw vendor type — read the shared fields without narrowing, narrow on `kind` for a solver's exclusive fields, or pass a literal `solverId` to get one variant directly:
  - markets — `Market = EnigmaMarket | RasaMarket` (+ `NormalizedMarketByKind`)
  - market info — `MarketInfo = EnigmaMarketInfo | RasaMarketInfo` (+ `RasaMarketInfoRow`, `NormalizedMarketInfoByKind`)
  - notional cap — `MarketNotionalCap` gains `EnigmaNotionalCap | RasaNotionalCap` (+ `NormalizedNotionalCapByKind`)
  - `searchNotifications` — one interface over both kinds: an enigma solver hits the notification service (`POST /api/v1/search`), a rasa solver hits its own position-state endpoint, returning `NotificationSearchResult = EnigmaNotificationSearchResult | RasaNotificationSearchResult`.

  **Breaking — removed / renamed exports.** The per-kind union replaces the previous single-shape reads:
  - `toMarketInfo` and `toMarketNotionalCap` are **removed** — the per-kind adapters are internal; call `getMarketInfo` / the notional-cap reads and read the normalized union.
  - `SymbolContractSymbol` is **removed**; use `Market` / `EnigmaMarket` from the markets slice.
  - `DefilyticsNotificationEnvelope` is **renamed** to `EnigmaNotificationEnvelope`, and `RawPositionNotification` is now joined by `RawEnigmaPositionNotification` / `RawRasaPositionNotification`. `buildRasaSubscribeMessage` is the Rasa twin of `buildSubscribeMessage`.

  **Rasa-only solver reads.** Endpoints only a `rasa` solver exposes — `getSolverBalanceInfo`, `getPartyAUpnl`, `getSolverOpenInterest`, `getSolverPriceRange`, `getSolverReadiness`, `getErrorMessage`, and `addSolverWhitelist` — each throwing a typed `UNSUPPORTED_BY_SOLVER` `SymmError` when the resolved solver is not a Rasa solver. The generated Rasa request/response schemas are re-exported for callers that need the raw wire shape.

  **Solver metadata & analytics reads.** `getSymbols` (the `/contract-symbols` catalogue, `SolverSymbol` with `SymbolStateFilter` / `SymbolValidityFilter`) and `getTradeVolume` (`SolverDailyVolume`), plus `getCoolDownsOfMA` and `getPendingQuotes` on the account reads, and `calculateAvailableForOrder` — the collateral a cross-margin (majors) account can still commit to a new order.

  `@symmio/trading-react` adds the matching hooks — the Rasa-only family (`useSolverBalanceInfo`, `usePartyAUpnl`, `useSolverOpenInterest`, `useSolverPriceRange`, `useSolverReadiness`, `useErrorMessage`, `useAddSolverWhitelist`), `useSymbols`, `useTradeVolume`, `useAccountUpnl`, `useCoolDownsOfMA`, and the per-kind `useSearchNotifications` (narrow on `data.kind`). All are `solverId`-aware and inherit the chain's default when it is omitted.

- d0e2a12: Add the contract-ready Muon signature assemblers the Rasa (majors) flows need, and let signed InstantLayer operations delegate a calldata region to a solver.

  Muon itself is deployment-agnostic — one `symmio` app on one shared gateway set serves both deployments, and the per-deployment input is the `symmio` request param (the chain's diamond), which the SDK already resolves per chain. What was missing was everything downstream of the attestation.

  **New in `@symmio/trading-core`**
  - `getSendQuoteUpnlSig` — assembles a Muon `uPnl_A_withSymbolPrice` attestation into `SingleUpnlAndPriceSig`, the `upnlSig` argument of `sendQuoteWithAffiliateAndData`. Solvers that enforce Muon verification require a live one.
  - `getForceClosePriceSig` — assembles a Muon `priceRange` attestation into `HighLowPriceSig`, which `forceClosePosition` verifies.
  - `SingleUpnlAndPriceSig` and `HighLowPriceSig` types, mirrored field-for-field from perps-core v0.8.5 `MuonStorage.sol`. Note `HighLowPriceSig.upnlPartyB` precedes `upnlPartyA`.
  - `sendQuoteUpnlSigFlexRange(callData)` — locates the encoded `upnlSig` region so it can be delegated to a solver. Argument indices are derived from the shipped ABI, not hardcoded.
  - `buildSignedOperation` now accepts `flexFields` and `maxUses` (defaults unchanged: `[]` and `1n`).

  **`instantOpen` now dispatches per solver kind**

  Enigma (lowcap) and Rasa (majors) open positions differently, and `instantOpen` now has one adapter per kind instead of assuming Enigma's shape for both:
  - **Enigma** — unchanged two-operation flow (`addMarginToNextVA` + `sendQuote`), still requiring `margin`, now additionally delegating the quote's `upnlSig` region to the solver via a `FlexField`.
  - **Rasa** — a single `sendQuote` operation signed for the sub-account (cross-margin, no virtual account, no `addMargin`), carrying a live Muon signature, posted to `/instant_trade/open` via the new `sendRasaInstantOpen`.

  `InstantOpenParameters` gains an optional `solverId` and makes `margin` optional (required by Enigma at runtime, ignored by Rasa). `InstantOpenReturnType` becomes a union discriminated on `kind` — `EnigmaInstantOpenResult | RasaInstantOpenResult`, the latter carrying the normalized `rfq`. Both are generic over the solver kind, so a literal `solverId` narrows them; `useInstantOpen` threads the same generic.

  **New in `@symmio/trading-react`**
  - `useSendQuoteUpnlSig` and `useForceClosePriceSig`, both mutations like the other Muon hooks.

  **Behavior changes**
  - `InstantOpenReturnType` now carries a required `kind` discriminant. Code that constructs or exhaustively destructures that value needs updating; code that only reads `success` / `tempQuoteId` / `partyBmm` is unaffected.
  - `getFakeSendQuoteMuonSignature` now emits a 32-byte zero `reqId` instead of `0x`, so the encoded `upnlSig` region is the size a solver's flex fill expects. This changes the bytes of the placeholder quote calldata (and therefore its EIP-712 struct hash) for lowcap opens.
  - `getDeallocateUpnlSig` now throws `MUON_SIG_MALFORMED` (was `MUON_UPNL_SIG_MALFORMED`) when the attestation is missing its Schnorr share, and `MUON_FIELD_MALFORMED` rather than a raw `TypeError` when `uPnl` is absent. Both now come from the shared envelope helper used by all three assemblers.

### Minor Changes

- d0e2a12: Add Binance USD-M Futures as a second price provider, behind a provider-agnostic mark-price facade.

  Majors trade against the Rasa solver, which has no mark-price feed of its own — no REST mark price, no mark-price WebSocket, no index price. Binance is the live price source, matching how the reference UI configures that solver. Until now the SDK shipped only the Enigma price service, and Base's `priceService` was a placeholder pointing majors markets at Enigma's _lowcap_ feed.

  **New public API**
  - `getMarkPrices(config, { chainId?, solverId?, names? })` (+ `getMarkPricesQueryKey` / `getMarkPricesQueryOptions`) — a one-shot snapshot from whichever provider serves the resolved solver.
  - `watchPrices(config, { …, onPrices })` — the provider-agnostic live feed, so a positions table or trade ticket never branches on provider.
  - `watchBinancePrices` / `parseBinancePriceFrame`, plus `getBinancePremiumIndex`, `getBinanceSymbolsInfo` and `getBinanceHealth` (+ their query factories) — the provider-specific twins, mirroring the existing Enigma price-service family. Each throws `UNSUPPORTED_BY_PRICE_SERVICE` when the resolved provider is not Binance. `getBinanceHealth` resolves `false` rather than throwing when the endpoint is unreachable, so a regional block reads as a health state instead of an error.
  - `MarkPriceTick`, a discriminated union on `provider` (`EnigmaMarkPriceTick | BinanceMarkPriceTick`), plus `NormalizedMarkPriceByProvider`. Read `name` / `markPrice` without narrowing; narrow to reach Binance's `indexPrice` and funding fields.
  - `SymmioSolverConfig.priceService?` — an optional per-solver override falling back to the chain-level price service, so one chain can host solvers that price differently.

  **New in `@symmio/trading-react`**

  The provider-agnostic mark-price hooks, each resolving whichever provider serves the target solver so a component never branches on provider:
  - `usePrices` (the live feed — returns both an ergonomic `prices` map and the full `ticks` map; narrow a tick on `provider` for Binance's `indexPrice`), `usePriceByName` / `usePriceByMarketId` (one market, with re-render gating), and `useMarkPrices` (the one-shot REST read).
  - `useBinancePrices` / `useBinanceHealth` / `useBinancePremiumIndex` / `useBinanceSymbolsInfo` — the Binance-specific twins, where every tick is a `BinanceMarkPriceTick` so `indexPrice` and the funding fields are reachable without narrowing. Each surfaces `UNSUPPORTED_BY_PRICE_SERVICE` when the target solver is not priced by Binance.

  Pass `names` on Binance: its stream pushes every listed symbol once per second, and the filter is what keeps that from churning the component tree. The Enigma-specific hooks (`useEnigmaPriceByMarketId`, …) now throw `UNSUPPORTED_BY_PRICE_SERVICE` on a chain whose provider is not Enigma, matching the core reads.

  **Behavior changes**
  1. `resolveMarkPrice` — and therefore `prepareInstantOpenParams` / `prepareInstantCloseParams` — now reads the price provider configured for the _resolved solver_ rather than always Enigma. A caller-supplied `markPrice` still short-circuits it, unchanged.
  2. `prepareInstantOpenParams` / `prepareInstantCloseParams` now forward `solverId` to every solver-scoped resolver **and carry it into their returned parameters**. Previously it was dropped, so a quote priced and sized for one solver was signed against the default solver's `partyB` (which is part of the signed EIP-712 payload) and submitted to that solver's URL. `resolveMarket` and `resolveLockedParams` gained a `solverId?` parameter for the same reason.
  3. Base's `priceService` changes from an Enigma placeholder to Binance. Anyone reading Base prices previously received Enigma's lowcap feed for majors symbols — i.e. wrong data. Base's `subgraphs` and `notifications` remain placeholders.
  4. `SymmioPriceServiceType` gains `"binance"`. Union widening is non-breaking for most consumers but will break an exhaustive `switch` over it or a `const t: "enigma" = …` annotation.
  5. `createConfig` now validates `priceService.type` on the chain block and on every solver-nested override, throwing `UNSUPPORTED_PRICE_SERVICE_TYPE`.
  6. `mergeChainConfig` can now throw `PRICE_SERVICE_OVERRIDE_INCOMPLETE` on a `priceService` override it previously accepted silently. A `type` swap must restate both URLs; inheriting the previous provider's endpoints would point one provider's client at another's host, which type-checks cleanly and 404s at runtime. Same-type partial overrides (the common `{ url, wsUrl }` staging shape) are unaffected.
  7. The five Enigma price-service reads and `watchEnigmaPrices` now throw `UNSUPPORTED_BY_PRICE_SERVICE` when the resolved provider is not Enigma. For the watcher this replaces a _silent_ failure: it would otherwise connect, parse every Binance frame to nothing, and report `open` while delivering zero ticks forever.
  8. `RESOLVE_MARK_PRICE_NOT_FOUND` keeps its code (the contract) but its message now names the provider, and hints when a `::`-suffixed lowcap name is sent to Binance.

  **Notes**

  Binance's WebSocket endpoint is configured as `wss://fstream.binance.com/market/ws/!markPrice@arr@1s`. Binance's _documented_ `/ws/<stream>` form was verified against the live endpoint to connect and then never push a frame, so using it would ship a silently dead feed. Both Binance URLs stay in config as the escape hatch for regional restrictions — repoint them at a proxy with no SDK change.

  Binance's `lastFundingRate` is exposed on the tick as `binanceLastFundingRate` but is **not** the funding a SYMMIO position is charged; `getFundingInfo` remains authoritative for that.

  The two Binance wire shapes are hand-written rather than generated: Binance publishes an official OpenAPI spec for SPOT only, and pointing Orval at a community futures spec would make an unaudited third-party repo a build input for types that reach a signed trade payload. See the `TODO(binance-openapi)` note in `orval.config.ts`.

- 8cddfc3: Add a candles slice — chart data decoupled from any chart library, with Binance as the first source.

  Consumers pick their own charting library, so the SDK's boundary is the data, not the widget. `CandleSource` is the whole contract: symbol metadata, historical bars for a range, and a live subscription. Everything else is written against that interface, never against a venue.

  `core` gains:
  - `CandleSource` / `Candle` / `CandleResolution` — the shared vocabulary, with bar times always in unix **milliseconds**, UTC.
  - `CandlePriceBasis` on every source (`reference-exchange` | `dex-pool` | `solver-mark`). A chart drawn from a reference exchange is not the price a SYMMIO trade settles at, so the SDK states which it is rather than leaving the UI to assume.
  - `createBinanceCandleSource` — USD-M futures by default (its symbols are perpetuals, matching what a SYMMIO market is), spot optional. History from `/klines`, live bars from the kline WebSocket, both reachable straight from a browser with no key or proxy. `exchangeInfo` is fetched once per source and cached to resolve price precision from the venue's own tick size.
  - `toTradingViewDatafeed` — adapts any source to TradingView's Charting Library. The datafeed contract is modeled **structurally**, so the returned object satisfies the library's `IBasicDataFeed` without the SDK depending on a licensed package that is not on npm.
  - `getCandlesQueryOptions` — TanStack options keyed by source id, so two venues never share a cache entry.

  `react` gains `@symmio/trading-react/candles`: `useBinanceCandleSource` (memoized, since a source caches `exchangeInfo`), `useCandles`, `useCandleStream` (handlers read through refs, so inline arrows do not re-dial the socket), and `useTradingViewDatafeed`.

  Three correctness details that a naive port of the usual datafeed gets wrong:
  - **Backfill pages backwards from `to`, sending `endTime` only.** Binance caps a bounded range from its _start_: passing `startTime`, `endTime` and `limit` together returns the OLDEST `limit` bars in the window, so a chart scrolling back receives the wrong end of the range. The `from` bound is applied client-side instead.
  - **Live frames are matched on symbol _and_ interval.** Matching on symbol alone lets two charts on different resolutions feed each other's series.
  - **A reconnect raises `onReset`**, wired to the library's `onResetCacheNeeded`, so a gap forces a history refetch rather than splicing a live bar onto a stale series. Requests are also capped at the real per-market maximum (1500 on futures, 1000 on spot), which is a hard `-1130` error rather than a silent clamp.

  Lowcap markets are deliberately out of scope here: their candles need a different source, and the price basis question there is unresolved.

- 1b9cc0a: Add grouped funding — read the settled funding of a merged position as one total and one merged timeline.

  `core` gains:
  - `aggregateGroupFunding` / `QuoteGroupFunding` — a pure fold of the per-quote `QuoteFundingData` rows into a single group total. De-duplicates by `quoteId`, skips optimistic children, tolerates over-fetched rows, and reports `isComplete` so a partially-indexed group reads as "funding unknown" rather than "no funding".
  - `getQuotesEventsByType` (plus `getQuotesEventsByTypeQueryKey` / `getQuotesEventsByTypeQueryOptions`) — the batched sibling of `getQuoteEventsByType`: many quote ids, one round-trip, rows already interleaved and sorted by `timestamp`, paged over the **merged** stream via `first` / `skip` and a `hasMore` flag. An omitted `first` asks for the 1000-row ceiling The Graph enforces, so an un-paged call returns everything one request can serve instead of a small default page.
  - `FUNDING_HISTORY_EVENT_TYPES` — the charge-event subset behind a funding timeline (`PRICE_HISTORY_EVENT_TYPES` minus `SETTLE_UPNL`).

  `react` gains `useQuoteGroupFunding` (the group total plus per-child rows aligned 1:1 with `group.quotes`) and `useQuoteGroupFundingHistory` (the merged, time-sorted per-tick timeline; every row carries its own `quoteId`, so a per-position breakdown is a client-side `groupBy`).

  **Sign convention** — `netReceived = received − paid` everywhere in this slice: a **positive** `netReceived` means the position **earned** funding, the P&L perspective trading venues present. It matches the polarity of `QuoteGroupUpnl.upnl`, so a card can colour and total funding and uPnL together, and it is the inverse of the cost-positive on-chain `int256`. A UI that colors "money in" green renders it as-is — the SDK nets it the way it is read, so no consumer negates.

  **Settled to date only** — every total and row covers funding the protocol has already charged and the analytics subgraph has indexed. Funding accrued since a quote's last funding charge is not indexed anywhere and is therefore not included.

  Two behavioural fixes ship alongside. Both can legitimately change numbers a consumer already renders:
  - **`getQuoteFunding` now pages internally.** The Graph silently caps an un-`first`-ed query at 100 entities, so any batch above that was truncated: the extras came back as `missingQuoteIds`, and a caller that ignored completeness showed a wrong total. Ids are now chunked at `QUOTES_FUNDING_MAX_IDS_PER_REQUEST` (1000, newly exported), issued concurrently, and merged; callers pass the full id list however long it is.
  - **`useQuotesFunding` no longer double-counts a repeated `quoteId`.** The sums fold over the distinct on-chain ids, and `netReceived` is derived as `received − paid` so the aggregate keeps the row-level invariant. `rows` is now aligned 1:1 with `quotes` on every path — including while loading and when no on-chain ids were requested — and `missingQuoteIds` reports every requested id while the query is in flight or has failed, instead of an empty list that read as "nothing missing".

- 1b9cc0a: Add margin & risk — read a merged position's margin, equity and distance to liquidation as one figure set.

  `core` gains a `margin` slice:
  - `calculateMarginRisk` / `MarginRiskMetrics` — a pure, **single-account** fold of `balanceInfoOfPartyA` plus the account's unrealized PnL into `totalMargin`, `maintenanceMargin` (`lockedCVA + lockedLF`), `initialMargin` (`+ lockedPartyAMM`), `equity`, `remainingToLiquidation`, `liquidationBufferPercent` and `isLiquidatable`. `isLiquidatable` is bit-for-bit the on-chain predicate `allocatedBalance − (cva + lf) + upnl < 0` (`LibAccount.partyAAvailableBalanceForLiquidation`, perps-core v0.8.5), so a UI never has to approximate it with a threshold on the buffer percent.
  - `aggregateGroupUpnl` / `QuoteGroupUpnl` — a pure bigint fold of a group's children into one signed unrealized-PnL total at the current mark price, with an `isComplete` flag so a group whose fill price has not settled reads as "PnL unknown" rather than "no PnL". Resting orders contribute nothing and are not counted as unvalued.
  - `decimalPriceToWei` — decimal price string to 18-decimal wei. Returns `undefined`, never `0n`, for an unparseable input: a fabricated `0n` mark price makes a uPnL fold report a −100% loss.

  `react` gains `useAccountMarginRisk` (one account) and `useQuoteGroupMarginRisk` (a `QuoteGroup`: resolves its Virtual Account, folds the group uPnL against a mark price you inject or it subscribes to, and returns the metrics alongside the account's liquidation price).

  **Margin risk is per liquidation domain and is never blended.** Each Virtual Account is liquidated on its own balance, so a group spanning several accounts reports `isMultiAccount: true` with `metrics: undefined` and exposes `accounts` — call `useAccountMarginRisk` per address. Summing balances across accounts would hide an account that is about to be liquidated behind a comfortable-looking average.

  `liquidationBufferPercent` is an 18-decimal fixed-point percent and is **not clamped**: it exceeds `100%` on a profitable book, goes negative once liquidatable, and is `undefined` when the zero-uPnL cushion is not positive. Clamp it at the render layer if you draw a bar.

  `sharePercent` moved from the TP/SL slice to shared utilities, and `triggerPriceToWei` now delegates to `decimalPriceToWei`. Both keep their exported name, signature and behaviour — no consumer change.

- 1b9cc0a: Add grouped TP/SL — read, plan, set and cancel take-profit / stop-loss orders across a merged position.

  A `QuoteGroup` is several on-chain quotes, and the conditional-order handler takes one signed request per quote. `core` gains a pure `tpsl/grouping` slice that folds those legs into one state and works out the smallest honest fan-out:
  - `toGroupTpSlChildren` / `summarizeQuoteGroupTpSl` / `toGroupTpSlOrders` — the cell and overview data model, with **notional-weighted** coverage rather than a count ratio.
  - `planGroupTpSl` — diffs a desired state against what the handler already holds, so an unchanged leg is never resubmitted and an unchanged side is dropped from its leg. Emits `set` / `delete` / `skip` per child with typed skip reasons and per-child validation.
  - `planGroupTpSlDelete` — the cancel-all plan, reading each `cohQuoteId` off the confirmed snapshot and excluding in-flight sides.
  - `estimateGroupTpSlReturn` — signed return if every staged trigger fires.

  `react` gains `useQuoteGroupTpSl` (one query per leg on the shared TP/SL key, one socket per distinct account), `useQuoteGroupTpSlEditor` (edit buffer, apply-to-all, live validation and plan), `useSetQuoteGroupTpSl` (sequential signed writes with per-leg progress and retry-failed-only) and `useDeleteQuoteGroupTpSl` (bounded-parallel cancels).

  `useSetQuoteGroupTpSl` executes **both** halves of the plan: a side the caller clears becomes a `deleteQuoteTpSl` cancel, a side with a new value becomes a `setQuoteTpSl` write, and one leg can do both in the same run. Steps carry a stable `id` and a `kind` (`"write" | "cancel" | "skip"`) because a leg can now produce several.

  Run reporting is stricter as a result:
  - `confirming` outranks `partial`, so a failure on one leg no longer makes the run terminal while another still awaits its handler report.
  - `acceptedCount` replaces the old `completedCount` and **excludes** failures; `failedCount` is reported alongside it.
  - A step is only confirmed by the transition it is actually waiting for — a _live_ report for a write, a _gone_ report for a cancel — so a shared socket cannot cross-confirm.
  - `retryFailed` merges onto the previous step list instead of replacing it, so successful legs keep their state.
  - A rejected wallet signature stops the run by default (`stopOnUserRejection`) rather than prompting for every remaining leg.

  Also fixes `useQuoteTpSl`, which returned a cast object whose `isLoading` / `isFetching` / `error` / `refetch` were `undefined` at runtime. It now returns those for real; the underlying query stays available as `query`.

  The React TP/SL hooks now refetch the handler's authoritative rows on a successful set or cancel (`invalidateTpSlReads`), so a box resolves out of `confirming` — and a cancelled side clears — even when the live WebSocket frame is missed. This applies to `useSetQuoteTpSl` / `useDeleteQuoteTpSl` and both grouped hooks.

  Grouped TP/SL run steps now resolve from the shared store (fed by every WebSocket subscription and the success refetch) rather than from each run hook's own subscription. A step no longer sticks on `confirming` when the handler's notification arrives on a channel that hook did not subscribe to.

- 04c4973: Add inventory TVL and solver-revenue reads — the analytics behind a pools / solver dashboard.

  **Inventory service** (`./inventory`) — the custody backend behind the lowcap Pools, a **separate vendor** from both the solver and the listing backend. `getInventoryTvl` reads the system-wide custodial TVL as a `bigint` at `INVENTORY_VALUE_DECIMALS` (18); `getInventoryTvlHistory` is its per-market twin, the TVL series behind one pool's chart (`InventoryTvlPoint`). `resolveInventoryService` returns the chain's configured backend and `supportsInventoryService` is its non-throwing boolean twin for gates.

  This TVL is deliberately **not** the sum of the pool catalogue's per-pool `tvl`: the catalogue covers listed markets, the inventory service covers the whole custodial system. Treat them as different numbers.

  **Solver revenue** — two reads off the chain's solver, Enigma-only:
  - `getSolverRevenue` — aggregate revenue totals, protocol-wide by default or for one market via `symbolId`, split into a hedger-fee share and a funding share whose sum is `totalRevenue` (`SolverRevenue`, `SolverRevenueTimeRange`).
  - `getRevenueRecords` — the itemized revenue rows behind that total (`SolverRevenueRecord`), for a table rather than a headline figure.

  `@symmio/trading-react` adds `useInventoryTvl` / `useInventoryTvlHistory`, `useSolverRevenue`, and `useRevenueRecords`, each a thin TanStack-Query wrapper over its core read with the resolved chain/solver threaded through.

- 04c4973: Add LIMIT orders, force-close, and force/request cancel — capability-gated writes for solvers that support resting orders and the on-chain escape hatches for stuck quotes.

  **Solver capabilities.** `getSolverCapabilities` reads a solver's declared feature flags into `SolverCapabilities`; `supportsLimitOrder` and `supportsGroupClose` are the boolean gates. Flags default to `false` — a solver must **declare** a capability to enable it — so a UI degrades gracefully instead of erroring against a solver that lacks the feature (Rasa/majors declare `limitOrder`; Enigma/lowcap declares `groupClose`).

  **LIMIT open / close.** `prepareLimitOpenParams` / `prepareLimitCloseParams` take the same inputs as their instant (market) twins, except the caller supplies an explicit resting **`price`** instead of a `markPrice` + `slippage` band. The order rests at exactly that price with **zero slippage** applied, and the request is tagged `orderType = LIMIT`, so the hedger writes a **pending** on-chain quote at that price rather than filling at mark. `limitOpenAuto` / `limitCloseAuto` are the prepare-then-submit one-call convenience actions.

  **Force-close.** When a solver stops answering close requests, `forceClosePosition` closes a quote directly on-chain against a Muon `priceRange` attestation (`HighLowPriceSig`, from `getForceClosePriceSig`), wrapped in the AccountLayer `_call` proxy. `checkForceCloseEligibility` / `findForceCloseWindow` / `previewForceClosePrice` / `getForceCloseParams` are the pure and read-side helpers that decide whether a force-close is allowed and at what price (`ForceCloseEligibility`, `ForceCloseIneligibleReason`, `ForceCloseWindow`); `forceCloseAuto` fetches the signature and submits in one call.

  **Force / request cancel.** The two-step cancel escape hatch for pending quotes, all routed through the `_call` proxy so the caller is the subaccount:
  - `requestToCancelQuote` → `forceCancelQuote` — cancel a pending open (e.g. a resting LIMIT order): request first, force it after the cooldown if the solver does not act.
  - `requestToCancelCloseRequest` → `forceCancelCloseRequest` — the same pair for a pending **close** request.

  `@symmio/trading-react` adds `useSolverCapabilities` / `useSupportsLimitOrder` / `useSupportsGroupClose`, `useLimitOpenAuto` / `useLimitCloseAuto` and `useLimitOrders` (the resting-order list), `useForceClose` / `useForceCloseEligibility` / `useForceCloseParams`, and `useForceCancelQuote` / `useRequestToCancelQuote` / `useForceCancelCloseRequest` / `useRequestToCancelCloseRequest`.

- 04c4973: Add an orderbook slice — market depth decoupled from any venue, with Binance as the first source.

  An `OrderbookSource` is the whole contract: symbol metadata, a depth snapshot, and a live subscription. Ladders, depth charts and price-impact estimates are all written against that interface, never against an exchange. As with candles, `priceBasis` states what the depth actually represents — a reference exchange's resting liquidity is **not** what a SYMMIO trade executes against.

  `createBinanceOrderbookSource` is the reference source for major markets. Its live book is **not** a stream of deltas applied on faith: it implements Binance's documented local-order-book procedure, verifies that every update chains onto the last, and rebuilds from a fresh snapshot the moment one does not — with `onResync` / `resyncReason` telling the consumer it happened, so a stale ladder can say so rather than drift silently. Depth limits, update speeds and the buffered-event cap are all exported constants.

  The pure helpers on top work on any source's book: `groupOrderbook` (onto a tick), `accumulateOrderbook` (cumulative depth), `getOrderbookSpread`, `walkOrderbook` / `getOrderbookDepthWithin` (fill-walking for impact), plus tick utilities (`roundToTick`, `countTickDecimals`, `suggestOrderbookTickSizes`). `getOrderbookQueryOptions` keys a one-off snapshot by source id so two venues never share a cache entry.

  `@symmio/trading-react` adds `useBinanceOrderbookSource` (a stable memoized source), `useLiveOrderbook` (the one most ladders want — a synchronized book, grouped onto a tick, with cumulative depth and spread already derived, exposing `isResyncing` / `resyncReason`), `useOrderbookStream` (the raw synchronized book for custom aggregation), and `useOrderbook` (a snapshot through TanStack Query). Import the value types (`Orderbook`, `OrderbookLevel`, `OrderbookSource`) from `@symmio/trading-core`.

- 04c4973: Add the lowcap **Pools** data layer — the whole listing-backend flow behind a pools page: catalogue, authentication, per-LP market config, pool detail, rewards, claims, LP withdrawals, and market listing/refund/retry.

  Pools are the lowcap side of SYMMIO served by a per-chain **listing backend** ({@link SymmioListingConfig}), a separate vendor from the solver and the subgraph. Listing is resolved **at chain level**: `resolveListingService` returns the chain's backend (throwing `LISTING_NOT_CONFIGURED` where a chain has none), and `supportsListingService` is its non-throwing boolean twin for `enabled` gates. Enigma-only.

  **Money is always 18-decimal `bigint`.** Every money and rate field on a pool row is a `bigint` at `LISTING_VALUE_DECIMALS` (18) — `1e18` is `$1` — independent of the collateral token's own decimals. A `null` means the backend reported no value; it never collapses to `0`. `parseListingValue` / `toListingValue` are the descaling helpers. APR/APY fields descale to a percentage instead; the reward series are money.

  **Catalogue (`getListingMarkets`)** — search, filter, sort and pagination are all **server-side**, so every parameter change is a fresh request rather than a re-view of an already-fetched page (`ListingMarketFilters`, `ListingMarketSortField`, `ListingSortDirection`, `ListingValueRange`, `ListingTimeRange`). `getUserListingMarkets` is its authed, caller-scoped twin — the signed-in user's own pools across every `ListingMarketStatus`, so a UI filters by status client-side rather than refetching.

  **Authentication (`authenticateListing`)** — SIWE. `getListingSignInMessage` builds the message to sign (`ListingSiweParams` / `ListingSignInMessage`); `authenticateListing` exchanges the signature for a bearer `ListingAuthToken`. Every authed read/write below takes that token.

  **Per-LP market config** — a pool's max leverage and buyback percentage are **not** set by any one LP. Each depositor submits an _opinion_ with `updateListingMarketConfig`, and the backend folds them into a deposit-weighted average, so a call **nudges** the pool rather than overwriting it. `getListingMarketConfig` reads the caller's own opinion back (`null` until they have ever set one) alongside the values in force; `projectListingMarketConfig` estimates where the pool lands **before** the write, from the pool detail plus the caller's stake. Both knobs are plain whole numbers (`LISTING_MARKET_CONFIG_BOUNDS`) — `50` is 50%, `20` is 20× — **not** 18-decimal. The write is authed, requires a deposit address on the market (minted by default), and is rate-limited to `getListingConfig().rateLimits.marketConfigUpdatesPerDay` per market in a rolling 24h window.

  **Pool detail** — the tables on a pool page, spanning three backends: `getListingMarketDetail` (listing backend — aggregate stats + inventory; `toPoolPositions` folds it into positions rows with no extra request), `getPoolQuotes` / `getPoolTradeHistory` (analytics subgraph — the pool's **whole** book and realized history, carrying **no** `partyA` filter, unlike the account-scoped quote reads), and `getPoolTransactions` (listing backend — deposits and withdrawals). A pool's resting limit orders are deliberately not here: they come from the TP/SL handler via `searchTpSlOrders({ symbolId, conditionalOrderType: "send_quote" })`.

  **Rewards** — `getPoolRewardChart` / `getPoolTotalReward` are **public**, one pool, addressed by `(marketAddress, marketChainId)`, where `marketChainId` is the chain the pool's token lives on (`ListingMarket.chainId`), not the SDK's own `chainId`. `getUserRewardChart` / `getUserTotalReward` are **authed** and cover every market the user has rewards in, so a single-pool view filters the series itself. Rewards are money (18-decimal), built from **earned** daily snapshots, so claiming does not reduce them — `getUserProfit` holds the claimable balance.

  **Money movements** — `getUserProfit` + `getDepositAddress`; `claimProfit` (+ `getClaimHistory`), `withdrawLp` and `cancelWithdraw`; `addMarket` to list a new market, and `refundMarket` / `retryListing` (+ `getRetryListingInfo`) for a rejected listing. `getWeeklyListingLimit` reports the remaining new-listing allowance. `getUserTransactions` is the account-wide, authed transaction history (deposits, withdrawals, claims) across every pool.

  `@symmio/trading-react` adds one hook per read and write above — `useListingMarkets`, `useUserListingMarkets`, `useAuthenticateListing`, `useListingConfig`, `useListingMarketConfig` / `useListingMarketConfigProjection` / `useUpdateListingMarketConfig`, `useListingMarketDetail`, `usePoolQuotes` / `usePoolTradeHistory` / `usePoolTransactions`, `usePoolRewardChart` / `usePoolTotalReward` / `useUserRewardChart` / `useUserTotalReward`, `useUserProfit` / `useDepositAddress`, `useClaimProfit` / `useClaimHistory`, `useWithdrawLp` / `useCancelWithdraw`, `useAddMarket` / `useRefundMarket` / `useRetryListing` / `useRetryListingInfo`, `useWeeklyListingLimit`, `useUserTransactions`, `useListingStatus`, and `useSupportsListingService` for gating. The write hooks invalidate the reads their effect changes (a claim/withdraw refreshes profit, balances and `useUserTransactions`), so a panel settles without a manual refetch.

  **Out of scope**: the pool candle/orderbook charts (see the candles and orderbook slices) and the on-chain deposit/allocate transaction itself (that is the existing account-layer flow) — this slice is the listing backend's own reads and writes.

- 306228e: Confirm grouped TP/SL from the handler when the WebSocket report never arrives.

  **Fixes a false confirmation.** A pending write used to be settled by any
  snapshot that listed the side — including a _stale_ one. Editing a take-profit
  from 150 to 160 and refetching before the handler caught up reported the edit as
  confirmed and rendered 150 as though it were live. A write is now settled only
  by evidence of the order that was actually submitted: a matching `coh_quote_id`,
  or a matching trigger price and price type. Confirmations that seeded neither
  behave as before. This closes the same hole on the existing per-quote read,
  where a window-focus refetch could trigger it, and it flips the expectation of
  one store test.

  **Adds the fallback sweep.** New `searchTpSlOrders` in core wraps
  `POST /api/v5/search/`, returning `{ orders, count, isComplete }` for one
  account. The WebSocket report keeps the first `fallbackPollDelayMs` (default
  30s) to itself; only if none arrives does the run start reading the handler
  directly, every `fallbackPollIntervalMs` (default 2s, `0` disables), confirming
  from whichever signal lands first. In the normal case the report resolves the
  wait long before the delay elapses and no sweep request is ever sent.

  Once running it costs one request per Virtual Account per tick — never one per
  leg — shared between concurrent runs on the same account, single-flight, with
  exponential backoff on handler errors. The sweep is owned by the wait rather
  than by a component, so closing the modal mid-run does not silence it.

  Two rules keep an account-wide page from doing damage:
  - **Absence only counts on a complete page.** `isComplete` is derived from
    `orders.length < size` rather than from `count`, whose meaning on this
    endpoint is unverified. A truncated response contributes positive rows only,
    so a live order can never be reported as cancelled.
  - **A cancel confirms on its own `coh_quote_id` disappearing**, not on an empty
    result — which also means a row the store has not yet linked to a quote cannot
    masquerade as one.

  Supporting changes: `setRowsForSides(id, rows, sides)` folds a snapshot over
  named sides without the `quote_id` aliasing (an account-wide page handed to
  `setRows` would fuse two legs of a group into one record); `clearConfirming`
  gains a sibling on the store's public surface; and a no-op commit is now skipped
  entirely, so a 2s sweep does not wake every waiter and re-render every TP/SL cell
  on each tick that merely confirmed the status quo.

  `DEFAULT_TPSL_CONFIRMATION_TIMEOUT_MS` rises from 45s to 60s so it covers both
  halves of the wait: 30s belonging to the report, then roughly fifteen sweeps.
  `TPSL_CONFIRMING_GUARD_MS` rises to 90s to stay clear of it, so a grouped run
  always reaches its own deadline and releases the store guard itself rather than
  having the guard expire underneath it.

- 04c4973: Add a one-call withdraw flow — deallocate and initiate a withdrawal in a single action, with the cross-margin path handled for the caller.

  `deallocateAndInitiateWithdraw` batches the `deallocate` and `initiateWithdraw` legs through the AccountLayer `_call` proxy so both are attributed to the subaccount (the connected wallet must be its on-chain `owner`). The `deallocate` leg needs a fresh, short-lived Muon `uPnl_A` attestation to prove the subaccount stays solvent; the action fetches one immediately before submitting (via `getDeallocateUpnlSig`) unless the caller passes a `upnlSig` to reuse. Its `amount` is in **18 decimals**; `parts` are the withdraw receiver parts (a plain same-chain withdrawal is a single `createClassicWithdrawPart`). `simulateDeallocateAndInitiateWithdraw` is its dry-run twin.

  `withdrawAuto` is the convenience entry point: it takes an `amount` in the **collateral token's own decimals** and a `receiver`, resolves the subaccount's isolation type, and picks the right path — a plain `withdraw` when the balance is already available, or the deallocate-and-initiate path for cross-margin (`CUSTOM`) accounts, scaling the amount to the 18-decimal figure the `deallocate` leg needs. `withdraw` is the underlying base write. All three carry the `speedUp` cooldown opt-in and opaque `providerData` for express/virtual providers.

  `@symmio/trading-react` adds `useWithdraw` (over `withdrawAuto`) and `useDeallocateAndInitiateWithdraw` (over the explicit batched action), so a UI can offer either the one-input convenience or the fully-specified flow.

## 1.1.0

### Minor Changes

- 15588f6: Add the affiliate registration API.

  `@symmio/trading-core` gains account-layer actions `requestToRegisterAffiliate`, `cancelRegistration`, `getAffiliateState`, and `generateAccountManagerAddress`, together with their `simulate*` variants, query option factories, and types. `@symmio/trading-react` wraps them as `useRequestToRegisterAffiliate`, `useCancelRegistration`, `useAffiliateState`, and `useGeneratedAccountManagerAddress`.

  Also clarifies the affiliate config contract: `createConfig` still throws `AFFILIATE_ADDRESS_REQUIRED` only when `affiliatesAddress` is missing, and the error message and JSDoc now spell out that the zero address is a valid no-affiliate placeholder (trades open, no fee share). Deposit docs now state that the instant flow funds via `deposit` alone (available balance), while `depositAndAllocate` targets the classic pool.

- 15588f6: @symmio/trading-core

  New account - layer API for registering an affiliate on - chain:
  - requestToRegisterAffiliate — submit registration request(creates PENDING affiliate)
    - cancelRegistration — cancel a pending registration
      - getAffiliateState — read affiliate status(PENDING / ACTIVE / …)
        - generateAccountManagerAddress — derive account - manager address
          - simulate \* variants for each write, query - option factories, and types — all exported from the package barrel

  Doc / error improvements(no behavior change):
  - AFFILIATE_ADDRESS_REQUIRED message rewritten — states zero address is valid no - affiliate placeholder(trades open, no
    fee share) and links registration page - depositForAccount JSDoc — instant flow funds via deposit alone(available balance); depositAndAllocateForAccount is
    classic - pool only

  @symmio/trading-react

      - New hooks wrapping the above: useRequestToRegisterAffiliate, useCancelRegistration, useAffiliateState,
          useGeneratedAccountManagerAddress
          - useDepositAndAllocate JSDoc clarified: allocates to classic pool; instant flow uses useDeposit alone
              - New hook tests: error - codes, locked - params, notional - cap(internal, no API change)

## 1.0.1

### Patch Changes

- 1549a40: Accept the zero address as an affiliate in `createConfig`.

  `createConfig` no longer rejects `addresses.affiliatesAddress === zeroAddress`; it now enforces only that the field is **present** for every supported chain. The zero address is on-chain's **no-affiliate sentinel** — the trade still opens, you just receive no share of the trading fee — so it is a valid (if attribution-free) value and a useful testing placeholder. What actually reverts on-chain is a non-zero **unregistered** affiliate (`PartyAFacet: Invalid affiliate`), which `createConfig` cannot detect. `AFFILIATE_ADDRESS_REQUIRED` still throws when the field is missing entirely, so a trade can never silently fall back to the SDK's built-in default affiliate and lose attribution. Use a **registered** affiliate to earn your fee share.

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

### Patch Changes

- Updated dependencies [ee1ad05]
  - @symmio/utils@1.0.0

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
